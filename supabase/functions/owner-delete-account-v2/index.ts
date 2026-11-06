import { createClient } from 'npm:@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, x-client-info, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const reply = (value: unknown, status = 200) => new Response(JSON.stringify(value), {
  status, headers: { ...cors, 'Content-Type': 'application/json' },
});
const fail = (code: string, status = 400) => reply({ ok: false, error: code }, status);
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type Profile = { id: string; user_id: string | null };
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (req.method !== 'POST') return fail('METHOD_NOT_ALLOWED', 405);
  try {
    const url = Deno.env.get('SUPABASE_URL');
    const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const ownerId = Deno.env.get('OWNER_USER_ID')?.trim();
    if (!url || !key || !ownerId || !uuid.test(ownerId)) return fail('SERVER_NOT_CONFIGURED', 503);
    const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '').trim();
    if (!token) return fail('AUTH_REQUIRED', 401);
    const admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: caller, error: authError } = await admin.auth.getUser(token);
    if (authError || !caller.user) return fail('AUTH_REQUIRED', 401);
    if (caller.user.id !== ownerId) return fail('OWNER_ONLY', 403);

    const input = await req.json().catch(() => null) as { userId?: string; confirmation?: string } | null;
    if (!input || !uuid.test(input.userId ?? '') || input.confirmation !== 'DELETE') return fail('INVALID_REQUEST');
    const userId = input.userId!;
    if (userId === ownerId) return fail('CANNOT_DELETE_OWNER', 403);
    const { data: target, error: targetError } = await admin.auth.admin.getUserById(userId);
    if (targetError || !target.user) return fail('TARGET_NOT_FOUND', 404);

    const { data: roles, error: rolesError } = await admin.from('user_roles').select('role').eq('user_id', userId);
    if (rolesError) { console.error('roles', rolesError); return fail('ROLE_CHECK_FAILED', 500); }
    if (roles?.some(r => r.role === 'admin')) return fail('CANNOT_DELETE_ADMIN', 403);

    // Resolve ALL professional profiles by the Authentication UID, not a client-provided profile ID.
    const profiles: { kind: 'doctor' | 'teacher'; id: string }[] = [];
    for (const [kind, table] of [['doctor', 'doctors'], ['teacher', 'teachers']] as const) {
      const { data, error } = await admin.from(table).select('id,user_id').eq('user_id', userId);
      if (error) { console.error(`lookup ${table}`, error); return fail('PROFILE_LOOKUP_FAILED', 500); }
      for (const p of (data ?? []) as Profile[]) profiles.push({ kind, id: p.id });
    }
    if (profiles.length !== 1) return fail(profiles.length ? 'MULTIPLE_PROFILES_BLOCKED' : 'PROFILE_NOT_FOUND', 409);
    const profile = profiles[0];
    // Preserve patient/student records. Never cascade-delete real bookings.
    const dependencies = profile.kind === 'doctor'
      ? [{ table: 'appointments', fk: 'doctor_id' }]
      : [{ table: 'teacher_groups', fk: 'teacher_id' }];
    for (const d of dependencies) {
      const { count, error } = await admin.from(d.table).select('*', { count: 'exact', head: true }).eq(d.fk, profile.id);
      if (error) { console.error(`dependency ${d.table}`, error); return fail('DEPENDENCY_CHECK_FAILED', 500); }
      if (count) return fail('HAS_LINKED_RECORDS', 409);
    }

    const { data: credentials, error: credentialsError } = await admin.from('professional_credentials')
      .select('file_path').eq(profile.kind === 'doctor' ? 'doctor_id' : 'teacher_id', profile.id);
    if (credentialsError) { console.error('credentials', credentialsError); return fail('CREDENTIALS_CHECK_FAILED', 500); }
    const { data: buckets, error: bucketError } = await admin.storage.listBuckets();
    if (bucketError) { console.error('buckets', bucketError); return fail('STORAGE_CHECK_FAILED', 500); }
    const existing = new Set((buckets ?? []).map(b => b.name));
    const paths = new Map<string, Set<string>>();
    const add = (bucket: string, path: string) => {
      if (!paths.has(bucket)) paths.set(bucket, new Set());
      paths.get(bucket)!.add(path);
    };
    if (existing.has('professional-evidence')) {
      for (const c of credentials ?? []) if (c.file_path) add('professional-evidence', c.file_path);
    }
    if (existing.has('professional-avatars')) {
      const folder = `${profile.kind}/${profile.id}`;
      const walk = async (dir: string): Promise<boolean> => {
        let offset = 0;
        while (true) {
          const { data, error } = await admin.storage.from('professional-avatars').list(dir, { limit: 100, offset });
          if (error) { console.error('avatar list', error); return false; }
          for (const item of data ?? []) {
            const path = `${dir}/${item.name}`;
            if (item.id) add('professional-avatars', path);
            else if (!await walk(path)) return false;
          }
          if (!data || data.length < 100) break;
          offset += data.length;
        }
        return true;
      };
      if (!await walk(folder)) return fail('STORAGE_CHECK_FAILED', 500);
    }

    // Remove owned storage assets, then profile, then Auth user. Errors are explicit; not atomic.
    for (const [bucket, filePaths] of paths) {
      const items = [...filePaths];
      for (let i = 0; i < items.length; i += 100) {
        const { error } = await admin.storage.from(bucket).remove(items.slice(i, i + 100));
        if (error) { console.error('storage delete', bucket, error); return fail('STORAGE_DELETE_FAILED', 500); }
      }
    }
    const table = profile.kind === 'doctor' ? 'doctors' : 'teachers';
    const { data: deleted, error: profileError } = await admin.from(table).delete().eq('id', profile.id).eq('user_id', userId).select('id');
    if (profileError || deleted?.length !== 1) {
      console.error('profile delete', profileError);
      return fail('PROFILE_DELETE_FAILED', 500);
    }
    const { error: deleteError } = await admin.auth.admin.deleteUser(userId);
    if (deleteError) { console.error('auth delete', deleteError); return fail('AUTH_DELETE_FAILED', 500); }
    return reply({ ok: true });
  } catch (error) {
    console.error('owner delete v2', error);
    return fail('INTERNAL_ERROR', 500);
  }
});
