type Status = 'open' | 'closed' | 'upcoming' | 'finished' | 'active' | 'custom'

type Props = {
  status?: Status
  label?: string
  className?: string
}

const statusConfig: Record<Status, { label: string; classes: string }> = {
  open:     { label: 'Åben',     classes: 'bg-forest text-cream' },
  closed:   { label: 'Lukket',   classes: 'bg-vintage-red text-cream' },
  upcoming: { label: 'Kommende', classes: 'bg-gold text-ink' },
  finished: { label: 'Færdig',   classes: 'bg-warm-border text-warm-gray' },
  active:   { label: 'Aktiv',    classes: 'bg-forest text-cream' },
  custom:   { label: '',         classes: 'bg-warm-border text-ink' },
}

export default function Badge({ status = 'custom', label, className = '' }: Props) {
  const cfg = statusConfig[status]
  const text = label ?? cfg.label

  return (
    <span
      className={[
        'inline-block font-condensed font-600 text-[11px] uppercase tracking-widest px-2 py-0.5 rounded-[4px]',
        cfg.classes,
        className,
      ].join(' ')}
    >
      {text}
    </span>
  )
}
