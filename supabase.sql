-- Ejecuta en Supabase → SQL Editor → New query → Run (se puede ejecutar varias veces sin error)
create table if not exists public.palmascent_data(
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null default '{}',
  updated_at timestamptz not null default now()
);
alter table public.palmascent_data enable row level security;
drop policy if exists "solo mis datos" on public.palmascent_data;
create policy "solo mis datos" on public.palmascent_data
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Protección contra sobrescrituras: ignora escrituras con fecha más vieja que la guardada
create or replace function public.palma_no_pisar() returns trigger language plpgsql as $$
begin
  if new.updated_at < old.updated_at then return null; end if;
  return new;
end $$;
drop trigger if exists palma_no_pisar on public.palmascent_data;
create trigger palma_no_pisar before update on public.palmascent_data
  for each row execute function public.palma_no_pisar();

do $$ begin
  alter publication supabase_realtime add table public.palmascent_data;
exception when duplicate_object then null; end $$;
