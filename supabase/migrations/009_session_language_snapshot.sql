alter table public.sessions
  add column if not exists native_language text not null default 'zh-CN';

alter table public.sessions
  add column if not exists learning_language text not null default 'en';

update public.sessions s
set native_language = coalesce(p.native_language, s.native_language, 'zh-CN')
from public.profiles p
where p.id = s.user_id
  and (
    s.native_language is null
    or s.native_language = ''
  );

update public.sessions
set learning_language = coalesce(nullif(learning_language, ''), 'en')
where learning_language is null
   or learning_language = '';
