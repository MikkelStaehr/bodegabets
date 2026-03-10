'use client'

import { useState } from 'react'
import Link from 'next/link'
import Button from '@/components/ui/Button'

type Field = {
  name: string
  label: string
  type: string
  placeholder: string
  autoComplete?: string
}

type Props = {
  title: string
  subtitle: string
  fields: Field[]
  submitLabel: string
  loadingLabel: string
  footerText: string
  footerLinkLabel: string
  footerLinkHref: string
  onSubmit: (values: Record<string, string>) => Promise<string | null>
}

export default function AuthForm({
  title,
  subtitle,
  fields,
  submitLabel,
  loadingLabel,
  footerText,
  footerLinkLabel,
  footerLinkHref,
  onSubmit,
}: Props) {
  const [values, setValues] = useState<Record<string, string>>(
    Object.fromEntries(fields.map((f) => [f.name, '']))
  )
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    const err = await onSubmit(values)
    if (err) {
      setError(err)
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-cream flex flex-col">
      {/* Topp-bjælke */}
      <div className="bg-forest border-b-2 border-forest-light px-6 py-4 flex items-center justify-between">
        <Link href="/" className="font-display text-cream text-xl font-bold tracking-tight">
          Bodega Bets
        </Link>
        <p className="font-body text-cream/50 text-sm hidden sm:block">
          Point og prestige — ingen rigtige penge
        </p>
      </div>

      {/* Centeret form */}
      <div className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-sm">

          {/* Form-kort */}
          <div className="bg-cream-dark border border-warm-border rounded-sm p-8">
            <div className="mb-7">
              <h1 className="font-display text-ink text-2xl font-bold mb-1">{title}</h1>
              <p className="font-body text-warm-gray text-sm">{subtitle}</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              {fields.map((field) => (
                <div key={field.name}>
                  <label
                    htmlFor={field.name}
                    className="block font-condensed font-600 text-xs uppercase tracking-[0.08em] text-ink mb-1.5"
                  >
                    {field.label}
                  </label>
                  <input
                    id={field.name}
                    type={field.type}
                    placeholder={field.placeholder}
                    autoComplete={field.autoComplete}
                    value={values[field.name]}
                    onChange={(e) =>
                      setValues((prev) => ({ ...prev, [field.name]: e.target.value }))
                    }
                    required
                    className="w-full bg-white border-[1.5px] border-warm-border text-ink placeholder-warm-gray rounded-sm px-4 py-3 font-body text-sm outline-none focus:border-forest transition-colors"
                  />
                </div>
              ))}

              {error && (
                <div className="bg-vintage-red/10 border border-vintage-red/30 text-vintage-red font-body text-sm rounded-sm px-4 py-3">
                  {error}
                </div>
              )}

              <Button
                type="submit"
                loading={loading}
                className="w-full mt-2"
                size="md"
              >
                {loading ? loadingLabel : submitLabel}
              </Button>
            </form>

            <p className="text-center font-body text-sm text-warm-gray mt-6">
              {footerText}{' '}
              <Link
                href={footerLinkHref}
                className="text-forest font-600 hover:opacity-70 transition-opacity"
              >
                {footerLinkLabel}
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
