ALTER TABLE public.sales_proposals ALTER COLUMN company_id DROP NOT NULL;
ALTER TABLE public.sales_proposals ADD COLUMN IF NOT EXISTS created_by_name text NOT NULL DEFAULT '', ADD COLUMN IF NOT EXISTS created_by_email text NOT NULL DEFAULT '';
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS created_by_name text NOT NULL DEFAULT '', ADD COLUMN IF NOT EXISTS created_by_email text NOT NULL DEFAULT '';

CREATE OR REPLACE FUNCTION public.commercial_creator_snapshot() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF TG_OP='UPDATE' THEN NEW.created_by:=OLD.created_by; NEW.created_by_name:=OLD.created_by_name; NEW.created_by_email:=OLD.created_by_email; RETURN NEW; END IF;
  SELECT coalesce(nullif(trim(p.full_name),''),p.display_name,''), coalesce(p.email,'') INTO NEW.created_by_name, NEW.created_by_email FROM public.profiles p WHERE p.id=NEW.created_by;
  NEW.created_by_name:=coalesce(NEW.created_by_name,''); NEW.created_by_email:=coalesce(NEW.created_by_email,'');
  RETURN NEW;
END $$;
CREATE TRIGGER invoices_creator_snapshot BEFORE INSERT OR UPDATE ON public.invoices FOR EACH ROW EXECUTE FUNCTION public.commercial_creator_snapshot();
CREATE TRIGGER proposals_creator_snapshot BEFORE INSERT OR UPDATE ON public.sales_proposals FOR EACH ROW EXECUTE FUNCTION public.commercial_creator_snapshot();
ALTER TABLE public.invoices DISABLE TRIGGER invoices_creator_snapshot;
UPDATE public.invoices i SET created_by_name=coalesce(nullif(trim(p.full_name),''),p.display_name,''), created_by_email=coalesce(p.email,'') FROM public.profiles p WHERE p.id=i.created_by;
ALTER TABLE public.invoices ENABLE TRIGGER invoices_creator_snapshot;
ALTER TABLE public.sales_proposals DISABLE TRIGGER proposals_creator_snapshot;
UPDATE public.sales_proposals s SET created_by_name=coalesce(nullif(trim(p.full_name),''),p.display_name,''), created_by_email=coalesce(p.email,'') FROM public.profiles p WHERE p.id=s.created_by;
ALTER TABLE public.sales_proposals ENABLE TRIGGER proposals_creator_snapshot;

CREATE OR REPLACE FUNCTION public.user_personal_commercial() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
 SELECT auth.uid() IS NOT NULL AND EXISTS(SELECT 1 FROM public.profiles WHERE id=auth.uid() AND account_status<>'blocked') $$;
GRANT EXECUTE ON FUNCTION public.user_personal_commercial() TO authenticated;

CREATE POLICY "Own personal invoices" ON public.invoices FOR SELECT TO authenticated USING (company_id IS NULL AND created_by=auth.uid() AND public.user_personal_commercial());
CREATE POLICY "Own personal proposals" ON public.sales_proposals FOR SELECT TO authenticated USING (company_id IS NULL AND created_by=auth.uid() AND public.user_personal_commercial());
CREATE POLICY "Sales admin proposals" ON public.sales_proposals FOR SELECT TO authenticated USING (public.can_manage_sales());
CREATE POLICY "Own personal sales customers" ON public.sales_customers FOR SELECT TO authenticated USING (lead_id IS NULL AND created_by=auth.uid() AND public.user_personal_commercial());
CREATE POLICY "Own personal invoice audit" ON public.financial_audit_logs FOR SELECT TO authenticated USING (entity_type='invoice' AND EXISTS(SELECT 1 FROM public.invoices i WHERE i.id=financial_audit_logs.entity_id AND i.company_id IS NULL AND i.created_by=auth.uid()));

