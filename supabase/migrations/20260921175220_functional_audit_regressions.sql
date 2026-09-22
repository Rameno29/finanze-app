-- One document confirmation cannot produce two expenses/incomes on concurrent clicks.
-- Preflight: abort instead of silently deleting any pre-existing duplicate.
begin;
create unique index transactions_one_document on public.transactions(user_id,document_id) where document_id is not null;

create function public.save_account_transfer(legs jsonb) returns void
language plpgsql security invoker set search_path='' as $$
declare a jsonb; b jsonb; actor uuid := auth.uid(); group_id uuid; existing_count integer;
begin
  if not app_private.is_active_member() then raise exception 'access_denied'; end if;
  if jsonb_typeof(legs)<>'array' or jsonb_array_length(legs)<>2 then raise exception 'invalid_transfer'; end if;
  a := legs->0; b := legs->1; group_id := (a->>'transfer_group')::uuid;
  if group_id is null or group_id is distinct from (b->>'transfer_group')::uuid
    or (a->>'id')::uuid is null or (b->>'id')::uuid is null or (a->>'id')=(b->>'id')
    or (a->>'kind') is distinct from 'expense' or (b->>'kind') is distinct from 'income'
    or (a->>'amount_cents')::integer is null or (a->>'amount_cents')::integer<=0
    or (a->>'amount_cents')::integer is distinct from (b->>'amount_cents')::integer
    or (a->>'account_id')::uuid is null or (b->>'account_id')::uuid is null or (a->>'account_id')=(b->>'account_id')
    or (a->>'date')::date is null or (a->>'date')::date is distinct from (b->>'date')::date
  then raise exception 'invalid_transfer'; end if;
  perform pg_advisory_xact_lock(hashtextextended(actor::text||group_id::text,0));
  select count(*) into existing_count from public.transactions where user_id=actor and transfer_group=group_id;
  if existing_count>0 then
    if existing_count<>2 or exists(
      select 1 from jsonb_array_elements(legs) l where not exists(
        select 1 from public.transactions t where t.user_id=actor and t.transfer_group=group_id and t.id=(l->>'id')::uuid
          and t.kind=l->>'kind' and t.account_id=(l->>'account_id')::uuid and t.amount_cents=(l->>'amount_cents')::integer and t.date=(l->>'date')::date
      )) then raise exception 'transfer_conflict'; end if;
    return;
  end if;
  insert into public.transactions(id,user_id,amount_cents,kind,account_id,date,description,transfer_group)
    select (l->>'id')::uuid,actor,(l->>'amount_cents')::integer,l->>'kind',(l->>'account_id')::uuid,(l->>'date')::date,left(coalesce(l->>'description','Trasferimento'),500),group_id
    from jsonb_array_elements(legs) l;
end $$;
create function public.delete_account_transfer(group_id uuid) returns void
language plpgsql security invoker set search_path='' as $$
begin
  if not app_private.is_active_member() then raise exception 'access_denied'; end if;
  delete from public.transactions where user_id=(select auth.uid()) and transfer_group=group_id;
end
$$;
revoke all on function public.save_account_transfer(jsonb),public.delete_account_transfer(uuid) from public,anon;
grant execute on function public.save_account_transfer(jsonb),public.delete_account_transfer(uuid) to authenticated;

-- Keep the original day across short months/leap years and retain the currency snapshot.
alter table public.transactions add column recurrence_anchor date;
update public.transactions set recurrence_anchor=date where recurrence is not null;
create function app_private.set_recurrence_anchor() returns trigger
language plpgsql set search_path='' as $$
begin
  if new.recurrence is not null then
    if new.recurrence_anchor is null then new.recurrence_anchor:=new.date; end if;
    if tg_op='UPDATE' then
      if new.date is distinct from old.date then new.recurrence_anchor:=new.date; end if;
    end if;
  end if;
  return new;
end $$;
revoke all on function app_private.set_recurrence_anchor() from public,anon,authenticated;
create trigger set_recurrence_anchor before insert or update of date,recurrence on public.transactions
for each row execute function app_private.set_recurrence_anchor();

create or replace function public.materialize_recurring_transactions() returns void
language plpgsql security definer set search_path='' as $$
declare item public.transactions; next_date date; month_start date; current_id uuid; new_id uuid; loop_count integer;
  today date := (now() at time zone 'Europe/Rome')::date;
