// Operator-only utility. Defaults to dry run. Never prints secret values or user IDs.
import { createClient } from 'jsr:@supabase/supabase-js@2.110.0'
import { openCredential, sealCredential } from '../functions/_shared/crypto.ts'

export async function rotateCredentials() {
  const url = Deno.env.get('SUPABASE_URL')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const version = Deno.env.get('CREDENTIAL_KEY_VERSION')
  const keys = JSON.parse(Deno.env.get('CREDENTIAL_MASTER_KEYS') ?? '{}') as Record<string,string>
  if (!url || !serviceKey || !version || !keys[version]) throw new Error('Missing operator configuration')
  const admin = createClient(url,serviceKey,{auth:{persistSession:false,autoRefreshToken:false}})
  const {data:rows,error}=await admin.from('user_api_credentials').select('*').neq('key_version',version).limit(100)
  if(error) throw new Error('Unable to read credentials')
  const apply=Deno.args.includes('--apply')
  let verified=0,updated=0,conflicts=0
  for(const row of rows??[]) {
    const previous=keys[row.key_version]
    if(!previous) throw new Error('Keep all previous master key versions during rotation')
    const plain=await openCredential(row,row.user_id,row.provider,previous)
    const sealed=await sealCredential(plain,row.user_id,row.provider,version,keys[version])
    if(await openCredential(sealed,row.user_id,row.provider,keys[version])!==plain) throw new Error('Verification failed')
    verified++
    if(apply) {
      const result=await admin.from('user_api_credentials').update({...sealed,updated_at:new Date().toISOString()})
        .eq('user_id',row.user_id).eq('provider',row.provider).eq('ciphertext',row.ciphertext).select('provider')
      if(result.error) throw new Error('Rotation write failed; retain all master keys')
      if(result.data?.length) updated++; else conflicts++
    }
  }
  console.log(JSON.stringify({dry_run:!apply,verified,updated,conflicts,batch_limit:100}))
}
if(import.meta.main) {
  try { await rotateCredentials() }
  catch { console.error('Rotation interrupted. No secret details logged. Keep previous keys; inspect configuration and rerun.'); Deno.exit(1) }
}
