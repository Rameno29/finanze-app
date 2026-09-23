import { test, expect, type Page } from '@playwright/test'

const owner='11111111-1111-4111-8111-111111111111'
const guest='22222222-2222-4222-8222-222222222222'
function session(id: string) {
  const token = [Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url'),Buffer.from(JSON.stringify({sub:id,exp:Math.floor(Date.now()/1000)+3600,role:'authenticated'})).toString('base64url'),'synthetic-test-signature'].join('.')
  return {access_token:token,refresh_token:`refresh-${id}`,token_type:'bearer',expires_in:3600,expires_at:Math.floor(Date.now()/1000)+3600,user:{id,aud:'authenticated',role:'authenticated',email:id===owner?'owner@example.test':'guest@example.test',app_metadata:{provider:'email'},user_metadata:{},identities:[],created_at:new Date().toISOString()}}
}
async function mockBackend(page: Page, options: { rejectFirstPassword?: boolean; csvFailure?: boolean; csvHistory?: boolean; csvReadFailure?: boolean; uploadLostResponse?: boolean; diaryFailure?: boolean } = {}) {
  let diaryPosts=0
  const documents = new Map<string, Record<string,unknown>>()
  const files = new Set<string>()
  const secrets = new Map<string,string>()
  const bank='44444444-4444-4444-8444-444444444444'
  const transactions = new Map<string, Record<string,unknown>>()
  if(options.csvHistory) for(let i=0;i<1001;i++) transactions.set(`existing-${i}`,{id:`existing-${i}`,user_id:owner,account_id:bank,date:'2026-09-01',kind:'expense',amount_cents:i+1})
  const csvMode = options.csvFailure || options.csvHistory || options.csvReadFailure || options.diaryFailure
  const calls: Array<{id:string;name:string;body:Record<string,unknown>}> = []
  await page.route('**/*', async route => {
    const req=route.request(), url=new URL(req.url())
    if(url.hostname==='127.0.0.1') return route.continue()
    if(url.hostname!=='boucbthrnddmnzcowafy.supabase.co') return route.abort()
    let id=owner
    try { id=JSON.parse(Buffer.from((req.headers().authorization??'').split('.')[1],'base64url').toString()).sub } catch { /* login */ }
    let body: any = {}
    try { body=req.postDataJSON()??{} } catch { /* Multipart document upload. */ }
    const send=(value:unknown,status=200,extra={})=>route.fulfill({status,contentType:'application/json',headers:{'Access-Control-Allow-Origin':'*',...extra},body:JSON.stringify(value)})
    if(req.method()==='OPTIONS') return route.fulfill({status:204,headers:{'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'*','Access-Control-Allow-Methods':'GET,POST,PATCH,DELETE,HEAD,PUT,OPTIONS'}})
    if(url.pathname.endsWith('/token')) return body.password==='bad-password' ? send({error:'invalid_grant',error_description:'Invalid login credentials'},400) : send(session(body.email==='guest@example.test'?guest:owner))
    if(url.pathname.endsWith('/verify')) return body.token_hash==='expired' ? send({message:'expired'},403) : send(session(guest))
    if(url.pathname.endsWith('/user')) {
      if(req.method()==='PUT') {
        calls.push({id,name:'password-update',body:{}})
        if(options.rejectFirstPassword) { options.rejectFirstPassword=false;return send({message:'Password rejected'},422) }
      }
      return send(session(id).user)
    }
    if(url.pathname.endsWith('/logout')) return route.fulfill({status:204})
    if(url.pathname.endsWith('/recover')) return send({})
    if(url.pathname.includes('/functions/v1/')) {
      const name=url.pathname.split('/').pop()!
      calls.push({id,name,body})
      if(options.diaryFailure && name==='ai-analyze' && body.mode==='parse_transactions') return send({transactions:[
        {amount_cents:100,kind:'expense',category_name:null,date:'2026-09-22',description:'Caffe'},
        {amount_cents:200,kind:'expense',category_name:null,date:'2026-09-22',description:'Pranzo'},
      ]})
      if(name==='manage-invites') {
        if(body.action==='accept') return send({ok:true})
        if(body.action==='status') return send({role:id===owner?'owner':'member'})
        if(id!==owner) return send({error:'access_denied'},403)
        if(body.action==='list') return send({invites:[],members:[{user_id:owner,role:'owner',status:'active'}],guest_limit:1})
        if(body.action==='create') return send({link:'http://127.0.0.1:4173/finanze-app/auth/callback#token_hash=valid-invite&type=invite&invite_id=33333333-3333-4333-8333-333333333333',email_sent:false})
      }
      if(name==='user-credentials') {
        if(body.action==='list') return send({integrations:secrets.has(id)?[{provider:'gemini',suffix:secrets.get(id)!.slice(-4),updated_at:'2026-09-21'}]:[]})
        if(body.action==='save') secrets.set(id,String(body.value))
        if(body.action==='delete') secrets.delete(id)
        return send({ok:true})
      }
      if(name==='youtube-search') return send({error:'missing_api_key'},428)
      return send({error:'missing_api_key'},428)
    }
    if(url.pathname.endsWith('/app_members')) return send({status:'active'})
    if(options.uploadLostResponse && url.pathname.includes('/storage/v1/object/documents')) {
      if(req.method()==='POST') { files.add(decodeURIComponent(url.pathname.split('/documents/')[1]));return send({Key:url.pathname}) }
      if(req.method()==='DELETE') { for(const path of body.prefixes) files.delete(path);return send([]) }
    }
    if(options.uploadLostResponse && url.pathname.endsWith('/documents')) {
      if(req.method()==='POST') {
        const doc={id:crypto.randomUUID(),status:'caricato',created_at:'2026-09-22',...body}
        documents.set(doc.id,doc)
        return send({message:'Connection lost after commit'},503)
      }
      const requestedId=url.searchParams.get('id')?.replace('eq.','')
      return send(requestedId ? documents.get(requestedId)??null : [...documents.values()])
    }
    if(csvMode && url.pathname.endsWith('/accounts')) return send([{id:bank,user_id:owner,name:'Banca prova',kind:'banca',initial_balance_cents:0,created_at:'2026-09-01'}])
    if(csvMode && url.pathname.endsWith('/transactions')) {
      if(req.method()==='POST') {
        if(options.diaryFailure && ++diaryPosts===2) return send({message:'synthetic temporary rejection'},400)
        for(const row of (Array.isArray(body)?body:[body]) as Array<Record<string,unknown>>) if(!transactions.has(String(row.id))) transactions.set(String(row.id),row)
        if(options.csvFailure) { options.csvFailure=false;return send({message:'Connection lost after commit'},503) }
        return send([])
      }
      if(options.csvReadFailure) return send({message:'Database unavailable'},503)
      const offset=Number(url.searchParams.get('offset')??0), limit=Number(url.searchParams.get('limit')??1000)
      return send([...transactions.values()].slice(offset,offset+limit))
    }
    if(req.method()==='HEAD') return route.fulfill({status:200,headers:{'Content-Range':'0-0/1'}})
    if(url.pathname.includes('/rest/v1/')) return send([])
    return send({})
  })
  return {secrets,calls,transactions,documents,files}
}

test('document upload preserves a committed file when the database response is lost',async({page})=>{
  const {documents,files}=await mockBackend(page,{uploadLostResponse:true})
  await page.goto('impostazioni');await login(page);await page.goto('documenti')
  await page.getByRole('button',{name:'Documento Spiegazione AI',exact:true}).click()
  await page.locator('input[type=file]').first().setInputFiles({name:'contratto-prova.pdf',mimeType:'application/pdf',buffer:Buffer.from('%PDF-1.4 synthetic test')})
  await expect(page.getByText('contratto-prova.pdf',{exact:true})).toBeVisible()
  expect(documents.size).toBe(1)
  expect(files.size).toBe(1)
})
async function login(page:Page,email='owner@example.test') {
  await page.getByLabel('Email', {exact:true}).fill(email)
  await page.getByLabel('Password', {exact:true}).fill('test-password-1234')
  await page.getByRole('button',{name:'Accedi',exact:true}).click()
  await expect(page.getByRole('heading',{name:'Le mie integrazioni'})).toBeVisible()
}

test('navigazione focalizzata conserva agenda documenti e carburanti', async ({page}) => {
  await mockBackend(page)
  await page.goto('impostazioni')
  await login(page)
  await expect(page.getByRole('link', {name: /Carburanti/})).toBeVisible()
  await expect(page.getByRole('heading', {name: /Gemini/})).toBeVisible()
  await expect(page.locator('a[href$="/media"]')).toHaveCount(0)
  await expect(page.locator('a[href$="/google"]')).toHaveCount(0)
  await expect(page.getByRole('heading', {name: /Spotify/})).toHaveCount(0)
  await page.getByRole('link', {name: 'Agenda', exact: true}).click()
  await expect(page.getByRole('button', {name: 'Calendario'})).toBeVisible()
  await page.getByRole('link', {name: 'Documenti', exact: true}).click()
  await expect(page.getByRole('button', {name: /Busta paga/})).toBeVisible()
})

test('documenti conserva caricamento e creazione PDF senza scanner', async ({page}) => {
  await mockBackend(page)
  await page.goto('impostazioni')
  await login(page)
  await page.getByRole('link', {name: 'Documenti', exact: true}).click()
  await expect(page.getByRole('button', {name: /Busta paga/})).toBeVisible()
  await expect(page.getByRole('button', {name: /Scontrino/})).toBeVisible()
  await expect(page.getByRole('heading', {name: 'Crea un documento PDF'})).toBeVisible()
  await expect(page.getByRole('button', {name: /Scanner documenti/})).toHaveCount(0)
})
test('leaving the assistant while microphone permission is pending cancels a late grant',async({page})=>{
  await mockBackend(page)
  await page.addInitScript(()=>{
    const state={requested:false,stopped:0,grant:()=>{}}
    Object.assign(window,{voiceTest:state})
    Object.defineProperty(navigator,'mediaDevices',{value:{getUserMedia:()=>new Promise(resolve=>{
      state.requested=true;state.grant=()=>resolve({getTracks:()=>[{stop:()=>state.stopped++}]})
    })}})
    const node=()=>({connect(){},disconnect(){},gain:{value:0},onaudioprocess:null})
    Object.assign(window,{AudioContext:class {
      state='running';sampleRate=16000;destination={}
      createMediaStreamSource=node;createScriptProcessor=node;createGain=node
      close(){return Promise.resolve()}
    }})
  })
  await page.goto('impostazioni');await login(page)
  await page.locator('a[href$="/assistente"]').click()
  await page.getByRole('button',{name:'Parla',exact:true}).click()
  await expect.poll(()=>page.evaluate(()=>(window as any).voiceTest.requested)).toBe(true)
  await page.getByRole('link',{name:'Altro',exact:true}).click()
  await page.evaluate(()=>(window as any).voiceTest.grant())
  await expect.poll(()=>page.evaluate(()=>(window as any).voiceTest.stopped)).toBe(1)
})
for(const theme of ['light','dark'] as const) test(`login input text, focus and password visibility in ${theme}`, async ({page}) => {
  await mockBackend(page)
  await page.emulateMedia({colorScheme:theme})
  await page.goto('impostazioni')
  const email=page.getByLabel('Email',{exact:true}), password=page.getByLabel('Password',{exact:true})
  await email.fill('reader@example.test'); await password.fill('bad-password')
  for(const input of [email,password]) {
    const color=await input.evaluate(el=>getComputedStyle(el).color)
    expect(color).toBe('rgb(242, 237, 228)')
    // Cream has >4.5:1 contrast even against the lightest opaque gradient stop.
    const ratio=await input.evaluate(el=>{
      const lum=(rgb:number[])=>rgb.map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4}).reduce((a,v,i)=>a+v*[.2126,.7152,.0722][i],0)
      const rgb=getComputedStyle(el).color.match(/\d+/g)!.map(Number)
      return (lum(rgb)+.05)/(lum([13,107,86])+.05)
    }); expect(ratio).toBeGreaterThanOrEqual(4.5)
  }
  await page.getByRole('button',{name:'Mostra password'}).click(); await expect(password).toHaveAttribute('type','text')
  await page.getByRole('button',{name:'Accedi',exact:true}).click()
  await expect(page.getByText('Accesso non riuscito: controlla email e password.')).toBeVisible()
  await expect(page.getByRole('button',{name:/registrati/i})).toHaveCount(0)
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true)
  await page.screenshot({path:`output/playwright/login-${theme}-${test.info().project.name}.png`})
})

test('owner creates invite; invited user completes password and has no owner panel', async ({page})=>{
  const {calls}=await mockBackend(page)
  await page.goto('impostazioni'); await login(page)
  await page.getByLabel('Email dell’ospite').fill('guest@example.test')
  await page.getByRole('button',{name:'Genera invito',exact:true}).click()
  const link=await page.getByLabel('Link personale dell’invito').inputValue()
  await page.goto(link)
  await page.getByLabel('Nuova password').fill('guest-password-1234')
  await page.getByLabel('Ripeti password').fill('guest-password-1234')
  await page.getByRole('button',{name:'Salva e continua'}).click()
  await expect(page.getByRole('heading',{name:'Le mie integrazioni'})).toBeVisible()
  await expect(page.getByRole('heading',{name:'Utenti e inviti'})).toHaveCount(0)
  expect(calls.find(call=>call.body.action==='accept')?.id).toBe(guest)
})

test('personal key save stays masked; logout removes OAuth; guest cannot see owner configuration',async({page})=>{
  const {secrets}=await mockBackend(page)
  await page.goto('impostazioni'); await login(page)
  const key=page.getByLabel('Nuova chiave personale').first()
  await key.fill('synthetic-owner-key-1234')
  await page.getByRole('button',{name:'Salva',exact:true}).first().click()
  await expect(page.getByText('Chiave salvata · ••••1234')).toBeVisible(); await expect(key).toHaveValue('')
  await page.evaluate(()=>sessionStorage.setItem('aje-oauth:11111111-1111-4111-8111-111111111111:google_token','synthetic-owner-token'))
  await page.getByRole('button',{name:/Esci/}).click()
  await expect(page.getByRole('button',{name:'Accedi',exact:true})).toBeVisible()
  expect(await page.evaluate(()=>Object.keys(sessionStorage).some(key=>key.startsWith('aje-oauth:')))).toBe(false)
  await login(page,'guest@example.test')
  await expect(page.getByText('Chiave salvata · ••••1234')).toHaveCount(0)
  await expect(page.getByRole('heading',{name:'Utenti e inviti'})).toHaveCount(0)
  expect(secrets.has(guest)).toBe(false)
  await page.goto('media')
  await page.getByPlaceholder(/cerca|link/i).first().fill('example video')
  await page.getByRole('button',{name:/cerca/i}).first().click()
  await expect(page.getByText('Configura la tua chiave personale in Impostazioni → Le mie integrazioni.')).toBeVisible()
})

test('expired invitation leaves a readable error and does not activate membership',async({page})=>{
  const {calls}=await mockBackend(page)
  await page.goto('auth/callback#token_hash=expired&type=invite&invite_id=test')
  await page.getByLabel('Nuova password').fill('test-password-1234');await page.getByLabel('Ripeti password').fill('test-password-1234')
  await page.getByRole('button',{name:'Salva e continua'}).click()
  await expect(page.getByRole('alert')).toContainText('Link scaduto')
  expect(calls.some(call=>call.body.action==='accept')).toBe(false)
})

test('password retry cannot change another account signed in from a second tab',async({page,context})=>{
  const {calls}=await mockBackend(page,{rejectFirstPassword:true})
  await page.goto('auth/callback#token_hash=valid-invite&type=invite&invite_id=test')
  await page.getByLabel('Nuova password').fill('guest-password-1234');await page.getByLabel('Ripeti password').fill('guest-password-1234')
  await page.getByRole('button',{name:'Salva e continua'}).click()
  await expect(page.getByRole('alert')).toContainText('Password non accettata')
  const second=await context.newPage();await mockBackend(second);await second.goto('impostazioni')
  await expect(second.getByRole('heading',{name:'Le mie integrazioni'})).toBeVisible()
  await second.getByRole('button',{name:/Esci/}).click();await login(second)
  await page.getByRole('button',{name:'Salva e continua'}).click()
  await expect(page.getByRole('alert')).toContainText('Account cambiato')
  expect(calls.filter(call=>call.name==='password-update').map(call=>call.id)).toEqual([guest])
  expect(calls.some(call=>call.body.action==='accept')).toBe(false)
})

test('logout propagates to a second tab and authenticated modules render without crashes',async({page,context})=>{
  await mockBackend(page)
  await page.goto('impostazioni');await login(page)
  const errors:string[]=[]
  page.on('pageerror',error=>errors.push(error.message))
  for(const path of ['finanze','agenda','documenti','assistente','google','media','carburanti','guida']) {
    await page.goto(path)
    await expect(page.locator('h1')).toBeVisible()
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true)
  }
  await page.goto('impostazioni')
  const second=await context.newPage();await mockBackend(second);await second.goto('impostazioni')
  await expect(second.getByRole('heading',{name:'Le mie integrazioni'})).toBeVisible()
  await page.getByRole('button',{name:/Esci/}).click()
  await expect(second.getByRole('button',{name:'Accedi',exact:true})).toBeVisible()
  expect(errors).toEqual([])
})

