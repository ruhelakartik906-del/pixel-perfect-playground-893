CREATE OR REPLACE FUNCTION public.org_number_limit_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE cap integer; used bigint;
BEGIN
 IF NEW.status NOT IN ('connected','connecting') THEN RETURN NEW; END IF;
 IF TG_OP='UPDATE' AND OLD.status IN ('connected','connecting') AND OLD.company_id=NEW.company_id THEN RETURN NEW; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(NEW.company_id::text,17));
 SELECT max_whatsapp_numbers INTO cap FROM public.org_usage_limits WHERE company_id=NEW.company_id;
 IF cap IS NULL THEN RETURN NEW; END IF;
 SELECT count(*) INTO used FROM public.org_whatsapp_connections WHERE company_id=NEW.company_id AND status IN ('connected','connecting') AND id<>NEW.id;
 IF used>=cap THEN RAISE EXCEPTION 'Connected WhatsApp number limit reached'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER org_number_limit_guard BEFORE INSERT OR UPDATE OF company_id,status ON public.org_whatsapp_connections FOR EACH ROW EXECUTE FUNCTION public.org_number_limit_guard();
CREATE OR REPLACE FUNCTION public.org_document_storage_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE cap integer; used bigint;
BEGIN
 IF NEW.size<0 THEN RAISE EXCEPTION 'Invalid file size'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(NEW.company_id::text,17));
 SELECT max_storage_mb INTO cap FROM public.org_usage_limits WHERE company_id=NEW.company_id;
 IF cap IS NULL THEN RETURN NEW; END IF;
 SELECT coalesce(sum(size),0) INTO used FROM (
  SELECT size FROM public.hr_document_versions WHERE company_id=NEW.company_id AND NOT (TG_TABLE_NAME='hr_document_versions' AND id=NEW.id)
  UNION ALL SELECT size FROM public.hr_announcement_attachments WHERE company_id=NEW.company_id AND NOT (TG_TABLE_NAME='hr_announcement_attachments' AND id=NEW.id)
 ) files;
 IF used+NEW.size>cap::bigint*1048576 THEN RAISE EXCEPTION 'Organization document storage limit reached'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER org_document_storage_guard BEFORE INSERT OR UPDATE OF company_id,size ON public.hr_document_versions FOR EACH ROW EXECUTE FUNCTION public.org_document_storage_guard();
CREATE TRIGGER org_announcement_storage_guard BEFORE INSERT OR UPDATE OF company_id,size ON public.hr_announcement_attachments FOR EACH ROW EXECUTE FUNCTION public.org_document_storage_guard();