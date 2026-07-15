import { useEffect, useMemo, useState } from 'react'
import { Line, LineChart, ResponsiveContainer, XAxis, YAxis } from 'recharts'
import { Sparkles, TrendingUp } from 'lucide-react'
import { Card, Field, Spinner, inputClass } from '../../components/ui'
import { AiText } from '../../components/AiText'
import { supabase } from '../../lib/supabase'
import { fetchAccountBalances, fetchMonthlyTotals } from '../../lib/data'
import { averageMonthlyFlows, projectWhatIf } from '../../lib/whatif'
import { formatCents, parseAmountToCents, todayISO } from '../../lib/format'
import type { Account } from '../../types'

const HORIZONS: Array<[number, string]> = [
  [6, '6 mesi'],
  [12, '1 anno'],
  [24, '2 anni'],
  [60, '5 anni'],
]

/**
 * Simulatore "what-if": quanto avrai tra N mesi al ritmo attuale, e come
 * cambierebbe risparmiando (o spendendo) una cifra in più ogni mese.
 */
export function WhatIfCard({ accounts }: { accounts: Account[] }) {
  const [flows, setFlows] = useState<{ income: number; expense: number; monthsUsed: number } | null>(null)
  const [startBalance, setStartBalance] = useState(0)
  const [loading, setLoading] = useState(true)
  const [direction, setDirection] = useState<'save' | 'spend'>('save')
  const [amount, setAmount] = useState('100')
  const [months, setMonths] = useState(12)
  const [aiBusy, setAiBusy] = useState(false)
  const [aiComment, setAiComment] = useState('')

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const [history, balances] = await Promise.all([
          fetchMonthlyTotals(13),
          fetchAccountBalances(accounts),
        ])
        if (cancelled) return
        setFlows(averageMonthlyFlows(history, todayISO().slice(0, 7)))
        setStartBalance(Array.from(balances.values()).reduce((sum, cents) => sum + cents, 0))
      } catch {
        if (!cancelled) setFlows({ income: 0, expense: 0, monthsUsed: 0 })
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [accounts])

  const deltaCents = useMemo(() => {
    const cents = parseAmountToCents(amount) ?? 0
    return direction === 'save' ? cents : -cents
  }, [amount, direction])

  const projection = useMemo(() => {
    if (!flows) return null
    return projectWhatIf(startBalance, flows.income, flows.expense, deltaCents, months)
  }, [flows, startBalance, deltaCents, months])

  const chartData = useMemo(
    () =>
      (projection?.points ?? [])
        .filter((_, index, all) => all.length <= 25 || index % Math.ceil(all.length / 25) === 0 || index === all.length - 1)
        .map((p) => ({ name: p.label, Oggi: p.baseline / 100, Scenario: p.scenario / 100 })),
    [projection],
  )

  async function askAi() {
    if (!projection || !flows) return
    setAiBusy(true)
    setAiComment('')
    try {
      const scenarioLabel = direction === 'save' ? 'risparmiare in più' : 'spendere in più'
      const { data, error } = await supabase.functions.invoke('ai-analyze', {
        body: {
          mode: 'assistant',
          question:
            `Sto valutando questo scenario: ${scenarioLabel} ${formatCents(Math.abs(deltaCents))} al mese per ${months} mesi. ` +
            `Oggi il mio patrimonio sui conti è ${formatCents(startBalance)}, in media risparmio ${formatCents(projection.monthlyNet)} al mese. ` +
            `A fine periodo avrei ${formatCents(projection.scenarioEnd)} invece di ${formatCents(projection.baselineEnd)}. ` +
            `Dimmi in 4-5 frasi se lo scenario è sostenibile guardando le mie spese reali, dove potrei recuperare la cifra e a cosa stare attento.`,
        },
      })
      if (error) throw error
      setAiComment((data as { answer: string }).answer)
    } catch {
      setAiComment('Commento non disponibile al momento, riprova tra poco.')
    } finally {
      setAiBusy(false)
    }
  }

  return (
    <Card className="mt-4">
      <h2 className="mb-1 flex items-center gap-2 font-semibold">
        <TrendingUp className="h-4 w-4 text-accent" /> Simulatore what-if
      </h2>
      <p className="mb-3 text-sm text-muted">
        "E se mettessi via 100 € in più al mese?" — proiezione basata sul tuo ritmo reale
        {flows && flows.monthsUsed > 0 ? ` degli ultimi ${flows.monthsUsed} mesi` : ''}.
      </p>

      {loading ? (
        <div className="flex justify-center py-8">
          <Spinner />
        </div>
      ) : (
        <>
          <div className="mb-3 grid grid-cols-3 gap-2 rounded-xl bg-card-2 px-3 py-2.5 text-center text-xs">
            <div>
              <p className="text-muted">Patrimonio</p>
              <p className="font-bold">{formatCents(startBalance)}</p>
            </div>
            <div>
              <p className="text-muted">Entrate/mese</p>
              <p className="font-bold text-income">{formatCents(flows?.income ?? 0)}</p>
            </div>
            <div>
              <p className="text-muted">Uscite/mese</p>
              <p className="font-bold text-expense">{formatCents(flows?.expense ?? 0)}</p>
            </div>
          </div>

          <div className="mb-3 grid grid-cols-2 gap-2 rounded-xl bg-card-2 p-1">
            {(
              [
                ['save', 'Risparmio in più'],
                ['spend', 'Spesa in più'],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                onClick={() => setDirection(value)}
                className={`min-h-[40px] rounded-lg text-[13px] font-semibold transition ${
                  direction === value
                    ? value === 'save'
                      ? 'bg-income text-white'
                      : 'bg-expense text-white'
                    : 'text-muted'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Al mese (EUR)">
              <input
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className={inputClass}
                placeholder="100"
              />
            </Field>
            <Field label="Per quanto tempo">
              <select
                value={months}
                onChange={(e) => setMonths(Number(e.target.value))}
                className={inputClass}
              >
                {HORIZONS.map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </Field>
          </div>

          {projection && (
            <>
              <div className="h-44">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData}>
                    <XAxis
                      dataKey="name"
                      tickLine={false}
                      axisLine={false}
                      interval="preserveStartEnd"
                      tick={{ fill: 'var(--muted)', fontSize: 10 }}
                    />
                    <YAxis hide domain={['auto', 'auto']} />
                    <Line
                      type="monotone"
                      dataKey="Oggi"
                      stroke="var(--muted)"
                      strokeWidth={2}
                      strokeDasharray="5 4"
                      dot={false}
                      isAnimationActive={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="Scenario"
                      stroke={deltaCents >= 0 ? 'var(--income)' : 'var(--expense)'}
                      strokeWidth={2.5}
                      dot={false}
                      isAnimationActive={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              <div className="mt-2 rounded-xl bg-card-2 px-4 py-3 text-sm">
                <p>
                  Al ritmo attuale tra {months} mesi avresti{' '}
                  <strong>{formatCents(projection.baselineEnd)}</strong>; con lo scenario{' '}
                  <strong className={deltaCents >= 0 ? 'text-income' : 'text-expense'}>
                    {formatCents(projection.scenarioEnd)}
                  </strong>{' '}
                  ({deltaCents >= 0 ? '+' : '−'}
                  {formatCents(Math.abs(projection.difference))}).
                </p>
                {projection.monthlyNet + deltaCents < 0 && (
                  <p className="mt-1 text-xs text-expense">
                    Attenzione: con questo scenario spenderesti più di quanto entra.
                  </p>
                )}
              </div>

              <button
                onClick={() => void askAi()}
                disabled={aiBusy || !navigator.onLine}
                className="mt-3 flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl border border-line text-sm font-semibold text-accent disabled:opacity-60"
              >
                {aiBusy ? <Spinner className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
                Chiedi all'AI se è sostenibile
              </button>
              {aiComment && (
                <div className="mt-3 rounded-xl bg-accent-soft px-4 py-3 text-sm">
                  <AiText text={aiComment} />
                </div>
              )}
            </>
          )}
        </>
      )}
    </Card>
  )
}