begin
  perform pg_advisory_xact_lock(94287123);
  for item in select t.* from public.transactions t join public.app_members m on m.user_id=t.user_id
    where t.recurrence is not null and m.status='active' for update of t
  loop
    current_id:=item.id;
    loop_count:=0;
    loop
      if item.recurrence='settimanale' then next_date:=item.date+7;
      else
        month_start:=case when item.recurrence='mensile' then (date_trunc('month',item.date)+interval '1 month')::date
          else make_date(extract(year from item.date)::integer+1,extract(month from item.recurrence_anchor)::integer,1) end;
        next_date:=month_start+least(extract(day from item.recurrence_anchor)::integer,extract(day from month_start+interval '1 month'-interval '1 day')::integer)-1;
      end if;
      exit when next_date>today or loop_count>=1000;
      insert into public.transactions(user_id,amount_cents,kind,category_id,date,description,recurrence,account_id,
        currency_code,original_amount_cents,exchange_rate_to_eur,exchange_rate_date,exchange_rate_source,recurrence_anchor)
      values(item.user_id,item.amount_cents,item.kind,item.category_id,next_date,item.description,item.recurrence,item.account_id,
        item.currency_code,item.original_amount_cents,item.exchange_rate_to_eur,item.exchange_rate_date,item.exchange_rate_source,item.recurrence_anchor)
      returning id into new_id;
      update public.transactions set recurrence=null where id=current_id;
      current_id:=new_id; item.date:=next_date; loop_count:=loop_count+1;
    end loop;
  end loop;
end $$;
revoke all on function public.materialize_recurring_transactions() from public,anon,authenticated;

-- Serialize deliveries across cron invocations without holding a DB transaction
-- open during network I/O. Clients cannot forge/release server delivery claims.
create table public.app_reminder_claims (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null unique references public.tasks(id) on delete cascade,
  expected_date date not null,
  expected_time time,
  expected_title text not null,
  expires_at timestamptz not null default now()+interval '2 minutes'
);
alter table public.app_reminder_claims enable row level security;
revoke all on public.app_reminder_claims from public,anon,authenticated;
grant all on public.app_reminder_claims to service_role;

create function public.claim_task_reminder(target_task uuid, expected_date date, expected_time time, expected_title text) returns uuid
language plpgsql security invoker set search_path='' as $$
declare token uuid; local_now timestamp := now() at time zone 'Europe/Rome';
begin
  perform 1 from public.tasks t join public.app_members m on m.user_id=t.user_id
    where t.id=target_task and not t.done and not t.notified and m.status='active'
      and t.due_date=expected_date and t.due_time is not distinct from expected_time and t.title=expected_title
      and (t.due_date<local_now::date or (t.due_date=local_now::date and coalesce(t.due_time,'09:00'::time)<=local_now::time))
    for update of t;
  if not found then return null; end if;
  insert into public.app_reminder_claims(task_id,expected_date,expected_time,expected_title)
    values(target_task,expected_date,expected_time,expected_title)
    on conflict(task_id) do update set id=gen_random_uuid(), expected_date=excluded.expected_date,
      expected_time=excluded.expected_time,expected_title=excluded.expected_title,expires_at=now()+interval '2 minutes'
    where public.app_reminder_claims.expires_at<=now()
    returning id into token;
  return token;
end $$;

create function public.finish_task_reminder(target_task uuid, claim_token uuid, delivered boolean) returns boolean
language plpgsql security invoker set search_path='' as $$
declare claim public.app_reminder_claims; affected integer := 0;
begin
  -- Same lock order as claim_task_reminder: task, then claim.
  perform 1 from public.tasks where id=target_task for update;
  select * into claim from public.app_reminder_claims where task_id=target_task and id=claim_token for update;
  if not found then return false; end if;
  if delivered then
    update public.tasks t set notified=true where t.id=target_task and not t.done and not t.notified
      and t.due_date=claim.expected_date and t.due_time is not distinct from claim.expected_time
      and t.title=claim.expected_title
      and exists(select 1 from public.app_members m where m.user_id=t.user_id and m.status='active');
    get diagnostics affected = row_count;
  end if;
  delete from public.app_reminder_claims where id=claim_token;
  return affected=1;
end $$;
revoke all on function public.claim_task_reminder(uuid,date,time,text),public.finish_task_reminder(uuid,uuid,boolean) from public,anon,authenticated;
grant execute on function public.claim_task_reminder(uuid,date,time,text),public.finish_task_reminder(uuid,uuid,boolean) to service_role;
commit;
