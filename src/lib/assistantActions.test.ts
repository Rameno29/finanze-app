import { beforeEach, expect, it, vi } from 'vitest'
import { sessionScope } from './sessionScope'
const state=vi.hoisted(()=>({user:'A',switchOnRead:true,writes:[] as string[]}))
vi.mock('./supabase',()=>{
  const query=(pinned?: string)=>{
    let writing=false
    const builder={
      select:()=>builder,eq:()=>builder,
      update:()=>{writing=true;return builder},
      maybeSingle:async()=>{state.writes.push(pinned??state.user);return {data:{id:'goal-A'},error:null}},
      then:async(resolve:(value:unknown)=>unknown)=>{
        if(writing) throw new Error('Unexpected update path')
        if(state.switchOnRead) {state.user='B';sessionScope.set('B')}
        return resolve({data:[{id:'goal-A',name:'Vacanze',saved_cents:1000}],error:null})
      },
    };return builder
  }
  return {
    requireUserId:async()=>state.user,
    supabase:{auth:{getSession:async()=>({data:{session:{user:{id:state.user},access_token:'token-'+state.user}}})},from:()=>query()},
    authenticatedClient:(token:string)=>({from:()=>query(token.slice(-1))}),
  }
})
import { executeIntent } from './assistantActions'
beforeEach(()=>{state.user='A';state.switchOnRead=true;state.writes=[];sessionScope.set('A')})
const intent={action:'contribute_goal' as const,say:'',data:{goal_name:'Vacanze',amount_cents:500,direction:'add' as const}}
it('does not issue an old confirmed action with the next account after a delayed lookup',async()=>{
  await expect(executeIntent(intent)).rejects.toThrow('Account cambiato')
  expect(state.writes).toEqual([])
})
it('still applies a confirmed contribution when the original session remains active',async()=>{
  state.switchOnRead=false
  expect(await executeIntent(intent)).toContain('aggiornato')
  expect(state.writes).toEqual(['A'])
})
