ALTER TABLE public.companies ADD COLUMN contact_person TEXT NOT NULL DEFAULT '';
ALTER TABLE public.companies ADD COLUMN website TEXT NOT NULL DEFAULT '';
ALTER TABLE public.companies ADD COLUMN address TEXT NOT NULL DEFAULT '';
ALTER TABLE public.companies ADD COLUMN city TEXT NOT NULL DEFAULT '';
ALTER TABLE public.companies ADD COLUMN state TEXT NOT NULL DEFAULT '';
ALTER TABLE public.companies ADD COLUMN country TEXT NOT NULL DEFAULT '';
ALTER TABLE public.companies ADD COLUMN notes TEXT NOT NULL DEFAULT '';
COMMENT ON COLUMN public.companies.location IS 'DEPRECATED: replaced by city/state/country';

ALTER TABLE public.contacts ADD COLUMN city TEXT NOT NULL DEFAULT '';
ALTER TABLE public.contacts ADD COLUMN state TEXT NOT NULL DEFAULT '';
ALTER TABLE public.contacts ADD COLUMN country TEXT NOT NULL DEFAULT '';
ALTER TABLE public.contacts ADD COLUMN notes TEXT NOT NULL DEFAULT '';
COMMENT ON COLUMN public.contacts.location IS 'DEPRECATED: replaced by city/state/country';