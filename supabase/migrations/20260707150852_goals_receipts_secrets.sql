-- Obiettivi di risparmio
create table public.goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  target_cents integer not null check (target_cents > 0),
  saved_cents integer not null default 0 check (saved_cents >= 0),
  deadline date,
  created_at timestamptz not null default now()
);
alter table public.goals enable row level security;
create policy "own goals" on public.goals for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Documenti: nuovo tipo 'scontrino' e colonna per l'analisi AI salvata
alter table public.documents drop constraint if exists documents_doc_type_check;
alter table public.documents add constraint documents_doc_type_check
  check (doc_type in ('busta_paga','scontrino','altro'));
alter table public.documents add column if not exists analysis jsonb;

-- Segreti dell'app: RLS attiva senza policy = leggibile solo dal service role (Edge Functions)
create table public.app_secrets (
  name text primary key,
  value text not null
);
alter table public.app_secrets enable row level security;;
