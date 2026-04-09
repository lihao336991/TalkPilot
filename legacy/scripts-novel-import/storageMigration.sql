alter table public.chapters
  add column if not exists content_path text,
  add column if not exists content_format text default 'json',
  add column if not exists content_version int default 1;

alter table public.chapters
  alter column content drop not null;
