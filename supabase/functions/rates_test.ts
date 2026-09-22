import assert from 'node:assert/strict'
import { serve } from './ecb-rates/index.ts'

const uid='11111111-1111-4111-8111-111111111111'
const today=new Date().toISOString().slice(0,10)
const stale=new Date(Date.now()-7_200_000).toISOString()
async function fixture(date: string, observed: string, providerFails=false) {
  const previousFetch=globalThis.fetch
  const names=['SUPABASE_URL','SUPABASE_SERVICE_ROLE_KEY'], previous=names.map(key=>Deno.env.get(key))
  const state={providerCalls:0,writes:[] as Record<string,unknown>[]}
  try {
    Deno.env.set(names[0],'https://database.test');Deno.env.set(names[1],'synthetic-service-key')
    globalThis.fetch=async(input,init)=>{
      const req=new Request(input,init),url=new URL(req.url)
      const send=(value:unknown,status=200)=>new Response(JSON.stringify(value),{status,headers:{'Content-Type':'application/json'}})
      if(url.hostname==='data-api.ecb.europa.eu') {
        state.providerCalls++
        assert.equal(url.searchParams.get('endPeriod'),date)
        return providerFails ? send({},503) : new Response(`TIME_PERIOD,OBS_VALUE\n${date},1.25`)
      }
      assert.equal(url.hostname,'database.test')
      if(url.pathname==='/auth/v1/user') return send({id:uid,aud:'authenticated',app_metadata:{},user_metadata:{},created_at:stale})
      if(url.pathname.endsWith('/app_members')) return send([{status:'active',role:'owner'}])
      if(url.pathname.endsWith('/rpc/consume_app_rate')) return send(true)
      if(url.pathname.endsWith('/rpc/acquire_app_lease')) return send(crypto.randomUUID())
      if(url.pathname.endsWith('/app_request_leases')) return new Response(null,{status:204})
      if(url.pathname.endsWith('/exchange_rates')) {
        if(req.method==='POST') { state.writes.push(await req.json());return new Response(null,{status:201}) }
        assert.equal(url.searchParams.get('currency_code'),'eq.USD')
        return send({observed_on:observed,units_per_eur:1.1,fetched_at:stale})
      }
      throw new Error(`Unexpected request ${req.method} ${url.pathname}`)
    }
    const response=await serve(new Request('https://app.test/ecb',{method:'POST',headers:{Authorization:'Bearer synthetic', 'Content-Type':'application/json'},body:JSON.stringify({currency:'USD',date})}))
    return {...state,status:response.status,body:await response.json()}
  } finally {
    globalThis.fetch=previousFetch
    names.forEach((name,i)=>previous[i]===undefined?Deno.env.delete(name):Deno.env.set(name,previous[i]!))
  }
}
Deno.test('ECB refreshes today’s observation once its cache is older than one hour',async()=>{
  const result=await fixture(today,today)
  assert.equal(result.status,200);assert.equal(result.providerCalls,1)
  assert.equal(result.body.rate_to_eur,0.8);assert.equal(result.writes.length,1)
})
Deno.test('ECB reuses an exact historical observation without contacting the provider',async()=>{
  const result=await fixture('2026-01-05','2026-01-05')
  assert.equal(result.status,200);assert.equal(result.providerCalls,0)
  assert.equal(result.body.rate_to_eur,0.9090909091);assert.equal(result.writes.length,0)
})
Deno.test('ECB refreshes a stale fallback from an earlier trading day',async()=>{
  const result=await fixture('2026-01-06','2026-01-05')
  assert.equal(result.status,200);assert.equal(result.providerCalls,1)
  assert.equal(result.body.observed_on,'2026-01-06');assert.equal(result.body.rate_to_eur,0.8)
})
Deno.test('ECB reports provider failure instead of presenting a stale fallback as a fresh quote',async()=>{
  const result=await fixture('2026-01-06','2026-01-05',true)
  assert.equal(result.status,502);assert.equal(result.writes.length,0)
  assert.equal(result.body.rate_to_eur,undefined)
})
