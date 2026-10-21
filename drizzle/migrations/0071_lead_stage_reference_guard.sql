CREATE OR REPLACE FUNCTION public.lead_board_stage_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN
IF OLD.kind='lead' THEN
IF TG_OP='DELETE' THEN
IF OLD.board_initial OR OLD.board_closed THEN RAISE EXCEPTION 'The initial and Deal Closed stages cannot be deleted'; END IF;
IF EXISTS(SELECT 1 FROM public.leads WHERE stage_id=OLD.id) OR EXISTS(SELECT 1 FROM public.deals WHERE stage_id=OLD.id) OR EXISTS(SELECT 1 FROM public.automation_workflows WHERE conditions::text LIKE '%'||OLD.id::text||'%' OR conditions::text LIKE '%'||OLD.name||'%' OR actions::text LIKE '%'||OLD.id::text||'%') THEN RAISE EXCEPTION 'Stage is in use; keep it to preserve history'; END IF;
RETURN OLD;
END IF;
IF OLD.board_initial AND (NOT NEW.is_active OR NEW.position<>0 OR NOT NEW.board_initial) THEN RAISE EXCEPTION 'The initial stage must remain active and first'; END IF;
IF OLD.board_closed AND (NOT NEW.is_active OR NOT NEW.board_closed) THEN RAISE EXCEPTION 'Deal Closed must remain active'; END IF;
END IF; RETURN NEW; END $$;