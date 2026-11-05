-- Task 3.7 — the tutorial videos live in Storage instead of the app.
--
-- Public bucket `tutorials`: anyone with the app can download the videos and `manifest.json`
-- by their public link, signed in or not (they are the app's own help videos, nothing
-- personal). There are no upload policies, so only the developer (dashboard or CLI) can add or
-- change files. docs/SETUP.md Part H uploads them.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('tutorials', 'tutorials', true, 20971520, array['video/mp4', 'application/json'])
on conflict (id) do nothing;
