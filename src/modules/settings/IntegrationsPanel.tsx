import { useEffect, useState } from 'react'
import { Card, inputClass } from '../../components/ui'
import { callFunction, type IntegrationStatus, type Provider } from '../../lib/integrations'
import { integrationGuides } from '../../lib/integrationGuides'
import { disconnectGoogle } from '../../lib/googleAuth'
import { disconnectSpotify } from '../../lib/spotifyAuth'

export function IntegrationsPanel() {
  const [items, setItems] = useState<IntegrationStatus[]>([])
  const [values, setValues] = useState<Partial<Record<Provider, string>>>({})
  const [busy, setBusy] = useState<Provider | null>(null)
  const [message, setMessage] = useState('')
  const reload = async () => setItems((await callFunction<{ integrations: IntegrationStatus[] }>('user-credentials', { action: 'list' })).integrations)
  useEffect(() => { void reload().catch(() => setMessage('La gestione delle integrazioni richiede la nuova configurazione server.')) }, [])
  async function run(provider: Provider, action: 'save' | 'delete' | 'verify') {
    if (action === 'delete' && !confirm('Rimuovere questa configurazione personale?')) return
    setBusy(provider); setMessage('')
    try {
      await callFunction('user-credentials', { action, provider, value: values[provider] ?? '' })
      if (action !== 'verify') {
        if (provider === 'google') disconnectGoogle()
        if (provider === 'spotify') disconnectSpotify()
      }
      setValues(previous => ({ ...previous, [provider]: '' }))
      await reload()
      setMessage(action === 'verify' ? 'Collegamento verificato. La disponibilità delle singole funzioni dipende dal tuo piano.' : 'Configurazione aggiornata.')
    } catch (cause) { setMessage(cause instanceof Error ? cause.message : 'Operazione non riuscita.') }
    finally { setBusy(null) }
  }
  return <section id="integrazioni" className="flex flex-col gap-3 scroll-mt-6">
    <h2 className="text-lg font-bold">Le mie integrazioni</h2>
    <p className="text-sm text-muted">Le chiavi API sono salvate cifrate nel tuo account. Puoi sostituirle o rimuoverle; ogni richiesta usa soltanto la tua configurazione.</p>
    {message && <p role="status" className="rounded-xl bg-card-2 p-3 text-sm">{message}</p>}
    {integrationGuides.map(guide => {
      const status = items.find(item => item.provider === guide.provider)
      const oauth = guide.provider === 'google' || guide.provider === 'spotify'
      return <Card key={guide.provider}>
        <h3 className="font-semibold">{guide.title}</h3>
        <p className="my-2 text-sm text-muted">{guide.description}</p>
        <p className="text-sm">{status ? oauth ? 'Client ID configurato' : `Chiave salvata · ••••${status.suffix}` : 'Da configurare'}</p>
        <details className="my-3 text-sm"><summary className="cursor-pointer font-semibold text-accent">Come ottenere la tua configurazione</summary>
          <ol className="ml-5 mt-3 list-decimal space-y-2">{guide.steps.map(step => <li key={step}>{step}</li>)}</ol>
          <a className="mt-3 block text-accent underline" href={guide.link} target="_blank" rel="noopener noreferrer">Apri il pannello ufficiale</a>
          <a className="mt-2 block text-accent underline" href={guide.docs} target="_blank" rel="noopener noreferrer">Requisiti, limiti e documentazione</a>
          <p className="mt-3 text-muted">{guide.note}</p>
        </details>
        <label className="block text-sm">{oauth ? 'Client ID personale' : 'Nuova chiave personale'}
          <input className={inputClass} type={oauth ? 'text' : 'password'} autoComplete="off" spellCheck={false} value={values[guide.provider] ?? ''} onChange={e => setValues(previous => ({ ...previous, [guide.provider]: e.target.value }))} />
        </label>
        <div className="mt-3 flex flex-wrap gap-2">
          <button disabled={busy !== null || !values[guide.provider]?.trim()} onClick={() => void run(guide.provider, 'save')} className="min-h-11 rounded-xl bg-accent px-4 text-white disabled:opacity-50">{busy === guide.provider ? 'Attendi…' : 'Salva'}</button>
          {status && <button disabled={busy !== null} onClick={() => void run(guide.provider, 'delete')} className="min-h-11 rounded-xl border border-line px-4 text-expense">Rimuovi</button>}
          {status && !oauth && <button disabled={busy !== null} onClick={() => void run(guide.provider, 'verify')} className="min-h-11 rounded-xl border border-line px-4">Verifica</button>}
        </div>
        {!oauth && <p className="mt-2 text-xs text-muted">La verifica effettua una richiesta al provider e può consumare una piccola quota.</p>}
      </Card>
    })}
  </section>
}
