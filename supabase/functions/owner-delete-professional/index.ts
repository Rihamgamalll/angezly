// Deploy with JWT verification enabled. OWNER_USER_ID must be set as an Edge Function secret.
import { createClient } from 'npm:@supabase/supabase-js@2';

Deno.serve(async (request) => {
  const headers = { 'Content-Type': 'application/json' };
  const fail = (message: string, status = 400) => new Response(JSON.stringify({ error: message }), { status, headers });
  if (request.method !== 'POST') return fail('METHOD_NOT_ALLOWED', 405);
  const url = Deno.env.get('SUPABASE_URL');
  const anon = Deno.env.get('SUPABASE_ANON_KEY');
  const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const ownerId = Deno.env.get('OWNER_USER_ID');
  if (!url || !anon || !service || !ownerId) return fail('SERVER_NOT_CONFIGURED', 503);
  const authorization = request.headers.get('Authorization') ?? '';
  if (!authorization.startsWith('Bearer ')) return fail('AUTH_REQUIRED', 401);
  const caller = createClient(url, anon, { global: { headers: { Authorization: authorization } }, auth: { persistSession: false } });
  const { data: identity, error: identityError } = await caller.auth.getUser();
  if (identityError || !identity.user || identity.user.id !== ownerId) return fail('OWNER_ONLY', 403);
  const admin = createClient(url, service, { auth: { persistSession: false } });
  const { data: roles, error: roleError } = await admin.from('user_roles').select('role').eq('user_id', identity.user.id);
  if (roleError || !roles?.some((r) => r.role === 'admin')) return fail('OWNER_ONLY', 403);
  let body: { kind?: string; id?: string; confirmation?: string };
  try { body = await request.json(); } catch { return fail('INVALID_JSON'); }
  if (!['doctor', 'teacher'].includes(body.kind ?? '') || !/^[0-9a-f-]{36}$/i.test(body.id ?? '') || body.confirmation !== 'DELETE') return fail('INVALID_REQUEST');
  const kind = body.kind as 'doctor' | 'teacher';
  const table = kind === 'doctor' ? 'doctors' : 'teachers';
  const { data: profile, error: profileError } = await admin.from(table).select('id,user_id,full_name').eq('id', body.id!).single();
  if (profileError || !profile?.user_id) return fail('PROFILE_NOT_FOUND', 404);
  if (profile.user_id === ownerId) return fail('CANNOT_DELETE_OWNER', 403);
  const { data: targetRoles, error: targetRolesError } = await admin.from('user_roles').select('role').eq('user_id', profile.user_id);
  if (targetRolesError || targetRoles?.some((r) => r.role === 'admin')) return fail('CANNOT_DELETE_ADMIN', 403);
  // Protect linked patient/student data and accounts with more than one professional profile.
  const otherTable = kind === 'doctor' ? 'teachers' : 'doctors';
  const { data: otherProfile, error: otherError } = await admin.from(otherTable).select('id').eq('user_id', profile.user_id).limit(1);
  if (otherError || (otherProfile?.length ?? 0) > 0) return fail('ACCOUNT_HAS_OTHER_PROFILE', 409);
  // Preserve appointments and their related records: refuse deletion if they exist.
  const dependent = kind === 'doctor' ? 'appointments' : 'teacher_groups';
  const fk = kind === 'doctor' ? 'doctor_id' : 'teacher_id';
  const { count, error: dependencyError } = await admin.from(dependent).select('id', { count: 'exact', head: true }).eq(fk, profile.id);
  if (dependencyError) return fail('DEPENDENCY_CHECK_FAILED', 409);
  if ((count ?? 0) > 0) return fail('HAS_BOOKINGS_DELETE_BLOCKED', 409);
  // Delete only files within this profile's dedicated paths.
  for (const bucket of ['professional-avatars', 'professional-evidence']) {
    const prefix = `${kind}/${profile.id}`;
    let offset = 0;
    const paths: string[] = [];
    while (true) {
      const { data: files, error } = await admin.storage.from(bucket).list(prefix, { limit: 100, offset });
      if (error) return fail('STORAGE_LIST_FAILED', 500);
      paths.push(...(files ?? []).filter(f => f.name && f.id).map(f => `${prefix}/${f.name}`));
      if (!files || files.length < 100) break;
      offset += files.length;
    }
    for (let i = 0; i < paths.length; i += 100) {
      const { error } = await admin.storage.from(bucket).remove(paths.slice(i, i + 100));
      if (error) return fail('STORAGE_DELETE_FAILED', 500);
    }
  }
  const { error: deleteProfileError } = await admin.from(table).delete().eq('id', profile.id);
  if (deleteProfileError) return fail('PROFILE_DELETE_FAILED', 500);
  const { error: deleteAuthError } = await admin.auth.admin.deleteUser(profile.user_id);
  if (deleteAuthError) return fail('AUTH_DELETE_FAILED_CONTACT_SUPPORT', 500);
  return new Response(JSON.stringify({ ok: true }), { status: 200, headers });
});
