import { PGlite } from '@electric-sql/pglite'
import { readFileSync, readdirSync } from 'node:fs'
import { beforeAll, afterAll, describe, expect, it } from 'vitest'

const owner = '11111111-1111-4111-8111-111111111111'
const guest = '22222222-2222-4222-8222-222222222222'
let db: PGlite
beforeAll(async () => {
  db = new PGlite()
  await db.exec(`
    create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth; create schema storage;
    create table auth.users(id uuid primary key, email text, email_confirmed_at timestamptz);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
    create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text);
    alter table storage.objects enable row level security;
    create function storage.foldername(text) returns text[] language sql as $$select string_to_array($1,'/')$$;
    insert into auth.users values ('${owner}', 'owner@example.test', now());
  `)
  for (const name of ['20260705212353_initial_schema.sql', '20260706194409_agenda_tasks.sql', '20260707150852_goals_receipts_secrets.sql', '20260712090000_multicurrency.sql', '20260714002316_accounts_transfers.sql']) {
    await db.exec(readFileSync(`supabase/migrations/${name}`, 'utf8'))
  }
  // Only pg_net installation is omitted in the embedded PostgreSQL fixture.
  await db.exec(readFileSync('supabase/migrations/20260708144534_push_notifications.sql','utf8').replace('create extension if not exists pg_net;', ''))
  await db.exec(`create table public.allowed_emails(email text primary key); insert into public.allowed_emails values ('old-owner@example.test');
    grant usage on schema auth,storage to authenticated;
    grant select,insert,update,delete on all tables in schema public,storage to authenticated;
  `)
  const migration = readdirSync('supabase/migrations').find(x => x.endsWith('_multiuser_credentials_invites.sql'))!
  await db.exec(readFileSync(`supabase/migrations/${migration}`, 'utf8'))
  const audit = readdirSync('supabase/migrations').find(x => x.endsWith('_functional_audit_regressions.sql'))!
  await db.exec(readFileSync(`supabase/migrations/${audit}`, 'utf8'))
}, 30000)
afterAll(async () => { await db?.close() })

