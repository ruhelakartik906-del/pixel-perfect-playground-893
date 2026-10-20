CREATE TABLE public.hr_announcement_attachments(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 announcement_id uuid NOT NULL REFERENCES public.hr_announcements(id) ON DELETE CASCADE,
 company_id uuid NOT NULL REFERENCES public.companies(id),
 path text NOT NULL UNIQUE,
 filename text NOT NULL CHECK(length(filename) BETWEEN 1 AND 200),
 mime text NOT NULL,
 size bigint NOT NULL CHECK(size>0),
 uploaded_by uuid NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT ON public.hr_announcement_attachments TO authenticated;
GRANT ALL ON public.hr_announcement_attachments TO service_role;
ALTER TABLE public.hr_announcement_attachments ENABLE ROW LEVEL SECURITY;
-- Visible only to callers who can already read the parent announcement under its own RLS.
CREATE POLICY hr_announcement_attachment_read ON public.hr_announcement_attachments FOR SELECT TO authenticated
 USING(EXISTS(SELECT 1 FROM public.hr_announcements a WHERE a.id=announcement_id AND a.company_id=hr_announcement_attachments.company_id));
CREATE INDEX hr_announcement_attachments_announcement_idx ON public.hr_announcement_attachments(announcement_id);