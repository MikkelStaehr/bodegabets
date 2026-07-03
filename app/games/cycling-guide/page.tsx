import { createServerSupabaseClient } from '@/lib/supabase'
import { redirect } from 'next/navigation'
import {
  BREAK_POINTS_PER_KM,
  CAT_MULTIPLIER,
  DOMESTIQUE_BONUS,
  EQUIPIER_TEAM_BONUS,
  GC_MULTIPLIER_DISPLAY,
  JERSEY_LABELS,
  JERSEY_POINTS,
  LIEUTENANT_MULTIPLIER_LEADER_DNF,
  LIEUTENANT_MULTIPLIER_NORMAL,
  POSITION_POINTS_DISPLAY,
  TEAM_BONUS_DEFAULT,
  TRAIN_BONUS_PER_LEADOUT,
  TRAIN_MAX_LEADOUTS,
  WON_HOW_SPRINTER_BONUS,
} from '@/lib/cyclingScoringConstants'

// Runder point-resultater til 1 decimal — fjerner float-precision-fejl som
// at 50 × 1.7 × 2.8 vises som "237.99999999999997" i stedet for "238".
function pt(n: number): string {
  return `${Math.round(n * 10) / 10} pt`
}

export const dynamic = 'force-dynamic'

export default async function CyclingGuidePage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  return (
    <div className="min-h-screen bg-cream">
      <div className="max-w-[760px] mx-auto px-4 py-8">

        {/* Hero */}
        <div className="bg-[#1E3A5F] rounded-sm p-6 mb-6">
          <p className="font-condensed text-[11px] font-semibold tracking-[0.1em] uppercase text-[#C9A84C] mb-2">
            Reglebog
          </p>
          <h1 className="font-display text-[28px] font-bold text-cream leading-tight mb-3">
            Sådan scorer du point
          </h1>
          <p className="font-body text-[13px] text-cream/75 leading-relaxed mb-3">
            Du sætter 8 ryttere i en lineup, hver med en rolle. Når etapen er kørt, får du point pr. rytter — baseret på rolle, kategori og etapens profil.
          </p>
          <div className="bg-cream/10 border border-cream/15 rounded-sm p-3">
            <p className="font-condensed text-[11px] text-[#C9A84C] font-bold tracking-[0.08em] uppercase mb-1">
              Grundformel
            </p>
            <p className="font-display text-[15px] text-cream font-bold tracking-tight">
              Basispoint × Kategori × Profil × Spurt-tog + bonus − straf
            </p>
            <p className="font-body text-[11px] text-cream/60 leading-relaxed mt-2">
              Forskellige roller bruger forskellige led. En sprinter bruger dem alle. En domestique bruger næsten ingen.
            </p>
          </div>
          <div className="bg-[#8FABC4]/10 border border-[#8FABC4]/25 rounded-sm p-3 mt-3">
            <p className="font-condensed text-[11px] text-[#9FB8CC] font-bold tracking-[0.08em] uppercase mb-1">
              👥 Holdtempo (TTT)
            </p>
            <p className="font-body text-[12px] text-cream/75 leading-relaxed">
              Hold-tempo-etaper er deres egen lineup-form: <strong>ingen roller</strong>, du vælger <strong>6 ryttere</strong> og <strong>max 2 fra samme hold</strong>. Der scores efter holdets <strong>officielle holdtids-placering</strong> — helt fladt. Alle ryttere på samme hold får præcis samme point: 1. hold = 50, 2. = 40, 3. = 30, 4. = 22, 5. = 16, 6. = 12, 7.-10. = 8, 11.-15. = 4. Det handler om at ramme de stærke TTT-hold. Kun trøje-point lægges oveni; kategori, roller og GC-multiplikator tæller ikke.
            </p>
          </div>
        </div>

        {/* Rolle-vælger */}
        <div className="bg-cream-dark border border-warm-border rounded-sm p-5 mb-6">
          <p className="font-condensed text-[11px] font-bold tracking-[0.08em] uppercase text-warm-gray mb-3">
            Vælg en rolle
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {ROLES.map((r) => (
              <a
                key={r.key}
                href={`#${r.key}`}
                className="block border border-warm-border bg-cream rounded-sm p-3 hover:border-[#1E3A5F] transition-colors"
              >
                <p className="font-condensed text-[13px] font-bold text-ink">{r.name}</p>
                <p className="font-body text-[11px] text-warm-gray mt-0.5 leading-tight">{r.tagline}</p>
              </a>
            ))}
          </div>
        </div>

        {/* En rolle pr. sektion */}
        {ROLES.map((r) => (
          <RoleSection key={r.key} role={r} />
        ))}

        {/* Centrale mekanikker */}
        <Hero title="Mekanikkerne" subtitle="Detaljer der gælder på tværs af roller." />

        <SubCard title="Spurt-tog (leadout)" highlighted>
          <P>
            Hvis din <B>sprinter</B> ender top-3 OG du har én eller flere <B>équipiers fra samme hold som sprinteren</B>, får sprinteren ekstra point.
          </P>
          <PointTable rows={[
            ['Ingen équipier samme hold', '×1.0'],
            ['1 équipier samme hold', `×${1 + TRAIN_BONUS_PER_LEADOUT} (+${Math.round(TRAIN_BONUS_PER_LEADOUT * 100)} %)`],
            [`${TRAIN_MAX_LEADOUTS}+ équipiers samme hold`, `×${1 + TRAIN_BONUS_PER_LEADOUT * TRAIN_MAX_LEADOUTS} (+${Math.round(TRAIN_BONUS_PER_LEADOUT * TRAIN_MAX_LEADOUTS * 100)} %)`],
          ]} />
          <Callout type="example">
            Kat 2 sprinter vinder en flad etape.<br />
            Uden leadout: 50 × 1.3 × 1.8 = <B>117 pt</B><br />
            Med 1 équipier fra samme hold: 50 × 1.3 × 1.8 × 1.2 = <B>140,4 pt</B>
          </Callout>
          <P>
            Hvis sprinteren ikke ender top-3, sker ingenting — équipieren har optaget en plads forgæves. Det er en satsning.
          </P>
        </SubCard>

        <SubCard title="Basispoint">
          <P>Placering i etapen.</P>
          <PointTable rows={POSITION_POINTS_DISPLAY.map((p) => [p.label, String(p.value)])} />
        </SubCard>

        <SubCard title="Kategori-multiplier">
          <P>Lavere kategori = højere risiko = højere point.</P>
          <PointTable rows={Object.entries(CAT_MULTIPLIER).map(([cat, mul]) => [`Kategori ${cat}`, `×${mul}`])} />
        </SubCard>

        <SubCard title="Trøje-point (stage races)">
          <P>Bonus til rytteren der bærer trøjen til etapen. Hver rytter får kun én trøje (prioritet: fører &gt; points &gt; bjerg &gt; ungdom).</P>
          <PointTable rows={Object.entries(JERSEY_POINTS).map(([key, pts]) => [JERSEY_LABELS[key] ?? key, `+${pts}`])} />
        </SubCard>

        <SubCard title="Klassement-bonus (stage races)">
          <P>Ekstra point hvis rytteren er top-10 sammenlagt efter etapen.</P>
          <PointTable rows={GC_MULTIPLIER_DISPLAY.map((p) => [p.label, p.value])} />
        </SubCard>

        <SubCard title="Bænk-ryttere">
          <P>
            Ryttere i truppen der ikke er i lineup tæller <B>ingenting</B> — hverken plus eller minus, uanset deres resultat.
          </P>
        </SubCard>

        <SubCard title="Lås">
          <P>Lineup låses <B>30 minutter</B> før start. Trup-uvælget låses ved blokkens deadline (typisk før første løb).</P>
        </SubCard>

        {/* Brutto trup */}
        <Hero title="Trup-udtagelse" subtitle="Din rytter-pulje pr. blok." />
        <SubCard title="Regler">
          <P>Maks <B>25 ryttere</B> pr. blok. Yderligere:</P>
          <BulletList items={[
            'Maks 3 ryttere fra samme hold',
            'Kat 1: maks 3',
            'Kat 2–4: maks 5 pr. kategori',
            'Kat 5: maks 7',
          ]} />
        </SubCard>

        {/* Footer */}
        <div className="mt-8 pt-6 border-t border-warm-border text-center">
          <p className="font-condensed text-[11px] text-warm-gray tracking-[0.08em] uppercase">
            Bodega Bets — Cycling Manager
          </p>
        </div>
      </div>
    </div>
  )
}

