create table if not exists public.generation_options (
  id uuid primary key default gen_random_uuid(),
  generation_number integer not null,
  label text not null,
  scope_type text not null default 'global',
  scope_id uuid null,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz null,

  constraint generation_options_generation_number_check
    check (generation_number >= 1),
  constraint generation_options_label_check
    check (length(trim(label)) > 0),
  constraint generation_options_scope_type_check
    check (scope_type in ('global', 'country', 'organization', 'church'))
);

create index if not exists idx_generation_options_generation_number
  on public.generation_options (generation_number);

create index if not exists idx_generation_options_scope
  on public.generation_options (scope_type, scope_id);

create index if not exists idx_generation_options_is_active
  on public.generation_options (is_active);

create index if not exists idx_generation_options_sort_order
  on public.generation_options (sort_order);

create index if not exists idx_generation_options_deleted_at
  on public.generation_options (deleted_at);

create unique index if not exists idx_generation_options_global_number_unique
  on public.generation_options (generation_number)
  where scope_type = 'global' and scope_id is null and deleted_at is null;

create or replace function public.set_generation_options_updated_at()
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
    where tgname = 'trg_generation_options_set_updated_at'
  ) then
    if to_regprocedure('public.set_updated_at()') is not null then
      create trigger trg_generation_options_set_updated_at
        before update on public.generation_options
        for each row execute function public.set_updated_at();
    else
      create trigger trg_generation_options_set_updated_at
        before update on public.generation_options
        for each row execute function public.set_generation_options_updated_at();
    end if;
  end if;
end $$;

insert into public.generation_options (
  generation_number,
  label,
  scope_type,
  is_active,
  sort_order
)
select seed.generation_number, seed.label, 'global', true, seed.generation_number
from (
  values
    (1, '1세대'),
    (2, '2세대'),
    (3, '3세대'),
    (4, '4세대'),
    (5, '5세대')
) as seed(generation_number, label)
where not exists (
  select 1
  from public.generation_options as existing
  where existing.scope_type = 'global'
    and existing.scope_id is null
    and existing.deleted_at is null
    and existing.generation_number = seed.generation_number
);

alter table public.generation_options enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'generation_options'
      and policyname = 'generation_options_select_authenticated'
  ) then
    create policy generation_options_select_authenticated
      on public.generation_options
      for select
      to authenticated
      using (deleted_at is null);
  end if;
end $$;
