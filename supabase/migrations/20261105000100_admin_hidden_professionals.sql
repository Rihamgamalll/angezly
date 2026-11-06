-- Additive migration: never deletes doctor/teacher/auth/storage records.
-- Review on the correct Supabase project before applying.
create table if not exists public.admin_hidden_professionals (
  kind text not null check (kind in ('doctor', 'teacher')),
  profile_id uuid not null,
  hidden_at timestamptz not null default now(),
  hidden_by uuid not null,
  primary key (kind, profile_id)
);

alter table public.admin_hidden_professionals enable row level security;
revoke all on public.admin_hidden_professionals from anon;
grant select on public.admin_hidden_professionals to authenticated;

-- Admins may view the hidden registry. No client direct writes.
drop policy if exists admin_hidden_professionals_read_admin on public.admin_hidden_professionals;
create policy admin_hidden_professionals_read_admin on public.admin_hidden_professionals
for select to authenticated using (
  exists (select 1 from public.user_roles ur where ur.user_id = (select auth.uid()) and ur.role::text = 'admin')
);

create or replace function public.admin_set_professional_hidden(
  p_kind text, p_id uuid, p_hidden boolean
) returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if auth.uid() is null or not exists (
    select 1 from public.user_roles ur
    where ur.user_id = auth.uid() and ur.role::text = 'admin'
  ) then
    raise exception 'ADMIN_ONLY';
  end if;
  if p_kind not in ('doctor','teacher') or p_kind is null or p_id is null or p_hidden is null then
    raise exception 'INVALID_ARGUMENT';
  end if;
  if p_kind = 'doctor' then
    -- Force unpublished on hide AND restore; restoring never auto-publishes.
    update public.doctors set is_published = false where id = p_id;
  else
    update public.teachers set is_published = false where id = p_id;
  end if;
  if not found then raise exception 'PROFILE_NOT_FOUND'; end if;
  if p_hidden then
    insert into public.admin_hidden_professionals(kind, profile_id, hidden_by)
    values (p_kind, p_id, auth.uid())
    on conflict (kind, profile_id) do nothing;
  else
    delete from public.admin_hidden_professionals
    where kind = p_kind and profile_id = p_id;
  end if;
end;
$$;
revoke all on function public.admin_set_professional_hidden(text, uuid, boolean) from public, anon;
grant execute on function public.admin_set_professional_hidden(text, uuid, boolean) to authenticated;
