/** Interruttore 52×32: traccia `--brand` quando è attivo, `--border` quando è spento. */
export function Switch({
  checked,
  onChange,
  label,
  disabled,
}: {
  checked: boolean
  onChange: (checked: boolean) => void
  label: string
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-8 w-[52px] shrink-0 items-center rounded-full p-[3px] transition-colors duration-300 before:absolute before:-inset-1.5 before:content-[''] disabled:opacity-50 ${
        checked ? 'bg-brand' : 'bg-line'
      }`}
    >
      <span
        aria-hidden="true"
        className="switch-knob h-[26px] w-[26px] rounded-full bg-white shadow-[0_1px_3px_rgb(0_0_0/.25)]"
        style={{ transform: checked ? 'translateX(20px)' : 'none' }}
      />
    </button>
  )
}
