type Props = { className?: string }

export default function FootballIcon({ className = 'w-6 h-6' }: Props) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="10" />
      <polygon points="12,6 14.5,9.5 12,13 9.5,9.5" />
      <line x1="12" y1="13" x2="12" y2="17" />
      <line x1="12" y1="17" x2="8.5" y2="19" />
      <line x1="12" y1="17" x2="15.5" y2="19" />
      <line x1="9.5" y1="9.5" x2="6" y2="9" />
      <line x1="14.5" y1="9.5" x2="18" y2="9" />
    </svg>
  )
}
