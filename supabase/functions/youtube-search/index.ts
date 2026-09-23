// Tombstone for the former video search endpoint. Existing keys are retained
// for optional user-initiated removal; this endpoint no longer reads them.
import { json } from '../_shared/access.ts'

export const serve = (req: Request): Response => json(req, { error: 'retired' }, 410)
if (import.meta.main) Deno.serve(serve)
