import assert from 'node:assert/strict'
import { rotateCredentials } from './rotate-credentials.ts'
import { openCredential, sealCredential, type SealedCredential } from '../functions/_shared/crypto.ts'

const user = '11111111-1111-4111-8111-111111111111'
const oldKey = btoa('a'.repeat(32)), newKey = btoa('b'.repeat(32))
async function fixture(mode: 'dry' | 'apply' | 'conflict' | 'missing') {
  const names=['SUPABASE_URL','SUPABASE_SERVICE_ROLE_KEY','CREDENTIAL_KEY_VERSION','CREDENTIAL_MASTER_KEYS']
  const previous=names.map(name=>Deno.env.get(name))
  const originalFetch=globalThis.fetch, originalLog=console.log, originalArgs=[...Deno.args]
  const row={user_id:user,provider:'gemini',...await sealCredential('synthetic-personal-secret',user,'gemini','v1',oldKey)}
  const writes: SealedCredential[] = [], logs: string[] = []
  try {
    Deno.env.set(names[0],'https://database.test');Deno.env.set(names[1],'synthetic-service-key')
    Deno.env.set(names[2],'v2');Deno.env.set(names[3],JSON.stringify(mode==='missing'?{v2:newKey}:{v1:oldKey,v2:newKey}))
    Deno.args.splice(0,Deno.args.length,...(mode==='dry'?[]:['--apply']))
    console.log=(value: unknown)=>logs.push(String(value))
    globalThis.fetch=async(input,init)=>{
      const req=new Request(input,init), url=new URL(req.url)
      assert.equal(url.hostname,'database.test')
      assert.equal(url.pathname,'/rest/v1/user_api_credentials')
      const send=(value:unknown)=>new Response(JSON.stringify(value),{headers:{'Content-Type':'application/json'}})
      if(req.method==='GET') {
        assert.equal(url.searchParams.get('key_version'),'neq.v2')
        return send([row])
      }
      assert.equal(req.method,'PATCH')
      assert.equal(url.searchParams.get('user_id'),`eq.${user}`)
      assert.equal(url.searchParams.get('provider'),'eq.gemini')
      assert.equal(url.searchParams.get('ciphertext'),`eq.${row.ciphertext}`)
      writes.push(await req.json())
      return send(mode==='conflict'?[]:[{provider:'gemini'}])
    }
    if(mode==='missing') await assert.rejects(rotateCredentials(),/Keep all previous master key versions/)
    else await rotateCredentials()
    assert.equal(writes.length,mode==='dry'||mode==='missing'?0:1)
    if(writes[0]) {
      assert.equal(writes[0].key_version,'v2')
      assert.equal(await openCredential(writes[0],user,'gemini',newKey),'synthetic-personal-secret')
      assert.notEqual(writes[0].ciphertext,row.ciphertext)
    }
    if(mode!=='missing') assert.deepEqual(JSON.parse(logs[0]),{
      dry_run:mode==='dry',verified:1,updated:mode==='apply'?1:0,conflicts:mode==='conflict'?1:0,batch_limit:100,
    })
    for(const secret of [user,oldKey,newKey,row.ciphertext,'synthetic-personal-secret']) assert.ok(!logs.join('').includes(secret))
  } finally {
    globalThis.fetch=originalFetch;console.log=originalLog;Deno.args.splice(0,Deno.args.length,...originalArgs)
    names.forEach((name,i)=>previous[i]===undefined?Deno.env.delete(name):Deno.env.set(name,previous[i]!))
  }
}
Deno.test('rotation defaults to a cryptographically verified dry run without writes',()=>fixture('dry'))
Deno.test('rotation apply preserves the secret under the new master version without logging it',()=>fixture('apply'))
Deno.test('rotation does not overwrite a concurrently changed ciphertext',()=>fixture('conflict'))
Deno.test('rotation refuses missing previous key material before writing',()=>fixture('missing'))