async function openCsv(page: Page, csv: string) {
  await page.goto('impostazioni');await login(page)
  await page.goto('finanze');await page.getByRole('button',{name:'Conti',exact:true}).click()
  await page.getByRole('button',{name:'Importa estratto conto CSV su Banca prova'}).click()
  await page.locator('input[type=file]').setInputFiles({name:'statement.csv',mimeType:'text/csv',buffer:Buffer.from(csv)})
}

test('retrying a partially saved diary does not duplicate its already saved movements',async({page})=>{
  const {transactions}=await mockBackend(page,{diaryFailure:true})
  await page.goto('impostazioni');await login(page);await page.goto('finanze')
  await page.getByRole('button',{name:/Diario del giorno/}).click()
  await page.locator('textarea').fill('Caffe e pranzo')
  await page.getByRole('button',{name:'Interpreta il diario',exact:true}).click()
  await page.getByRole('button',{name:'Registra 2 movimenti',exact:true}).click()
  await expect(page.getByText(/synthetic temporary rejection|Salvataggio non riuscito/)).toBeVisible()
  await page.getByRole('button',{name:'Registra 2 movimenti',exact:true}).click()
  await expect(page.getByText('2 movimenti registrati', {exact:true})).toBeVisible()
  expect(transactions.size).toBe(2)
})

