import { createClient, type SupabaseClient, type User } from 'jsr:@supabase/supabase-js@2.110.0'

export class ApiError extends Error {
  constructor(message: string, public status = 400) { super(message) }
}
export const APP_URL = 'https://rameno29.github.io/finanze-app/'
export function cors(req: Request) {
  const origin = req.headers.get('Origin') ?? ''
  const allowed = origin === new URL(APP_URL).origin || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)
  return { 'Access-Control-Allow-Origin': allowed ? origin : new URL(APP_URL).origin,
    'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
    'Access-Control-Allow-Methods': 'POST, OPTIONS', Vary: 'Origin', 'Cache-Control': 'no-store' }
}
export function json(req: Request, data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { ...cors(req), 'Content-Type': 'application/json' } })
}
export async function readJson(req: Request, limit = 16384): Promise<Record<string, unknown>> {
  const reader = req.body?.getReader()
  if (!reader) throw new ApiError('invalid_input')
  let size = 0
  const chunks: Uint8Array[] = []
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      size += value.length
      if (size > limit) { await reader.cancel(); throw new ApiError('payload_too_large', 413) }
      chunks.push(value)
    }
    const bytes = new Uint8Array(size)
    let offset = 0
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length }
    const body = JSON.parse(new TextDecoder().decode(bytes))
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error()
    return body
  } catch (error) {
    if (error instanceof ApiError) throw error
    throw new ApiError('invalid_input')
  } finally { reader.releaseLock() }
}
export async function requireActive(admin: SupabaseClient, userId: string, ownerOnly = false) {
  const { data, error } = await admin.from('app_members').select('role,status').eq('user_id', userId).maybeSingle()
  if (error) throw new ApiError('service_unavailable', 503)
  if (!data || data.status !== 'active' || (ownerOnly && data.role !== 'owner')) throw new ApiError('access_denied', 403)
  return data as { role: 'owner' | 'member'; status: 'active' }
}
export async function rateLimit(admin: SupabaseClient, userId: string, bucket: string, max = 30) {
  const { data, error } = await admin.rpc('consume_app_rate', { actor: userId, rate_bucket: bucket, max_requests: max })
  if (error) throw new ApiError('service_unavailable', 503)
  if (!data) throw new ApiError('rate_limit', 429)
}
export type Context = { admin: SupabaseClient; user: User; body: Record<string, unknown>; req: Request }
export function handler(action: (context: Context) => Promise<unknown>, options: { allowPending?: boolean; bodyLimit?: number; bucket?: string } = {}) {
  return async (req: Request): Promise<Response> => {
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(req) })
    if (req.method !== 'POST') return json(req, { error: 'method_not_allowed' }, 405)
    const origin = req.headers.get('Origin')
    if (origin && cors(req)['Access-Control-Allow-Origin'] !== origin) return json(req, { error: 'access_denied' }, 403)
    let admin: SupabaseClient | undefined
    let lease: string | undefined
    try {
      const jwt = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '')
      if (!jwt) throw new ApiError('unauthorized', 401)
      admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false, autoRefreshToken: false } })
      const { data, error } = await admin.auth.getUser(jwt)
      if (error || !data.user) throw new ApiError('unauthorized', 401)
      if (!options.allowPending) await requireActive(admin, data.user.id)
      await rateLimit(admin, data.user.id, options.bucket ?? 'management', 30)
      const slot = await admin.rpc('acquire_app_lease', { actor: data.user.id })
      if (slot.error) throw new ApiError('service_unavailable', 503)
      if (!slot.data) throw new ApiError('rate_limit', 429)
      lease = slot.data
      const body = await readJson(req, options.bodyLimit)
      const result = await action({ admin, user: data.user, body, req })
      return result instanceof Response ? result : json(req, result)
    } catch (error) {
      return json(req, { error: error instanceof ApiError ? error.message : 'service_unavailable' }, error instanceof ApiError ? error.status : 503)
    } finally {
      if (admin && lease) await admin.from('app_request_leases').delete().eq('id', lease).then(() => {}, () => {})
    }
  }
}