describe.sequential('multiuser migration executed in PostgreSQL', () => {
  it('claims a reminder once, releases failures and acknowledges successful delivery', async () => {
    const id=crypto.randomUUID()
    await db.query("insert into public.tasks(id,user_id,title,due_date,due_time) values ($1,$2,'Claim test','2020-01-01','08:00')",[id,owner])
    const claim=async ()=>(await db.query<{token:string|null}>("select public.claim_task_reminder($1,'2020-01-01','08:00','Claim test') as token",[id])).rows[0].token
    const [a,b]=await Promise.all([claim(),claim()])
    expect([a,b].filter(Boolean)).toHaveLength(1)
    await db.query('select public.finish_task_reminder($1,$2,false)',[id,a??b])
    const retry=await claim();expect(retry).toBeTruthy()
    await db.query('select public.finish_task_reminder($1,$2,true)',[id,retry])
    expect((await db.query<{notified:boolean}>('select notified from public.tasks where id=$1',[id])).rows[0].notified).toBe(true)
    expect(await claim()).toBeNull()
  })
  it('does not mark a changed reminder time as notified by an older delivery', async () => {
    const id=crypto.randomUUID()
    await db.query("insert into public.tasks(id,user_id,title,due_date,due_time) values ($1,$2,'Changed time','2020-01-01',null)",[id,owner])
    const token=(await db.query<{token:string}>("select public.claim_task_reminder($1,'2020-01-01',null,'Changed time') token",[id])).rows[0].token
    await db.query("update public.tasks set due_time='10:00' where id=$1",[id])
    await db.query('select public.finish_task_reminder($1,$2,true)',[id,token])
    expect((await db.query<{notified:boolean}>('select notified from public.tasks where id=$1',[id])).rows[0].notified).toBe(false)
    expect((await db.query<{token:string}>("select public.claim_task_reminder($1,'2020-01-01','10:00','Changed time') token",[id])).rows[0].token).toBeTruthy()
  })
  it('ignores expired holders and denies client access to reminder claims', async () => {
    const id=crypto.randomUUID()
    await db.query("insert into public.tasks(id,user_id,title,due_date) values ($1,$2,'Expired claim','2020-01-01')",[id,owner])
    const claim=async ()=>(await db.query<{token:string}>("select public.claim_task_reminder($1,'2020-01-01',null,'Expired claim') token",[id])).rows[0].token
    const old=await claim()
    await db.query("update public.app_reminder_claims set expires_at=now()-interval '1 second' where task_id=$1",[id])
    const current=await claim();expect(current).not.toBe(old)
    await db.query('select public.finish_task_reminder($1,$2,true)',[id,old])
    expect((await db.query<{notified:boolean}>('select notified from public.tasks where id=$1',[id])).rows[0].notified).toBe(false)
    expect((await db.query('select id from public.app_reminder_claims where task_id=$1',[id])).rows).toEqual([{id:current}])
    await db.exec(`set role authenticated; set request.jwt.claim.sub='${owner}'`)
    try {
      await expect(claim()).rejects.toMatchObject({code:'42501'})
      await expect(db.query('select * from public.app_reminder_claims')).rejects.toMatchObject({code:'42501'})
    } finally { await db.exec('reset role') }
  })
  it('bootstraps the sole existing owner even after an email change', async () => {
    const result = await db.query('select user_id, role from public.app_members')
    expect(result.rows).toEqual([{user_id:owner,role:'owner'}])
  })
  it('reserves exactly one guest seat and denies a second invitation', async () => {
    await db.query('select public.reserve_app_invite($1,$2)',[owner,'Guest@Example.test'])
    await expect(db.query('select public.reserve_app_invite($1,$2)',[owner,'third@example.test'])).rejects.toThrow('capacity_reached')
  })
  it('blocks signup without an unexpired invitation', async () => {
    await expect(db.exec("insert into auth.users values (gen_random_uuid(),'stranger@example.test',now())")).rejects.toThrow()
    await db.query('insert into auth.users values ($1,$2,now())',[guest,'guest@example.test'])
  })
  it('denies member changes and access to encrypted credentials from authenticated clients', async () => {
    await db.exec(`set role authenticated; set request.jwt.claim.sub = '${owner}';`)
    try {
      await expect(db.query('update public.app_members set role = $1', ['owner'])).rejects.toThrow()
      await expect(db.query('select * from public.user_api_credentials')).rejects.toThrow()
      await expect(db.query('select public.reserve_app_invite($1,$2)', [owner,'intruder@example.test'])).rejects.toThrow()
    } finally { await db.exec('reset role') }
  })
  it('does not activate an invite without the correct proof, or after cancellation', async () => {
    const invite = (await db.query<{id:string, revision:string}>('select id,revision from public.app_invites')).rows[0]
    await db.query('update public.app_invites set user_id=$1,proof_hash=$2 where id=$3',[guest,'proof',invite.id])
    await expect(db.query('select public.accept_app_invite($1,$2,$3)',[guest,invite.id,'wrong'])).rejects.toThrow('invalid_invite')
    await db.query("update public.app_invites set status='cancelled' where id=$1",[invite.id])
    await expect(db.query('select public.accept_app_invite($1,$2,$3)',[guest,invite.id,'proof'])).rejects.toThrow('invalid_invite')
  })
  it('isolates rows and denies suspended members with an already issued identity', async () => {
    await db.query("insert into public.app_members(user_id,role,status) values ($1,'member','active')",[guest])
    await db.query("insert into public.categories(user_id,name,kind) values ($1,'Private A','expense'),($2,'Private B','expense')",[owner,guest])
    await db.exec(`set role authenticated; set request.jwt.claim.sub = '${guest}';`)
    try { expect((await db.query('select name from public.categories')).rows).toEqual([{name:'Private B'}]) }
    finally { await db.exec('reset role') }
    await db.query("update public.app_members set status='suspended' where user_id=$1",[guest])
    await db.exec(`set role authenticated; set request.jwt.claim.sub = '${guest}';`)
    try { expect((await db.query('select name from public.categories')).rows).toEqual([]) }
    finally { await db.exec('reset role') }
  })
  it('enforces ownership of foreign keys even for server writes', async () => {
    const id = (await db.query<{id:string}>('select id from public.categories where user_id=$1',[owner])).rows[0].id
    await expect(db.query("insert into public.transactions(user_id,category_id,amount_cents,kind) values ($1,$2,100,'expense')",[guest,id])).rejects.toThrow('foreign_owner')
  })
  it('enforces a persistent atomic request limit', async () => {
    for(let i=0;i<3;i++) expect((await db.query<{consume_app_rate:boolean}>('select public.consume_app_rate($1,$2,$3)',[owner,'test',3])).rows[0].consume_app_rate).toBe(true)
    expect((await db.query<{consume_app_rate:boolean}>('select public.consume_app_rate($1,$2,$3)',[owner,'test',3])).rows[0].consume_app_rate).toBe(false)
  })
  it('accepts a valid reinvitation once and suspends atomically with pending proofs revoked', async () => {
    await db.query('select public.reserve_app_invite($1,$2)', [owner,'guest@example.test'])
    const invite = (await db.query<{id:string}>('select id from public.app_invites')).rows[0]
    await db.query('update public.app_invites set user_id=$1,proof_hash=$2 where id=$3',[guest,'fresh-proof',invite.id])
    await db.query('select public.accept_app_invite($1,$2,$3)',[guest,invite.id,'fresh-proof'])
    expect((await db.query<{status:string}>('select status from public.app_members where user_id=$1',[guest])).rows[0].status).toBe('active')
    await expect(db.query('select public.accept_app_invite($1,$2,$3)',[guest,invite.id,'fresh-proof'])).rejects.toThrow('invalid_invite')
    await expect(db.query('select public.suspend_app_member($1,$2)',[guest,owner])).rejects.toThrow('access_denied')
    await db.query('select public.suspend_app_member($1,$2)',[owner,guest])
    expect((await db.query<{status:string}>('select status from public.app_members where user_id=$1',[guest])).rows[0].status).toBe('suspended')
    expect((await db.query('select proof_hash from public.app_invites')).rows).toEqual([{proof_hash:null}])
  })
  it('bounds concurrent server calls with expiring leases and denies client bypass', async () => {
    const ids: string[] = []
    for (let i=0;i<3;i++) ids.push((await db.query<{acquire_app_lease:string}>('select public.acquire_app_lease($1)',[owner])).rows[0].acquire_app_lease)
    expect((await db.query('select public.acquire_app_lease($1)',[owner])).rows).toEqual([{acquire_app_lease:null}])
    await db.query('delete from public.app_request_leases where id=$1',[ids[0]])
    expect((await db.query<{acquire_app_lease:string}>('select public.acquire_app_lease($1)',[owner])).rows[0].acquire_app_lease).not.toBeNull()
    await db.exec(`set role authenticated; set request.jwt.claim.sub = '${owner}';`)
    try { await expect(db.query('select public.acquire_app_lease($1)',[owner])).rejects.toMatchObject({code:'42501'}) }
    finally { await db.exec('reset role') }
  })
  it('does not acknowledge a suspended member’s transfer deletion as successful', async () => {
    await db.query("update public.app_members set status='suspended' where user_id=$1",[guest])
    await db.exec(`set role authenticated; set request.jwt.claim.sub = '${guest}';`)
    try {
      await expect(db.query('select public.delete_account_transfer($1)',[crypto.randomUUID()])).rejects.toThrow('access_denied')
    } finally { await db.exec('reset role') }
  })
  it('creates transfers atomically, rolls back invalid second legs and replays without duplicates', async () => {
    const from=crypto.randomUUID(), to=crypto.randomUUID(), foreign=crypto.randomUUID(), group=crypto.randomUUID()
    await db.query("insert into public.accounts(id,user_id,name) values ($1,$2,'bank'),($3,$2,'cash'),($4,$5,'foreign')",[from,owner,to,foreign,guest])
    const legs=[{id:crypto.randomUUID(),transfer_group:group,kind:'expense',account_id:from,amount_cents:100,date:'2026-01-01'}, {id:crypto.randomUUID(),transfer_group:group,kind:'income',account_id:foreign,amount_cents:100,date:'2026-01-01'}]
    await db.exec(`set role authenticated; set request.jwt.claim.sub = '${owner}';`)
    try {
      await expect(db.query('select public.save_account_transfer($1)',[JSON.stringify(legs)])).rejects.toThrow()
      expect((await db.query('select id from public.transactions where transfer_group=$1',[group])).rows).toEqual([])
      legs[1].account_id=to
      await db.query('select public.save_account_transfer($1)',[JSON.stringify(legs)])
      await db.query('select public.save_account_transfer($1)',[JSON.stringify(legs)])
      expect((await db.query('select id from public.transactions where transfer_group=$1',[group])).rows).toHaveLength(2)
      await db.query('select public.delete_account_transfer($1)',[group])
      expect((await db.query('select id from public.transactions where transfer_group=$1',[group])).rows).toEqual([])
    } finally { await db.exec('reset role') }
  })
  it('catches up recurring months, preserves the 31st and original currency and is idempotent', async () => {
    await db.query("insert into public.transactions(user_id,amount_cents,kind,date,description,recurrence,currency_code,original_amount_cents,exchange_rate_to_eur,exchange_rate_date,exchange_rate_source) values ($1,100,'expense','2024-01-31','recurrence-test','mensile','USD',200,0.5,'2024-01-31','ECB')",[owner])
    await db.exec('select public.materialize_recurring_transactions()')
    expect((await db.query("select date::text,currency_code,original_amount_cents from public.transactions where description='recurrence-test' and date in ('2024-02-29','2024-03-31') order by date")).rows).toEqual([{date:'2024-02-29',currency_code:'USD',original_amount_cents:200},{date:'2024-03-31',currency_code:'USD',original_amount_cents:200}])
    const before=(await db.query("select count(*) from public.transactions where description='recurrence-test'")).rows
    await db.exec('select public.materialize_recurring_transactions()')
    expect((await db.query("select count(*) from public.transactions where description='recurrence-test'")).rows).toEqual(before)
  })
  it('applies tenant RLS to every private table and document storage, including writes', async () => {
    await db.query("update public.app_members set status='active' where user_id=$1",[guest])
    const doc=crypto.randomUUID(), cat=(await db.query<{id:string}>('select id from public.categories where user_id=$1 limit 1',[owner])).rows[0].id
    await db.query("insert into public.documents(id,user_id,storage_path,file_name) values ($1,$2,$3,'synthetic.pdf')",[doc,owner,`${owner}/synthetic.pdf`])
    await db.query('insert into public.payslips(user_id,document_id,period_year,period_month) values ($1,$2,2026,1)',[owner,doc])
    await db.query('insert into public.budgets(user_id,category_id,monthly_cents) values ($1,$2,100)',[owner,cat])
    await db.query("insert into public.goals(user_id,name,target_cents) values ($1,'synthetic',100)",[owner])
    await db.query("insert into public.tasks(user_id,title) values ($1,'synthetic')",[owner])
    await db.query("insert into public.push_subscriptions(user_id,endpoint,p256dh,auth) values ($1,'https://fcm.googleapis.com/synthetic','synthetic','synthetic')",[owner])
    await db.query("insert into storage.objects(bucket_id,name) values ('documents',$1),('documents',$2)",[`${owner}/a.pdf`,`${guest}/b.pdf`])
    await db.exec(`set role authenticated; set request.jwt.claim.sub = '${guest}';`)
    try {
      for(const table of ['categories','accounts','transactions','budgets','goals','tasks','documents','payslips','push_subscriptions']) {
        expect((await db.query(`select id from public.${table} where user_id=$1`,[owner])).rows,table).toEqual([])
        expect((await db.query(`delete from public.${table} where user_id=$1 returning id`,[owner])).rows,table).toEqual([])
        expect((await db.query(`update public.${table} set user_id=$1 where user_id=$2 returning id`,[guest,owner])).rows,table).toEqual([])
      }
      await expect(db.query("insert into public.tasks(user_id,title) values ($1,'spoof')",[owner])).rejects.toMatchObject({code:'42501'})
      expect((await db.query('select name from storage.objects')).rows).toEqual([{name:`${guest}/b.pdf`}])
      await expect(db.query("insert into storage.objects(bucket_id,name) values ('documents',$1)",[`${owner}/stolen.pdf`])).rejects.toMatchObject({code:'42501'})
    } finally { await db.exec('reset role') }
    await db.query("update public.app_members set status='suspended' where user_id=$1",[guest])
    await db.exec(`set role authenticated; set request.jwt.claim.sub = '${guest}';`)
    try { expect((await db.query('select name from storage.objects')).rows).toEqual([]) }
    finally { await db.exec('reset role') }
  })
})
