import Link from 'next/link'

type Props = { searchParams: Promise<{ email?: string }> }

export default async function VerifyEmailPage({ searchParams }: Props) {
  const { email } = await searchParams

  return (
    <div className="min-h-screen bg-[#F2EDE4] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md text-center">
        <div className="text-6xl mb-6">📧</div>
        <p
          className="font-condensed text-xs uppercase tracking-[0.14em] mb-3"
          style={{ color: '#7a7060' }}
        >
          Næsten færdig
        </p>
        <h1
          className="font-display text-3xl font-bold mb-4"
          style={{ color: '#1a3329' }}
        >
          Bekræft din email
        </h1>
        <p className="font-body text-[#5C5C4A] mb-2">
          Vi har sendt et bekræftelses-link til:
        </p>
        {email && (
          <p
            className="font-condensed text-base font-bold mb-6"
            style={{ color: '#1a3329' }}
          >
            {email}
          </p>
        )}
        <p className="font-body text-sm text-[#7a7060] mb-8 leading-relaxed">
          Klik på linket i mailen for at aktivere din konto. Tjek evt. spam-mappen
          hvis du ikke ser den inden for et par minutter.
        </p>
        <div className="flex flex-col gap-3">
          <Link
            href="/login"
            className="px-6 py-3 rounded-sm bg-[#1a3329] text-[#F2EDE4] font-condensed font-bold text-sm uppercase tracking-[0.08em] hover:bg-[#2c4a3e] transition-colors"
          >
            Til login-siden
          </Link>
          <Link
            href="/"
            className="font-body text-sm text-[#5C5C4A] hover:text-[#1a3329] transition-colors"
          >
            Tilbage til forsiden
          </Link>
        </div>
      </div>
    </div>
  )
}
