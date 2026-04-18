import { createServerSupabaseClient } from '@/lib/supabase'
import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

export default async function CyclingGuidePage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  return (
    <div className="min-h-screen bg-cream">
      <div className="max-w-[640px] mx-auto px-4 py-8">

        {/* Hero */}
        <div className="bg-[#1E3A5F] rounded-sm p-6 mb-6">
          <p className="font-condensed text-[11px] font-semibold tracking-[0.1em] uppercase text-[#C9A84C] mb-2">
            Alfa Test — Sæson 2026
          </p>
          <h1 className="font-display text-[28px] font-bold text-cream leading-tight mb-3">
            Cycling Manager
          </h1>
          <p className="font-body text-[13px] text-cream/70 leading-relaxed">
            Velkommen til Bodega Bets' fantasy cykling. Denne guide forklarer alt du skal vide
            for at deltage i alfa-testen. Læs den grundigt — det tager 5 minutter.
          </p>
        </div>

        {/* Sådan virker det */}
        <Section title="Sådan virker det" number="1">
          <P>
            Du konkurrerer mod de andre spillere i spilrummet om at samle flest point
            hen over cykel-sæsonen. Sæsonen er delt op i <B>blokke</B> (fx Ardennerne,
            Giro d'Italia, Tour de France) — hver blok indeholder ét eller flere løb.
          </P>
          <P>For hvert løb sætter du en <B>lineup</B> med 8 ryttere fra din brutto trup. Hver rytter har en <B>rolle</B> der bestemmer hvordan de scorer point.</P>
        </Section>

        {/* Brutto trup */}
        <Section title="Din brutto trup" number="2">
          <P>
            Før du kan sætte lineups, skal du udtage en <B>brutto trup</B> på op til <B>25 ryttere</B> per blok.
            Det er din pulje — du vælger 8 af dem til hvert løb.
          </P>
          <SubHeading>Begrænsninger</SubHeading>
          <BulletList items={[
            'Maks 3 ryttere fra samme hold',
            'Kat 1 (topstjerner): maks 3',
            'Kat 2–4: maks 5 per kategori',
            'Kat 5 (lavest rangeret): maks 7',
          ]} />
          <Callout type="tip">
            Ryttere der ikke er i din lineup for et løb sidder på <B>bænken</B>.
            Hvis en bænk-rytter scorer, får du en straf — så vælg klogt hvem du tager med i truppen.
          </Callout>
        </Section>

        {/* Lineup & Roller */}
        <Section title="Lineup & roller" number="3">
          <P>
            Din lineup består af 8 ryttere med hver sin rolle. Roller bestemmer
            multiplikatorer og bonusser. Kategori-regler begrænser hvem der kan have hvilken rolle.
          </P>
          <div className="space-y-3 mt-4">
            <RoleCard
              role="Leader"
              cat="Alle"
              desc="Din stærkeste rytter. Point = placering × kategori-multiplikator."
              extra="+5 holdbonus hvis vinderhold."
            />
            <RoleCard
              role="Lieutenant"
              cat="Kat 2–3"
              desc="Backup for lederen. Top 10 → ×1.8 multiplikator."
              extra="×2.8 hvis Leader DNF'er. +5 holdbonus."
            />
            <RoleCard
              role="Grimpeur"
              cat="Kat 3–5"
              desc="Bjergrytteren. Mountain ×1.8, Hilly ×1.2."
              extra="Won how bonus: Solo +50 (+1p/km), Sprint a deux +25, Small group +20."
            />
            <RoleCard
              role="Sprinter"
              cat="Kat 1–3"
              desc="Spurteren. Flat/Mixed ×1.8, Hilly ×1.2."
              extra="Won how bonus: Bunch sprint +20, Small group +25, Sprint a deux +50."
            />
            <RoleCard
              role="Domestique"
              cat="Kun Kat 4"
              desc="Holdarbejderen. Ingen multiplikator."
              extra="+8 bonus hvis top 40 OG Leader er top 10."
            />
            <RoleCard
              role="Équipier"
              cat="Alle"
              desc="Holdkammeraten (2 pladser). Ingen multiplikator."
              extra="+7 bonus hvis samme hold som etapens vinder."
            />
            <RoleCard
              role="Joker"
              cat="Alle"
              desc="Wildcard. Ingen multiplikator."
              extra="+7 holdbonus. Immun mod DNF-straf og alle minuspoint."
            />
          </div>
        </Section>

        {/* Pointsystem */}
        <Section title="Pointsystem" number="4">
          <SubHeading>Basispoint (placering)</SubHeading>
          <PointTable rows={[
            ['1. plads', '50'],
            ['2.–3. plads', '30'],
            ['4.–5. plads', '20'],
            ['6.–10. plads', '10'],
            ['11.–20. plads', '5'],
            ['21.+', '0'],
          ]} />

          <SubHeading>Kategori-multiplikator</SubHeading>
          <P>
            Lavere-rangerede ryttere giver flere point — det belønner at du tager en chance.
          </P>
          <PointTable rows={[
            ['Kat 1 (topstjerner)', '×1.0'],
            ['Kat 2', '×1.3'],
            ['Kat 3', '×1.7'],
            ['Kat 4', '×2.2'],
            ['Kat 5', '×3.5'],
          ]} />

          <SubHeading>Eksempel</SubHeading>
          <Callout type="example">
            Din <B>Leader</B> er Kat 3 og slutter på 2. pladsen:<br />
            30 (base) × 1.7 (kat) = <B>51 point</B><br /><br />
            Din <B>Sprinter</B> er Kat 2 på et flat løb, vundet med bunch sprint, og slutter 5.:<br />
            20 (base) × 1.3 (kat) × 1.8 (flat) = 46.8 + 20 (won how) = <B>66.8 point</B>
          </Callout>
        </Section>

        {/* Won How */}
        <Section title="Won How — sejrens art" number="5">
          <P>
            Hvordan løbet blev vundet påvirker <B>Sprinter</B> og <B>Grimpeur</B> rollerne.
            Bonussen gives til ryttere i top 10.
          </P>
          <SubHeading>Sprinter-bonus</SubHeading>
          <PointTable rows={[
            ['Bunch sprint', '+20'],
            ['Small group sprint', '+25'],
            ['Sprint a deux', '+50'],
          ]} />
          <SubHeading>Grimpeur-bonus</SubHeading>
          <PointTable rows={[
            ['Small group sprint', '+20'],
            ['Sprint a deux', '+25'],
            ['Solo', '+50'],
            ['XX km solo', '+50 + 1p per km (rundet ned)'],
          ]} />
          <Callout type="example">
            Løbet vindes med "4.3 km solo". Din Grimpeur er top 10:<br />
            Bonus = 50 + 4 = <B>+54 point</B>
          </Callout>
        </Section>

        {/* Bonusser & straffe */}
        <Section title="Bonusser & straffe" number="6">
          <SubHeading>Holdbonus</SubHeading>
          <P>
            +5 point til Leader, Lieutenant, Grimpeur og Sprinter hvis de er på vinderens hold.
          </P>

          <SubHeading>Jersey-point (kun stage races)</SubHeading>
          <P>
            Farven på trøjen varierer per race (Tour: gul, Giro: rosa, Vuelta: rød osv.),
            men pointene gælder uanset løb.
          </P>
          <PointTable rows={[
            ['Førertrøje (sammenlagt)', '+8'],
            ['Pointtrøje (sprint)', '+5'],
            ['Bjergtrøje', '+5'],
            ['Ungdomstrøje', '+3'],
          ]} />

          <SubHeading>GC-multiplikator (kun stage races)</SubHeading>
          <P>
            Ryttere i top-10 sammenlagt efter etapen får et klassement-boost
            på deres placerings-point for etapen.
          </P>
          <PointTable rows={[
            ['Sammenlagt #1', '×1.4'],
            ['Sammenlagt #2-3', '×1.3'],
            ['Sammenlagt #4-5', '×1.2'],
            ['Sammenlagt #6-10', '×1.1'],
            ['Sammenlagt #11+', '×1.0 (ingen bonus)'],
          ]} />

          <SubHeading>DNF-straf</SubHeading>
          <P>
            Hvis en rytter udgår (DNF), mister du <B>50%</B> af hvad de ville have scoret.
            Minimum straf er <B>-5 point</B>. Joker er undtaget.
          </P>

          <SubHeading>Bænk-straf</SubHeading>
          <P>
            Ryttere i din brutto trup der <em>ikke</em> er i lineup men alligevel scorer:
          </P>
          <PointTable rows={[
            ['Bænk-rytter vinder', '-50% af would-be score'],
            ['Bænk-rytter top 3', '-40%'],
            ['Bænk-rytter top 10', '-20%'],
            ['Bænk-rytter med jersey', '-30% af jersey-point'],
            ['Bænk-rytter DNF', '-5'],
          ]} />
          <Callout type="tip">
            Bænk-straffen belønner dig for at have en lille, fokuseret trup.
            Tag kun ryttere med i truppen som du realistisk vil bruge.
          </Callout>
        </Section>

        {/* Deadlines */}
        <Section title="Deadlines & lås" number="7">
          <P>
            Din lineup <B>låser 30 minutter</B> før løbets start. Derefter kan du ikke ændre den.
            Brutto truppen låser ved blokkens deadline (typisk før første løb i blokken).
          </P>
          <P>
            Deadline vises i rødt under løbs-headeren i lineup-viewet.
          </P>
        </Section>

        {/* Alfa-test info */}
        <Section title="Alfa-test — Paris-Roubaix" number="8">
          <P>
            Vi starter med <B>Paris-Roubaix</B> søndag d. 12. april.
            Det er et endagsløb (flat profil) i Ardennerne-blokken.
          </P>
          <SubHeading>Hvad du skal gøre</SubHeading>
          <BulletList items={[
            'Gå ind i dit spilrum',
            'Vælg Ardennerne-blokken i top-tabs',
            'Udtag din brutto trup (op til 25 ryttere)',
            'Klik på Roubaix i løb-tabs',
            'Sæt din lineup med 8 ryttere og roller',
            'Gem lineup inden deadline (30 min før start)',
            'Vent på resultater — point beregnes automatisk',
          ]} />
          <Callout type="tip">
            Roubaix er flat, så <B>Sprinter</B>-rollen med ×1.8 bonus er oplagt.
            Tænk også over hvem du sætter som Joker — immunitet mod DNF kan være guld værd i Helvede fra Norden.
          </Callout>
        </Section>

        {/* Footer */}
        <div className="mt-8 pt-6 border-t border-warm-border text-center">
          <p className="font-condensed text-[11px] text-warm-gray tracking-[0.08em] uppercase">
            Bodega Bets — Cycling Manager Alfa
          </p>
        </div>
      </div>
    </div>
  )
}

