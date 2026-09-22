-- Additive migration. Bootstrap uses the sole existing Auth identity, not mutable email/metadata.
-- Preflight MUST confirm there is exactly one legitimate account before deployment.
-- The CLI can execute statements separately: keep the lock and all DDL atomic.
begin;
lock table auth.users in share row exclusive mode;
create schema if not exists app_private;
revoke all on schema app_private from public, anon;
grant usage on schema app_private to authenticated, service_role;

create table public.app_members (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('owner','member')),
  status text not null default 'active' check (status in ('active','suspended')),
  created_at timestamptz not null default now()
);
create unique index app_single_owner on public.app_members(role) where role='owner';
alter table public.app_members enable row level security;
revoke all on public.app_members from public, anon, authenticated;
grant select on public.app_members to authenticated;
grant all on public.app_members to service_role;
create policy "own membership" on public.app_members for select to authenticated using (user_id=(select auth.uid()));

do $$
declare owner_id uuid;
begin
  if (select count(*) from auth.users) <> 1 then
    raise exception 'Bootstrap requires exactly one existing owner; verify auth.users before migrating';
  end if;
  select id into owner_id from auth.users;
  insert into public.app_members(user_id,role) values(owner_id,'owner');
end $$;

create table public.app_settings (
  id boolean primary key default true check(id),
  guest_limit integer not null default 1 check(guest_limit between 1 and 20)
);
insert into public.app_settings(id) values(true);

create table public.app_invites (
  id uuid primary key default gen_random_uuid(),
  email text not null unique check(email=lower(trim(email)) and length(email)<=254),
  status text not null default 'pending' check(status in ('pending','accepted','cancelled')),
  revision uuid not null default gen_random_uuid(),
  proof_hash text,
  user_id uuid references auth.users(id) on delete set null,
  invited_by uuid not null references auth.users(id),
  expires_at timestamptz not null default now()+interval '24 hours',
  created_at timestamptz not null default now()
);
create table public.user_api_credentials (
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null check(provider in ('gemini','youtube')),
  ciphertext text not null,
  nonce text not null,
  key_version text not null,
  suffix text not null check(length(suffix)<=4),
  updated_at timestamptz not null default now(),
  primary key(user_id,provider)
);
create table public.user_integrations (
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null check(provider in ('google','spotify')),
  client_id text not null check(length(client_id) between 5 and 300),
  updated_at timestamptz not null default now(),
  primary key(user_id,provider)
);
create table public.app_rate_limits (
  user_id uuid not null references auth.users(id) on delete cascade,
  bucket text not null,
  window_start timestamptz not null,
  requests integer not null,
  primary key(user_id,bucket)
);
create index app_invites_user on public.app_invites(user_id);
create index app_invites_inviter on public.app_invites(invited_by);
create table public.app_request_leases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  expires_at timestamptz not null default now()+interval '120 seconds'
);
create index app_request_leases_user on public.app_request_leases(user_id);
do $$ declare t text; begin
  foreach t in array array['app_settings','app_invites','user_api_credentials','user_integrations','app_rate_limits','app_request_leases'] loop
    execute format('alter table public.%I enable row level security',t);
    execute format('revoke all on public.%I from public, anon, authenticated',t);
    execute format('grant all on public.%I to service_role',t);
  end loop;
end $$;

create function app_private.is_active_member() returns boolean
language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.app_members where user_id=(select auth.uid()) and status='active')
$$;
revoke all on function app_private.is_active_member() from public,anon;
grant execute on function app_private.is_active_member() to authenticated,service_role;

-- Restrictive policy composes with all existing ownership policies, including future permissive policies.
do $$ declare t text; begin
  foreach t in array array['categories','accounts','transactions','budgets','documents','payslips','tasks','goals','push_subscriptions','exchange_rates'] loop
    execute format('alter table public.%I enable row level security',t);
    execute format('create policy "active membership" on public.%I as restrictive for all to authenticated using ((select app_private.is_active_member())) with check ((select app_private.is_active_member()))',t);
  end loop;
end $$;
create policy "active document membership" on storage.objects as restrictive for all to authenticated
  using (bucket_id <> 'documents' or (select app_private.is_active_member()))
  with check (bucket_id <> 'documents' or (select app_private.is_active_member()));

create or replace function public.enforce_signup_allowlist() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if not exists(select 1 from public.app_invites where email=lower(trim(new.email)) and status='pending' and expires_at>now()) then
    raise exception 'Registration requires an invitation';
  end if;
  return new;
end $$;
revoke all on function public.enforce_signup_allowlist() from public,anon,authenticated;
drop trigger if exists enforce_signup_allowlist on auth.users;
create trigger enforce_signup_allowlist before insert on auth.users for each row execute function public.enforce_signup_allowlist();

create function public.reserve_app_invite(actor uuid, invite_email text) returns public.app_invites
language plpgsql security invoker set search_path='' as $$
declare result public.app_invites; capacity integer; occupied integer;
begin
  if not exists(select 1 from public.app_members where user_id=actor and role='owner' and status='active') then raise exception 'access_denied'; end if;
  invite_email := lower(trim(invite_email));
  if length(invite_email)>254 or invite_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then raise exception 'invalid_input'; end if;
  select guest_limit into capacity from public.app_settings where id for update;
  if exists(select 1 from public.app_members m join auth.users u on u.id=m.user_id where lower(u.email)=invite_email and m.status='active') then raise exception 'already_member'; end if;
  select (select count(*) from public.app_members where role='member' and status='active') +
    (select count(*) from public.app_invites where status='pending' and expires_at>now() and email<>invite_email) into occupied;
  if occupied>=capacity then raise exception 'capacity_reached'; end if;
  insert into public.app_invites(email,invited_by) values(invite_email,actor)
  on conflict(email) do update set status='pending', revision=gen_random_uuid(), proof_hash=null, expires_at=now()+interval '24 hours', invited_by=actor
  returning * into result;
  update public.app_invites set user_id=(select id from auth.users where lower(email)=invite_email limit 1) where id=result.id returning * into result;
  return result;
