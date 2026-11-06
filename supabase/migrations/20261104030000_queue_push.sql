-- Requires deployment of queue-push Edge Function and a scheduler (see PUSH_SETUP_AR.md).
-- The subscription endpoint is a secret: do not expose it in public read policies.
BEGIN;
CREATE TABLE IF NOT EXISTS public.queue_push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id uuid NOT NULL REFERENCES public.appointments(id) ON DELETE CASCADE,
  endpoint text NOT NULL,
  p256dh text NOT NULL,
  auth_secret text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(appointment_id, endpoint)
);
ALTER TABLE public.queue_push_subscriptions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.queue_push_subscriptions FROM anon, authenticated;

CREATE TABLE IF NOT EXISTS public.queue_push_outbox (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  doctor_id uuid NOT NULL REFERENCES public.doctors(id),
  queue_date date NOT NULL,
  queue_number integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz
);
ALTER TABLE public.queue_push_outbox ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.queue_push_outbox FROM anon, authenticated;

-- Save subscription with the same high-entropy tracking token used by the patient.
CREATE OR REPLACE FUNCTION public.save_queue_push_subscription(p_token text, p_endpoint text, p_p256dh text, p_auth text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_id uuid;
BEGIN
  IF p_token IS NULL OR p_token !~ '^[a-f0-9]{64}$' OR length(p_endpoint) NOT BETWEEN 30 AND 2048
     OR p_endpoint !~ '^https://' OR length(p_p256dh) NOT BETWEEN 30 AND 512
     OR length(p_auth) NOT BETWEEN 8 AND 512 THEN RAISE EXCEPTION 'INVALID_SUBSCRIPTION'; END IF;
  SELECT l.appointment_id INTO v_id FROM public.appointment_tracking_links l
  JOIN public.appointments a ON a.id=l.appointment_id
  WHERE l.token_hash=encode(sha256(convert_to(p_token,'UTF8')),'hex')
    AND l.expires_at>now() AND a.status='booked';
  IF v_id IS NULL THEN RAISE EXCEPTION 'INVALID_TRACKING_LINK'; END IF;
  INSERT INTO public.queue_push_subscriptions(appointment_id,endpoint,p256dh,auth_secret)
  VALUES(v_id,p_endpoint,p_p256dh,p_auth)
  ON CONFLICT(appointment_id,endpoint) DO UPDATE SET p256dh=excluded.p256dh,auth_secret=excluded.auth_secret;
END $$;
REVOKE ALL ON FUNCTION public.save_queue_push_subscription(text,text,text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.save_queue_push_subscription(text,text,text,text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.enqueue_queue_push()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NEW.status='completed' AND OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO public.queue_push_outbox(doctor_id,queue_date,queue_number)
    VALUES(NEW.doctor_id,NEW.queue_date,NEW.queue_number);
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_enqueue_queue_push ON public.clinic_queue;
CREATE TRIGGER trg_enqueue_queue_push AFTER UPDATE OF status ON public.clinic_queue
FOR EACH ROW EXECUTE FUNCTION public.enqueue_queue_push();
REVOKE ALL ON FUNCTION public.enqueue_queue_push() FROM PUBLIC,anon,authenticated;
COMMIT;
