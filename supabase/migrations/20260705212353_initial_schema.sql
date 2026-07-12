-- Categorie di entrata/uscita
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  kind text not null check (kind in ('income','expense')),
  color text not null default '#6366f1',
  icon text not null default 'tag',
  created_at timestamptz not null default now()
);

-- Documenti caricati (buste paga e altro)
create table public.documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  doc_type text not null default 'busta_paga' check (doc_type in ('busta_paga','altro')),
  storage_path text not null,
  file_name text not null,
  status text not null default 'caricato' check (status in ('caricato','analizzato','errore')),
  created_at timestamptz not null default now()
);

-- Transazioni (importi in centesimi)
create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  amount_cents integer not null check (amount_cents > 0),
  kind text not null check (kind in ('income','expense')),
  category_id uuid references public.categories(id) on delete set null,
  date date not null default current_date,
  description text not null default '',
  recurrence text check (recurrence in ('mensile','settimanale','annuale')),
  document_id uuid references public.documents(id) on delete set null,
  created_at timestamptz not null default now()
);

-- Budget mensili per categoria
create table public.budgets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  category_id uuid not null references public.categories(id) on delete cascade,
  monthly_cents integer not null check (monthly_cents > 0),
  unique (user_id, category_id)
);

-- Dati estratti dalle buste paga
create table public.payslips (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  document_id uuid not null references public.documents(id) on delete cascade,
  period_year integer not null,
  period_month integer not null check (period_month between 1 and 12),
  net_cents integer,
  gross_cents integer,
  deductions jsonb not null default '{}'::jsonb,
  vacation_days numeric,
  leave_hours numeric,
  raw_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (user_id, document_id)
);

-- Indici
create index idx_transactions_user_date on public.transactions (user_id, date desc);
create index idx_payslips_user_period on public.payslips (user_id, period_year, period_month);

-- RLS: ogni utente vede solo i propri dati
alter table public.categories enable row level security;
alter table public.transactions enable row level security;
alter table public.budgets enable row level security;
alter table public.documents enable row level security;
alter table public.payslips enable row level security;

create policy "own categories" on public.categories for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own transactions" on public.transactions for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own budgets" on public.budgets for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own documents" on public.documents for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own payslips" on public.payslips for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Bucket privato per i documenti
insert into storage.buckets (id, name, public) values ('documents', 'documents', false);

create policy "own docs read" on storage.objects for select
  using (bucket_id = 'documents' and auth.uid()::text = (storage.foldername(name))[1]);
create policy "own docs insert" on storage.objects for insert
  with check (bucket_id = 'documents' and auth.uid()::text = (storage.foldername(name))[1]);
create policy "own docs delete" on storage.objects for delete
  using (bucket_id = 'documents' and auth.uid()::text = (storage.foldername(name))[1]);;
