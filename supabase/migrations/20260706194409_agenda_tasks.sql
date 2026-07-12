create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  notes text not null default '',
  due_date date,
  due_time time,
  done boolean not null default false,
  created_at timestamptz not null default now()
);

create index idx_tasks_user_due on public.tasks (user_id, due_date);

alter table public.tasks enable row level security;
create policy "own tasks" on public.tasks for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);;
