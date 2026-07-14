-- Multi-conto: conti separati (contanti, banca, carta) con saldo iniziale,
-- assegnazione dei movimenti a un conto e trasferimenti interni (coppia di
-- movimenti legati da transfer_group, esclusi dai totali entrate/uscite).

create table if not exists public.accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 40),
  kind text not null default 'banca' check (kind in ('contanti', 'banca', 'carta')),
  -- Saldo di partenza (può essere negativo, es. carta di credito).
  initial_balance_cents bigint not null default 0,
  created_at timestamptz not null default now(),
  unique (user_id, name)
);

alter table public.accounts enable row level security;

drop policy if exists "own accounts" on public.accounts;
create policy "own accounts" on public.accounts for all
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

alter table public.transactions
  add column if not exists account_id uuid references public.accounts(id) on delete set null,
  add column if not exists transfer_group uuid;

-- I trasferimenti interni non hanno categoria né ricorrenza.
alter table public.transactions
  drop constraint if exists transactions_transfer_shape_check,
  add constraint transactions_transfer_shape_check
    check (transfer_group is null or (category_id is null and recurrence is null));

create index if not exists idx_transactions_user_account
  on public.transactions (user_id, account_id);
create index if not exists idx_transactions_transfer_group
  on public.transactions (transfer_group) where transfer_group is not null;

-- La materializzazione delle ricorrenze conserva anche il conto di appartenenza.
create or replace function public.materialize_recurring_transactions()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  with due as (
    select id, user_id, amount_cents, kind, category_id, description, recurrence, account_id,
      case recurrence
        when 'settimanale' then (date + interval '7 days')::date
        when 'mensile' then (date + interval '1 month')::date
        when 'annuale' then (date + interval '1 year')::date
      end as next_date
    from transactions
    where recurrence is not null
  ),
  to_create as (
    select * from due where next_date is not null and next_date <= current_date
  ),
  inserted as (
    insert into transactions (user_id, amount_cents, kind, category_id, date, description, recurrence, account_id)
    select user_id, amount_cents, kind, category_id, next_date, description, recurrence, account_id
    from to_create
    returning id
  )
  update transactions set recurrence = null where id in (select id from to_create);
end;
$$;
