import { handler, requireActive, ApiError, APP_URL } from '../_shared/access.ts'
import { fingerprint } from '../_shared/crypto.ts'

function dbError(error: { message: string } | null) {
  if (!error) return
  const safe = ['capacity_reached', 'access_denied', 'invalid_invite', 'invalid_input', 'already_member']
  throw new ApiError(safe.find(code => error.message.includes(code)) ?? 'service_unavailable', 400)
}

export const serve = handler(async ({ admin, user, body }) => {
  if (body.action === 'accept') {
    if (typeof body.invite_id !== 'string' || typeof body.token_hash !== 'string' || body.token_hash.length > 256) throw new ApiError('invalid_invite')
    const { error } = await admin.rpc('accept_app_invite', { actor: user.id, invite_id: body.invite_id, proof: await fingerprint(body.token_hash) })
    dbError(error)
    return { ok: true }
  }
  const member = await requireActive(admin, user.id)
  if (body.action === 'status') return { role: member.role }
  await requireActive(admin, user.id, true)
  if (body.action === 'list') {
    const page = body.page ?? 0
    if (typeof page !== 'number' || !Number.isSafeInteger(page) || page < 0 || page > 40_000_000) throw new ApiError('invalid_input')
    const pageSize = 50
    const offset = page * pageSize
    const invites = await admin.from('app_invites').select('id,email,status,expires_at,user_id')
      .order('created_at', { ascending: false }).order('id', { ascending: false }).range(offset, offset + pageSize)
    dbError(invites.error)
    const visible = (invites.data ?? []).slice(0, pageSize)
    const userIds = [...new Set(visible.map(invite => invite.user_id).filter((id): id is string => !!id))]
    const members = userIds.length ? await admin.from('app_members').select('user_id,role,status').in('user_id', userIds) : null
    dbError(members?.error ?? null)
    return { invites: visible, members: members?.data ?? [], has_more: (invites.data?.length ?? 0) > pageSize }
  }
  if (body.action === 'cancel') {
    if (typeof body.invite_id !== 'string') throw new ApiError('invalid_input')
    const { error } = await admin.from('app_invites').update({ status: 'cancelled', proof_hash: null, revision: crypto.randomUUID() }).eq('id', body.invite_id).eq('status', 'pending')
    dbError(error)
    return { ok: true }
  }
  if (body.action === 'suspend') {
    if (typeof body.user_id !== 'string' || body.user_id === user.id) throw new ApiError('invalid_input')
    const { error } = await admin.rpc('suspend_app_member', { actor: user.id, target_user: body.user_id })
    dbError(error)
    // Membership policies deny even still-valid JWTs. Banning also prevents token refresh/sign-in.
    const { error: banError } = await admin.auth.admin.updateUserById(body.user_id, { ban_duration: '876000h' })
    return { ok: true, session_revocation_pending: !!banError }
  }
  if (body.action !== 'create' || typeof body.email !== 'string') throw new ApiError('invalid_input')
  if (body.delivery === 'email' && !Deno.env.get('INVITE_SMTP_URL')) throw new ApiError('smtp_unavailable')
  const { data: invite, error } = await admin.rpc('reserve_app_invite', { actor: user.id, invite_email: body.email })
  dbError(error)
  if (!invite) throw new ApiError('service_unavailable', 503)
  const type = invite.user_id ? 'recovery' : 'invite'
  const { data: generated, error: linkError } = await admin.auth.admin.generateLink({ type, email: invite.email })
  if (linkError || !generated.properties?.hashed_token || !generated.user?.id) throw new ApiError('service_unavailable', 503)
  const hash = generated.properties.hashed_token
  const { data: finalized, error: finalizeError } = await admin.from('app_invites').update({ user_id: generated.user.id, proof_hash: await fingerprint(hash) })
    .eq('id', invite.id).eq('revision', invite.revision).eq('status', 'pending').select('id').maybeSingle()
  dbError(finalizeError)
  if (!finalized) throw new ApiError('invite_changed', 409)
  // Reinviting a suspended identity does not grant membership; acceptance with the new proof is required.
  const { error: unbanError } = await admin.auth.admin.updateUserById(generated.user.id, { ban_duration: 'none' })
  if (unbanError) throw new ApiError('service_unavailable', 503)
  const link = new URL('auth/callback', APP_URL)
  link.hash = new URLSearchParams({ token_hash: hash, type, invite_id: invite.id }).toString()
  if (body.delivery === 'email') {
    const { default: nodemailer } = await import('npm:nodemailer@10.0.10')
    try {
      const transporter = nodemailer.createTransport(Deno.env.get('INVITE_SMTP_URL')!)
      await transporter.sendMail({ from: Deno.env.get('INVITE_FROM'), to: invite.email, subject: 'Il tuo invito ad AJE', text: `Sei stato invitato ad AJE. Apri questo link per impostare la password e attivare il tuo account:\n\n${link.href}\n\nIl link è personale, monouso e può scadere entro un’ora. Se scade, richiedi un nuovo invito.` })
      transporter.close()
    } catch { return { ok: true, link: link.href, email_sent: false } }
  }
  return { ok: true, link: link.href, email_sent: body.delivery === 'email' }
}, { allowPending: true })
if (import.meta.main) Deno.serve(serve)
