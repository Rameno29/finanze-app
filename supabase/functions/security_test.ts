import assert from 'node:assert/strict'
import { serve as youtube } from './youtube-search/index.ts'
import { serve as analyze } from './ai-analyze/index.ts'
import { serve as command } from './ai-command/index.ts'
import { serve as credentials } from './user-credentials/index.ts'
import { serve as invites } from './manage-invites/index.ts'
import { serve as legacy } from './analyze-payslip/index.ts'
import { sealCredential } from './_shared/crypto.ts'
import { readJson } from './_shared/access.ts'

const A = '11111111-1111-4111-8111-111111111111'
const B = '22222222-2222-4222-8222-222222222222'
const master = btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32))))
const response = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json' } })
const request = (user: string, body: unknown) => new Request('https://app.test/function', { method: 'POST', headers: { Authorization: `Bearer ${user}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) })

async function fixture(run: (state: { sent: string[]; missing: boolean; suspended: boolean; quota: boolean; saved: Record<string, unknown>[] }) => Promise<void>) {
  const previousFetch = globalThis.fetch
  const env = ['SUPABASE_URL','SUPABASE_SERVICE_ROLE_KEY','CREDENTIAL_MASTER_KEYS','GEMINI_API_KEY','CREDENTIAL_KEY_VERSION']
  const previousEnv = env.map(key => Deno.env.get(key))
  Deno.env.set('SUPABASE_URL', 'https://database.test')
  Deno.env.set('SUPABASE_SERVICE_ROLE_KEY', 'synthetic-service-key')
  Deno.env.set('CREDENTIAL_MASTER_KEYS', JSON.stringify({v1: master}))
  Deno.env.set('CREDENTIAL_KEY_VERSION','v1')
  Deno.env.set('GEMINI_API_KEY', 'FORBIDDEN_GLOBAL_KEY')
  const state = { sent: [] as string[], missing: false, suspended: false, quota: false, saved: [] as Record<string, unknown>[] }
  const encrypted = new Map<string, unknown>()
  for (const user of [A,B]) for (const provider of ['gemini','youtube']) encrypted.set(`${user}:${provider}`, await sealCredential(`personal-${user}-${provider}`,user,provider,'v1',master))
  globalThis.fetch = async (input, init) => {
    const req = new Request(input, init)
    const url = new URL(req.url)
    if (url.hostname === 'database.test') {
      if (url.pathname === '/auth/v1/user') {
        const id = req.headers.get('Authorization')?.replace('Bearer ','')
        return id === A || id === B ? response({id,email: `${id}@example.test`,aud:'authenticated',app_metadata:{},user_metadata:{},created_at:new Date().toISOString()}) : response({message:'invalid'},401)
      }
      if (url.pathname.endsWith('/rpc/consume_app_rate')) return response(true)
      if (url.pathname.endsWith('/rpc/acquire_app_lease')) return response(crypto.randomUUID())
      if (url.pathname.endsWith('/app_request_leases')) return new Response(null,{status:204})
      if (url.pathname.endsWith('/app_members')) return response([{role:url.searchParams.get('user_id')===`eq.${A}`?'owner':'member',status:state.suspended?'suspended':'active'}])
      if (url.pathname.endsWith('/user_integrations')) return response([])
      if (url.pathname.endsWith('/user_api_credentials')) {
        const uid = url.searchParams.get('user_id')?.slice(3)
        const provider = url.searchParams.get('provider')?.slice(3)
        if (req.method === 'POST') { state.saved.push(await req.json()); return new Response(null,{status:201}) }
        if (url.searchParams.get('select')?.startsWith('provider,')) return response([{provider:'gemini',suffix:'mini',updated_at:'2026-09-20'}])
        return response(state.missing ? [] : [encrypted.get(`${uid}:${provider}`)])
      }
      if (['categories','goals'].some(table => url.pathname.endsWith('/'+table))) return response([])
      throw new Error('Unexpected DB request: '+url.pathname)
    }
    if (url.hostname === 'generativelanguage.googleapis.com' || url.hostname === 'www.googleapis.com') {
      const key=req.headers.get('x-goog-api-key') ?? ''
      assert(!url.searchParams.has('key')); assert.notEqual(key,'FORBIDDEN_GLOBAL_KEY')
      state.sent.push(key)
      if(state.quota) return response({error:{errors:[{reason:'quotaExceeded'}]}},403)
      return url.hostname === 'www.googleapis.com' ? response({items:[]}) : response({candidates:[{content:{parts:[{text:'{"action":"answer"}'}]}}]})
    }
    throw new Error('Unexpected external network')
  }
  try { await run(state) } finally {
    globalThis.fetch=previousFetch
    env.forEach((key,i)=> previousEnv[i]===undefined ? Deno.env.delete(key) : Deno.env.set(key,previousEnv[i]!))
  }
}

Deno.test('real handlers send only the requesting user key to AI and YouTube, ignoring spoofed user_id', () => fixture(async state => {
  for (const uid of [A,B]) {
    assert.equal((await youtube(request(uid,{query:'example',user_id:A}))).status,200)
    assert.equal((await analyze(request(uid,{mode:'youtube',video_url:'https://youtube.com/watch?v=abcdefghijk',user_id:A}))).status,200)
    assert.equal((await command(request(uid,{text:'ciao',user_id:A}))).status,200)
  }
  assert.deepEqual(state.sent,[`personal-${A}-youtube`,`personal-${A}-gemini`,`personal-${A}-gemini`,`personal-${B}-youtube`,`personal-${B}-gemini`,`personal-${B}-gemini`])
}))
Deno.test('missing key, suspended and anonymous sessions never call a provider; retired endpoint is inert', () => fixture(async state => {
  state.missing=true
  for (const fn of [youtube,analyze,command]) assert.equal((await fn(request(B,{query:'x',text:'x',mode:'youtube'}))).status,428)
  state.missing=false; state.suspended=true
  assert.equal((await youtube(request(B,{query:'x'}))).status,403)
  assert.equal((await youtube(request('anonymous',{query:'x'}))).status,401)
  assert.equal(legacy(request(B,{})).status,410)
  assert.equal(state.sent.length,0)
}))
Deno.test('credential save binds identity, encrypts and returns only acknowledgement; list has metadata only', () => fixture(async state => {
  const secret='synthetic-personal-key-1234'
  const saved=await credentials(request(B,{action:'save',provider:'gemini',value:secret,user_id:A}))
  assert.equal(saved.status,200); assert.deepEqual(await saved.json(),{ok:true})
  assert.equal(state.saved[0].user_id,B); assert.equal(state.saved[0].suffix,'1234')
  assert(!JSON.stringify(state.saved).includes(secret)); assert(state.saved[0].ciphertext)
  const list=await credentials(request(B,{action:'list'}))
  assert.equal(list.headers.get('Cache-Control'),'no-store')
  assert.deepEqual(await list.json(),{integrations:[{provider:'gemini',suffix:'mini',updated_at:'2026-09-20'}]})
}))
Deno.test('guest cannot invoke owner administration even with forged actor', () => fixture(async state => {
  for (const action of ['list','create','cancel','suspend']) assert.equal((await invites(request(B,{action,actor:A,email:'x@example.test',user_id:A}))).status,403)
  assert.equal(state.sent.length,0)
}))
Deno.test('YouTube quotaExceeded is actionable without exposing provider response', () => fixture(async state => {
  state.quota=true
  const result=await youtube(request(B,{query:'x'}))
  assert.equal(result.status,429); assert.deepEqual(await result.json(),{error:'provider_quota'})
}))
Deno.test('body limit is enforced on streamed bytes without Content-Length', async () => {
  const req=new Request('https://app.test',{method:'POST',body:new ReadableStream({start(c){c.enqueue(new TextEncoder().encode('{"value":"'+'x'.repeat(50)+'"}'));c.close()}})})
  await assert.rejects(readJson(req,20),/payload_too_large/)
})
