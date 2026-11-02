/*
 * دَوْرك V11 — private patient follow-up link, no account needed to view.
 * APPLY ONCE, after V9 / V10. Do not rerun previous migrations.
 * The patient receives a 256-bit opaque link capability. Only the hash is stored.
 * Never place names/phones/credentials in the tracking URL or result.
 * A public request without this secret cannot retrieve a booking.
 */
BEGIN;

CREATE TABLE IF NOT EXISTS public.appointment_tracking_links (
  appointment_id uuid PRIMARY KEY REFERENCES public.appointments(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE CHECK (token_hash ~ '^[a-f0-9]{64}$'),
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.appointment_tracking_links ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.appointment_tracking_links FROM PUBLIC, anon, authenticated;
-- There are deliberately NO RLS policies on this table; access is only via checked RPCs.

ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS status_updated_at timestamptz NOT NULL DEFAULT now();

CREATE OR REPLACE FUNCTION public.touch_appointment_status_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    NEW.status_updated_at := now();
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_touch_appointment_status ON public.appointments;
CREATE TRIGGER trg_touch_appointment_status
  BEFORE UPDATE OF status ON public.appointments
  FOR EACH ROW EXECUTE FUNCTION public.touch_appointment_status_updated_at();
REVOKE EXECUTE ON FUNCTION public.touch_appointment_status_updated_at() FROM PUBLIC, anon, authenticated;

-- Called immediately after a successful booking, or by its owner in "حجوزاتي".
-- Calling it again invalidates any previous tracking link for that appointment.
CREATE OR REPLACE FUNCTION public.create_appointment_tracking_link(p_appointment_id uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_slot timestamptz;
  v_secret text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED'; END IF;

  SELECT a.slot_start INTO v_slot
  FROM public.appointments a
  WHERE a.id = p_appointment_id AND a.patient_id = auth.uid();

  IF NOT FOUND THEN RAISE EXCEPTION 'NOT_ALLOWED'; END IF;

  -- Two independent UUIDv4 values = 244 bits of cryptographic randomness.
  v_secret := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
  INSERT INTO public.appointment_tracking_links(appointment_id, token_hash, expires_at)
  VALUES (
    p_appointment_id,
    encode(sha256(convert_to(v_secret, 'UTF8')), 'hex'),
    greatest(v_slot + interval '30 days', now() + interval '14 days')
  )
  ON CONFLICT(appointment_id) DO UPDATE
    SET token_hash = EXCLUDED.token_hash, expires_at = EXCLUDED.expires_at, created_at = now();

  RETURN v_secret;
END;
$$;

-- Token-only read; no user ID required, so a patient can reopen it on any device.
-- Public result intentionally omits patient name, number and any other PII.
CREATE OR REPLACE FUNCTION public.get_appointment_tracking(p_token text)
RETURNS TABLE(
  doctor_name text,
  doctor_slug text,
  clinic_name text,
  clinic_address text,
  slot_start timestamptz,
  appointment_status text,
  queue_number integer,
  current_number integer,
  patients_ahead integer,
  queue_status text,
  updated_at timestamptz
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_appt public.appointments%ROWTYPE;
  v_queue public.clinic_queue%ROWTYPE;
BEGIN
  -- Reject invalid tokens before hashing or doing any database lookup.
  IF p_token IS NULL OR p_token !~ '^[a-f0-9]{64}$' THEN RETURN; END IF;

  SELECT a.* INTO v_appt
  FROM public.appointment_tracking_links l
  JOIN public.appointments a ON a.id = l.appointment_id
  WHERE l.token_hash = encode(sha256(convert_to(p_token, 'UTF8')), 'hex')
    AND l.expires_at > now();
  IF NOT FOUND THEN RETURN; END IF;

  SELECT q.* INTO v_queue FROM public.clinic_queue q
    WHERE q.appointment_id = v_appt.id;

  RETURN QUERY
  SELECT
    d.full_name, d.slug, d.clinic_name, d.clinic_address,
    v_appt.slot_start, v_appt.status,
    v_queue.queue_number,
    CASE WHEN v_queue.id IS NULL THEN NULL::integer ELSE
      COALESCE(
        (SELECT q.queue_number FROM public.clinic_queue q
         WHERE q.doctor_id = v_queue.doctor_id AND q.queue_date = v_queue.queue_date
           AND q.status = 'in_progress' ORDER BY q.queue_number LIMIT 1),
        (SELECT MAX(q.queue_number) FROM public.clinic_queue q
         WHERE q.doctor_id = v_queue.doctor_id AND q.queue_date = v_queue.queue_date
           AND q.status = 'completed'),
        0
      )::integer END,
    CASE WHEN v_queue.id IS NULL THEN NULL::integer ELSE
      (SELECT COUNT(*)::integer FROM public.clinic_queue q
       WHERE q.doctor_id = v_queue.doctor_id AND q.queue_date = v_queue.queue_date
         AND q.queue_number < v_queue.queue_number AND q.status IN ('waiting', 'in_progress')) END,
    v_queue.status,
    GREATEST(v_appt.status_updated_at, COALESCE(v_queue.updated_at, v_appt.created_at))
  FROM public.doctors d WHERE d.id = v_appt.doctor_id;
END;
$$;

-- Keep queue status synchronized when doctor uses "تم الكشف", "لم يحضر", "إلغاء"
-- directly on the booking instead of the queue card.
CREATE OR REPLACE FUNCTION public.sync_queue_on_appointment_status_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NEW.status = 'completed' AND NEW.status IS DISTINCT FROM OLD.status THEN
    UPDATE public.clinic_queue SET status = 'completed', updated_at = now()
      WHERE appointment_id = NEW.id AND status IN ('waiting','in_progress');
  ELSIF NEW.status IN ('no_show', 'cancelled') AND NEW.status IS DISTINCT FROM OLD.status THEN
    UPDATE public.clinic_queue SET status = 'no_show', updated_at = now()
      WHERE appointment_id = NEW.id AND status IN ('waiting','in_progress');
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_sync_queue_status ON public.appointments;
CREATE TRIGGER trg_sync_queue_status
  AFTER UPDATE OF status ON public.appointments
  FOR EACH ROW EXECUTE FUNCTION public.sync_queue_on_appointment_status_change();
REVOKE EXECUTE ON FUNCTION public.sync_queue_on_appointment_status_change() FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.create_appointment_tracking_link(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_appointment_tracking_link(uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.get_appointment_tracking(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_appointment_tracking(text) TO anon, authenticated;

COMMIT;