CREATE OR REPLACE FUNCTION public.user_proposal_action(_action text, _payload jsonb) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$ DECLARE p public.sales_proposals;pid uuid;cid uuid;lid uuid;cust uuid;did uuid;calc jsonb;doc jsonb;st text;personal boolean;BEGIN
IF _payload->>'id' IS NOT NULL THEN SELECT * INTO p FROM public.sales_proposals WHERE id=(_payload->>'id')::uuid FOR UPDATE;IF NOT FOUND THEN RAISE EXCEPTION 'Proposal access denied';END IF;pid:=p.id;personal:=p.company_id IS NULL;
ELSE personal:=nullif(_payload->>'company_id','') IS NULL;END IF;
IF personal THEN
 IF NOT public.user_personal_commercial() OR (pid IS NOT NULL AND p.created_by<>auth.uid()) THEN RAISE EXCEPTION 'Proposal access denied';END IF;
ELSE
 IF NOT public.user_commercial_allowed('proposal.view') THEN RAISE EXCEPTION 'Proposal access required';END IF;
 IF pid IS NOT NULL AND (NOT public.user_commercial_company(p.company_id) OR (p.created_by<>auth.uid() AND NOT public.has_role(auth.uid(),'super_admin'))) THEN RAISE EXCEPTION 'Proposal access denied';END IF;
END IF;
IF pid IS NOT NULL AND (_payload->>'version')::integer IS DISTINCT FROM p.version THEN RAISE EXCEPTION 'Proposal changed; refresh before saving';END IF;
IF _action='save' THEN
 IF (pid IS NOT NULL AND p.status<>'draft') OR (NOT personal AND NOT public.user_commercial_allowed(CASE WHEN pid IS NULL THEN 'proposal.create' ELSE 'proposal.edit' END)) THEN RAISE EXCEPTION 'Only authorized drafts may be edited';END IF;
 doc:=_payload->'document';
 IF personal THEN
  cid:=NULL;lid:=NULL;cust:=NULL;did:=NULL;
  IF length(trim(coalesce(doc->'billing'->>'name','')))=0 THEN RAISE EXCEPTION 'Enter the client name';END IF;
 ELSE
  cid:=(_payload->>'company_id')::uuid;lid:=nullif(_payload->>'lead_id','')::uuid;cust:=nullif(_payload->>'customer_id','')::uuid;did:=nullif(_payload->>'deal_id','')::uuid;
  IF NOT public.user_commercial_company(cid) OR (pid IS NOT NULL AND cid<>p.company_id) THEN RAISE EXCEPTION 'Company access denied';END IF;
  IF lid IS NOT NULL AND NOT public.user_commercial_lead(lid,cid) THEN RAISE EXCEPTION 'Lead access denied';END IF;
  IF cust IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.sales_customers c WHERE c.id=cust AND c.is_active AND (public.has_role(auth.uid(),'super_admin') OR public.user_commercial_lead(c.lead_id,cid))) THEN RAISE EXCEPTION 'Customer access denied';END IF;
  IF lid IS NULL AND cust IS NULL THEN RAISE EXCEPTION 'Link an authorized lead or customer';END IF;
  IF did IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.deals d WHERE d.id=did AND d.company_id=cid AND d.deleted_at IS NULL AND (public.has_role(auth.uid(),'super_admin') OR d.assigned_to=auth.uid()) AND (lid IS NULL OR d.lead_id=lid)) THEN RAISE EXCEPTION 'Deal access denied';END IF;
 END IF;
 IF length(trim(coalesce(_payload->>'title','')))=0 OR coalesce(_payload->>'currency','') !~ '^[A-Z]{3}$' OR (_payload->>'valid_until')::date IS NULL THEN RAISE EXCEPTION 'Complete proposal title, currency and validity';END IF;
 calc:=public.commercial_line_totals(doc->'items',doc->>'tax_mode');doc:=jsonb_set(doc,'{items}',calc->'items');
 IF pid IS NULL THEN INSERT INTO public.sales_proposals(company_id,lead_id,customer_id,deal_id,number,title,currency,valid_until,document,subtotal,discount_total,tax_total,total) VALUES(cid,lid,cust,did,'PROP-'||upper(substr(gen_random_uuid()::text,1,12)),trim(_payload->>'title'),_payload->>'currency',(_payload->>'valid_until')::date,doc,(calc->>'subtotal')::numeric,(calc->>'discount')::numeric,(calc->>'tax')::numeric,(calc->>'total')::numeric) RETURNING id INTO pid;
 ELSE UPDATE public.sales_proposals SET lead_id=lid,customer_id=cust,deal_id=did,title=trim(_payload->>'title'),currency=_payload->>'currency',valid_until=(_payload->>'valid_until')::date,document=doc,subtotal=(calc->>'subtotal')::numeric,discount_total=(calc->>'discount')::numeric,tax_total=(calc->>'tax')::numeric,total=(calc->>'total')::numeric,version=version+1,updated_at=now() WHERE id=pid;END IF;
