import { Banknote, CreditCard, Landmark } from 'lucide-react'
import type { AccountKind } from '../../types'

/** Icona del conto: banca `Landmark`, carta `CreditCard`, contanti `Banknote`. */
export function AccountIcon({ kind, className }: { kind: AccountKind; className?: string }) {
  const Icon = kind === 'contanti' ? Banknote : kind === 'carta' ? CreditCard : Landmark
  return <Icon className={className} strokeWidth={1.9} />
}