test('CSV retry after a lost response does not duplicate already committed rows',async({page})=>{
  const {transactions}=await mockBackend(page,{csvFailure:true})
  await openCsv(page,'Data;Descrizione;Importo\n'+Array.from({length:201},(_,i)=>`01/09/2026;Riga ${i};-${i+1},00`).join('\n'))
  await page.getByRole('button',{name:'Importa 201',exact:true}).click()
  await expect(page.getByText(/Import non riuscito/)).toBeVisible()
  await page.getByRole('button',{name:/^(Importa 201|Riprova importazione)$/}).click()
  await expect(page.getByText('201 movimenti importati su Banca prova')).toBeVisible()
  expect(transactions.size).toBe(201)
})

test('CSV duplicate detection reads past the first database page',async({page})=>{
  await mockBackend(page,{csvHistory:true})
  await openCsv(page,'Data;Descrizione;Importo\n01/09/2026;Gia presente;-10,01')
  await expect(page.getByText(/1 possibili duplicati/)).toBeVisible()
  await expect(page.getByRole('button',{name:'Importa 0',exact:true})).toBeDisabled()
})

test('CSV import is not enabled when duplicate verification fails',async({page})=>{
  await mockBackend(page,{csvReadFailure:true})
  await openCsv(page,'Data;Descrizione;Importo\n01/09/2026;Prova;-10,01')
  // Supabase retries transient GET failures before surfacing the final error.
  await expect(page.getByText(/Lettura del file non riuscita|Verifica dei movimenti non riuscita/)).toBeVisible({timeout:20000})
  await expect(page.getByRole('button',{name:'Importa 1',exact:true})).toHaveCount(0)
})
