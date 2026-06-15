create table if not exists public.portfolio_content (
  id text primary key,
  content jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.portfolio_content enable row level security;

insert into storage.buckets (id, name, public)
values ('portfolio-media', 'portfolio-media', true)
on conflict (id) do update set public = true;

-- Public visitors can only read media. Database writes and media uploads
-- are performed by authenticated Netlify Functions using the service role.
drop policy if exists "Public portfolio media read" on storage.objects;

create policy "Public portfolio media read"
on storage.objects for select
using (bucket_id = 'portfolio-media');
