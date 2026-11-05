// Task 3.6: deletes the signed-in student's account (Data Protection and Privacy Act 2019).
//
// 1. Checks who is asking from their sign-in token (sent by supabase.functions.invoke).
// 2. Removes their pictures from Storage (`user-media/<user id>/…`; files aren't removed by the
//    database cascade).
// 3. Deletes the auth user. Every table's owner_id (and profiles.id) references auth.users with
//    ON DELETE CASCADE, so all their rows go with it.
//
// The service-role key is only ever used here, on Supabase's servers; it is never in the app.
// Deploy: npx supabase@3.0.0 functions deploy delete-account --use-api   (docs/SETUP.md Part G)

import { createClient } from 'npm:@supabase/supabase-js@2';

const BUCKET = 'user-media';
const PAGE = 1000;

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const reply = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return reply(405, { error: 'Use POST' });

  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  if (!token) return reply(401, { error: 'Not signed in' });

  let body: { confirm?: unknown } = {};
  try {
    body = await req.json();
  } catch {
    // no body: refused below
  }
  if (body.confirm !== 'DELETE') return reply(400, { error: 'Missing confirmation' });

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  const { data: userData, error: userError } = await admin.auth.getUser(token);
  const user = userData?.user;
  if (userError || !user) return reply(401, { error: 'Not signed in' });

  // Pictures first: if this fails, the account is still there and the student can try again.
  const bucket = admin.storage.from(BUCKET);
  for (;;) {
    const { data: files, error } = await bucket.list(user.id, { limit: PAGE });
    if (error) return reply(500, { error: `Could not list pictures: ${error.message}` });
    if (!files || files.length === 0) break;
    const { error: removeError } = await bucket.remove(files.map((f) => `${user.id}/${f.name}`));
    if (removeError)
      return reply(500, { error: `Could not remove pictures: ${removeError.message}` });
    if (files.length < PAGE) break;
  }

  const { error: deleteError } = await admin.auth.admin.deleteUser(user.id);
  if (deleteError)
    return reply(500, { error: `Could not delete the account: ${deleteError.message}` });

  return reply(200, { deleted: true });
});
