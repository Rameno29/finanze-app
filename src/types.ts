export type Kind = 'income' | 'expense'

export interface Category {
  id: string
  user_id: string
  name: string
  kind: Kind
  color: string
  icon: string
}

export interface Transaction {
  id: string
  user_id: string
  amount_cents: number
  /** Controvalore contabile in EUR, usato per totali, budget e grafici. */
  currency_code: string
  /** Importo nella valuta originale, espresso in centesimi della valuta. */
  original_amount_cents: number
  /** EUR ottenuti per una unità della valuta originale. */
  exchange_rate_to_eur: number
  exchange_rate_date: string | null
  exchange_rate_source: 'ECB' | 'EUR'
  kind: Kind
  category_id: string | null
  date: string
  description: string
  recurrence: 'mensile' | 'settimanale' | 'annuale' | null
  document_id: string | null
}

export interface Budget {
  id: string
  user_id: string
  category_id: string
  monthly_cents: number
}

export interface DocumentRow {
  id: string
  user_id: string
  doc_type: 'busta_paga' | 'scontrino' | 'altro'
  storage_path: string
  file_name: string
  status: 'caricato' | 'analizzato' | 'errore'
  analysis: DocAnalysis | null
  created_at: string
}

/** Risultato dell'analisi AI di uno scontrino/ricevuta */
export interface ReceiptAnalysis {
  total_cents: number | null
  date: string | null
  merchant: string | null
  category_hint: string | null
  notes: string | null
}

/** Risultato dell'analisi AI di un documento generico */
export interface DocAnalysis {
  title: string
  summary: string
  key_points?: string[]
  explanation: string
}

export interface Goal {
  id: string
  user_id: string
  name: string
  target_cents: number
  saved_cents: number
  deadline: string | null
  created_at: string
}

export interface Payslip {
  id: string
  user_id: string
  document_id: string
  period_year: number
  period_month: number
  net_cents: number | null
  gross_cents: number | null
  deductions: Record<string, number>
  vacation_days: number | null
  leave_hours: number | null
  raw_data: Record<string, unknown>
}

export interface Task {
  id: string
  user_id: string
  title: string
  notes: string
  due_date: string | null
  due_time: string | null
  done: boolean
  created_at: string
}

/** Risultato dell'analisi AI di una busta paga (dalla Edge Function) */
export interface PayslipAnalysis {
  period_year: number | null
  period_month: number | null
  net_cents: number | null
  gross_cents: number | null
  deductions: Record<string, number>
  vacation_days: number | null
  leave_hours: number | null
  employer: string | null
  notes: string | null
}
