import { forwardRef } from 'react'

type InputProps = React.InputHTMLAttributes<HTMLInputElement> & {
  label?: string
  hint?: string
  error?: string
}

type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label?: string
  hint?: string
  error?: string
}

const inputBase =
  'w-full bg-white border-[1.5px] border-warm-border text-ink placeholder-warm-gray rounded-sm px-4 py-3 font-body text-sm outline-none focus:border-forest transition-colors'

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, hint, error, className = '', ...props }, ref) => {
    return (
      <div className="w-full">
        {label && (
          <label className="block font-condensed font-600 text-xs uppercase tracking-[0.08em] text-ink mb-1.5">
            {label}
          </label>
        )}
        <input
          ref={ref}
          className={[inputBase, error ? 'border-vintage-red' : '', className].join(' ')}
          {...props}
        />
        {error && (
          <p className="mt-1.5 text-vintage-red text-xs font-body">{error}</p>
        )}
        {hint && !error && (
          <p className="mt-1.5 text-warm-gray text-xs font-body">{hint}</p>
        )}
      </div>
    )
  }
)

Input.displayName = 'Input'

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, hint, error, className = '', ...props }, ref) => {
    return (
      <div className="w-full">
        {label && (
          <label className="block font-condensed font-600 text-xs uppercase tracking-[0.08em] text-ink mb-1.5">
            {label}
          </label>
        )}
        <textarea
          ref={ref}
          className={[
            inputBase,
            'resize-none',
            error ? 'border-vintage-red' : '',
            className,
          ].join(' ')}
          {...props}
        />
        {error && (
          <p className="mt-1.5 text-vintage-red text-xs font-body">{error}</p>
        )}
        {hint && !error && (
          <p className="mt-1.5 text-warm-gray text-xs font-body">{hint}</p>
        )}
      </div>
    )
  }
)

Textarea.displayName = 'Textarea'

export default Input
