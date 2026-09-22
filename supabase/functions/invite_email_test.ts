import assert from 'node:assert/strict'
import nodemailer from 'npm:nodemailer@10.0.10'
import { serve } from './manage-invites/index.ts'

const owner='11111111-1111-4111-8111-111111111111', guest='22222222-2222-4222-8222-222222222222'
Deno.test('invitation email is composed by the real mailer without contacting SMTP',async()=>{
  const names=['SUPABASE_URL','SUPABASE_SERVICE_ROLE_KEY','INVITE_SMTP_URL','INVITE_FROM']
  const previous=names.map(name=>Deno.env.get(name)), originalFetch=globalThis.fetch, create=nodemailer.createTransport
  let envelope: {to:string[];from:string} | undefined, message='', invitationText=''
  // Exercise the real MIME builder; replace only the external delivery transport.
  const local=create({streamTransport:true,buffer:true,name:'app.test'})
  nodemailer.createTransport=((url: string)=>{
    assert.equal(url,'smtp://smtp.test')
    return {sendMail:async(options: Record<string,unknown>)=>{
      invitationText=String(options.text)
      const result=await local.sendMail(options)
      envelope=result.envelope;message=result.message.toString()
      return result
    },close:()=>local.close()}
  }) as typeof create
  try {
    Deno.env.set(names[0],'https://database.test');Deno.env.set(names[1],'synthetic-service-key')
    Deno.env.set(names[2],'smtp://smtp.test');Deno.env.set(names[3],'AJE <owner@example.test>')
    globalThis.fetch=async(input,init)=>{
      const req=new Request(input,init),url=new URL(req.url),send=(value:unknown)=>Response.json(value)
      assert.equal(url.hostname,'database.test')
      if(url.pathname==='/auth/v1/user') return send({id:owner,aud:'authenticated',app_metadata:{},user_metadata:{},created_at:'2026-01-01'})
      if(url.pathname.endsWith('/app_members')) return send([{role:'owner',status:'active'}])
      if(url.pathname.endsWith('/rpc/consume_app_rate')) return send(true)
      if(url.pathname.endsWith('/rpc/acquire_app_lease')) return send('lease')
      if(url.pathname.endsWith('/app_request_leases')) return new Response(null,{status:204})
      if(url.pathname.endsWith('/rpc/reserve_app_invite')) {
        assert.deepEqual(await req.json(),{actor:owner,invite_email:'guest@example.test'})
        return send({id:'invite',revision:'revision',email:'guest@example.test',user_id:null})
      }
      if(url.pathname.endsWith('/admin/generate_link')) return send({id:guest,email:'guest@example.test',hashed_token:'synthetic-proof',verification_type:'invite',action_link:'https://app.test'})
      if(url.pathname.endsWith('/app_invites')) return send({id:'invite'})
      if(url.pathname.endsWith('/admin/users/'+guest)) return send({id:guest,email:'guest@example.test'})
      throw new Error(`Unexpected request ${req.method} ${url.pathname}`)
    }
    const result=await serve(new Request('https://app.test/invites',{method:'POST',headers:{Authorization:'Bearer synthetic','Content-Type':'application/json'},body:JSON.stringify({action:'create',email:'guest@example.test',delivery:'email'})}))
    const body=await result.json()
    assert.equal(result.status,200);assert.equal(body.email_sent,true)
    assert.deepEqual(envelope,{from:'owner@example.test',to:['guest@example.test']})
    // The decoded text sent to the MIME builder contains the correct, personal URL.
    assert.ok(message.includes('Subject: Il tuo invito ad AJE'))
    assert.ok(invitationText.includes(body.link))
    const link=new URL(body.link)
    assert.equal(link.pathname,'/finanze-app/auth/callback')
    assert.equal(new URLSearchParams(link.hash.slice(1)).get('token_hash'),'synthetic-proof')
  } finally {
    globalThis.fetch=originalFetch;nodemailer.createTransport=create;local.close()
    names.forEach((name,i)=>previous[i]===undefined?Deno.env.delete(name):Deno.env.set(name,previous[i]!))
  }
})
