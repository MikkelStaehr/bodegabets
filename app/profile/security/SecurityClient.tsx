'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createBrowserSupabaseClient } from '@/lib/supabase-browser'

const supabase = createBrowserSupabaseClient()

type Factor = {
  id: string
  friendly_name?: string
  status: string
  created_at: string
}

type Props = {
  factors: Factor[]
  isAdmin: boolean
  userEmail: string
}

export default function SecurityClient({ factors, isAdmin, userEmail }: Props) {
  const router = useRouter()
  const [enrolling, setEnrolling] = useState(false)
  const [qrSvg, setQrSvg] = useState<string | null>(null)
  const [secret, setSecret] = useState<string | null>(null)
  const [factorId, setFactorId] = useState<string | null>(null)
  const [verifyCode, setVerifyCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [verifying, setVerifying] = useState(false)
  const [removing, setRemoving] = useState<string | null>(null)

  const verifiedFactors = factors.filter((f) => f.status === 'verified')
  const hasVerifiedTotp = verifiedFactors.length > 0

  async function startEnroll() {
    setEnrolling(true)
    setError(null)
    const { data, error: err } = await supabase.auth.mfa.enroll({
      factorType: 'totp',
      friendlyName: `Bodega Bets — ${userEmail}`,
    })
    if (err) {
      setError(err.message)
      setEnrolling(false)
      return
    }
    setFactorId(data.id)
    setQrSvg(data.totp.qr_code)
    setSecret(data.totp.secret)
  }

  async function verifyAndComplete() {
    if (!factorId || !verifyCode.trim()) return
    setVerifying(true)
    setError(null)

    const { data: challenge, error: challengeErr } = await supabase.auth.mfa.challenge({ factorId })
    if (challengeErr || !challenge) {
      setError(challengeErr?.message ?? 'Kunne ikke starte challenge')
      setVerifying(false)
      return
    }

    const { error: verifyErr } = await supabase.auth.mfa.verify({
      factorId,
      challengeId: challenge.id,
      code: verifyCode.trim(),
    })
    if (verifyErr) {
      setError(verifyErr.message ?? 'Forkert kode')
      setVerifying(false)
      return
    }

    // Success — reload for at vise opdateret state
    router.refresh()
    setEnrolling(false)
    setQrSvg(null)
    setSecret(null)
    setFactorId(null)
    setVerifyCode('')
    setVerifying(false)
  }

  async function cancelEnroll() {
    if (factorId) {
      await supabase.auth.mfa.unenroll({ factorId })
    }
    setEnrolling(false)
    setQrSvg(null)
    setSecret(null)
    setFactorId(null)
    setVerifyCode('')
    setError(null)
  }

  async function removeFactor(id: string) {
    if (!confirm('Fjern 2FA fra din konto? Du skal opsætte det igen for at få det tilbage.')) return
    setRemoving(id)
    const { error: err } = await supabase.auth.mfa.unenroll({ factorId: id })
    if (err) {
      setError(err.message)
      setRemoving(null)
      return
    }
    router.refresh()
    setRemoving(null)
  }

  return (
    <div className="space-y-6">
      {/* Status */}
      <div
        className="p-5 rounded-sm border"
        style={{
          background: hasVerifiedTotp ? 'rgba(61,107,90,0.06)' : 'rgba(184,150,62,0.08)',
          borderColor: hasVerifiedTotp ? 'rgba(61,107,90,0.3)' : 'rgba(184,150,62,0.3)',
        }}
      >
        <div className="flex items-start gap-3">
          <div className="flex-1">
            <p className="font-condensed text-xs uppercase tracking-[0.08em] font-bold mb-1" style={{ color: hasVerifiedTotp ? '#3D6B5A' : '#B8963E' }}>
              {hasVerifiedTotp ? '✓ 2FA aktiv' : '⚠ 2FA ikke aktiveret'}
            </p>
            <p className="font-body text-sm text-[#1a1a1a] leading-relaxed">
              {hasVerifiedTotp
                ? 'Din konto er beskyttet af to-faktor godkendelse. Ved login skal du indtaste en kode fra din authenticator-app.'
                : 'To-faktor godkendelse tilføjer et ekstra sikkerhedslag. Du skal bruge en authenticator-app som Google Authenticator, 1Password eller Authy.'}
            </p>
            {isAdmin && !hasVerifiedTotp && (
              <p className="font-body text-sm mt-2" style={{ color: '#B8963E', fontWeight: 600 }}>
                Som admin anbefales det stærkt at aktivere 2FA.
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Enrolled factors */}
      {verifiedFactors.length > 0 && (
        <div>
          <p className="font-condensed text-xs uppercase tracking-[0.14em] text-[#7a7060] mb-3">
            Aktive enheder
          </p>
          <div className="space-y-2">
            {verifiedFactors.map((f) => (
              <div
                key={f.id}
                className="flex items-center justify-between p-4 rounded-sm border bg-white"
                style={{ borderColor: '#E5DFD2' }}
              >
                <div>
                  <p className="font-condensed font-bold text-sm text-[#1a3329]">
                    {f.friendly_name ?? 'Authenticator app'}
                  </p>
                  <p className="font-body text-xs text-[#7a7060] mt-0.5">
                    Aktiveret {new Date(f.created_at).toLocaleDateString('da-DK', {
                      day: 'numeric', month: 'long', year: 'numeric',
                    })}
                  </p>
                </div>
                <button
                  onClick={() => removeFactor(f.id)}
                  disabled={removing === f.id}
                  className="px-3 py-1.5 rounded-sm border text-xs font-condensed font-bold uppercase tracking-[0.06em]"
                  style={{ borderColor: '#C8392B', color: '#C8392B' }}
                >
                  {removing === f.id ? 'Fjerner...' : 'Fjern'}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Enroll new */}
      {!hasVerifiedTotp && !enrolling && (
        <button
          onClick={startEnroll}
          className="w-full px-6 py-3 rounded-sm bg-[#1a3329] text-[#F2EDE4] font-condensed font-bold text-sm uppercase tracking-[0.08em] hover:bg-[#2c4a3e] transition-colors"
        >
          Aktivér 2FA
        </button>
      )}

      {enrolling && qrSvg && (
        <div className="p-6 rounded-sm border bg-white" style={{ borderColor: '#E5DFD2' }}>
          <h3 className="font-display text-lg font-bold text-[#1a3329] mb-3">
            Scan QR-koden
          </h3>
          <p className="font-body text-sm text-[#5C5C4A] mb-4 leading-relaxed">
            Åbn din authenticator-app og scan koden. Indtast derefter den 6-cifrede
            kode appen viser for at bekræfte.
          </p>

          <div className="flex flex-col items-center my-6">
            <div
              dangerouslySetInnerHTML={{ __html: qrSvg }}
              style={{ background: '#fff', padding: 12, borderRadius: 4 }}
            />
            {secret && (
              <details className="mt-4 w-full">
                <summary className="font-body text-xs text-[#7a7060] cursor-pointer text-center">
                  Kan du ikke scanne? Indtast manuelt.
                </summary>
                <p className="font-mono text-sm bg-[#F2EDE4] p-3 rounded-sm mt-2 break-all text-center">
                  {secret}
                </p>
              </details>
            )}
          </div>

          <label className="font-condensed text-xs uppercase tracking-[0.08em] block mb-1.5 font-bold text-[#1a1a1a]">
            6-cifret kode fra app
          </label>
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={6}
            value={verifyCode}
            onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, ''))}
            placeholder="123456"
            className="w-full px-4 py-3 rounded-sm border border-[#D4CEC4] bg-white font-mono text-lg text-center tracking-widest focus:outline-none focus:border-[#1a3329]"
            autoFocus
          />

          {error && (
            <p className="font-body text-sm text-[#C8392B] mt-3">{error}</p>
          )}

          <div className="flex gap-2 mt-4">
            <button
              onClick={verifyAndComplete}
              disabled={verifying || verifyCode.length !== 6}
              className="flex-1 px-6 py-3 rounded-sm bg-[#1a3329] text-[#F2EDE4] font-condensed font-bold text-sm uppercase tracking-[0.08em] disabled:opacity-40"
            >
              {verifying ? 'Bekræfter...' : 'Bekræft'}
            </button>
            <button
              onClick={cancelEnroll}
              disabled={verifying}
              className="px-6 py-3 rounded-sm border border-[#5C5C4A] text-[#5C5C4A] font-condensed font-bold text-sm uppercase tracking-[0.08em]"
            >
              Annullér
            </button>
          </div>
        </div>
      )}

      <p className="text-center font-body text-sm pt-4" style={{ color: '#5C5C4A' }}>
        <Link href="/profile" className="font-semibold hover:opacity-70" style={{ color: '#1a3329' }}>
          ← Tilbage til profil
        </Link>
      </p>
    </div>
  )
}
