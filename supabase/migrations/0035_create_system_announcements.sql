create table if not exists public.system_announcements (
  id uuid primary key default gen_random_uuid(),
  audience text not null,
  placement text not null,
  title text not null,
  body text not null,
  is_active boolean not null default true,
  starts_at timestamptz null,
  ends_at timestamptz null,
  priority integer not null default 0,
  created_by uuid null references public.profiles(id),
  updated_by uuid null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz null,
  constraint system_announcements_audience_check
    check (audience in ('all', 'admin')),
  constraint system_announcements_placement_check
    check (placement in ('dashboard', 'login_after', 'admin')),
  constraint system_announcements_date_range_check
    check (ends_at is null or starts_at is null or ends_at > starts_at)
);

create or replace function public.set_system_announcements_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
begin
  if not exists (
    select 1
    from pg_trigger
    where tgname = 'trg_system_announcements_set_updated_at'
      and tgrelid = 'public.system_announcements'::regclass
  ) then
    if to_regprocedure('public.set_updated_at()') is not null then
      create trigger trg_system_announcements_set_updated_at
        before update on public.system_announcements
        for each row execute function public.set_updated_at();
    else
      create trigger trg_system_announcements_set_updated_at
        before update on public.system_announcements
        for each row execute function public.set_system_announcements_updated_at();
    end if;
  end if;
end $$;

create index if not exists idx_system_announcements_placement
  on public.system_announcements (placement);

create index if not exists idx_system_announcements_audience
  on public.system_announcements (audience);

create index if not exists idx_system_announcements_is_active
  on public.system_announcements (is_active);

create index if not exists idx_system_announcements_starts_at
  on public.system_announcements (starts_at);

create index if not exists idx_system_announcements_ends_at
  on public.system_announcements (ends_at);

create index if not exists idx_system_announcements_deleted_at
  on public.system_announcements (deleted_at);

create index if not exists idx_system_announcements_priority
  on public.system_announcements (priority);

create index if not exists idx_system_announcements_active_lookup
  on public.system_announcements (
    placement,
    audience,
    is_active,
    priority desc,
    created_at desc
  )
  where deleted_at is null;

alter table public.system_announcements enable row level security;

drop policy if exists "system_announcements_super_admin_select_all" on public.system_announcements;
drop policy if exists "system_announcements_active_all_select" on public.system_announcements;
drop policy if exists "system_announcements_active_admin_select" on public.system_announcements;
drop policy if exists "system_announcements_super_admin_insert" on public.system_announcements;
drop policy if exists "system_announcements_super_admin_update" on public.system_announcements;
drop policy if exists "system_announcements_super_admin_delete" on public.system_announcements;

create policy "system_announcements_super_admin_select_all"
  on public.system_announcements
  for select
  using (
    exists (
      select 1
      from public.profiles p
      join public.user_roles ur on ur.profile_id = p.id
      where p.auth_user_id = auth.uid()
        and p.status = 'active'
        and p.deleted_at is null
        and ur.role = 'super_admin'
        and ur.status = 'active'
        and ur.is_active = true
        and ur.scope_type = 'global'
        and ur.scope_id is null
        and ur.deleted_at is null
        and (ur.expires_at is null or ur.expires_at > now())
    )
  );

create policy "system_announcements_active_all_select"
  on public.system_announcements
  for select
  using (
    deleted_at is null
    and is_active = true
    and (starts_at is null or starts_at <= now())
    and (ends_at is null or ends_at >= now())
    and audience = 'all'
    and exists (
      select 1
      from public.profiles p
      where p.auth_user_id = auth.uid()
        and p.status = 'active'
        and p.deleted_at is null
    )
  );

create policy "system_announcements_active_admin_select"
  on public.system_announcements
  for select
  using (
    deleted_at is null
    and is_active = true
    and (starts_at is null or starts_at <= now())
    and (ends_at is null or ends_at >= now())
    and audience in ('all', 'admin')
    and exists (
      select 1
      from public.profiles p
      join public.user_roles ur on ur.profile_id = p.id
      where p.auth_user_id = auth.uid()
        and p.status = 'active'
        and p.deleted_at is null
        and ur.role in (
          'church_admin',
          'organization_admin',
          'country_admin',
          'super_admin'
        )
        and ur.status = 'active'
        and ur.is_active = true
        and ur.deleted_at is null
        and (ur.expires_at is null or ur.expires_at > now())
    )
  );

create policy "system_announcements_super_admin_insert"
  on public.system_announcements
  for insert
  with check (
    exists (
      select 1
      from public.profiles p
      join public.user_roles ur on ur.profile_id = p.id
      where p.auth_user_id = auth.uid()
        and p.status = 'active'
        and p.deleted_at is null
        and ur.role = 'super_admin'
        and ur.status = 'active'
        and ur.is_active = true
        and ur.scope_type = 'global'
        and ur.scope_id is null
        and ur.deleted_at is null
        and (ur.expires_at is null or ur.expires_at > now())
    )
  );

create policy "system_announcements_super_admin_update"
  on public.system_announcements
  for update
  using (
    exists (
      select 1
      from public.profiles p
      join public.user_roles ur on ur.profile_id = p.id
      where p.auth_user_id = auth.uid()
        and p.status = 'active'
        and p.deleted_at is null
        and ur.role = 'super_admin'
        and ur.status = 'active'
        and ur.is_active = true
        and ur.scope_type = 'global'
        and ur.scope_id is null
        and ur.deleted_at is null
        and (ur.expires_at is null or ur.expires_at > now())
    )
  )
  with check (
    exists (
      select 1
      from public.profiles p
      join public.user_roles ur on ur.profile_id = p.id
      where p.auth_user_id = auth.uid()
        and p.status = 'active'
        and p.deleted_at is null
        and ur.role = 'super_admin'
        and ur.status = 'active'
        and ur.is_active = true
        and ur.scope_type = 'global'
        and ur.scope_id is null
        and ur.deleted_at is null
        and (ur.expires_at is null or ur.expires_at > now())
    )
  );

create policy "system_announcements_super_admin_delete"
  on public.system_announcements
  for delete
  using (
    exists (
      select 1
      from public.profiles p
      join public.user_roles ur on ur.profile_id = p.id
      where p.auth_user_id = auth.uid()
        and p.status = 'active'
        and p.deleted_at is null
        and ur.role = 'super_admin'
        and ur.status = 'active'
        and ur.is_active = true
        and ur.scope_type = 'global'
        and ur.scope_id is null
        and ur.deleted_at is null
        and (ur.expires_at is null or ur.expires_at > now())
    )
  );
