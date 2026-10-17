CREATE OR REPLACE FUNCTION public.can_manage_sales() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$ SELECT auth.uid() IS NOT NULL AND public.has_role(auth.uid(), 'super_admin') AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND account_status = 'active'); $$;
REVOKE ALL ON FUNCTION public.can_manage_sales() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_manage_sales() TO authenticated, service_role;
CREATE TABLE public.products_services (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 name text NOT NULL CHECK(length(trim(name)) BETWEEN 1 AND 200),
 kind text NOT NULL DEFAULT 'product' CHECK(kind IN ('product','service')),
 description text NOT NULL DEFAULT '',
 code text NOT NULL DEFAULT '',
 category_id uuid REFERENCES public.crm_options(id) ON DELETE RESTRICT,
 selling_price numeric(14,2) NOT NULL DEFAULT 0 CHECK(selling_price >= 0),
 cost_price numeric(14,2) CHECK(cost_price >= 0),
 tax_rate numeric(7,4) NOT NULL DEFAULT 0 CHECK(tax_rate BETWEEN 0 AND 100),
 image_path text,
 is_active boolean NOT NULL DEFAULT true,
 stock_quantity numeric(14,3) NOT NULL DEFAULT 0 CHECK(stock_quantity >= 0),
 service_duration text NOT NULL DEFAULT '',
 billing_frequency text NOT NULL DEFAULT 'one_time' CHECK(billing_frequency IN ('one_time','monthly','quarterly','yearly')),
 created_by uuid NOT NULL DEFAULT auth.uid(),
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.products_services TO authenticated;
GRANT ALL ON public.products_services TO service_role;
ALTER TABLE public.products_services ENABLE ROW LEVEL SECURITY;
CREATE POLICY sales_products_admin ON public.products_services FOR ALL TO authenticated USING(public.can_manage_sales()) WITH CHECK(public.can_manage_sales());
CREATE UNIQUE INDEX sales_product_code_unique ON public.products_services(lower(trim(code))) WHERE trim(code) <> '';
CREATE TRIGGER sales_products_updated BEFORE UPDATE ON public.products_services FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TABLE public.sales_customers (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 customer_number bigint GENERATED ALWAYS AS IDENTITY UNIQUE,
 name text NOT NULL CHECK(length(trim(name)) BETWEEN 1 AND 200),
 kind text NOT NULL DEFAULT 'individual' CHECK(kind IN ('individual','business')),
 company_name text NOT NULL DEFAULT '',
 phone text NOT NULL DEFAULT '',
 email text NOT NULL DEFAULT '',
 gstin text NOT NULL DEFAULT '',
 address text NOT NULL DEFAULT '',
 city text NOT NULL DEFAULT '',
 state text NOT NULL DEFAULT '',
 country text NOT NULL DEFAULT '',
 postal_code text NOT NULL DEFAULT '',
 notes text NOT NULL DEFAULT '',
 lead_id uuid UNIQUE REFERENCES public.leads(id) ON DELETE RESTRICT,
 is_active boolean NOT NULL DEFAULT true,
 created_by uuid NOT NULL DEFAULT auth.uid(),
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sales_customers TO authenticated;
GRANT ALL ON public.sales_customers TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.sales_customers_customer_number_seq TO authenticated, service_role;
ALTER TABLE public.sales_customers ENABLE ROW LEVEL SECURITY;
CREATE POLICY sales_customers_admin ON public.sales_customers FOR ALL TO authenticated USING(public.can_manage_sales()) WITH CHECK(public.can_manage_sales());
CREATE TRIGGER sales_customers_updated BEFORE UPDATE ON public.sales_customers FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();