ELSIF _action='delete' THEN IF pid IS NULL OR p.status<>'draft' OR (NOT personal AND NOT public.user_commercial_allowed('proposal.delete')) THEN RAISE EXCEPTION 'Only permitted drafts may be deleted';END IF;DELETE FROM public.sales_proposals WHERE id=pid;RETURN pid;
ELSIF _action='status' THEN st:=_payload->>'status';IF pid IS NULL OR (NOT personal AND NOT public.user_commercial_allowed('proposal.edit')) OR NOT ((p.status='draft' AND st='sent') OR (p.status='sent' AND st IN ('accepted','rejected'))) OR length(trim(coalesce(_payload->>'note','')))<5 THEN RAISE EXCEPTION 'Record a valid transition and delivery/decision evidence';END IF;UPDATE public.sales_proposals SET status=st,version=version+1,updated_at=now() WHERE id=pid;
ELSIF _action='note' THEN IF pid IS NULL OR (NOT personal AND NOT public.user_commercial_allowed('proposal.edit')) OR length(trim(coalesce(_payload->>'note','')))=0 THEN RAISE EXCEPTION 'Authorized note required';END IF;
ELSE RAISE EXCEPTION 'Unsupported proposal action';END IF;
INSERT INTO public.proposal_events(proposal_id,action,note) VALUES(pid,CASE WHEN _action='status' THEN 'recorded_'||st ELSE _action END,left(coalesce(_payload->>'note',''),5000));RETURN pid;END $function$;

CREATE OR REPLACE FUNCTION public.user_personal_invoice_draft(_payload jsonb) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$ DECLARE inv public.invoices;pid uuid;prop uuid;cust_id uuid;b jsonb;seller jsonb;mode text;calc jsonb;BEGIN
IF NOT public.user_personal_commercial() THEN RAISE EXCEPTION 'Sign in to save invoice drafts';END IF;
IF coalesce(_payload->>'status','draft')<>'draft' THEN RAISE EXCEPTION 'User actions can only save drafts';END IF;
IF _payload->>'id' IS NOT NULL THEN SELECT * INTO inv FROM public.invoices WHERE id=(_payload->>'id')::uuid FOR UPDATE;IF NOT FOUND OR inv.status<>'draft' OR inv.created_by<>auth.uid() OR inv.company_id IS NOT NULL THEN RAISE EXCEPTION 'Only your own drafts may be edited';END IF;IF inv.updated_at IS DISTINCT FROM (_payload->>'updated_at')::timestamptz THEN RAISE EXCEPTION 'Invoice changed; refresh before saving';END IF;pid:=inv.id;END IF;
b:=coalesce(_payload->'billing','{}'::jsonb);seller:=coalesce(_payload->'seller','{}'::jsonb);mode:=coalesce(_payload->>'tax_mode','none');
IF length(trim(coalesce(b->>'name','')))=0 THEN RAISE EXCEPTION 'Enter the client name';END IF;
IF coalesce(_payload->>'currency','') !~ '^[A-Z]{3}$' OR (_payload->>'issue_date')::date IS NULL OR (_payload->>'due_date')::date IS NULL OR (_payload->>'due_date')::date<(_payload->>'issue_date')::date THEN RAISE EXCEPTION 'Valid invoice dates and currency required';END IF;
IF mode NOT IN ('none','cgst_sgst','igst') THEN RAISE EXCEPTION 'Invalid tax treatment';END IF;
IF mode<>'none' AND (coalesce(trim(seller->>'state'),'')='' OR coalesce(trim(b->>'state'),'')='') THEN RAISE EXCEPTION 'GST requires your state and the client state';END IF;
IF mode='cgst_sgst' AND lower(trim(seller->>'state'))<>lower(trim(b->>'state')) OR mode='igst' AND lower(trim(seller->>'state'))=lower(trim(b->>'state')) THEN RAISE EXCEPTION 'Tax treatment does not match billing states';END IF;
prop:=nullif(_payload->>'proposal_id','')::uuid;
IF prop IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.sales_proposals p WHERE p.id=prop AND p.status='accepted' AND p.company_id IS NULL AND p.created_by=auth.uid()) THEN RAISE EXCEPTION 'Accepted own proposal required';END IF;
IF pid IS NOT NULL AND EXISTS(SELECT 1 FROM public.sales_customers c WHERE c.id=inv.customer_id AND c.created_by=auth.uid() AND c.lead_id IS NULL) THEN cust_id:=inv.customer_id;
 UPDATE public.sales_customers SET name=left(trim(b->>'name'),200),company_name=left(coalesce(b->>'company_name',''),200),email=left(coalesce(b->>'email',''),320),phone=left(coalesce(b->>'phone',''),40),gstin=left(coalesce(b->>'gstin',''),20),address=left(coalesce(b->>'address',''),2000),city=left(coalesce(b->>'city',''),120),state=left(coalesce(b->>'state',''),120),country=left(coalesce(b->>'country',''),120) WHERE id=cust_id;
