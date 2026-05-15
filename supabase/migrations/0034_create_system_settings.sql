create table if not exists public.system_settings (
  id uuid primary key default gen_random_uuid(),
  scope_type text not null default 'global',
  scope_id uuid null,
  key text not null,
  value jsonb not null,
  value_type text not null,
  description text null,
  updated_by uuid null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint system_settings_scope_key_unique unique nulls not distinct (scope_type, scope_id, key)
);

alter table public.system_settings enable row level security;

insert into public.system_settings (scope_type, scope_id, key, value, value_type, description)
values
  (
    'global',
    null,
    'default_locale',
    '{"locale":"ko"}'::jsonb,
    'locale',
    'Global default interface locale for new sessions and fallbacks.'
  ),
  (
    'global',
    null,
    'default_country_id',
    '{"country_id":null}'::jsonb,
    'uuid',
    'Global default country used by administrative forms.'
  ),
  (
    'global',
    null,
    'invitation_expires_in_days',
    '{"days":7}'::jsonb,
    'number',
    'Default invitation expiration period in days.'
  )
on conflict on constraint system_settings_scope_key_unique do nothing;

drop policy if exists "system_settings_super_admin_select" on public.system_settings;
drop policy if exists "system_settings_super_admin_insert" on public.system_settings;
drop policy if exists "system_settings_super_admin_update" on public.system_settings;
drop policy if exists "system_settings_super_admin_delete" on public.system_settings;

create policy "system_settings_super_admin_select"
  on public.system_settings
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

create policy "system_settings_super_admin_insert"
  on public.system_settings
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

create policy "system_settings_super_admin_update"
  on public.system_settings
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

create policy "system_settings_super_admin_delete"
  on public.system_settings
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
