-- Safe additive queue corrections. Review on a staging database first.
BEGIN;
-- The existing queue schema supports no_show, but not cancelled.
-- Keep the queue row/number for audit, while excluding it from waiting counts.
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
REVOKE ALL ON FUNCTION public.sync_queue_on_appointment_status_change() FROM PUBLIC, anon, authenticated;
-- Do not renumber other patients after cancellation: their assigned number is permanent.
COMMIT;
