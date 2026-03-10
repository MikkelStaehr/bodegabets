import { forwardRef } from 'react'

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost'
type Size = 'sm' | 'md' | 'lg'

type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant
  size?: Size
  loading?: boolean
}

const base =
  'inline-flex items-center justify-center gap-2 font-condensed font-semibold uppercase tracking-[0.08em] transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer'

const variants: Record<Variant, string> = {
  primary:
    'bg-forest text-cream hover:opacity-85 rounded-sm',
  secondary:
    'bg-transparent border-[1.5px] border-ink text-ink hover:bg-ink hover:text-cream rounded-sm',
  danger:
    'bg-vintage-red text-cream hover:opacity-85 rounded-sm',
  ghost:
    'bg-transparent text-warm-gray hover:text-ink rounded-sm',
}

const sizes: Record<Size, string> = {
  sm: 'text-xs px-4 py-2',
  md: 'text-sm px-6 py-3',
  lg: 'text-base px-8 py-4',
}

const Button = forwardRef<HTMLButtonElement, Props>(
  ({ variant = 'primary', size = 'md', loading, children, className = '', ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={[base, variants[variant], sizes[size], className].join(' ')}
        disabled={loading || props.disabled}
        {...props}
      >
        {loading && (
          <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
          </svg>
        )}
        {children}
      </button>
    )
  }
)

Button.displayName = 'Button'
export default Button
