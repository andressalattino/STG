-- Supabase public media only. Receipt documents remain in stg_private.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
 ('trip-images', 'trip-images', true, 8388608, ARRAY['image/jpeg','image/png','image/webp','image/gif','image/avif']),
 ('passenger-images', 'passenger-images', true, 8388608, ARRAY['image/jpeg','image/png','image/webp','image/gif','image/avif']),
 ('trip-pdfs', 'trip-pdfs', true, 20971520, ARRAY['application/pdf'])
ON CONFLICT (id) DO NOTHING;
--> statement-breakpoint
GRANT SELECT ON public.app_admins TO authenticated;
DROP POLICY IF EXISTS "Admins can read own admin row" ON public.app_admins;
CREATE POLICY "Admins can read own admin row" ON public.app_admins
FOR SELECT TO authenticated USING (user_id = (SELECT auth.uid()));
--> statement-breakpoint
DROP POLICY IF EXISTS "Public can read STG storage" ON storage.objects;
CREATE POLICY "Public can read STG storage" ON storage.objects
FOR SELECT TO anon, authenticated
USING (bucket_id IN ('trip-images', 'trip-pdfs', 'passenger-images'));
--> statement-breakpoint
DROP POLICY IF EXISTS "Admins can upload STG storage" ON storage.objects;
CREATE POLICY "Admins can upload STG storage" ON storage.objects
FOR INSERT TO authenticated WITH CHECK (
 bucket_id IN ('trip-images', 'trip-pdfs', 'passenger-images')
 AND EXISTS (SELECT 1 FROM public.app_admins WHERE user_id = (SELECT auth.uid()))
);
--> statement-breakpoint
DROP POLICY IF EXISTS "Admins can update STG storage" ON storage.objects;
CREATE POLICY "Admins can update STG storage" ON storage.objects
FOR UPDATE TO authenticated USING (
 bucket_id IN ('trip-images', 'trip-pdfs', 'passenger-images')
 AND EXISTS (SELECT 1 FROM public.app_admins WHERE user_id = (SELECT auth.uid()))
) WITH CHECK (
 bucket_id IN ('trip-images', 'trip-pdfs', 'passenger-images')
 AND EXISTS (SELECT 1 FROM public.app_admins WHERE user_id = (SELECT auth.uid()))
);
--> statement-breakpoint
DROP POLICY IF EXISTS "Admins can delete STG storage" ON storage.objects;
CREATE POLICY "Admins can delete STG storage" ON storage.objects
FOR DELETE TO authenticated USING (
 bucket_id IN ('trip-images', 'trip-pdfs', 'passenger-images')
 AND EXISTS (SELECT 1 FROM public.app_admins WHERE user_id = (SELECT auth.uid()))
);
