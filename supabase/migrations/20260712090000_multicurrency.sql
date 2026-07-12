-- Supporto multivaluta: amount_cents resta il controvalore contabile in EUR.
alter table public.transactions
  add column if not exists currency_code text not null default 'EUR',
  add column if not exists original_amount_cents bigint,
  add column if not exists exchange_rate_to_eur numeric(20, 10) not null default 1,
  add column if not exists exchange_rate_date date,
  add column if not exists exchange_rate_source text not null default 'EUR';

update public.transactions
set original_amount_cents = amount_cents
where original_amount_cents is null;

alter table public.transactions
  alter column original_amount_cents set not null;

alter table public.transactions
  drop constraint if exists transactions_currency_code_check,
  add constraint transactions_currency_code_check check (currency_code ~ '^[A-Z]{3}$'),
  drop constraint if exists transactions_original_amount_check,
  add constraint transactions_original_amount_check check (original_amount_cents > 0),
  drop constraint if exists transactions_exchange_rate_check,
  add constraint transactions_exchange_rate_check check (exchange_rate_to_eur > 0),
  drop constraint if exists transactions_exchange_rate_source_check,
  add constraint transactions_exchange_rate_source_check check (exchange_rate_source in ('ECB', 'EUR'));

create table if not exists public.exchange_rates (
  currency_code text not null check (currency_code ~ '^[A-Z]{3}$'),
  observed_on date not null,
  units_per_eur numeric(20, 10) not null check (units_per_eur > 0),
  source text not null default 'ECB' check (source = 'ECB'),
  fetched_at timestamptz not null default now(),
  primary key (currency_code, observed_on)
);

alter table public.exchange_rates enable row level security;

drop policy if exists "authenticated users read ECB rates" on public.exchange_rates;
create policy "authenticated users read ECB rates"
on public.exchange_rates for select
to authenticated
using (true);

revoke insert, update, delete on public.exchange_rates from anon, authenticated;
grant select on public.exchange_rates to authenticated;

create index if not exists exchange_rates_lookup_idx
  on public.exchange_rates (currency_code, observed_on desc);

-- Mantiene compatibili i client precedenti e impedisce controvalori incoerenti.
create or replace function public.validate_transaction_currency()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.currency_code = 'EUR' then
    new.original_amount_cents := coalesce(new.original_amount_cents, new.amount_cents);
    new.exchange_rate_to_eur := 1;
    new.exchange_rate_date := null;
    new.exchange_rate_source := 'EUR';
  else
    if new.original_amount_cents is null
      or new.exchange_rate_date is null
      or new.exchange_rate_source <> 'ECB' then
      raise exception 'Dati del cambio BCE incompleti';
    end if;
    if new.amount_cents <> round(new.original_amount_cents * new.exchange_rate_to_eur) then
      raise exception 'Controvalore EUR incoerente con il cambio';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists validate_transaction_currency_trigger on public.transactions;
create trigger validate_transaction_currency_trigger
before insert or update of amount_cents, currency_code, original_amount_cents,
  exchange_rate_to_eur, exchange_rate_date, exchange_rate_source
on public.transactions
for each row execute function public.validate_transaction_currency();
