type Props = { className?: string }

export default function TrophyIcon({ className = 'w-6 h-6' }: Props) {
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
      <path d="M6 3h12v7a6 6 0 01-12 0V3z" />
      <path d="M6 5H3a2 2 0 000 4h3" />
      <path d="M18 5h3a2 2 0 010 4h-3" />
      <path d="M12 16v4" />
      <path d="M8 20h8" />
    </svg>
  )
}
