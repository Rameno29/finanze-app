// Endpoint legacy ritirato: nessun accesso a segreti globali né chiamata al provider.
import { json } from '../_shared/access.ts'
export const serve = (req: Request) => json(req, { error: 'endpoint_retired', replacement: 'ai-analyze' }, 410)
if (import.meta.main) Deno.serve(serve)
