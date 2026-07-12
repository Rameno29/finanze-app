create extension if not exists pg_cron;

-- Materializza le transazioni ricorrenti scadute:
-- crea la nuova occorrenza e sposta il "testimone" della ricorrenza sulla riga più recente.
create or replace function public.materialize_recurring_transactions()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  with due as (
    select id, user_id, amount_cents, kind, category_id, description, recurrence,
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
    insert into transactions (user_id, amount_cents, kind, category_id, date, description, recurrence)
    select user_id, amount_cents, kind, category_id, next_date, description, recurrence
    from to_create
    returning id
  )
  update transactions set recurrence = null where id in (select id from to_create);
end;
$$;

-- Esecuzione ogni notte alle 3:15 (l'app la richiama comunque in modo idempotente)
select cron.schedule('materialize-recurring', '15 3 * * *', 'select public.materialize_recurring_transactions()');;
