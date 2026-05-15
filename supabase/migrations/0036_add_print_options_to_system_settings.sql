insert into public.system_settings (scope_type, scope_id, key, value, value_type, description)
values (
  'global',
  null,
  'print_options',
  '{
    "paper_size": "a4",
    "orientation": "portrait",
    "margin": "normal",
    "show_logo": true,
    "show_title": true,
    "show_people_info": true,
    "show_date": true,
    "show_signature": false,
    "show_page_numbers": false
  }'::jsonb,
  'json',
  'Default print options for moksilgi, personal records, and reports.'
)
on conflict on constraint system_settings_scope_key_unique do nothing;
