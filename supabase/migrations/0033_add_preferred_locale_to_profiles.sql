alter table public.profiles
  add column if not exists preferred_locale varchar(10) default 'ko';

alter table public.profiles
  add column if not exists locale_updated_at timestamptz;

update public.profiles
set preferred_locale = 'ko'
where preferred_locale is null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'profiles_preferred_locale_check'
  ) then
    alter table public.profiles
      add constraint profiles_preferred_locale_check
      check (preferred_locale in ('ko', 'en', 'th', 'my', 'fil', 'zh'));
  end if;
end $$;

create index if not exists idx_profiles_preferred_locale
  on public.profiles(preferred_locale);
