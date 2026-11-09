-- Ejecuta esto una vez en Supabase → SQL Editor → New query → Run
create table if not exists public.palmascent_data(
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null default '{}',
  updated_at timestamptz not null default now()
);
alter table public.palmascent_data enable row level security;
create policy "solo mis datos" on public.palmascent_data
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
alter publication supabase_realtime add table public.palmascent_data;
