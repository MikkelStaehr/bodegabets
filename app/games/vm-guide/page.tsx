import { createServerSupabaseClient } from '@/lib/supabase'
import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

export default async function VmGuidePage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  return (
    <div className="min-h-screen bg-cream">
      <div className="max-w-[760px] mx-auto px-4 py-8">

        {/* Hero */}
        <div className="bg-forest rounded-sm p-6 mb-6">
          <p className="font-condensed text-[11px] font-semibold tracking-[0.1em] uppercase text-gold mb-2">
            Reglebog · Slutrunde
          </p>
          <h1 className="font-display text-[28px] font-bold text-cream leading-tight mb-3">
            Sådan virker slutrunden
          </h1>
          <p className="font-body text-[13px] text-cream/75 leading-relaxed mb-3">
            Slutrunden køres i <strong>blokke</strong> — ligesom vores sæsoner. Du forudsiger
            kampe med dine credits, og den der tjener mest i en blok, vinder blokken. Det er
            blok-sejre der afgør stillingen.
          </p>
          <div className="bg-cream/10 border border-cream/15 rounded-sm p-3">
            <p className="font-condensed text-[11px] text-gold font-bold tracking-[0.08em] uppercase mb-1">
              Grundprincip
            </p>
            <p className="font-display text-[15px] text-cream font-bold tracking-tight">
              2 spillerunder = 1 blok · 1000 credits pr. blok · højest profit vinder
            </p>
          </div>
        </div>

        {/* Blokke */}
        <Section emoji="🧱" title="Blokke">
          <p className="mb-3">
            Slutrunden er delt op i <strong>blokke på to spillerunder</strong>. En spillerunde
            er typisk én kampdag. To runder i træk udgør én blok — uanset hvor mange kampe der
            er i dem. Det giver dig tid til at tænke dig om og fordele dine indsatser.
          </p>
          <Callout>
            En blok afsluttes når begge dens runder er spillet. Så afgøres blok-vinderen, og en
            ny blok begynder med friske credits.
          </Callout>
        </Section>

        {/* Credits */}
        <Section emoji="🎯" title="1000 credits — pr. blok, ikke pr. runde">
          <p className="mb-3">
            Du får <strong>1000 credits pr. blok</strong>, som du fordeler hen over blokkens to
            runder. Det er <strong>ikke</strong> 1000 pr. runde — det er 1000 til hele blokken.
            Bruger du 700 i første runde, har du 300 tilbage til anden runde.
          </p>
          <ul className="space-y-1.5 mb-3">
            <Bullet>Du behøver ikke bruge alt i første runde — du kan gemme til den næste.</Bullet>
            <Bullet>Ubrugte credits giver <strong>ingen point</strong>. De er spildt potentiale.</Bullet>
            <Bullet>Brug <strong>“Maxe ud”</strong>-knappen for at lægge resten af dine credits i spil.</Bullet>
          </ul>
          <Callout tone="warn">
            Maxer du ikke ud, efterlader du point på bordet. Den der bruger alle sine credits
            klogt, står stærkest.
          </Callout>
        </Section>

        {/* Point */}
        <Section emoji="💰" title="Sådan tjener du point">
          <p className="mb-3">
            Hver indsats har <strong>odds</strong>. Rammer du rigtigt, får du{' '}
            <strong>indsats × odds</strong> i point. Rammer du forkert, mister du indsatsen (0 point).
          </p>
          <div className="bg-cream-dark border border-warm-border rounded-sm p-4 mb-3">
            <p className="font-condensed text-[11px] text-warm-gray font-bold tracking-[0.08em] uppercase mb-1">
              Eksempel
            </p>
            <p className="font-body text-[13px] text-ink leading-relaxed">
              Du sætter <strong>600 credits</strong> på en sejr med odds <strong>1,20</strong> →
              rammer du rigtigt, får du <strong>720 point</strong> (600 × 1,20).
            </p>
          </div>
          <p>
            Din <strong>profit i blokken</strong> er summen af point fra alle dine indsatser i
            blokkens to runder.
          </p>
        </Section>

        {/* Ekstra valg */}
        <Section emoji="➕" title="Ekstra valg">
          <p className="mb-3">
            Ud over kampens resultat (1 / X / 2) kan du lægge ekstra valg oveni — hver med sine
            egne odds:
          </p>
          <ul className="space-y-1.5">
            <Bullet><strong>Clean sheet</strong> — et hold holder nullet.</Bullet>
            <Bullet><strong>Scorer 3+ mål</strong> — et hold scorer mindst tre.</Bullet>
            <Bullet><strong>Vinder med 2+</strong> — et hold vinder med to måls margin.</Bullet>
          </ul>
        </Section>

        {/* Blok-vinder */}
        <Section emoji="🏅" title="Blok-vinderen får 1 blok-point">
          <p className="mb-3">
            Når blokkens to runder er spillet, vinder spilleren med <strong>højest samlet
            profit</strong> blokken og får <strong>1 blok-point</strong>.
          </p>
          <Callout>
            Står to spillere helt lige på profit, får <strong>begge</strong> et blok-point.
          </Callout>
        </Section>

        {/* Stilling */}
        <Section emoji="📊" title="Stillingen">
          <p className="mb-3">Leaderboardet rangeres efter — i denne rækkefølge:</p>
          <ol className="space-y-1.5">
            <Bullet num={1}><strong>Blok-sejre</strong> — antal vundne blokke.</Bullet>
            <Bullet num={2}><strong>Profit i nuværende blok</strong>.</Bullet>
            <Bullet num={3}><strong>Profit i nuværende runde</strong>.</Bullet>
          </ol>
        </Section>

        {/* Ingen overførsel */}
        <Section emoji="🚫" title="Profit kan ikke spilles videre">
          <p>
            Din profit er en <strong>score</strong> — ikke credits du kan gen-indsætte. Alle
            starter hver ny blok med friske 1000 credits. Sådan kan ingen løbe fra feltet på en
            tidlig storgevinst, og det forbliver fair hele vejen.
          </p>
        </Section>

        <p className="font-body text-[12px] text-warm-gray text-center mt-8">
          Spørgsmål? Skriv i gruppen. God fornøjelse — og max nu de credits ud. ⚡
        </p>
      </div>
    </div>
  )
}

function Section({ emoji, title, children }: { emoji: string; title: string; children: React.ReactNode }) {
  return (
    <div className="bg-cream-dark border border-warm-border rounded-sm p-5 mb-4">
      <h2 className="font-display text-[19px] font-bold text-forest leading-tight mb-3 flex items-center gap-2">
        <span className="text-[20px]">{emoji}</span>
        {title}
      </h2>
      <div className="font-body text-[13px] text-ink leading-relaxed">{children}</div>
    </div>
  )
}

function Callout({ children, tone = 'info' }: { children: React.ReactNode; tone?: 'info' | 'warn' }) {
  const cls =
    tone === 'warn'
      ? 'bg-gold/10 border-gold/40 text-ink'
      : 'bg-forest/5 border-forest/20 text-ink'
  return (
    <div className={`border rounded-sm p-3 ${cls}`}>
      <p className="font-body text-[12.5px] leading-relaxed">{children}</p>
    </div>
  )
}

function Bullet({ children, num }: { children: React.ReactNode; num?: number }) {
  return (
    <li className="flex gap-2 font-body text-[13px] text-ink leading-snug">
      <span className="text-gold-dark font-bold shrink-0">{num != null ? `${num}.` : '·'}</span>
      <span>{children}</span>
    </li>
  )
}
