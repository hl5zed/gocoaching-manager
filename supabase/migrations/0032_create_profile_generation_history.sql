create table if not exists public.profile_generation_history (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id),
  old_generation_number integer null,
  new_generation_number integer null,
  changed_by_auth_user_id uuid null,
  changed_by_profile_id uuid null references public.profiles(id),
  change_source text not null default 'manual_admin',
  reason text null,
  created_at timestamptz not null default now()
);

create index if not exists idx_profile_generation_history_profile_id
  on public.profile_generation_history (profile_id);

create index if not exists idx_profile_generation_history_created_at
  on public.profile_generation_history (created_at);

create index if not exists idx_profile_generation_history_new_generation_number
  on public.profile_generation_history (new_generation_number);

create index if not exists idx_profile_generation_history_changed_by_profile_id
  on public.profile_generation_history (changed_by_profile_id);

create or replace function public.fn_record_profile_generation_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_changed_by_profile_id uuid;
begin
  if old.generation_number is distinct from new.generation_number then
    if auth.uid() is not null then
      select p.id
      into v_changed_by_profile_id
      from public.profiles as p
      where p.auth_user_id = auth.uid()
        and p.deleted_at is null
      limit 1;
    end if;

    insert into public.profile_generation_history (
      profile_id,
      old_generation_number,
      new_generation_number,
      changed_by_auth_user_id,
      changed_by_profile_id,
      change_source,
      created_at
    )
    values (
      new.id,
      old.generation_number,
      new.generation_number,
      auth.uid(),
      v_changed_by_profile_id,
      'manual_admin',
      now()
    );
  end if;

  return new;
end;
$$;

do $$
begin
  if not exists (
    select 1
    from pg_trigger
    where tgname = 'trg_profiles_generation_history'
  ) then
    create trigger trg_profiles_generation_history
      after update of generation_number on public.profiles
      for each row
      execute function public.fn_record_profile_generation_change();
  end if;
end $$;

alter table public.profile_generation_history enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'profile_generation_history'
      and policyname = 'profile_generation_history_select_admin_roles'
  ) then
    create policy profile_generation_history_select_admin_roles
      on public.profile_generation_history
      for select
      to authenticated
      using (
        exists (
          select 1
          from public.profiles as viewer
          join public.user_roles as viewer_role
            on viewer_role.profile_id = viewer.id
          where viewer.auth_user_id = auth.uid()
            and viewer.deleted_at is null
            and viewer.status <> 'anonymized'
            and viewer_role.deleted_at is null
            and viewer_role.status = 'active'
            and viewer_role.is_active = true
            and (
              viewer_role.expires_at is null
              or viewer_role.expires_at > now()
            )
            and viewer_role.role in (
              'super_admin',
              'country_admin',
              'organization_admin',
              'church_admin',
              'coach_maker'
            )
        )
      );
  end if;
end $$;
