import type { SupabaseClient } from 'jsr:@supabase/supabase-js@2.110.0'
import { openCredential, sealCredential } from './crypto.ts'
import { ApiError, requireActive, rateLimit } from './access.ts'

export function masterKeys(): Record<string, string> {
  try {
    const keys = JSON.parse(Deno.env.get('CREDENTIAL_MASTER_KEYS') ?? '{}')
    if (!keys || typeof keys !== 'object' || Array.isArray(keys)) throw new Error()
    return keys
  } catch { throw new ApiError('credential_service_unavailable', 503) }
}
export async function saveCredential(admin: SupabaseClient, userId: string, provider: string, value: string) {
  const version = Deno.env.get('CREDENTIAL_KEY_VERSION') ?? 'v1'
  const key = masterKeys()[version]
  if (!key) throw new ApiError('credential_service_unavailable', 503)
  const encrypted = await sealCredential(value, userId, provider, version, key)
  const { error } = await admin.from('user_api_credentials').upsert({ user_id: userId, provider, ...encrypted, suffix: value.slice(-4), updated_at: new Date().toISOString() })
  if (error) throw new ApiError('service_unavailable', 503)
}
export async function personalKey(admin: SupabaseClient, userId: string, provider: 'gemini' | 'youtube'): Promise<string> {
  await requireActive(admin, userId)
  await rateLimit(admin, userId, provider)
  const { data, error } = await admin.from('user_api_credentials').select('ciphertext,nonce,key_version').eq('user_id', userId).eq('provider', provider).maybeSingle()
  if (error) throw new ApiError('service_unavailable', 503)
  if (!data) throw new ApiError('missing_api_key', 428)
  const key = masterKeys()[data.key_version]
  if (!key) throw new ApiError('credential_service_unavailable', 503)
  try { return await openCredential(data, userId, provider, key) }
  catch { throw new ApiError('credential_service_unavailable', 503) }
}
export async function providerFetch(url: string, init: RequestInit): Promise<Response> {
  let response: Response
  try { response = await fetch(url, { ...init, signal: AbortSignal.timeout(45000) }) }
  catch { throw new ApiError('provider_unavailable', 502) }
  if (response.status === 429) throw new ApiError('provider_quota', 429)
  if (response.status === 403) {
    const errorBody = await response.json().catch(() => null)
    const reasons = errorBody?.error?.errors
    if (Array.isArray(reasons) && reasons.some(item => ['quotaExceeded','dailyLimitExceeded','rateLimitExceeded'].includes(item?.reason))) throw new ApiError('provider_quota', 429)
  }
  if (response.status === 400) {
    const body = await response.json().catch(() => null)
    const message = String(body?.error?.message ?? '').toLowerCase()
    if (/(video|youtube)/.test(message) && /(not available|unavailable|not found|private|inaccessible|cannot access)/.test(message)) throw new ApiError('video_unavailable', 422)
    throw new ApiError('invalid_credential', 400)
  }
  if (response.status === 401 || response.status === 403) throw new ApiError('invalid_credential', 400)
  if (!response.ok) throw new ApiError('provider_unavailable', 502)
  return response
}
