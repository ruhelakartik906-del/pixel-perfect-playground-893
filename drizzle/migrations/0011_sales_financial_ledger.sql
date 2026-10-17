CREATE TABLE public.sales_settings (id boolean PRIMARY KEY DEFAULT true CHECK(id), company_name text NOT NULL DEFAULT '', address text NOT NULL DEFAULT '', gstin text NOT NULL DEFAULT '', state text NOT NULL DEFAULT '', country text NOT NULL DEFAULT '', email text NOT NULL DEFAULT '', phone text NOT NULL DEFAULT '');
GRANT SELECT ON public.sales_settings TO authenticated; GRANT ALL ON public.sales_settings TO service_role;
ALTER TABLE public.sales_settings ENABLE ROW LEVEL SECURITY; CREATE POLICY sales_settings_read ON public.sales_settings FOR SELECT TO authenticated USING(public.can_manage_sales());
CREATE TABLE public.invoices (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), customer_id uuid NOT NULL REFERENCES public.sales_customers(id), number text NOT NULL UNIQUE, kind text NOT NULL CHECK(kind IN ('proforma','tax')), issue_date date NOT NULL, due_date date NOT NULL, status text NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','unpaid','cancelled')), billing_details jsonb NOT NULL DEFAULT '{}', seller_details jsonb NOT NULL DEFAULT '{}', tax_mode text NOT NULL DEFAULT 'none' CHECK(tax_mode IN ('none','cgst_sgst','igst')), items jsonb NOT NULL DEFAULT '[]', subtotal numeric(14,2) NOT NULL DEFAULT 0, discount_total numeric(14,2) NOT NULL DEFAULT 0, tax_total numeric(14,2) NOT NULL DEFAULT 0, total numeric(14,2) NOT NULL DEFAULT 0, notes text NOT NULL DEFAULT '', payment_terms text NOT NULL DEFAULT '', created_by uuid NOT NULL DEFAULT auth.uid(), created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), CHECK(due_date >= issue_date));
GRANT SELECT ON public.invoices TO authenticated; GRANT ALL ON public.invoices TO service_role;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY; CREATE POLICY sales_invoices_read ON public.invoices FOR SELECT TO authenticated USING(public.can_manage_sales());
CREATE TABLE public.payments (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), invoice_id uuid NOT NULL REFERENCES public.invoices(id), amount numeric(14,2) NOT NULL CHECK(amount>0), payment_date date NOT NULL, method text NOT NULL, reference text NOT NULL CHECK(length(trim(reference))>0), notes text NOT NULL DEFAULT '', authorized_by uuid NOT NULL DEFAULT auth.uid(), created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(invoice_id,reference));
GRANT SELECT ON public.payments TO authenticated; GRANT ALL ON public.payments TO service_role;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY; CREATE POLICY sales_payments_read ON public.payments FOR SELECT TO authenticated USING(public.can_manage_sales());
CREATE TABLE public.credit_notes (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), invoice_id uuid NOT NULL REFERENCES public.invoices(id), number text NOT NULL UNIQUE, issue_date date NOT NULL, amount numeric(14,2) NOT NULL CHECK(amount>0), tax_adjustment numeric(14,2) NOT NULL DEFAULT 0 CHECK(tax_adjustment>=0), reason text NOT NULL CHECK(length(trim(reason))>0), notes text NOT NULL DEFAULT '', status text NOT NULL DEFAULT 'issued' CHECK(status IN ('issued','void')), created_by uuid NOT NULL DEFAULT auth.uid(), created_at timestamptz NOT NULL DEFAULT now(), CHECK(tax_adjustment<=amount));
GRANT SELECT ON public.credit_notes TO authenticated; GRANT ALL ON public.credit_notes TO service_role;
ALTER TABLE public.credit_notes ENABLE ROW LEVEL SECURITY; CREATE POLICY sales_credits_read ON public.credit_notes FOR SELECT TO authenticated USING(public.can_manage_sales());
CREATE TABLE public.revenue_entries (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), title text NOT NULL CHECK(length(trim(title))>0), customer_id uuid NOT NULL REFERENCES public.sales_customers(id), invoice_id uuid REFERENCES public.invoices(id), category text NOT NULL DEFAULT '', amount numeric(14,2) NOT NULL CHECK(amount>0), entry_date date NOT NULL, method text NOT NULL, reference text NOT NULL UNIQUE CHECK(length(trim(reference))>0), description text NOT NULL DEFAULT '', notes text NOT NULL DEFAULT '', status text NOT NULL DEFAULT 'posted' CHECK(status IN ('posted','void')), created_by uuid NOT NULL DEFAULT auth.uid(), created_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT ON public.revenue_entries TO authenticated; GRANT ALL ON public.revenue_entries TO service_role;
ALTER TABLE public.revenue_entries ENABLE ROW LEVEL SECURITY; CREATE POLICY sales_revenue_read ON public.revenue_entries FOR SELECT TO authenticated USING(public.can_manage_sales());
CREATE TABLE public.financial_audit_logs (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), entity_id uuid, entity_type text NOT NULL, action text NOT NULL, actor_id uuid NOT NULL DEFAULT auth.uid(), detail jsonb NOT NULL DEFAULT '{}', created_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT ON public.financial_audit_logs TO authenticated; GRANT ALL ON public.financial_audit_logs TO service_role;
ALTER TABLE public.financial_audit_logs ENABLE ROW LEVEL SECURITY; CREATE POLICY sales_audit_read ON public.financial_audit_logs FOR SELECT TO authenticated USING(public.can_manage_sales());
CREATE OR REPLACE FUNCTION public.sales_financial_action(action text, payload jsonb) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE result_id uuid; inv public.invoices%ROWTYPE; customer public.sales_customers%ROWTYPE; item jsonb; snapshot jsonb := '[]'; q numeric; price numeric; discount numeric; rate numeric; base numeric; tax numeric; sub numeric:=0; discounts numeric:=0; taxes numeric:=0; total_amount numeric; paid numeric; credited numeric; amt numeric; tax_adj numeric; settings jsonb; mode text; credit public.credit_notes%ROWTYPE; revenue public.revenue_entries%ROWTYPE;
BEGIN
 IF NOT public.can_manage_sales() THEN RAISE EXCEPTION 'Active Super Admin authorization required'; END IF;
 IF action='settings' THEN
  INSERT INTO public.sales_settings(id,company_name,address,gstin,state,country,email,phone) VALUES(true,trim(payload->>'company_name'),coalesce(payload->>'address',''),coalesce(payload->>'gstin',''),coalesce(payload->>'state',''),coalesce(payload->>'country',''),coalesce(payload->>'email',''),coalesce(payload->>'phone','')) ON CONFLICT(id) DO UPDATE SET company_name=EXCLUDED.company_name,address=EXCLUDED.address,gstin=EXCLUDED.gstin,state=EXCLUDED.state,country=EXCLUDED.country,email=EXCLUDED.email,phone=EXCLUDED.phone;
 ELSIF action='invoice' THEN
  IF nullif(payload->>'id','') IS NOT NULL THEN SELECT * INTO inv FROM public.invoices WHERE id=(payload->>'id')::uuid FOR UPDATE; IF NOT FOUND OR inv.status<>'draft' THEN RAISE EXCEPTION 'Only existing drafts may be edited'; END IF; END IF;
  SELECT * INTO customer FROM public.sales_customers WHERE id=(payload->>'customer_id')::uuid AND is_active; IF NOT FOUND THEN RAISE EXCEPTION 'Select an active customer'; END IF;
  mode:=coalesce(payload->>'tax_mode','none');
  IF jsonb_array_length(payload->'items') NOT BETWEEN 1 AND 100 THEN RAISE EXCEPTION 'Add 1 to 100 line items'; END IF;
  FOR item IN SELECT value FROM jsonb_array_elements(payload->'items') LOOP
   q:=(item->>'quantity')::numeric; price:=(item->>'unit_price')::numeric; discount:=(item->>'discount_percent')::numeric; rate:=(item->>'tax_rate')::numeric;
   IF q<=0 OR q>1000000 OR price<0 OR discount NOT BETWEEN 0 AND 100 OR rate NOT BETWEEN 0 AND 100 OR length(trim(item->>'name'))=0 THEN RAISE EXCEPTION 'Invalid line item'; END IF;
   base:=round(round(q*price,2)*(1-discount/100),2); tax:=CASE WHEN mode='none' THEN 0 ELSE round(base*rate/100,2) END;
   sub:=sub+round(q*price,2); discounts:=discounts+round(q*price,2)-base; taxes:=taxes+tax;
   snapshot:=snapshot || jsonb_build_array(jsonb_build_object('product_id',item->>'product_id','name',item->>'name','quantity',q,'unit_price',price,'discount_percent',discount,'tax_rate',rate,'cost_price',item->'cost_price','subtotal',round(q*price,2),'discount',round(q*price,2)-base,'tax',tax,'cgst',CASE WHEN mode='cgst_sgst' THEN round(tax/2,2) ELSE 0 END,'sgst',CASE WHEN mode='cgst_sgst' THEN tax-round(tax/2,2) ELSE 0 END,'igst',CASE WHEN mode='igst' THEN tax ELSE 0 END,'total',base+tax));
  END LOOP;
  total_amount:=sub-discounts+taxes;
  IF total_amount<=0 THEN RAISE EXCEPTION 'Invoice total must be positive'; END IF;
  SELECT to_jsonb(s)-'id' INTO settings FROM public.sales_settings s WHERE id=true;
  IF payload->>'status'='unpaid' AND coalesce(settings->>'company_name','')='' THEN RAISE EXCEPTION 'Save your real seller details before issuing invoices'; END IF;
  IF mode<>'none' AND (coalesce(settings->>'gstin','')='' OR coalesce(settings->>'state','')='' OR customer.state='') THEN RAISE EXCEPTION 'GST requires seller GSTIN and both seller and customer states'; END IF;
  IF mode='cgst_sgst' AND lower(trim(settings->>'state'))<>lower(trim(customer.state)) THEN RAISE EXCEPTION 'Use IGST for different states'; END IF;
  IF mode='igst' AND lower(trim(settings->>'state'))=lower(trim(customer.state)) THEN RAISE EXCEPTION 'Use CGST/SGST for the same state'; END IF;
  IF inv.id IS NULL THEN
   INSERT INTO public.invoices(customer_id,number,kind,issue_date,due_date,status,billing_details,seller_details,tax_mode,items,subtotal,discount_total,tax_total,total,notes,payment_terms) VALUES(customer.id,trim(payload->>'number'),payload->>'kind',(payload->>'issue_date')::date,(payload->>'due_date')::date,payload->>'status',to_jsonb(customer),coalesce(settings,'{}'),mode,snapshot,sub,discounts,taxes,total_amount,coalesce(payload->>'notes',''),coalesce(payload->>'payment_terms','')) RETURNING id INTO result_id;
  ELSE
   UPDATE public.invoices SET customer_id=customer.id,number=trim(payload->>'number'),kind=payload->>'kind',issue_date=(payload->>'issue_date')::date,due_date=(payload->>'due_date')::date,status=payload->>'status',billing_details=to_jsonb(customer),seller_details=coalesce(settings,'{}'),tax_mode=mode,items=snapshot,subtotal=sub,discount_total=discounts,tax_total=taxes,total=total_amount,notes=coalesce(payload->>'notes',''),payment_terms=coalesce(payload->>'payment_terms',''),updated_at=now() WHERE id=inv.id RETURNING id INTO result_id;
  END IF;
 ELSIF action IN ('payment','credit','cancel_invoice','void_credit') THEN
  IF action='void_credit' THEN SELECT * INTO credit FROM public.credit_notes WHERE id=(payload->>'id')::uuid; SELECT * INTO inv FROM public.invoices WHERE id=credit.invoice_id FOR UPDATE;
  ELSE SELECT * INTO inv FROM public.invoices WHERE id=(payload->>'invoice_id')::uuid FOR UPDATE; END IF;
  IF inv.id IS NULL THEN RAISE EXCEPTION 'Invoice not found'; END IF;
  SELECT coalesce(sum(amount),0) INTO paid FROM public.payments WHERE invoice_id=inv.id;
  SELECT coalesce(sum(amount),0) INTO credited FROM public.credit_notes WHERE invoice_id=inv.id AND status='issued';
  IF action IN ('payment','credit') AND inv.status<>'unpaid' THEN RAISE EXCEPTION 'Payments and credits require an issued, non-cancelled invoice'; END IF;
  IF action='payment' THEN
   IF coalesce((payload->>'authorized')::boolean,false)=false THEN RAISE EXCEPTION 'Confirm authorized payment information'; END IF;
   amt:=round((payload->>'amount')::numeric,2);
   IF amt<=0 OR amt>inv.total-credited-paid THEN RAISE EXCEPTION 'Payment exceeds outstanding balance'; END IF;
   INSERT INTO public.payments(invoice_id,amount,payment_date,method,reference,notes) VALUES(inv.id,amt,(payload->>'date')::date,trim(payload->>'method'),trim(payload->>'reference'),coalesce(payload->>'notes','')) RETURNING id INTO result_id;
  ELSIF action='credit' THEN
   amt:=round((payload->>'amount')::numeric,2); tax_adj:=round(coalesce((payload->>'tax_adjustment')::numeric,0),2);
   IF amt<=0 OR amt>inv.total-credited OR tax_adj<0 OR tax_adj>amt OR tax_adj>inv.tax_total-coalesce((SELECT sum(tax_adjustment) FROM public.credit_notes WHERE invoice_id=inv.id AND status='issued'),0) THEN RAISE EXCEPTION 'Credit or tax adjustment exceeds allowable invoice amount'; END IF;
   INSERT INTO public.credit_notes(invoice_id,number,issue_date,amount,tax_adjustment,reason,notes) VALUES(inv.id,trim(payload->>'number'),(payload->>'date')::date,amt,tax_adj,trim(payload->>'reason'),coalesce(payload->>'notes','')) RETURNING id INTO result_id;
  ELSIF action='cancel_invoice' THEN
   IF paid>0 OR credited>0 THEN RAISE EXCEPTION 'Cannot cancel an invoice with payments or active credits'; END IF;
   UPDATE public.invoices SET status='cancelled',updated_at=now() WHERE id=inv.id; result_id:=inv.id;
  ELSE
   IF credit.status<>'issued' THEN RAISE EXCEPTION 'Credit note is already void'; END IF;
   UPDATE public.credit_notes SET status='void' WHERE id=credit.id; result_id:=credit.id;
  END IF;
 ELSIF action IN ('revenue','void_revenue') THEN
  IF nullif(payload->>'id','') IS NOT NULL THEN SELECT * INTO revenue FROM public.revenue_entries WHERE id=(payload->>'id')::uuid FOR UPDATE; IF NOT FOUND OR revenue.status='void' THEN RAISE EXCEPTION 'Entry not editable'; END IF; END IF;
  IF action='void_revenue' THEN UPDATE public.revenue_entries SET status='void' WHERE id=revenue.id; result_id:=revenue.id;
  ELSIF nullif(payload->>'invoice_id','') IS NOT NULL THEN RAISE EXCEPTION 'Record linked receipts through Invoice > Record Payment to prevent double counting';
  ELSE
   IF coalesce((payload->>'authorized')::boolean,false)=false THEN RAISE EXCEPTION 'Confirm authorized receipt information'; END IF;
   amt:=round((payload->>'amount')::numeric,2);
   IF revenue.id IS NULL THEN INSERT INTO public.revenue_entries(title,customer_id,category,amount,entry_date,method,reference,description,notes) VALUES(trim(payload->>'title'),(payload->>'customer_id')::uuid,coalesce(payload->>'category',''),amt,(payload->>'date')::date,trim(payload->>'method'),trim(payload->>'reference'),coalesce(payload->>'description',''),coalesce(payload->>'notes','')) RETURNING id INTO result_id;
   ELSE UPDATE public.revenue_entries SET title=trim(payload->>'title'),customer_id=(payload->>'customer_id')::uuid,category=coalesce(payload->>'category',''),amount=amt,entry_date=(payload->>'date')::date,method=trim(payload->>'method'),reference=trim(payload->>'reference'),description=coalesce(payload->>'description',''),notes=coalesce(payload->>'notes','') WHERE id=revenue.id RETURNING id INTO result_id; END IF;
  END IF;
 ELSE RAISE EXCEPTION 'Unsupported financial action'; END IF;
 INSERT INTO public.financial_audit_logs(entity_id,entity_type,action,detail) VALUES(result_id,CASE WHEN action='invoice' OR action='cancel_invoice' THEN 'invoice' WHEN action='payment' THEN 'payment' WHEN action IN ('credit','void_credit') THEN 'credit_note' ELSE action END,action,jsonb_build_object('amount',amt,'invoice_id',inv.id));
 RETURN result_id;
END $$;
REVOKE ALL ON FUNCTION public.sales_financial_action(text,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sales_financial_action(text,jsonb) TO authenticated;