ELSE INSERT INTO public.sales_customers(name,company_name,email,phone,gstin,address,city,state,country,notes,created_by) VALUES(left(trim(b->>'name'),200),left(coalesce(b->>'company_name',''),200),left(coalesce(b->>'email',''),320),left(coalesce(b->>'phone',''),40),left(coalesce(b->>'gstin',''),20),left(coalesce(b->>'address',''),2000),left(coalesce(b->>'city',''),120),left(coalesce(b->>'state',''),120),left(coalesce(b->>'country',''),120),'Personal client added by a user invoice draft',auth.uid()) RETURNING id INTO cust_id;END IF;
calc:=public.commercial_line_totals(_payload->'items',mode);
seller:=jsonb_build_object('company_name',left(coalesce(seller->>'company_name',''),200),'address',left(coalesce(seller->>'address',''),2000),'email',left(coalesce(seller->>'email',''),320),'phone',left(coalesce(seller->>'phone',''),40),'gstin',left(coalesce(seller->>'gstin',''),20),'state',left(coalesce(seller->>'state',''),120));
IF pid IS NULL THEN INSERT INTO public.invoices(customer_id,number,kind,issue_date,due_date,status,billing_details,seller_details,tax_mode,items,subtotal,discount_total,tax_total,total,notes,payment_terms,company_id,proposal_id,currency) VALUES(cust_id,'DRAFT-'||upper(substr(gen_random_uuid()::text,1,12)),'proforma',(_payload->>'issue_date')::date,(_payload->>'due_date')::date,'draft',(SELECT to_jsonb(c)-'notes' FROM public.sales_customers c WHERE c.id=cust_id),seller,mode,calc->'items',(calc->>'subtotal')::numeric,(calc->>'discount')::numeric,(calc->>'tax')::numeric,(calc->>'total')::numeric,coalesce(_payload->>'notes',''),coalesce(_payload->>'payment_terms',''),NULL,prop,_payload->>'currency') RETURNING id INTO pid;
ELSE UPDATE public.invoices SET customer_id=cust_id,issue_date=(_payload->>'issue_date')::date,due_date=(_payload->>'due_date')::date,billing_details=(SELECT to_jsonb(c)-'notes' FROM public.sales_customers c WHERE c.id=cust_id),seller_details=seller,tax_mode=mode,items=calc->'items',subtotal=(calc->>'subtotal')::numeric,discount_total=(calc->>'discount')::numeric,tax_total=(calc->>'tax')::numeric,total=(calc->>'total')::numeric,notes=coalesce(_payload->>'notes',''),payment_terms=coalesce(_payload->>'payment_terms',''),proposal_id=prop,currency=_payload->>'currency',updated_at=now() WHERE id=pid;END IF;
INSERT INTO public.financial_audit_logs(entity_id,entity_type,action,detail) VALUES(pid,'invoice','user_draft_saved',jsonb_build_object('company_id',NULL,'personal',true,'status','draft','total',calc->'total'));RETURN pid;END $function$;
GRANT EXECUTE ON FUNCTION public.user_personal_invoice_draft(jsonb) TO authenticated;