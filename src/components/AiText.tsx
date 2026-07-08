/** Rendering leggero del testo dell'AI: paragrafi ed elenchi puntati. */
export function AiText({ text }: { text: string }) {
  return (
    <div className="space-y-1.5">
      {text.split('\n').map((line, i) => {
        const t = line.trim()
        if (!t) return null
        if (t.startsWith('- ') || t.startsWith('* ')) {
          return (
            <p key={i} className="flex gap-2">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
              <span>{t.slice(2).replace(/\*\*/g, '')}</span>
            </p>
          )
        }
        return <p key={i}>{t.replace(/\*\*/g, '')}</p>
      })}
    </div>
  )
}
