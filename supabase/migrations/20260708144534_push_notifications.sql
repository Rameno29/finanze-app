-- Sottoscrizioni push per le notifiche dei promemoria
create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);
create index idx_push_subs_user on public.push_subscriptions (user_id);
alter table public.push_subscriptions enable row level security;
create policy "own push subscriptions" on public.push_subscriptions for all
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- Traccia le attività già notificate (evita doppioni)
alter table public.tasks add column if not exists notified boolean not null default false;

-- Estensione per chiamare la Edge Function dal cron
create extension if not exists pg_net;;
