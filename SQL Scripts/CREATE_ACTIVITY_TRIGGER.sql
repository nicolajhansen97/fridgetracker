-- Create trigger function to automatically log all fridge item activities
-- Captures INSERT (created), UPDATE (updated), and DELETE (deleted) actions

CREATE OR REPLACE FUNCTION public.log_fridge_item_activity()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
    change_data JSONB;
BEGIN
    IF (TG_OP = 'DELETE') THEN
        -- Log deletion
        INSERT INTO public.activity_log (
            household_id, item_id, user_id, action, item_name, item_drawer, changes
        ) VALUES (
            OLD.household_id,
            OLD.id,
            auth.uid(),
            'deleted',
            OLD.name,
            OLD.drawer,
            jsonb_build_object(
                'quantity', OLD.quantity,
                'expiry_date', OLD.expiry_date,
                'position', OLD.position,
                'notes', OLD.notes
            )
        );
        RETURN OLD;

    ELSIF (TG_OP = 'UPDATE') THEN
        -- Build changes object (only changed fields)
        change_data := '{}'::jsonb;

        IF OLD.name IS DISTINCT FROM NEW.name THEN
            change_data := change_data || jsonb_build_object('name', jsonb_build_object('old', OLD.name, 'new', NEW.name));
        END IF;

        IF OLD.drawer IS DISTINCT FROM NEW.drawer THEN
            change_data := change_data || jsonb_build_object('drawer', jsonb_build_object('old', OLD.drawer, 'new', NEW.drawer));
        END IF;

        IF OLD.quantity IS DISTINCT FROM NEW.quantity THEN
            change_data := change_data || jsonb_build_object('quantity', jsonb_build_object('old', OLD.quantity, 'new', NEW.quantity));
        END IF;

        IF OLD.expiry_date IS DISTINCT FROM NEW.expiry_date THEN
            change_data := change_data || jsonb_build_object('expiry_date', jsonb_build_object('old', OLD.expiry_date, 'new', NEW.expiry_date));
        END IF;

        IF OLD.position IS DISTINCT FROM NEW.position THEN
            change_data := change_data || jsonb_build_object('position', jsonb_build_object('old', OLD.position, 'new', NEW.position));
        END IF;

        IF OLD.notes IS DISTINCT FROM NEW.notes THEN
            change_data := change_data || jsonb_build_object('notes', jsonb_build_object('old', OLD.notes, 'new', NEW.notes));
        END IF;

        -- Only log if something actually changed
        IF change_data != '{}'::jsonb THEN
            INSERT INTO public.activity_log (
                household_id, item_id, user_id, action, item_name, item_drawer, changes
            ) VALUES (
                NEW.household_id,
                NEW.id,
                auth.uid(),
                'updated',
                NEW.name,
                NEW.drawer,
                change_data
            );
        END IF;

        RETURN NEW;

    ELSIF (TG_OP = 'INSERT') THEN
        -- Log creation
        INSERT INTO public.activity_log (
            household_id, item_id, user_id, action, item_name, item_drawer, changes
        ) VALUES (
            NEW.household_id,
            NEW.id,
            auth.uid(),
            'created',
            NEW.name,
            NEW.drawer,
            jsonb_build_object(
                'quantity', NEW.quantity,
                'expiry_date', NEW.expiry_date,
                'position', NEW.position,
                'notes', NEW.notes
            )
        );
        RETURN NEW;
    END IF;

    RETURN NULL;
END;
$$;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS trigger_log_fridge_item_activity ON public.fridge_items;

-- Create trigger that fires on INSERT, UPDATE, DELETE
CREATE TRIGGER trigger_log_fridge_item_activity
    AFTER INSERT OR UPDATE OR DELETE ON public.fridge_items
    FOR EACH ROW
    EXECUTE FUNCTION public.log_fridge_item_activity();

-- Note: This trigger automatically captures all changes
-- No manual logging needed in application code
