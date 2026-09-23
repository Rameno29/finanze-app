import { ApiError } from './access.ts'

export type GenerateFormat = 'sintesi' | 'appunti' | 'schema'
export type GenerateSource = { kind: 'text' } | { kind: 'youtube'; url: string } | { kind: 'document'; file_name: string }

export interface GenerateRequest {
  source: GenerateSource['kind']
  format: GenerateFormat
  prompt: string
  videoUrl?: string
  documentId?: string
}

export interface GeneratedDocument {
  title: string
  sections: Array<{ heading: string; body: string }>
  source: GenerateSource
}

export function canonicalYouTubeUrl(value: string): string {
  if (value.length > 500) throw new ApiError('invalid_video_url')
  let url: URL
  try { url = new URL(value) } catch { throw new ApiError('invalid_video_url') }
  if (url.protocol !== 'https:' || url.username || url.password || url.port) throw new ApiError('invalid_video_url')
  const host = url.hostname.toLowerCase()
  const id = host === 'youtu.be'
    ? url.pathname.slice(1)
    : ['youtube.com', 'www.youtube.com', 'm.youtube.com'].includes(host)
      ? url.pathname === '/watch' ? url.searchParams.get('v') : /^\/(shorts|live)\//.test(url.pathname) ? url.pathname.split('/')[2] : null
      : null
  if (!id || !/^[A-Za-z0-9_-]{11}$/.test(id)) throw new ApiError('invalid_video_url')
  return `https://www.youtube.com/watch?v=${id}`
}

export function parseGenerateRequest(body: Record<string, unknown>): GenerateRequest {
  const source = body.source ?? (body.video_url ? 'youtube' : body.document_id ? 'document' : 'text')
  if (source !== 'text' && source !== 'youtube' && source !== 'document') throw new ApiError('invalid_input')
  const format = body.format ?? 'appunti'
  if (format !== 'sintesi' && format !== 'appunti' && format !== 'schema') throw new ApiError('invalid_input')
  if (body.prompt !== undefined && typeof body.prompt !== 'string') throw new ApiError('invalid_input')
  const prompt = (body.prompt ?? '').trim() as string
  if (prompt.length > 2000 || (source === 'text' && !prompt)) throw new ApiError('invalid_input')
  if (source === 'text') {
    if (body.video_url || body.document_id) throw new ApiError('invalid_input')
    return { source, format, prompt }
  }
  if (source === 'youtube') {
    if (body.document_id || typeof body.video_url !== 'string') throw new ApiError('invalid_input')
    return { source, format, prompt, videoUrl: canonicalYouTubeUrl(body.video_url) }
  }
  if (body.video_url || typeof body.document_id !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(body.document_id)) throw new ApiError('invalid_input')
  return { source, format, prompt, documentId: body.document_id }
}

export function parseGeneratedDocument(value: string, source: GenerateSource): GeneratedDocument {
  let data: unknown
  try { data = JSON.parse(value) } catch { throw new ApiError('invalid_response', 502) }
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new ApiError('invalid_response', 502)
  const doc = data as Record<string, unknown>
  if (typeof doc.title !== 'string' || !doc.title.trim() || doc.title.length > 200) throw new ApiError('invalid_response', 502)
  if (!Array.isArray(doc.sections) || doc.sections.length === 0 || doc.sections.length > 24) throw new ApiError('invalid_response', 502)
  const sections = doc.sections.map((section: unknown) => {
    if (!section || typeof section !== 'object' || Array.isArray(section)) throw new ApiError('invalid_response', 502)
    const item = section as Record<string, unknown>
    if (typeof item.heading !== 'string' || !item.heading.trim() || item.heading.length > 200 || typeof item.body !== 'string' || !item.body.trim() || item.body.length > 20000) throw new ApiError('invalid_response', 502)
    return { heading: item.heading.trim(), body: item.body.trim() }
  })
  if (sections.reduce((sum, section) => sum + section.body.length, 0) > 50000) throw new ApiError('invalid_response', 502)
  return { title: doc.title.trim(), sections, source }
}