// ── Rolle-data ──────────────────────────────────────────────────────────────

type RoleData = {
  key: string
  name: string
  tagline: string
  desc: string
  category: string
  formulaLabel: string
  scoring: { label: string; rows: string[][] }[]
  examples: { title: string; calculation: string; result: string; highlight?: boolean }[]
  bonuses?: string[]
  penalties?: string[]
  strategy: string
}

const ROLES: RoleData[] = [
  {
    key: 'leader',
    name: 'Leader',
    tagline: 'Din bedste rytter',
    desc: 'Den rytter du tror vinder. Får point efter placering ganget med kategori.',
    category: 'Alle kategorier',
    formulaLabel: 'Basispoint × Kategori',
    scoring: [
      { label: 'Multipliers', rows: [
        ['Kategori', `×${CAT_MULTIPLIER[1]}–×${CAT_MULTIPLIER[5]}`],
      ]},
    ],
    examples: [
      { title: 'Kat 1 leder vinder', calculation: `50 × ${CAT_MULTIPLIER[1]}`, result: pt(50 * CAT_MULTIPLIER[1]) },
      { title: 'Kat 3 leder vinder', calculation: `50 × ${CAT_MULTIPLIER[3]}`, result: pt(50 * CAT_MULTIPLIER[3]), highlight: true },
      { title: 'Kat 1 leder, 5. plads', calculation: `20 × ${CAT_MULTIPLIER[1]}`, result: pt(20 * CAT_MULTIPLIER[1]) },
    ],
    bonuses: [`+${TEAM_BONUS_DEFAULT} hvis vinderens hold`, 'Trøje-point hvis fører klassement', 'Klassement-bonus hvis top-10 sammenlagt'],
    strategy: 'Højere kategori = højere risiko, højere udbytte. En kat 3 leder der leverer giver væsentligt mere end en kat 1.',
  },
  {
    key: 'lieutenant',
    name: 'Lieutenant',
    tagline: 'Reserveleder',
    desc: 'Belønnes hvis han ender top-10. Får dobbelt-bonus hvis Leader udgår.',
    category: 'Kategori 2–3',
    formulaLabel: `Basispoint × Kategori × ${LIEUTENANT_MULTIPLIER_NORMAL} (top-10)`,
    scoring: [
      { label: 'Multipliers', rows: [
        ['Top-10', `×${LIEUTENANT_MULTIPLIER_NORMAL}`],
        ['Top-10 + Leader udgår', `×${LIEUTENANT_MULTIPLIER_LEADER_DNF}`],
        ['Uden for top-10', '×1.0'],
      ]},
    ],
    examples: [
      { title: 'Kat 2 lieutenant, 5. plads', calculation: `20 × ${CAT_MULTIPLIER[2]} × ${LIEUTENANT_MULTIPLIER_NORMAL}`, result: pt(20 * CAT_MULTIPLIER[2] * LIEUTENANT_MULTIPLIER_NORMAL) },
      { title: 'Kat 3 lieutenant vinder, Leader udgår', calculation: `50 × ${CAT_MULTIPLIER[3]} × ${LIEUTENANT_MULTIPLIER_LEADER_DNF}`, result: pt(50 * CAT_MULTIPLIER[3] * LIEUTENANT_MULTIPLIER_LEADER_DNF), highlight: true },
      { title: 'Kat 2 lieutenant, 15. plads', calculation: `5 × ${CAT_MULTIPLIER[2]}`, result: pt(5 * CAT_MULTIPLIER[2]) },
    ],
    bonuses: [`+${TEAM_BONUS_DEFAULT} hvis vinderens hold`, 'Trøje-point hvis fører klassement'],
    strategy: 'Forsikring hvis Leader fejler. Vælg en der oftest ender top-15.',
  },
  {
    key: 'grimpeur',
    name: 'Grimpeur',
    tagline: 'Bjergrytter',
    desc: 'Stor multiplier på bjerg — men ×1.8 (og solo-bonus) kun når grimpeuren VINDER etapen. Ellers ×1.2. Belønningen følger sejren.',
    category: 'Kategori 3–5',
    formulaLabel: 'Basispoint × Kategori × Profil + Bonus',
    scoring: [
      { label: 'Profil', rows: [
        ['Bjerg — vinder etapen', '×1.8'],
        ['Bjerg — ellers', '×1.2'],
        ['Bakket', '×1.2'],
        ['Brosten', '×1.2'],
        ['Flad / ITT', '×1.0'],
      ]},
      { label: 'Bonus (kun etapevinder)', rows: [
        ['Lille gruppe-spurt', '+20'],
        ['Spurt à deux', '+25'],
        ['Solo', '+50'],
        ['Solo med tidsgap', '+50 + 1 pr. km'],
      ]},
    ],
    examples: [
      { title: 'Kat 4 grimpeur vinder bjerg', calculation: `50 × ${CAT_MULTIPLIER[4]} × 1.8`, result: pt(50 * CAT_MULTIPLIER[4] * 1.8) },
      { title: 'Samme + 4 km solo', calculation: `50 × ${CAT_MULTIPLIER[4]} × 1.8 + 54`, result: pt(50 * CAT_MULTIPLIER[4] * 1.8 + 54), highlight: true },
      { title: 'Kat 5 grimpeur, 3. plads bjerg (ingen sejr)', calculation: `30 × ${CAT_MULTIPLIER[5]} × 1.2`, result: pt(30 * CAT_MULTIPLIER[5] * 1.2) },
    ],
    bonuses: [`+${TEAM_BONUS_DEFAULT} hvis vinderens hold`, 'Trøje-point (oftest bjergtrøje)'],
    strategy: 'Lav kategori i bjergene er en lotto-billet — sjælden succes, men store udbytter.',
  },
  {
    key: 'sprinter',
    name: 'Sprinter',
    tagline: 'Sprinter — forstærkes af spurt-tog',
    desc: 'Stærk på flade etaper. Den eneste rolle der forstærkes hvis du også har holdkammerater (équipiers) fra samme hold som leadout.',
    category: 'Kategori 1–3',
    formulaLabel: 'Basispoint × Kategori × Profil × Spurt-tog + Bonus',
    scoring: [
      { label: 'Profil', rows: [
        ['Flad', '×1.8'],
        ['Bakket', '×1.2'],
        ['Brosten', '×1.2'],
        ['Bjerg / ITT', '×1.0'],
      ]},
      { label: 'Spurt-tog (sprinter top-3)', rows: [
        ['Ingen équipier samme hold', '×1.0'],
        ['1 équipier samme hold', `×${1 + TRAIN_BONUS_PER_LEADOUT}`],
        [`${TRAIN_MAX_LEADOUTS}+ équipiers samme hold`, `×${1 + TRAIN_BONUS_PER_LEADOUT * TRAIN_MAX_LEADOUTS}`],
      ]},
      { label: 'Bonus (top-10)', rows: [
        ['Massespurt', `+${WON_HOW_SPRINTER_BONUS['Bunch sprint']}`],
        ['Lille gruppe-spurt', `+${WON_HOW_SPRINTER_BONUS['Small group sprint']}`],
        ['Spurt à deux', `+${WON_HOW_SPRINTER_BONUS['Sprint a deux']}`],
      ]},
    ],
    examples: [
      { title: 'Kat 2 sprinter vinder flad — alene', calculation: `50 × ${CAT_MULTIPLIER[2]} × 1.8`, result: pt(50 * CAT_MULTIPLIER[2] * 1.8) },
      { title: 'Samme — med 1 équipier fra samme hold', calculation: `50 × ${CAT_MULTIPLIER[2]} × 1.8 × ${1 + TRAIN_BONUS_PER_LEADOUT}`, result: pt(50 * CAT_MULTIPLIER[2] * 1.8 * (1 + TRAIN_BONUS_PER_LEADOUT)), highlight: true },
      { title: 'Kat 2 sprinter, 4. plads (ikke top-3 = intet spurt-tog)', calculation: `20 × ${CAT_MULTIPLIER[2]} × 1.8`, result: pt(20 * CAT_MULTIPLIER[2] * 1.8) },
    ],
    bonuses: [`+${TEAM_BONUS_DEFAULT} hvis vinderens hold`, 'Trøje-point (oftest pointtrøje)'],
    strategy: 'Tror du sprinteren vinder? Tag en équipier fra samme hold med — det giver 20–40 % oven på.',
  },
  {
    key: 'domestique',
    name: 'Domestique',
    tagline: 'Holdarbejder',
    desc: `Får en fast bonus hvis han ender top-40 OG Leader er top-10. Ingen multiplier. Og en udbruds-bonus på ${BREAK_POINTS_PER_KM} pt pr. km han er i udbrud.`,
    category: 'Kun kategori 4',
    formulaLabel: `Basispoint + ${DOMESTIQUE_BONUS} (hvis top-40 og Leader top-10) + udbruds-km × ${BREAK_POINTS_PER_KM}`,
    scoring: [
      { label: 'Bonus', rows: [
        [`Top-40 og Leader top-10`, `+${DOMESTIQUE_BONUS}`],
        ['Ellers', 'Kun basispoint'],
      ]},
      { label: 'Udbrud', rows: [
        ['Pr. km foran feltet', `+${BREAK_POINTS_PER_KM} pt`],
        ['Fx 135 km i udbrud', '+13,5'],
      ]},
    ],
    examples: [
      { title: 'Domestique 25. plads, Leader 3.', calculation: `0 + ${DOMESTIQUE_BONUS}`, result: `${DOMESTIQUE_BONUS} pt` },
      { title: 'Domestique 135 km i udbrud, 40. plads', calculation: `0 + 135 × ${BREAK_POINTS_PER_KM}`, result: '13,5 pt', highlight: true },
      { title: 'Domestique 50. plads, intet udbrud', calculation: '0', result: '0 pt' },
    ],
    strategy: 'Sikre småpoint hvis din Leader-strategi virker — eller sæt en angriber der jager udbruddet: hver km foran feltet giver point, også når han fanges.',
  },
  {
    key: 'equipier',
    name: 'Équipier',
    tagline: 'Holdkammerat — kan blive leadout',
    desc: `Scorer fulde placerings-basispoint som alle andre roller (top-20: 50/30/20/10/5), plus +${EQUIPIER_TEAM_BONUS} hvis han er på vinderens hold, plus en udbruds-bonus på ${BREAK_POINTS_PER_KM} pt pr. km i udbrud. Ingen multiplikator. På SAMME hold som din Sprinter forstærker han sprinterens score.`,
    category: 'Alle kategorier',
    formulaLabel: `Basispoint + ${EQUIPIER_TEAM_BONUS} (hvis vinderens hold) + udbruds-km × ${BREAK_POINTS_PER_KM}`,
    scoring: [
      { label: 'Placering', rows: [
        ['Top-20 i mål', 'Fulde basispoint (50/30/20/10/5)'],
        ['Uden for top-20', '0 basispoint'],
      ]},
      { label: 'Udbrud', rows: [
        ['Pr. km foran feltet', `+${BREAK_POINTS_PER_KM} pt`],
        ['Fx 135 km i udbrud', '+13,5'],
      ]},
      { label: 'Bonus', rows: [
        ['Samme hold som vinder', `+${EQUIPIER_TEAM_BONUS}`],
        ['Ellers', 'Kun basispoint'],
      ]},
      { label: 'Sammenspil', rows: [
        ['Samme hold som Sprinter + Sprinter top-3', 'Spurt-tog aktiveres'],
      ]},
    ],
    examples: [
      { title: 'Équipier nr. 3 på etapen', calculation: '30 basispoint', result: '30 pt', highlight: true },
      { title: 'Équipier 135 km i udbrud, fanget', calculation: `135 × ${BREAK_POINTS_PER_KM}`, result: '13,5 pt', highlight: true },
      { title: 'Équipier nr. 30, vinderens hold', calculation: `0 + ${EQUIPIER_TEAM_BONUS}`, result: `${EQUIPIER_TEAM_BONUS} pt` },
    ],
    strategy: 'Stærk til opportunister: en équipier i top-20 giver fuld placeringsscore, og hver km i udbrud giver point selv når han fanges. Ellers leadout for din Sprinter eller holdbonus-jagt.',
  },
  {
    key: 'joker',
    name: 'Joker',
    tagline: 'Wildcard',
    desc: `Scorer fulde placerings-basispoint som alle andre roller (top-20: 50/30/20/10/5), plus +${EQUIPIER_TEAM_BONUS} hvis han er på vinderens hold, plus en udbruds-bonus på ${BREAK_POINTS_PER_KM} pt pr. km i udbrud. Ingen multiplikator.`,
    category: 'Alle kategorier',
    formulaLabel: `Basispoint + ${EQUIPIER_TEAM_BONUS} (hvis vinderens hold) + udbruds-km × ${BREAK_POINTS_PER_KM}`,
    scoring: [
      { label: 'Placering', rows: [
        ['Top-20 i mål', 'Fulde basispoint (50/30/20/10/5)'],
        ['Uden for top-20', '0 basispoint'],
      ]},
      { label: 'Udbrud', rows: [
        ['Pr. km foran feltet', `+${BREAK_POINTS_PER_KM} pt`],
        ['Fx 135 km i udbrud', '+13,5'],
      ]},
      { label: 'Bonus', rows: [
        ['Samme hold som vinder', `+${EQUIPIER_TEAM_BONUS}`],
        ['Ellers', 'Kun basispoint'],
      ]},
    ],
    examples: [
      { title: 'Joker nr. 1 på etapen', calculation: '50 basispoint', result: '50 pt', highlight: true },
      { title: 'Joker 135 km i udbrud, fanget', calculation: `135 × ${BREAK_POINTS_PER_KM}`, result: '13,5 pt', highlight: true },
      { title: 'Joker uden for top-20, vinderens hold', calculation: `0 + ${EQUIPIER_TEAM_BONUS}`, result: `${EQUIPIER_TEAM_BONUS} pt` },
    ],
    strategy: 'Et frit valg uden bindinger til kategori eller profil — perfekt til en risikabel angriber: hver km i udbrud giver point, også når han fanges, og han kan snige sig i top-20.',
  },
]

