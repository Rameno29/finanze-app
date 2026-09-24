import { notifyDataChanged, useAccounts, useCategories } from '../../lib/data'
import { TransactionSheet } from './TransactionSheet'

/** "Nuovo movimento" dal "+" sulle pagine che non hanno un foglio proprio (Home, pagine secondarie). */
export function GlobalTransactionSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { categories } = useCategories()
  const { accounts } = useAccounts()
  return (
    <TransactionSheet
      open={open}
      onClose={onClose}
      onSaved={notifyDataChanged}
      categories={categories}
      accounts={accounts}
      editing={null}
    />
  )
}
