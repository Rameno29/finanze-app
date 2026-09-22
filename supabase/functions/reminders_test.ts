import assert from 'node:assert/strict'
import webpush from 'npm:web-push@3.6.7'

// Capture the legacy entrypoint without opening a listener or a real connection.
let reminders!: (request: Request) => Promise<Response>
const serve = Deno.serve
try {
  Deno.serve = ((handler: typeof reminders) => { reminders = handler; return {} }) as unknown as typeof Deno.serve
  await import('./send-reminders/index.ts')
} finally { Deno.serve = serve }

const uid = '11111111-1111-4111-8111-111111111111'
const taskId = '77777777-7777-4777-8777-777777777777'
const reply = (data: unknown) => Response.json(data)
const cron = () => new Request('https://app.test/reminders', { method: 'POST', headers: { 'x-cron-secret': 'synthetic-cron' }, body: '{}' })

async function fixture(run: (state: { sent: number; notified: boolean; claimed: boolean; fail: boolean; changeTime: boolean; finishes: boolean[]; failedTable: string }) => Promise<void>) {
  const oldFetch=globalThis.fetch, oldSend=webpush.sendNotification, oldVapid=webpush.setVapidDetails
  const keys=['SUPABASE_URL','SUPABASE_SERVICE_ROLE_KEY'], oldEnv=keys.map(key=>Deno.env.get(key))
  Deno.env.set(keys[0],'https://reminders.test');Deno.env.set(keys[1],'synthetic-service')
  const state={sent:0,notified:false,claimed:false,fail:false,changeTime:false,finishes:[] as boolean[],failedTable:''}
  let time='08:00:00'
  webpush.setVapidDetails=()=>{}
  webpush.sendNotification=(async()=>{
    state.sent++
    if(state.changeTime) time='10:00:00'
    if(state.fail) throw new Error('Unavailable push provider')
    await Promise.resolve()
    return {statusCode:201,headers:{},body:''}
  }) as typeof webpush.sendNotification
  globalThis.fetch=async(input,init)=>{
    const req=new Request(input,init), url=new URL(req.url)
    if(url.hostname!=='reminders.test') throw new Error('Unexpected network')
    if(state.failedTable && url.pathname.endsWith('/'+state.failedTable)) return Response.json({code:'42501',message:'synthetic database failure'},{status:403})
    if(url.pathname.endsWith('/app_secrets')) return reply(['CRON_SECRET','VAPID_PUBLIC_KEY','VAPID_PRIVATE_KEY'].map(name=>({name,value:name==='CRON_SECRET'?'synthetic-cron':'synthetic-vapid'})))
    if(url.pathname.endsWith('/app_members')) return reply([{user_id:uid,role:'owner',status:'active'}])
    if(url.pathname.endsWith('/push_subscriptions')) return reply([{id:'sub',user_id:uid,endpoint:'https://fcm.googleapis.com/test',p256dh:'synthetic',auth:'synthetic'}])
    if(url.pathname.endsWith('/tasks')) {
      if(req.method==='PATCH') { if(!url.searchParams.has('due_time') || url.searchParams.get('due_time')===`eq.${time}`) state.notified=true;return new Response(null,{status:204}) }
      return reply([{id:taskId,user_id:uid,title:'Reminder',due_date:'2020-01-01',due_time:'08:00:00'}])
    }
    if(url.pathname.endsWith('/rpc/claim_task_reminder')) {
      const body=await req.json()
      assert.deepEqual(body,{target_task:taskId,expected_date:'2020-01-01',expected_time:'08:00:00',expected_title:'Reminder'})
      if(state.claimed || state.notified) return reply(null)
      state.claimed=true;return reply('claim-token')
    }
    if(url.pathname.endsWith('/rpc/finish_task_reminder')) {
      const body=await req.json()
      assert.equal(body.claim_token,'claim-token');assert.equal(body.target_task,taskId)
      state.finishes.push(body.delivered)
      state.notified=body.delivered && time==='08:00:00';state.claimed=false
      return reply(state.notified)
    }
    throw new Error('Unexpected database request: '+url.pathname)
  }
  try { await run(state) } finally {
    globalThis.fetch=oldFetch;webpush.sendNotification=oldSend;webpush.setVapidDetails=oldVapid
    keys.forEach((key,i)=>oldEnv[i]===undefined?Deno.env.delete(key):Deno.env.set(key,oldEnv[i]!))
  }
}

Deno.test('concurrent cron invocations do not deliver the same reminder twice',()=>fixture(async state=>{
  await Promise.all([reminders(cron()),reminders(cron())])
  assert.equal(state.sent,1);assert.equal(state.notified,true)
}))
Deno.test('an edited due time is not acknowledged by an old reminder delivery',()=>fixture(async state=>{
  state.changeTime=true
  assert.equal((await reminders(cron())).status,200)
  assert.equal(state.sent,1);assert.equal(state.notified,false)
}))
Deno.test('failed push releases its claim and the next cron can retry',()=>fixture(async state=>{
  state.fail=true;await reminders(cron())
  assert.deepEqual(state.finishes,[false]);assert.equal(state.notified,false)
  state.fail=false;await reminders(cron())
  assert.deepEqual(state.finishes,[false,true]);assert.equal(state.sent,2);assert.equal(state.notified,true)
}))
for(const table of ['tasks','push_subscriptions']) Deno.test(`cron reports ${table} read failures instead of successful zero reminders`,()=>fixture(async state=>{
  state.failedTable=table
  assert.equal((await reminders(cron())).status,503)
  assert.equal(state.sent,0)
}))