// ── Helper components ────────────────────────────────────────────────────────

function Section({ title, number, children }: { title: string; number: string; children: React.ReactNode }) {
  return (
    <div className="bg-cream-dark border border-warm-border rounded-sm p-5 mb-4">
      <div className="flex items-center gap-3 mb-4">
        <span className="flex items-center justify-center w-7 h-7 rounded-full bg-[#1E3A5F] font-condensed text-[12px] font-bold text-cream">
          {number}
        </span>
        <h2 className="font-condensed text-[18px] font-bold text-ink tracking-[0.02em]">
          {title}
        </h2>
      </div>
      {children}
    </div>
  )
}

function SubHeading({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="font-condensed text-[13px] font-bold text-ink tracking-[0.06em] uppercase mt-5 mb-2">
      {children}
    </h3>
  )
}

function P({ children }: { children: React.ReactNode }) {
  return <p className="font-body text-[13px] text-ink/80 leading-relaxed mb-2">{children}</p>
}

function B({ children }: { children: React.ReactNode }) {
  return <strong className="font-semibold text-ink">{children}</strong>
}

function BulletList({ items }: { items: string[] }) {
  return (
    <ul className="space-y-1 mb-3">
      {items.map((item, i) => (
        <li key={i} className="flex items-start gap-2 font-body text-[13px] text-ink/80">
          <span className="text-[#1E3A5F] mt-1 text-[8px]">●</span>
          {item}
        </li>
      ))}
    </ul>
  )
}

