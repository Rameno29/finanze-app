import { handler, ApiError } from '../_shared/access.ts'
import { personalKey, providerFetch, saveCredential } from '../_shared/credentials.ts'

export const serve = handler(async ({ admin, user, body }) => {
  if (body.action === 'list') {
    const [secrets, oauth] = await Promise.all([
      admin.from('user_api_credentials').select('provider,suffix,updated_at').eq('user_id', user.id),
      admin.from('user_integrations').select('provider,client_id,updated_at').eq('user_id', user.id),
    ])
    if (secrets.error || oauth.error) throw new ApiError('service_unavailable', 503)
    return { integrations: [...(secrets.data ?? []), ...(oauth.data ?? []).map(row => ({ ...row, suffix: '' }))] }
  }
  const provider = body.provider
  if (provider !== 'gemini' && provider !== 'youtube' && provider !== 'google' && provider !== 'spotify') throw new ApiError('invalid_input')
  const oauth = provider === 'google' || provider === 'spotify'
  if (body.action === 'delete') {
    const { error } = await admin.from(oauth ? 'user_integrations' : 'user_api_credentials').delete().eq('user_id', user.id).eq('provider', provider)
    if (error) throw new ApiError('service_unavailable', 503)
    return { ok: true }
  }
  if (body.action === 'save') {
    const value = typeof body.value === 'string' ? body.value.trim() : ''
    if (value.length < 10 || value.length > 4096 || /\s/.test(value)) throw new ApiError('invalid_input')
    if (oauth) {
      if (provider === 'google' ? !/^[\w.-]+\.apps\.googleusercontent\.com$/.test(value) : !/^[a-f0-9]{32}$/.test(value)) throw new ApiError('invalid_input')
      const { error } = await admin.from('user_integrations').upsert({ user_id: user.id, provider, client_id: value, updated_at: new Date().toISOString() })
      if (error) throw new ApiError('service_unavailable', 503)
    } else await saveCredential(admin, user.id, provider, value)
    return { ok: true }
  }
  if (body.action === 'verify' && !oauth) {
    const key = await personalKey(admin, user.id, provider)
    const url = provider === 'gemini' ? 'https://generativelanguage.googleapis.com/v1beta/models?pageSize=1' : 'https://www.googleapis.com/youtube/v3/videos?part=id&id=dQw4w9WgXcQ'
    await providerFetch(url, { headers: { 'x-goog-api-key': key } })
    return { ok: true }
  }
  throw new ApiError('invalid_input')
})
if (import.meta.main) Deno.serve(serve)
