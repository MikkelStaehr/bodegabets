import { createServerSupabaseClient } from '@/lib/supabase'
import { redirect } from 'next/navigation'
import {
  CAT_MULTIPLIER,
  DNF_PENALTY_MIN,
  DNF_PENALTY_PCT,
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
            Reglebog — Cycling Manager
          </p>
          <h1 className="font-display text-[28px] font-bold text-cream leading-tight mb-3">
            Sådan scorer du point
          </h1>
          <p className="font-body text-[13px] text-cream/75 leading-relaxed mb-3">
            Hvert valg du laver påvirker din score — rolle, kategori, hold, profil. Det her er ikke "mange regler". Det er ét grundprincip
            der gentages med små variationer pr. rolle. Klik en rolle nedenfor for at se præcis hvordan den scorer.
          </p>
          <div className="bg-cream/10 border border-cream/15 rounded-sm p-3">
            <p className="font-condensed text-[11px] text-[#C9A84C] font-bold tracking-[0.08em] uppercase mb-1">
              Grundformlen
            </p>
            <p className="font-display text-[15px] text-cream font-bold tracking-tight">
              Basispoint × Kategori × Profil × Spurt-tog + bonusser − straffe
            </p>
            <p className="font-body text-[11px] text-cream/60 leading-relaxed mt-2">
              Hver rolle bruger nogle af leddene. Sprinter bruger alle. Domestique bruger næsten ingen.
            </p>
          </div>
        </div>

        {/* Rolle-vælger */}
        <div className="bg-cream-dark border border-warm-border rounded-sm p-5 mb-6">
          <p className="font-condensed text-[11px] font-bold tracking-[0.08em] uppercase text-warm-gray mb-3">
            Vælg en rolle for at se hvordan den scorer
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

        {/* Centrale mekanikker — uddybende */}
        <Hero title="Centrale mekanikker" subtitle="Detaljer der gælder på tværs af roller." />

        <SubCard title="Spurt-tog (leadout)" highlighted>
          <P>
            Den vigtigste sammenspilsmekanik. Hvis din <B>Sprinter</B> ender <B>top-3</B> i etapen, og du har én eller flere <B>Equipiers fra samme hold som sprinteren</B>,
            multipliceres sprinterens role_multiplier med en bonus:
          </P>
          <Formula>
            +{Math.round(TRAIN_BONUS_PER_LEADOUT * 100)}% pr. leadout-equipier (cap ×{1 + TRAIN_BONUS_PER_LEADOUT * TRAIN_MAX_LEADOUTS} ved {TRAIN_MAX_LEADOUTS} leadouts)
          </Formula>
          <PointTable rows={[
            ['0 leadouts', '×1.0'],
            ['1 leadout (samme hold)', `×${1 + TRAIN_BONUS_PER_LEADOUT}`],
            [`${TRAIN_MAX_LEADOUTS}+ leadouts`, `×${1 + TRAIN_BONUS_PER_LEADOUT * TRAIN_MAX_LEADOUTS}`],
          ]} />
          <Callout type="example">
            <B>Eksempel:</B> Jonathan Milan (Lidl-Trek, kat 2) vinder en flat etape.<br />
            <B>Uden leadout:</B> 50 × 1.3 × 1.8 = <B>117 pt</B><br />
            <B>Med Ciccone (Lidl-Trek) som equipier:</B> 50 × 1.3 × 1.8 × 1.2 = <B>140,4 pt</B> (+23,4)
          </Callout>
          <P>
            Spurt-tog kræver at sprinteren faktisk er top-3. Hvis han bliver 4. eller værre, koster du dig en pladsen i lineupet uden at få noget. Det er en satsning.
          </P>
        </SubCard>

        <SubCard title="Basispoint (placering)">
          <P>Pointene gives baseret på rytterens etape-placering. Roller uden multiplier (domestique/equipier/joker) får kun basispoint + rolle-bonus.</P>
          <PointTable rows={POSITION_POINTS_DISPLAY.map((p) => [p.label, String(p.value)])} />
        </SubCard>

        <SubCard title="Kategori-multiplikator">
          <P>Lavere-rangerede ryttere giver flere point — det belønner at du tager en chance.</P>
          <PointTable rows={Object.entries(CAT_MULTIPLIER).map(([cat, mul]) => [`Kategori ${cat}`, `×${mul}`])} />
        </SubCard>

        <SubCard title="Jersey-point (kun stage races)">
          <P>Trøje-bonus tildeles til rytteren der bærer trøjen til etapen. Hver rytter får kun ÉN trøje (prioritet: fører &gt; points &gt; bjerg &gt; ungdom).</P>
          <PointTable rows={Object.entries(JERSEY_POINTS).map(([key, pts]) => [JERSEY_LABELS[key] ?? key, `+${pts}`])} />
        </SubCard>

        <SubCard title="GC-multiplikator (kun stage races)">
          <P>Bonus på <em>placerings-point</em> for ryttere i top-10 sammenlagt efter etapen. Stacker oven på role_multiplier.</P>
          <PointTable rows={GC_MULTIPLIER_DISPLAY.map((p) => [p.label, p.value])} />
        </SubCard>

        <SubCard title="DNF-straf">
          <P>
            Hvis en rytter udgår (DNF), mister du <B>{Math.round(DNF_PENALTY_PCT * 100)}%</B> af hvad de ville have scoret.
            Minimum straf er <B>{DNF_PENALTY_MIN} point</B>. <B>Joker</B> er undtaget.
          </P>
        </SubCard>

        <SubCard title="Bænk-ryttere">
          <P>
            Ryttere i din brutto trup der ikke er i din lineup tæller <B>hverken plus eller minus</B>.
            De er helt udeladt af scoringen, uanset hvordan de placerer sig i løbet.
          </P>
        </SubCard>

        <SubCard title="Deadlines & lås">
          <P>Din lineup låser <B>30 minutter</B> før løbets start. Derefter kan du ikke ændre den. Brutto truppen låser ved blokkens deadline (typisk før første løb i blokken).</P>
        </SubCard>

        {/* Brutto trup */}
        <Hero title="Brutto trup" subtitle="Din rytter-pulje pr. blok. Lineup vælges blandt disse." />
        <SubCard title="Begrænsninger">
          <P>Du kan udtage op til <B>25 ryttere</B> per blok. Inden for de 25 gælder:</P>
          <BulletList items={[
            'Maks 3 ryttere fra samme hold',
            'Kat 1 (topstjerner): maks 3',
            'Kat 2–4: maks 5 per kategori',
            'Kat 5 (lavest rangeret): maks 7',
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
    tagline: 'Din stærkeste rytter',
    desc: 'Den rytter du satser på vinder eller kommer højt op. Klassisk: en topstjerne i Kategori 1 (Pogačar, Vingegaard, van der Poel). Risikoen er at de ofte er dyrere i kategori-multiplier.',
    category: 'Alle kategorier',
    formulaLabel: 'Basispoint × Kategori + holdbonus',
    scoring: [
      { label: 'Multipliers', rows: [
        ['Kategori', `×${CAT_MULTIPLIER[1]}–×${CAT_MULTIPLIER[5]}`],
        ['Andre', 'Ingen profil-bonus, ingen spurt-tog'],
      ]},
    ],
    examples: [
      { title: 'Kat 1 leader vinder etape', calculation: `50 × ${CAT_MULTIPLIER[1]}`, result: `${50 * CAT_MULTIPLIER[1]} pt` },
      { title: 'Kat 3 leader vinder etape', calculation: `50 × ${CAT_MULTIPLIER[3]}`, result: `${50 * CAT_MULTIPLIER[3]} pt`, highlight: true },
      { title: 'Kat 1 leader, 5. plads + vinderhold', calculation: `20 × ${CAT_MULTIPLIER[1]} + ${TEAM_BONUS_DEFAULT}`, result: `${20 * CAT_MULTIPLIER[1] + TEAM_BONUS_DEFAULT} pt` },
    ],
    bonuses: [`+${TEAM_BONUS_DEFAULT} hvis vinderhold`, 'Jersey-point hvis bærer trøje', 'GC-multiplier hvis top-10 sammenlagt'],
    penalties: [`DNF: -${Math.round(DNF_PENALTY_PCT * 100)}% af forventet score (min ${DNF_PENALTY_MIN})`],
    strategy: 'Stabil men dyr på kat 1. Kat 3 leader giver markant højere udbytte hvis de leverer — men deres odds for top-5 er lavere. Brug kat 1 i bjerge når favoritterne er tunge; vær mere modig på flade etaper.',
  },
  {
    key: 'lieutenant',
    name: 'Lieutenant',
    tagline: 'Backup-leder i top-10',
    desc: 'Din næstbedste kort. Belønnes hvis han er top-10. Forstærkes drastisk hvis din Leader udgår — så aktiveres en større multiplikator. Tænk: hvis Leader DNF, hvem træder ind?',
    category: 'Kategori 2–3',
    formulaLabel: `Basispoint × Kategori × ${LIEUTENANT_MULTIPLIER_NORMAL} (top-10) ELLER ×${LIEUTENANT_MULTIPLIER_LEADER_DNF} (Leader DNF)`,
    scoring: [
      { label: 'Multipliers', rows: [
        ['Top-10', `×${LIEUTENANT_MULTIPLIER_NORMAL}`],
        ['Top-10 OG Leader DNF', `×${LIEUTENANT_MULTIPLIER_LEADER_DNF}`],
        ['Uden for top-10', '×1.0 (kun kategori-mul)'],
      ]},
    ],
    examples: [
      { title: 'Kat 2 lieutenant, 5. plads', calculation: `20 × ${CAT_MULTIPLIER[2]} × ${LIEUTENANT_MULTIPLIER_NORMAL}`, result: `${(20 * CAT_MULTIPLIER[2] * LIEUTENANT_MULTIPLIER_NORMAL).toFixed(1)} pt` },
      { title: 'Kat 3 lieutenant vinder, Leader DNF', calculation: `50 × ${CAT_MULTIPLIER[3]} × ${LIEUTENANT_MULTIPLIER_LEADER_DNF}`, result: `${50 * CAT_MULTIPLIER[3] * LIEUTENANT_MULTIPLIER_LEADER_DNF} pt`, highlight: true },
      { title: 'Kat 2 lieutenant, 15. plads', calculation: `5 × ${CAT_MULTIPLIER[2]}`, result: `${5 * CAT_MULTIPLIER[2]} pt` },
    ],
    bonuses: [`+${TEAM_BONUS_DEFAULT} hvis vinderhold`, 'Jersey-point hvis bærer trøje'],
    penalties: [`DNF: -${Math.round(DNF_PENALTY_PCT * 100)}% af forventet score`],
    strategy: 'En "hvis Leader fejler"-forsikring. Vælg kat 2-3 ryttere der altid kører top-15 (Roglič, Almeida) — så har du både en stærk score når Leader klikker, og en kæmpe score når Leader DNF.',
  },
  {
    key: 'grimpeur',
    name: 'Grimpeur',
    tagline: 'Bjergrytteren',
    desc: 'Spillets bjergrytter — store multipliers på bjerge og bakker. Kombineret med won-how-bonus kan en grimpeur i en solo-flugt score voldsomt. Begrænset til kat 3-5 — det er ikke topstjerner.',
    category: 'Kategori 3–5',
    formulaLabel: 'Basispoint × Kategori × Profil-multiplier + Won-how-bonus',
    scoring: [
      { label: 'Profil-multipliers', rows: [
        ['Mountain', '×1.8'],
        ['Hilly', '×1.2'],
        ['Cobbled', '×1.2 (nye regler)'],
        ['Flat / Mixed / ITT', '×1.0'],
      ]},
      { label: 'Won-how-bonus (top-10)', rows: [
        ['Small group sprint', '+20'],
        ['Sprint à deux', '+25'],
        ['Solo', '+50'],
        ['XX km solo', '+50 + 1p pr. km'],
      ]},
    ],
    examples: [
      { title: 'Kat 4 grimpeur vinder bjerg-etape med 4,3 km solo', calculation: `50 × ${CAT_MULTIPLIER[4]} × 1.8 + 50 + 4`, result: `${(50 * CAT_MULTIPLIER[4] * 1.8 + 54).toFixed(1)} pt`, highlight: true },
      { title: 'Kat 5 grimpeur 3. plads bjerg', calculation: `30 × ${CAT_MULTIPLIER[5]} × 1.8`, result: `${(30 * CAT_MULTIPLIER[5] * 1.8).toFixed(1)} pt` },
      { title: 'Kat 3 grimpeur 5. plads bakket', calculation: `20 × ${CAT_MULTIPLIER[3]} × 1.2`, result: `${(20 * CAT_MULTIPLIER[3] * 1.2).toFixed(1)} pt` },
    ],
    bonuses: [`+${TEAM_BONUS_DEFAULT} hvis vinderhold`, 'Jersey-point (typisk bjergtrøje)'],
    penalties: [`DNF: -${Math.round(DNF_PENALTY_PCT * 100)}%`],
    strategy: 'Kerne-rolle på bjerg- og bakke-etaper. Kat 5 grimpeur er en lotto-billet — sjældent succes, men når de leverer giver ×3,5 ekstreme tal. Kombiner med won-how: solo-vindere fra "long break" er klassiske grimpeur-jackpots.',
  },
  {
    key: 'sprinter',
    name: 'Sprinter',
    tagline: 'Spurteren — forstærkes af spurt-tog',
    desc: 'Spillets spurter. Stærk på flade etaper. Den eneste rolle der forstærkes af leadout-tog — hvis du parrer ham med en equipier fra samme hold OG han ender top-3, får hele scoren et stort boost.',
    category: 'Kategori 1–3',
    formulaLabel: 'Basispoint × Kategori × Profil × Spurt-tog + Won-how-bonus',
    scoring: [
      { label: 'Profil-multipliers', rows: [
        ['Flat / Mixed', '×1.8'],
        ['Hilly', '×1.2'],
        ['Cobbled', '×1.2 (nye regler)'],
        ['Mountain / ITT', '×1.0'],
      ]},
      { label: 'Spurt-tog (sprinter top-3)', rows: [
        ['0 leadouts', '×1.0'],
        ['1 leadout-equipier (samme hold)', `×${1 + TRAIN_BONUS_PER_LEADOUT}`],
        [`${TRAIN_MAX_LEADOUTS}+ leadouts`, `×${1 + TRAIN_BONUS_PER_LEADOUT * TRAIN_MAX_LEADOUTS}`],
      ]},
      { label: 'Won-how-bonus (top-10)', rows: [
        ['Massespurt (bunch sprint)', `+${WON_HOW_SPRINTER_BONUS['Bunch sprint']}`],
        ['Lille gruppe-spurt', `+${WON_HOW_SPRINTER_BONUS['Small group sprint']}`],
        ['Spurt à deux', `+${WON_HOW_SPRINTER_BONUS['Sprint a deux']}`],
      ]},
    ],
    examples: [
      { title: 'Kat 2 Milan vinder flat, INGEN leadout', calculation: `50 × ${CAT_MULTIPLIER[2]} × 1.8`, result: `${(50 * CAT_MULTIPLIER[2] * 1.8).toFixed(1)} pt` },
      { title: 'Kat 2 Milan vinder flat, 1 leadout', calculation: `50 × ${CAT_MULTIPLIER[2]} × 1.8 × ${1 + TRAIN_BONUS_PER_LEADOUT}`, result: `${(50 * CAT_MULTIPLIER[2] * 1.8 * (1 + TRAIN_BONUS_PER_LEADOUT)).toFixed(1)} pt`, highlight: true },
      { title: 'Kat 2 Milan, 4. plads (ingen spurt-tog, ikke top-3)', calculation: `20 × ${CAT_MULTIPLIER[2]} × 1.8`, result: `${(20 * CAT_MULTIPLIER[2] * 1.8).toFixed(1)} pt` },
      { title: 'Kat 2 Milan vinder + bunch sprint + 1 leadout', calculation: `50 × ${CAT_MULTIPLIER[2]} × 1.8 × ${1 + TRAIN_BONUS_PER_LEADOUT} + ${WON_HOW_SPRINTER_BONUS['Bunch sprint']}`, result: `${(50 * CAT_MULTIPLIER[2] * 1.8 * (1 + TRAIN_BONUS_PER_LEADOUT) + WON_HOW_SPRINTER_BONUS['Bunch sprint']).toFixed(1)} pt`, highlight: true },
    ],
    bonuses: [`+${TEAM_BONUS_DEFAULT} hvis vinderhold`, 'Jersey-point (typisk pointtrøje)'],
    penalties: [`DNF: -${Math.round(DNF_PENALTY_PCT * 100)}%`],
    strategy: 'Spurt-tog er kerne-strategien. Hvis du tror Milan vinder, betal pladsen for en Lidl-Trek equipier også — det giver 20-40% bonus oven på en allerede stor score. Men hvis du ikke tror han er top-3, sparer du pladsen og bruger den på en grimpeur eller domestique.',
  },
  {
    key: 'domestique',
    name: 'Domestique',
    tagline: 'Holdarbejder — sikre småpoint',
    desc: 'Holdarbejder. Ingen multiplier, men giver en garanteret bonus hvis han er top-40 OG din Leader er top-10. Lav-risiko, lav-belønning. Kun kat 4 — det er en rolle for sjette-mand-i-feltet typer.',
    category: 'Kun kategori 4',
    formulaLabel: `Basispoint + ${DOMESTIQUE_BONUS} (hvis top-40 OG Leader top-10)`,
    scoring: [
      { label: 'Bonus', rows: [
        [`Top-40 OG Leader top-10`, `+${DOMESTIQUE_BONUS}`],
        ['Andre', 'Kun basispoint'],
      ]},
    ],
    examples: [
      { title: 'Kat 4 domestique 25. plads, Leader 3.', calculation: `0 + ${DOMESTIQUE_BONUS}`, result: `${DOMESTIQUE_BONUS} pt` },
      { title: 'Kat 4 domestique 10. plads, Leader vinder', calculation: `10 + ${DOMESTIQUE_BONUS}`, result: `${10 + DOMESTIQUE_BONUS} pt`, highlight: true },
      { title: 'Kat 4 domestique 50. plads', calculation: '0', result: '0 pt' },
    ],
    penalties: [`DNF: -${Math.round(DNF_PENALTY_PCT * 100)}%`],
    strategy: 'En tæve i flokken. Vælg en pålidelig kat 4 rytter (typisk en holdleders højre hånd) der kører tæt på Leader. Hvis din Leader-strategi virker, får du gratis bonus-point. Hvis Leader fejler, mister du domestique-bonusen — men ikke ret meget.',
  },
  {
    key: 'equipier',
    name: 'Équipier',
    tagline: 'Holdkammerat — leadout for sprinteren',
    desc: 'Holdkammerat. Belønnes hvis han er på samme hold som dagens vinder. Vigtigere: hvis han er på SAMME HOLD som din Sprinter, fungerer han som leadout og forstærker sprinterens score med 20-40%.',
    category: 'Alle kategorier',
    formulaLabel: `Basispoint + ${EQUIPIER_TEAM_BONUS} (hvis samme hold som vinder)`,
    scoring: [
      { label: 'Bonus', rows: [
        ['Samme hold som vinder', `+${EQUIPIER_TEAM_BONUS}`],
        ['Andre', 'Kun basispoint'],
      ]},
      { label: 'Sammenspil (leadout)', rows: [
        ['Sprinter samme hold + sprinter top-3', 'Boost sprinterens score'],
      ]},
    ],
    examples: [
      { title: 'Equipier på vinderhold, 30. plads', calculation: `0 + ${EQUIPIER_TEAM_BONUS}`, result: `${EQUIPIER_TEAM_BONUS} pt` },
      { title: 'Equipier på sprinterens hold (leadout-bonus tilfalder Sprinter)', calculation: 'egne point uændret', result: 'Sprinter får ×1.2', highlight: true },
    ],
    penalties: ['Ingen DNF-straf (rolle uden multiplier — basisscore er allerede lille)'],
    strategy: 'Den mest taktiske rolle. Selvom equipieren scorer meget lidt selv, kan han ændre din Sprinters score markant via spurt-tog. Identificér Lidl-Treks, Soudal Quick-Step\'s eller Decathlon\'s mest pålidelige leadout-mand og par ham med din sprinter.',
  },
  {
    key: 'joker',
    name: 'Joker',
    tagline: 'Wildcard — immun mod minus',
    desc: 'Jokeren. Får +7 hvis han er på vinderhold. Vigtigste egenskab: immun mod ALLE minuspoint og DNF-straffe. Brug ham som forsikring eller wild-card-satsning.',
    category: 'Alle kategorier',
    formulaLabel: `Basispoint + ${EQUIPIER_TEAM_BONUS} (hvis samme hold som vinder)`,
    scoring: [
      { label: 'Bonus', rows: [
        ['Samme hold som vinder', `+${EQUIPIER_TEAM_BONUS}`],
        ['DNF / minuspoint', 'Tæller IKKE (immun)'],
      ]},
    ],
    examples: [
      { title: 'Joker på vinderhold, 50. plads', calculation: `0 + ${EQUIPIER_TEAM_BONUS}`, result: `${EQUIPIER_TEAM_BONUS} pt` },
      { title: 'Joker DNF (immun!)', calculation: 'Ingen straf', result: '0 pt', highlight: true },
    ],
    strategy: 'En forsikring mod en katastrofal etape. Hvis du har en stjerne du elsker men er bange for at hun udgår (Paris-Roubaix-stil), gør hende til Joker — du får ikke det fulde multiplier-udbytte, men du undgår -25 pt fra DNF. Eller: kast en risiko-rytter du tror på, så du ikke betaler hvis han udgår.',
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
