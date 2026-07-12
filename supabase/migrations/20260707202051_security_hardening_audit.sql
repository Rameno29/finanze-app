-- 1) La funzione delle ricorrenze non deve essere invocabile via API pubblica
revoke execute on function public.materialize_recurring_transactions() from public, anon, authenticated;

-- 2) Difesa in profondità sui segreti dell'app
revoke all on table public.app_secrets from anon, authenticated;

-- 3) Lista di email autorizzate a registrarsi (l'app è personale)
create table public.allowed_emails (
  email text primary key
);
alter table public.allowed_emails enable row level security;
revoke all on table public.allowed_emails from anon, authenticated;
insert into public.allowed_emails (email) values ('bogdanstafie1996@gmail.com');

create or replace function public.enforce_signup_allowlist()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from public.allowed_emails where lower(email) = lower(new.email)) then
    raise exception 'Registrazione non consentita: questa app è privata.';
  end if;
  return new;
end;
$$;
revoke execute on function public.enforce_signup_allowlist() from public, anon, authenticated;

drop trigger if exists enforce_signup_allowlist on auth.users;
create trigger enforce_signup_allowlist
  before insert on auth.users
  for each row execute function public.enforce_signup_allowlist();

-- 4) Limiti sul bucket documenti: max 20 MB, solo PDF/immagini
update storage.buckets
set file_size_limit = 20971520,
    allowed_mime_types = array['application/pdf','image/jpeg','image/png','image/webp']
where id = 'documents';

-- 5) Indici mancanti sulle chiavi esterne (advisor performance)
create index if not exists idx_budgets_category on public.budgets (category_id);
create index if not exists idx_categories_user on public.categories (user_id);
create index if not exists idx_documents_user on public.documents (user_id);
create index if not exists idx_goals_user on public.goals (user_id);
create index if not exists idx_payslips_document on public.payslips (document_id);
create index if not exists idx_transactions_category on public.transactions (category_id);
create index if not exists idx_transactions_document on public.transactions (document_id);

-- 6) Policy RLS ottimizzate: (select auth.uid()) valutato una sola volta per query
drop policy "own categories" on public.categories;
create policy "own categories" on public.categories for all
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

drop policy "own transactions" on public.transactions;
create policy "own transactions" on public.transactions for all
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

drop policy "own budgets" on public.budgets;
create policy "own budgets" on public.budgets for all
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

drop policy "own documents" on public.documents;
create policy "own documents" on public.documents for all
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

drop policy "own payslips" on public.payslips;
create policy "own payslips" on public.payslips for all
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

drop policy "own tasks" on public.tasks;
create policy "own tasks" on public.tasks for all
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

drop policy "own goals" on public.goals;
create policy "own goals" on public.goals for all
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);;