function PointTable({ rows }: { rows: string[][] }) {
  return (
    <div className="border border-warm-border rounded-sm overflow-hidden mb-3">
      {rows.map((row, i) => (
        <div
          key={i}
          className={`flex justify-between px-4 py-2 font-condensed text-[12px] ${
            i % 2 === 0 ? 'bg-cream' : 'bg-cream-dark'
          }`}
        >
          <span className="text-ink/70">{row[0]}</span>
          <span className="font-bold text-ink">{row[1]}</span>
        </div>
      ))}
    </div>
  )
}

function RoleCard({ role, cat, desc, extra }: { role: string; cat: string; desc: string; extra: string }) {
  return (
    <div className="border border-warm-border rounded-sm bg-cream p-4">
      <div className="flex items-center justify-between mb-1">
        <span className="font-condensed text-[14px] font-bold text-ink">{role}</span>
        <span className="font-condensed text-[10px] font-semibold tracking-[0.08em] uppercase text-[#1E3A5F] bg-[#1E3A5F]/10 px-2 py-0.5 rounded-full">
          {cat}
        </span>
      </div>
      <p className="font-body text-[12px] text-ink/70 leading-relaxed">{desc}</p>
      <p className="font-body text-[12px] text-[#C9A84C] leading-relaxed mt-1">{extra}</p>
    </div>
  )
}

function Callout({ type, children }: { type: 'tip' | 'example'; children: React.ReactNode }) {
  const styles = type === 'tip'
    ? 'bg-[#1E3A5F]/8 border-[#1E3A5F]/20'
    : 'bg-[#C9A84C]/8 border-[#C9A84C]/20'
  const label = type === 'tip' ? 'Tip' : 'Eksempel'
  return (
    <div className={`border rounded-sm p-4 mt-3 ${styles}`}>
      <span className="font-condensed text-[10px] font-bold tracking-[0.1em] uppercase text-warm-gray block mb-1">
        {label}
      </span>
      <div className="font-body text-[12px] text-ink/80 leading-relaxed">
        {children}
      </div>
    </div>
  )
}
