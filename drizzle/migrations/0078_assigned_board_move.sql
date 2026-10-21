ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS board_moved_at timestamptz;
CREATE OR REPLACE FUNCTION public.lead_assigned_board_move(_id uuid, _updated_at timestamptz, _stage uuid, _outcome text DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE l public.leads;
BEGIN
SELECT * INTO l FROM public.leads WHERE id=_id FOR UPDATE;
IF NOT FOUND OR auth.uid() IS NULL OR l.assigned_to IS DISTINCT FROM auth.uid() OR NOT coalesce(public.lead_workspace_active(),false) THEN RAISE EXCEPTION 'Lead access denied'; END IF;
PERFORM public.lead_board_move(_id,_updated_at,_stage,_outcome);
UPDATE public.leads SET board_moved_at=coalesce(board_moved_at,now()) WHERE id=_id;
RETURN _id;
END $$;
REVOKE ALL ON FUNCTION public.lead_assigned_board_move(uuid,timestamptz,uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.lead_assigned_board_move(uuid,timestamptz,uuid,text) TO authenticated;