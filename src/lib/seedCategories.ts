import { supabase } from './supabase'

const DEFAULT_CATEGORIES: Array<{ name: string; kind: 'income' | 'expense'; color: string; icon: string }> = [
  { name: 'Stipendio', kind: 'income', color: '#10b981', icon: 'banknote' },
  { name: 'Altre entrate', kind: 'income', color: '#14b8a6', icon: 'piggy-bank' },
  { name: 'Spesa', kind: 'expense', color: '#f59e0b', icon: 'shopping-cart' },
  { name: 'Affitto/Mutuo', kind: 'expense', color: '#6366f1', icon: 'home' },
  { name: 'Bollette', kind: 'expense', color: '#eab308', icon: 'zap' },
  { name: 'Trasporti', kind: 'expense', color: '#3b82f6', icon: 'car' },
  { name: 'Ristoranti', kind: 'expense', color: '#f97316', icon: 'utensils' },
  { name: 'Svago', kind: 'expense', color: '#a855f7', icon: 'gamepad-2' },
  { name: 'Salute', kind: 'expense', color: '#ef4444', icon: 'heart-pulse' },
  { name: 'Abbigliamento', kind: 'expense', color: '#ec4899', icon: 'shirt' },
  { name: 'Viaggi', kind: 'expense', color: '#06b6d4', icon: 'plane' },
  { name: 'Altro', kind: 'expense', color: '#71717a', icon: 'tag' },
]

// Evita che due render concorrenti (es. StrictMode) creino le categorie due volte
let seedingFor: string | null = null

/** Al primo accesso crea il set di categorie standard italiane. */
export async function ensureDefaultCategories(userId: string): Promise<void> {
  if (seedingFor === userId) return
  seedingFor = userId
  const { count, error } = await supabase
    .from('categories')
    .select('id', { count: 'exact', head: true })
  if (error || (count ?? 0) > 0) return
  await supabase
    .from('categories')
    .insert(DEFAULT_CATEGORIES.map((c) => ({ ...c, user_id: userId })))
}
