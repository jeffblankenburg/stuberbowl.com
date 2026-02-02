-- Create storage bucket for prop bet images
INSERT INTO storage.buckets (id, name, public)
VALUES ('prop-images', 'prop-images', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload images
CREATE POLICY "Admins can upload images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'prop-images' AND
  EXISTS (SELECT 1 FROM sb_profiles WHERE id = auth.uid() AND is_admin = true)
);

-- Allow anyone to view images
CREATE POLICY "Anyone can view images"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'prop-images');

-- Allow admins to delete images
CREATE POLICY "Admins can delete images"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'prop-images' AND
  EXISTS (SELECT 1 FROM sb_profiles WHERE id = auth.uid() AND is_admin = true)
);
