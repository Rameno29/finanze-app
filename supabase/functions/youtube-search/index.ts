import { handler, ApiError } from '../_shared/access.ts'
import { personalKey, providerFetch } from '../_shared/credentials.ts'

export const serve = handler(async ({ admin, user, body }) => {
  if (typeof body.query !== 'string' || !body.query.trim() || body.query.length > 200) throw new ApiError('invalid_input')
  const key = await personalKey(admin, user.id, 'youtube')
  const params = new URLSearchParams({ part: 'snippet', type: 'video', maxResults: '8', q: body.query.trim() })
  const response = await providerFetch(`https://www.googleapis.com/youtube/v3/search?${params}`, { headers: { 'x-goog-api-key': key } })
  const data = await response.json()
  return { items: data.items ?? [] }
})
if (import.meta.main) Deno.serve(serve)
