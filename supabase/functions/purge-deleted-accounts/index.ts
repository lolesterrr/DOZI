// Task 3.6: removes accounts whose 10-day "undo" period is over (Data Protection and Privacy Act
// 2019). The database calls this once a day (pg_cron, see
// supabase/migrations/20261105100000_account_deletion_grace.sql) with a shared secret.
//
// For each account due: removes its pictures from Storage (`user-media/<user id>/…`; files
// aren't removed by the database cascade), then deletes the auth user. Every table's owner_id
// (and profiles.id) references auth.users with ON DELETE CASCADE, so all their rows go with it,
// and so does the pending-deletion record.
//
// The service-role key is only ever used here, on Supabase's servers; it is never in the app.
// Deploy: npx supabase@3.0.0 functions deploy purge-deleted-accounts --use-api   (docs/SETUP.md
// Part G, which also sets PURGE_SECRET).

import { createClient } from 'npm:@supabase/supabase-js@2';

const BUCKET = 'user-media';
const PAGE = 1000;

const reply = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

/** Compares two strings in constant time, so the secret can't be guessed from timings. */
function sameSecret(a: string, b: string): boolean {
  const x = new TextEncoder().encode(a);
  const y = new TextEncoder().encode(b);
  let diff = x.length ^ y.length;
  for (let i = 0; i < Math.max(x.length, y.length); i++) diff |= (x[i] ?? 0) ^ (y[i] ?? 0);
  return diff === 0;
}

Deno.serve(async (req) => {
  const expected = Deno.env.get('PURGE_SECRET') ?? '';
  const given = req.headers.get('x-purge-secret') ?? '';
  if (expected.length < 16 || !sameSecret(given, expected)) {
    return reply(401, { error: 'Not allowed' });
  }

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  const { data: due, error: dueError } = await admin.rpc('due_account_deletions');
  if (dueError) return reply(500, { error: `Could not list accounts: ${dueError.message}` });

  const bucket = admin.storage.from(BUCKET);
  let purged = 0;
  const failed: string[] = [];
  for (const userId of (due ?? []) as string[]) {
    try {
      // Pictures first: if this fails, the account stays and the next run tries again.
      for (;;) {
        const { data: files, error } = await bucket.list(userId, { limit: PAGE });
        if (error) throw new Error(`list pictures: ${error.message}`);
        if (!files || files.length === 0) break;
        const { error: removeError } = await bucket.remove(files.map((f) => `${userId}/${f.name}`));
        if (removeError) throw new Error(`remove pictures: ${removeError.message}`);
        if (files.length < PAGE) break;
      }
      const { error: deleteError } = await admin.auth.admin.deleteUser(userId);
      if (deleteError) throw new Error(`delete user: ${deleteError.message}`);
      purged++;
    } catch (error) {
      console.error('purge failed', userId, String(error));
      failed.push(userId);
    }
  }
  return reply(failed.length > 0 ? 500 : 200, { purged, failed: failed.length });
});
