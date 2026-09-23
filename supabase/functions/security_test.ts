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
const OWN_DOCUMENT = '33333333-3333-4333-8333-333333333333'
const master = btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32))))
const response = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json' } })
const request = (user: string, body: unknown) => new Request('https://app.test/function', { method: 'POST', headers: { Authorization: `Bearer ${user}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) })

async function fixture(run: (state: { sent: string[]; missing: boolean; suspended: boolean; quota: boolean; videoUnavailable: boolean; saved: Record<string, unknown>[]; geminiOutput: string; geminiRequests: Record<string, unknown>[]; storageDownloads: number; documentUpdates: number }) => Promise<void>) {
  const previousFetch = globalThis.fetch
  const env = ['SUPABASE_URL','SUPABASE_SERVICE_ROLE_KEY','CREDENTIAL_MASTER_KEYS','GEMINI_API_KEY','CREDENTIAL_KEY_VERSION']
  const previousEnv = env.map(key => Deno.env.get(key))
  Deno.env.set('SUPABASE_URL', 'https://database.test')
  Deno.env.set('SUPABASE_SERVICE_ROLE_KEY', 'synthetic-service-key')
  Deno.env.set('CREDENTIAL_MASTER_KEYS', JSON.stringify({v1: master}))
  Deno.env.set('CREDENTIAL_KEY_VERSION','v1')
  Deno.env.set('GEMINI_API_KEY', 'FORBIDDEN_GLOBAL_KEY')
  const state = { sent: [] as string[], missing: false, suspended: false, quota: false, videoUnavailable: false, saved: [] as Record<string, unknown>[], geminiOutput: '{"action":"answer"}', geminiRequests: [] as Record<string, unknown>[], storageDownloads: 0, documentUpdates: 0 }
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
      if (url.pathname.endsWith('/documents')) {
        if (req.method === 'PATCH') { state.documentUpdates++; return response([]) }
        const uid = url.searchParams.get('user_id')?.slice(3)
        const docId = url.searchParams.get('id')?.slice(3)
        return uid === A && docId === OWN_DOCUMENT
          ? response({id: OWN_DOCUMENT, user_id: A, file_name: 'appunti.pdf', storage_path: `${A}/appunti.pdf`})
          : response({message: 'not found'}, 406)
      }
      if (url.pathname.includes('/storage/v1/object/documents/')) {
        state.storageDownloads++
        return new Response('%PDF-1.4 fixture', {headers: {'Content-Type': 'application/pdf'}})
      }
      if (['categories','goals'].some(table => url.pathname.endsWith('/'+table))) return response([])
      throw new Error('Unexpected DB request: '+url.pathname)
    }
    if (url.hostname === 'generativelanguage.googleapis.com' || url.hostname === 'www.googleapis.com') {
      const key=req.headers.get('x-goog-api-key') ?? ''
      assert(!url.searchParams.has('key')); assert.notEqual(key,'FORBIDDEN_GLOBAL_KEY')
      state.sent.push(key)
      if(state.quota) return response({error:{errors:[{reason:'quotaExceeded'}]}},403)
      if(url.hostname === 'www.googleapis.com') return response({items:[]})
      state.geminiRequests.push(await req.json())
      if(state.videoUnavailable) return response({error:{message:'The YouTube video is not available'}},400)
      return response({candidates:[{content:{parts:[{text:state.geminiOutput}]}}]})
    }
    throw new Error('Unexpected external network')
  }
  try { await run(state) } finally {
    globalThis.fetch=previousFetch
    env.forEach((key,i)=> previousEnv[i]===undefined ? Deno.env.delete(key) : Deno.env.set(key,previousEnv[i]!))
  }
}

Deno.test('real AI handlers send only the requesting user Gemini key, ignoring spoofed user_id', () => fixture(async state => {
  for (const uid of [A,B]) {
    assert.equal((await analyze(request(uid,{mode:'assistant',question:'Come risparmiare?',user_id:A}))).status,200)
    assert.equal((await command(request(uid,{text:'ciao',user_id:A}))).status,200)
  }
  assert.deepEqual(state.sent,[`personal-${A}-gemini`,`personal-${A}-gemini`,`personal-${B}-gemini`,`personal-${B}-gemini`])
}))
Deno.test('missing key, suspended and anonymous sessions never call a provider; retired endpoint is inert', () => fixture(async state => {
  state.missing=true
  for (const fn of [analyze,command]) assert.equal((await fn(request(B,{question:'x',text:'x',mode:'assistant'}))).status,428)
  state.missing=false; state.suspended=true
  assert.equal((await analyze(request(B,{mode:'assistant',question:'x'}))).status,403)
  assert.equal((await analyze(request('anonymous',{mode:'assistant',question:'x'}))).status,401)
  assert.equal((await youtube(request(B,{query:'x'}))).status,410)
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
Deno.test('body limit is enforced on streamed bytes without Content-Length', async () => {
  const req=new Request('https://app.test',{method:'POST',body:new ReadableStream({start(c){c.enqueue(new TextEncoder().encode('{"value":"'+'x'.repeat(50)+'"}'));c.close()}})})
  await assert.rejects(readJson(req,20),/payload_too_large/)
})

Deno.test('PDF generation rejects an invalid YouTube link instead of silently using only the prompt', () => fixture(async state => {
  const result = await analyze(request(A,{mode:'generate',source:'youtube',video_url:'https://youtube.com.evil.test/watch?v=abcdefghijk',prompt:'Appunti'}))
  assert.equal(result.status,400)
  assert.equal(state.geminiRequests.length,0)
}))

Deno.test('PDF generation accepts a public YouTube URL and identifies the source', () => fixture(async state => {
  state.geminiOutput='{"title":"Appunti","sections":[{"heading":"Punti chiave","body":"Risparmio e budget"}]}'
  const result = await analyze(request(A,{mode:'generate',source:'youtube',video_url:'https://youtu.be/abcdefghijk',format:'appunti'}))
  assert.equal(result.status,200)
  const document = await result.json()
  assert.equal(document.source.kind,'youtube')
  assert.equal(document.source.url,'https://www.youtube.com/watch?v=abcdefghijk')
  assert.equal(document.sections[0].heading,'Punti chiave')
  assert.equal(state.sent.at(-1),`personal-${A}-gemini`)
}))

Deno.test('PDF generation rejects malformed AI output', () => fixture(async state => {
  state.geminiOutput='{"title":"Appunti","sections":[]}'
  const result = await analyze(request(A,{mode:'generate',source:'text',prompt:'Un testo di prova'}))
  assert.equal(result.status,502)
}))

Deno.test('PDF generation cannot access another account document', () => fixture(async state => {
  const result = await analyze(request(B,{mode:'generate',source:'document',document_id:OWN_DOCUMENT,prompt:'Riassumi'}))
  assert.equal(result.status,404)
  assert.equal(state.storageDownloads,0)
  assert.equal(state.geminiRequests.length,0)
}))

Deno.test('PDF generation uses only the owner document as source', () => fixture(async state => {
  state.geminiOutput='{"title":"Appunti","sections":[{"heading":"Sintesi","body":"Un testo"}]}'
  const result = await analyze(request(A,{mode:'generate',source:'document',document_id:OWN_DOCUMENT,format:'sintesi'}))
  assert.equal(result.status,200)
  assert.equal((await result.json()).source.file_name,'appunti.pdf')
  assert.equal(state.storageDownloads,1)
  const parts = (state.geminiRequests[0].contents as Array<{parts: Array<Record<string, unknown>>}>)[0].parts
  assert.equal((parts[0].inline_data as {mime_type:string}).mime_type,'application/pdf')
}))

Deno.test('old PDF text request remains compatible during PWA rollout', () => fixture(async state => {
  state.geminiOutput='{"title":"Guida","sections":[{"heading":"Passo uno","body":"Descrizione"}]}'
  const result = await analyze(request(A,{mode:'generate',prompt:'Scrivi una guida'}))
  assert.equal(result.status,200)
  assert.deepEqual((await result.json()).source,{kind:'text'})
}))

Deno.test('failed PDF from a saved document does not mark the original as failed', () => fixture(async state => {
  state.geminiOutput='{"title":"Guida","sections":[]}'
  const result = await analyze(request(A,{mode:'generate',source:'document',document_id:OWN_DOCUMENT}))
  assert.equal(result.status,502)
  assert.equal(state.documentUpdates,0)
}))

Deno.test('PDF generation reports provider quota', () => fixture(async state => {
  state.quota=true
  const result = await analyze(request(A,{mode:'generate',source:'youtube',video_url:'https://www.youtube.com/watch?v=abcdefghijk'}))
  assert.equal(result.status,429)
  assert.deepEqual(await result.json(),{error:'provider_quota'})
}))

Deno.test('unavailable video is a clear error, never a generated PDF', () => fixture(async state => {
  state.videoUnavailable=true
  const result=await analyze(request(A,{mode:'generate',source:'youtube',video_url:'https://www.youtube.com/watch?v=abcdefghijk'}))
  assert.equal(result.status,422)
  assert.deepEqual(await result.json(),{error:'video_unavailable'})
}))

Deno.test('retired Media, web search and scanner modes do not contact Gemini', () => fixture(async state => {
  for (const body of [
    {mode:'youtube',video_url:'https://www.youtube.com/watch?v=abcdefghijk'},
    {mode:'websearch',query:'Come risparmiare?'},
    {mode:'detect_corners',image_base64:'a'.repeat(200),image_mime:'image/jpeg'},
  ]) {
    const result=await analyze(request(A,body))
    assert.equal(result.status,400)
  }
  assert.equal(state.geminiRequests.length,0)
}))
