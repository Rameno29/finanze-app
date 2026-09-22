import { expect, it } from 'vitest'
import { readAllPages } from './pagination'
it('does not truncate financial totals at the PostgREST page limit', async () => {
  const rows=Array.from({length:2051},(_,id)=>({id,amount_cents:100}))
  const result=await readAllPages(async(from,to)=>({data:rows.slice(from,to+1),error:null}))
  expect(result.reduce((sum,row)=>sum+row.amount_cents,0)).toBe(205100)
  expect(new Set(result.map(row=>row.id)).size).toBe(2051)
})
it('never returns partial data when a later page fails',async()=>{
  await expect(readAllPages(async(from)=>from===0?{data:[1,2],error:null}:{data:null,error:new Error('offline')},2)).rejects.toThrow('offline')
})