// ── Helper components ────────────────────────────────────────────────────────

function RoleSection({ role }: { role: RoleData }) {
  return (
    <div id={role.key} className="bg-cream-dark border border-warm-border rounded-sm p-5 mb-4 scroll-mt-4">
      <div className="flex items-baseline justify-between mb-3 pb-3 border-b border-warm-border">
        <div>
          <h2 className="font-display text-[22px] font-bold text-ink leading-tight">{role.name}</h2>
          <p className="font-body text-[13px] text-warm-gray mt-0.5">{role.tagline}</p>
        </div>
        <span className="font-condensed text-[10px] font-semibold tracking-[0.1em] uppercase text-[#1E3A5F] bg-[#1E3A5F]/10 px-2 py-1 rounded-full whitespace-nowrap">
          {role.category}
        </span>
      </div>

      <P>{role.desc}</P>

      <SubHeading>Formel</SubHeading>
      <Formula>{role.formulaLabel}</Formula>

      {role.scoring.map((block, i) => (
        <div key={i}>
          <SubHeading>{block.label}</SubHeading>
          <PointTable rows={block.rows} />
        </div>
      ))}

      <SubHeading>Eksempler</SubHeading>
      <div className="space-y-2 mb-3">
        {role.examples.map((ex, i) => (
          <ExampleRow key={i} example={ex} />
        ))}
      </div>

      {role.bonuses && role.bonuses.length > 0 && (
        <>
          <SubHeading>Bonusser</SubHeading>
          <BulletList items={role.bonuses} />
        </>
      )}

      {role.penalties && role.penalties.length > 0 && (
        <>
          <SubHeading>Straffe</SubHeading>
          <BulletList items={role.penalties} />
        </>
      )}

      <SubHeading>Strategi</SubHeading>
      <Callout type="tip">{role.strategy}</Callout>
    </div>
  )
}