end $$;

create function public.accept_app_invite(actor uuid, invite_id uuid, proof text) returns void
language plpgsql security invoker set search_path='' as $$
declare invitation public.app_invites;
begin
  perform 1 from public.app_settings where id for update;
  select * into invitation from public.app_invites where id=invite_id for update;
  if invitation.id is null or invitation.status<>'pending' or invitation.expires_at<=now()
     or invitation.user_id is distinct from actor or invitation.proof_hash is null or invitation.proof_hash is distinct from proof
     or not exists(select 1 from auth.users where id=actor and lower(email)=invitation.email and email_confirmed_at is not null)
  then raise exception 'invalid_invite'; end if;
  if exists(select 1 from public.app_members where user_id=actor and role='owner') then raise exception 'invalid_invite'; end if;
  insert into public.app_members(user_id,role,status) values(actor,'member','active')
  on conflict(user_id) do update set status='active';
  update public.app_invites set status='accepted',proof_hash=null where id=invite_id;
end $$;

create function public.consume_app_rate(actor uuid, rate_bucket text, max_requests integer default 30) returns boolean
language plpgsql security invoker set search_path='' as $$
declare count_now integer;
begin
  if max_requests<1 or max_requests>1000 or length(rate_bucket)>60 then raise exception 'invalid_input'; end if;
  insert into public.app_rate_limits(user_id,bucket,window_start,requests) values(actor,rate_bucket,date_trunc('minute',now()),1)
  on conflict(user_id,bucket) do update set
    requests=case when public.app_rate_limits.window_start=date_trunc('minute',now()) then public.app_rate_limits.requests+1 else 1 end,
    window_start=date_trunc('minute',now()) returning requests into count_now;
  return count_now<=max_requests;
end $$;
revoke all on function public.reserve_app_invite(uuid,text), public.accept_app_invite(uuid,uuid,text), public.consume_app_rate(uuid,text,integer) from public,anon,authenticated;
grant execute on function public.reserve_app_invite(uuid,text), public.accept_app_invite(uuid,uuid,text), public.consume_app_rate(uuid,text,integer) to service_role;

create function public.suspend_app_member(actor uuid, target_user uuid) returns void
language plpgsql security invoker set search_path='' as $$
begin
  if not exists(select 1 from public.app_members where user_id=actor and role='owner' and status='active') then raise exception 'access_denied'; end if;
  perform 1 from public.app_settings where id for update;
  update public.app_members set status='suspended' where user_id=target_user and role='member';
  if not found then raise exception 'invalid_input'; end if;
  update public.app_invites set status='cancelled',proof_hash=null,revision=gen_random_uuid() where user_id=target_user;
end $$;
create function public.acquire_app_lease(actor uuid) returns uuid
language plpgsql security invoker set search_path='' as $$
declare lease_id uuid;
begin
  perform pg_advisory_xact_lock(hashtextextended(actor::text,0));
  delete from public.app_request_leases where expires_at<=now();
  if (select count(*) from public.app_request_leases where user_id=actor)>=3 then return null; end if;
  insert into public.app_request_leases(user_id) values(actor) returning id into lease_id;
  return lease_id;
end $$;
revoke all on function public.suspend_app_member(uuid,uuid), public.acquire_app_lease(uuid) from public,anon,authenticated;
grant execute on function public.suspend_app_member(uuid,uuid), public.acquire_app_lease(uuid) to service_role;

-- Enforce ownership of referenced records even for service-role writes and offline replay.
create function app_private.check_record_owner() returns trigger
language plpgsql security definer set search_path='' as $$
declare row_data jsonb := to_jsonb(new); field text; target text; ref_id uuid; valid boolean;
begin
  foreach field in array array['account_id','category_id','document_id'] loop
    ref_id := (row_data->>field)::uuid;
    if ref_id is not null then
      target := case field when 'account_id' then 'accounts' when 'category_id' then 'categories' else 'documents' end;
      execute format('select exists(select 1 from public.%I where id=$1 and user_id=$2)',target) into valid using ref_id,new.user_id;
      if not valid then raise exception 'foreign_owner'; end if;
    end if;
  end loop;
  if tg_table_name='documents' and split_part(row_data->>'storage_path','/',1)<>new.user_id::text then raise exception 'foreign_owner'; end if;
  return new;
end $$;
revoke all on function app_private.check_record_owner() from public,anon,authenticated;
create trigger check_transaction_owner before insert or update on public.transactions for each row execute function app_private.check_record_owner();
create trigger check_budget_owner before insert or update on public.budgets for each row execute function app_private.check_record_owner();
create trigger check_payslip_owner before insert or update on public.payslips for each row execute function app_private.check_record_owner();
create trigger check_document_owner before insert or update on public.documents for each row execute function app_private.check_record_owner();
commit;
