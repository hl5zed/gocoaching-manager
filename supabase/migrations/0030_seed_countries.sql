insert into public.countries (name, code)
select seed.name, seed.code
from (
  values
    ('Thailand', 'TH'),
    ('South Korea', 'KR'),
    ('United States', 'US'),
    ('Japan', 'JP'),
    ('China', 'CN'),
    ('Vietnam', 'VN'),
    ('Laos', 'LA'),
    ('Myanmar', 'MM'),
    ('Cambodia', 'KH'),
    ('Philippines', 'PH'),
    ('Indonesia', 'ID'),
    ('Malaysia', 'MY'),
    ('Singapore', 'SG'),
    ('India', 'IN'),
    ('Australia', 'AU'),
    ('New Zealand', 'NZ'),
    ('United Kingdom', 'GB'),
    ('Germany', 'DE'),
    ('France', 'FR'),
    ('Canada', 'CA')
) as seed(name, code)
where not exists (
  select 1
  from public.countries as countries
  where lower(trim(countries.name)) = lower(trim(seed.name))
    or upper(trim(countries.code)) = upper(trim(seed.code))
);
