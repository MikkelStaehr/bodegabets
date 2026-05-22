/**
 * Returnerer en Proxy der opretter den underliggende instans LAZY — først ved
 * faktisk brug, ikke ved module-load. Bruges til klienter (Supabase, Stripe …)
 * der kræver env-vars/secrets, så `next build` (som evaluerer route-moduler for
 * at samle page-data) ikke kræver runtime-secrets og aldrig fejler på manglende
 * env-vars. Metoder bindes til den rigtige instans, så `this` virker korrekt.
 */
export function lazyProxy<T extends object>(factory: () => T): T {
  let instance: T | null = null
  const resolve = (): T => (instance ??= factory())
  return new Proxy({} as T, {
    get(_target, prop) {
      const obj = resolve()
      const value = Reflect.get(obj, prop)
      return typeof value === 'function' ? value.bind(obj) : value
    },
  })
}
