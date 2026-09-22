import { authenticatedClient, supabase } from './supabase'
import { sessionScope } from './sessionScope'
import { formatCents, todayISO } from './format'

interface TransactionData {
  amount_cents: number
  kind: 'income' | 'expense'
  category_name: string | null
  date: string | null
  description: string
  recurrence: string | null
}
interface TaskData {
  title: string
  due_date: string | null
  due_time: string | null
}
interface GoalData {
  name: string
  target_cents: number
  deadline: string | null
}
interface ContributeData {
  goal_name: string
  amount_cents: number
  direction: 'add' | 'remove'
}
interface BudgetData {
  category_name: string
  monthly_cents: number
}

export type Intent =
  | { action: 'add_transaction'; say: string; data: TransactionData }
  | { action: 'add_task'; say: string; data: TaskData }
  | { action: 'add_goal'; say: string; data: GoalData }
  | { action: 'contribute_goal'; say: string; data: ContributeData }
  | { action: 'set_budget'; say: string; data: BudgetData }

/** Esegue l'azione confermata scrivendo sul database */
export async function executeIntent(intent: Intent): Promise<string> {
  const ticket = sessionScope.capture()
  const { data } = await supabase.auth.getSession()
  sessionScope.assert(ticket)
  if (!data.session || data.session.user.id !== ticket.userId) throw new Error('Sessione scaduta: accedi di nuovo.')
  const userId = ticket.userId
  const client = authenticatedClient(data.session.access_token)

  if (intent.action === 'add_transaction') {
    const d = intent.data
    let categoryId: string | null = null
    if (d.category_name) {
      const { data: cat } = await client
        .from('categories')
        .select('id')
        .eq('kind', d.kind)
        .ilike('name', d.category_name)
        .maybeSingle()
      sessionScope.assert(ticket)
      categoryId = cat?.id ?? null
    }
    const { error } = await client.from('transactions').insert({
      user_id: userId,
      amount_cents: d.amount_cents,
      kind: d.kind,
      category_id: categoryId,
      date: d.date ?? todayISO(),
      description: d.description,
      recurrence: d.recurrence,
    })
    sessionScope.assert(ticket)
    if (error) throw error
    return `✅ ${d.kind === 'income' ? 'Entrata' : 'Uscita'} di ${formatCents(d.amount_cents)} registrata.`
  }

  if (intent.action === 'add_task') {
    const d = intent.data
    const { error } = await client.from('tasks').insert({
      user_id: userId,
      title: d.title,
      due_date: d.due_date,
      due_time: d.due_time,
    })
    sessionScope.assert(ticket)
    if (error) throw error
    return `✅ Promemoria "${d.title}" aggiunto all'agenda.`
  }

  if (intent.action === 'add_goal') {
    const d = intent.data
    const { error } = await client.from('goals').insert({
      user_id: userId,
      name: d.name,
      target_cents: d.target_cents,
      deadline: d.deadline,
    })
    sessionScope.assert(ticket)
    if (error) throw error
    return `✅ Obiettivo "${d.name}" creato (traguardo ${formatCents(d.target_cents)}).`
  }

  if (intent.action === 'contribute_goal') {
    const d = intent.data
    const { data: goals, error: goalsError } = await client.from('goals').select('id, name, saved_cents')
    sessionScope.assert(ticket)
    if (goalsError) throw goalsError
    const goal = (goals ?? []).find(
      (g) =>
        g.name.toLowerCase() === d.goal_name.toLowerCase() ||
        g.name.toLowerCase().includes(d.goal_name.toLowerCase()) ||
        d.goal_name.toLowerCase().includes(g.name.toLowerCase()),
    )
    if (!goal) throw new Error(`Obiettivo "${d.goal_name}" non trovato`)
    const newSaved = Math.max(
      0,
      goal.saved_cents + (d.direction === 'remove' ? -d.amount_cents : d.amount_cents),
    )
    const { data: updated, error } = await client
      .from('goals')
      .update({ saved_cents: newSaved })
      .eq('id', goal.id)
      .eq('saved_cents', goal.saved_cents)
      .select('id')
      .maybeSingle()
    sessionScope.assert(ticket)
    if (error) throw error
    if (!updated) throw new Error('l’obiettivo è stato modificato nel frattempo; riprova')
    return `✅ Obiettivo "${goal.name}" aggiornato: ora ha ${formatCents(newSaved)}.`
  }

  // set_budget
  const d = intent.data
  const { data: cat } = await client
    .from('categories')
    .select('id, name')
    .eq('kind', 'expense')
    .ilike('name', d.category_name)
    .maybeSingle()
  sessionScope.assert(ticket)
  if (!cat) throw new Error(`Categoria "${d.category_name}" non trovata`)
  const { error } = await client
    .from('budgets')
    .upsert(
      { user_id: userId, category_id: cat.id, monthly_cents: d.monthly_cents },
      { onConflict: 'user_id,category_id' },
    )
  sessionScope.assert(ticket)
  if (error) throw error
  return `✅ Budget di ${cat.name} impostato a ${formatCents(d.monthly_cents)} al mese.`
}
