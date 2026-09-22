import { afterEach, expect, it, vi } from 'vitest'
import { uploadDocument } from './documentUpload'
import { supabase } from './supabase'
import { sessionScope } from './sessionScope'

afterEach(() => { vi.restoreAllMocks();vi.unstubAllGlobals();sessionScope.set(null) })

function fixture(mode: 'committed' | 'rejected' | 'uncertain' | 'switch') {
  sessionScope.set('A')
  vi.spyOn(supabase.auth, 'getSession').mockResolvedValue({data:{session:{user:{id:'A'},access_token:'token-A'}},error:null} as never)
  const writes: string[] = []
  let saved: Record<string,unknown> | null = null
  const files = new Set<string>()
  vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
    const req = new Request(input,init), url = new URL(req.url)
    expect(req.headers.get('authorization')).toBe('Bearer token-A')
    const send = (value: unknown, status=200) => new Response(JSON.stringify(value),{status,headers:{'Content-Type':'application/json'}})
    if(url.pathname.includes('/storage/v1/object/documents')) {
      if(req.method==='POST') {
        files.add(url.pathname.split('/documents/')[1])
        if(mode==='switch') sessionScope.set('B')
        return send({Key:url.pathname})
      }
      if(req.method==='DELETE') { for(const path of (await req.json()).prefixes) files.delete(path);return send([]) }
    }
    if(url.pathname.endsWith('/documents')) {
      if(req.method==='POST') {
        const row=await req.json();writes.push(row.user_id)
        if(mode==='committed') saved={...row,status:'caricato'}
        return send({code:mode==='rejected'?'23514':'',message:'synthetic failure'},mode==='rejected'?400:503)
      }
      if(saved) expect(url.searchParams.get('id')).toBe(`eq.${saved.id}`)
      return send(saved)
    }
    throw new Error(`Unexpected request ${req.method} ${url.pathname}`)
  })
  return {files,writes}
}
const file = () => new File(['%PDF test'],'scan.pdf',{type:'application/pdf'})

it('recovers a committed document by its predetermined ID without deleting its file',async()=>{
  const {files}=fixture('committed')
  const doc=await uploadDocument(file(),'altro')
  expect(doc.user_id).toBe('A')
  expect(doc.file_name).toBe('scan.pdf')
  expect(files.has(doc.storage_path)).toBe(true)
})
it('removes an orphan only after a definitive database rejection and successful absence check',async()=>{
  const {files}=fixture('rejected')
  await expect(uploadDocument(file(),'altro')).rejects.toThrow('Salvataggio rifiutato')
  expect(files.size).toBe(0)
})
it('does not treat an empty reconciliation read as proof an uncertain write cannot commit',async()=>{
  const {files}=fixture('uncertain')
  await expect(uploadDocument(file(),'altro')).rejects.toThrow('Esito del salvataggio incerto')
  expect(files.size).toBe(1)
})
it('stops before inserting document metadata when the account changes during upload',async()=>{
  const {writes,files}=fixture('switch')
  await expect(uploadDocument(file(),'altro')).rejects.toThrow('Account cambiato')
  expect(writes).toEqual([])
  expect(files.size).toBe(1)
})
