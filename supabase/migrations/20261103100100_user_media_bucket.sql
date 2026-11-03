-- Task 3.1 — Storage for the students' own images (ARCHITECTURE §5).
--
-- Private bucket `user-media`. Each file lives under the owner's auth user id:
--   user-media/<auth user id>/<media id>.jpg
-- and the policies below only let a student touch files inside their own folder.
-- Images are compressed on the phone first (long edge ≤ 1600 px, JPEG 0.7), so 5 MB is plenty.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('user-media', 'user-media', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy "Students read their own media files"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'user-media'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "Students upload their own media files"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'user-media'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "Students replace their own media files"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'user-media'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  )
  with check (
    bucket_id = 'user-media'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "Students delete their own media files"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'user-media'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