function ExampleRow({ example }: { example: { title: string; calculation: string; result: string; highlight?: boolean } }) {
  return (
    <div className={`rounded-sm p-3 border ${
      example.highlight
        ? 'bg-[#C9A84C]/10 border-[#C9A84C]/30'
        : 'bg-cream border-warm-border'
    }`}>
      <p className="font-condensed text-[12px] font-semibold text-ink mb-1">{example.title}</p>
      <div className="flex items-baseline justify-between gap-3 flex-wrap">
        <span className="font-mono text-[11px] text-warm-gray">{example.calculation}</span>
        <span className={`font-condensed text-[14px] font-bold ${example.highlight ? 'text-[#8B6F1F]' : 'text-ink'}`}>
          {example.result}
        </span>
      </div>
    </div>
  )
}

function Hero({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="mt-8 mb-4">
      <h2 className="font-display text-[24px] font-bold text-ink leading-tight">{title}</h2>
      <p className="font-body text-[13px] text-warm-gray mt-1">{subtitle}</p>
    </div>
  )
}

function SubCard({ title, children, highlighted }: { title: string; children: React.ReactNode; highlighted?: boolean }) {
  return (
    <div className={`border rounded-sm p-5 mb-4 ${
      highlighted
        ? 'bg-[#C9A84C]/8 border-[#C9A84C]/30'
        : 'bg-cream-dark border-warm-border'
    }`}>
      <h3 className="font-condensed text-[14px] font-bold text-ink tracking-[0.04em] mb-3">{title}</h3>
      {children}
    </div>
  )
}

function SubHeading({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="font-condensed text-[11px] font-bold text-ink tracking-[0.1em] uppercase mt-4 mb-2">
      {children}
    </h3>
  )
}

function Formula({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-cream border border-warm-border rounded-sm p-3 mb-3">
      <p className="font-mono text-[12px] text-ink leading-relaxed">{children}</p>
    </div>
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

function Callout({ type, children }: { type: 'tip' | 'example'; children: React.ReactNode }) {
  const styles = type === 'tip'
    ? 'bg-[#1E3A5F]/8 border-[#1E3A5F]/20'
    : 'bg-[#C9A84C]/8 border-[#C9A84C]/20'
  const label = type === 'tip' ? 'Strategi' : 'Eksempel'
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
