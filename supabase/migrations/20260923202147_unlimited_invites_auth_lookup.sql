begin;

-- NULL means no AJE-enforced capacity. Existing invitations and members remain untouched.
alter table public.app_settings alter column guest_limit drop not null;
alter table public.app_settings alter column guest_limit drop default;
update public.app_settings set guest_limit = null where id = true;

-- The service role may ask only the Auth questions needed for an invitation.
-- No SELECT on auth.users is granted to the service role or to app clients.
create function app_private.invite_auth_user_id(invite_email text) returns uuid
language sql stable security definer set search_path = '' as $$
  select id from auth.users where lower(email) = lower(trim(invite_email)) limit 1
$$;
create function app_private.invite_auth_user_confirmed(actor uuid, invite_email text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists(
    select 1 from auth.users
    where id = actor and lower(email) = lower(trim(invite_email)) and email_confirmed_at is not null
  )
$$;
revoke all on function app_private.invite_auth_user_id(text),
  app_private.invite_auth_user_confirmed(uuid,text) from public, anon, authenticated;
grant execute on function app_private.invite_auth_user_id(text),
  app_private.invite_auth_user_confirmed(uuid,text) to service_role;

create or replace function public.reserve_app_invite(actor uuid, invite_email text) returns public.app_invites
language plpgsql security invoker set search_path = '' as $$
declare result public.app_invites; capacity integer; occupied integer; existing_user uuid;
begin
  if not exists(select 1 from public.app_members where user_id=actor and role='owner' and status='active') then raise exception 'access_denied'; end if;
  invite_email := lower(trim(invite_email));
  if length(invite_email)>254 or invite_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then raise exception 'invalid_input'; end if;
  select guest_limit into capacity from public.app_settings where id for update;
  existing_user := app_private.invite_auth_user_id(invite_email);
  if existing_user is not null and exists(select 1 from public.app_members where user_id=existing_user and status='active') then raise exception 'already_member'; end if;
  if capacity is not null then
    select (select count(*) from public.app_members where role='member' and status='active') +
      (select count(*) from public.app_invites where status='pending' and expires_at>now() and email<>invite_email) into occupied;
    if occupied>=capacity then raise exception 'capacity_reached'; end if;
  end if;
  insert into public.app_invites(email,invited_by) values(invite_email,actor)
  on conflict(email) do update set status='pending', revision=gen_random_uuid(), proof_hash=null, expires_at=now()+interval '24 hours', invited_by=actor
  returning * into result;
  update public.app_invites set user_id=existing_user where id=result.id returning * into result;
  return result;
end $$;

create or replace function public.accept_app_invite(actor uuid, invite_id uuid, proof text) returns void
language plpgsql security invoker set search_path = '' as $$
declare invitation public.app_invites;
begin
  perform 1 from public.app_settings where id for update;
  select * into invitation from public.app_invites where id=invite_id for update;
  if invitation.id is null or invitation.status<>'pending' or invitation.expires_at<=now()
     or invitation.user_id is distinct from actor or invitation.proof_hash is null or invitation.proof_hash is distinct from proof
     or not app_private.invite_auth_user_confirmed(actor, invitation.email)
  then raise exception 'invalid_invite'; end if;
  if exists(select 1 from public.app_members where user_id=actor and role='owner') then raise exception 'invalid_invite'; end if;
  insert into public.app_members(user_id,role,status) values(actor,'member','active')
  on conflict(user_id) do update set status='active';
  update public.app_invites set status='accepted',proof_hash=null where id=invite_id;
end $$;

commit;
