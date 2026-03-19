export type NewsTemplate = {
  headline: string
  body: string
}

export function generateMatchNews(
  home: string,
  away: string,
  homeScore: number,
  awayScore: number,
  tournament: string
): NewsTemplate {
  const diff = Math.abs(homeScore - awayScore)
  const homeWon = homeScore > awayScore
  const draw = homeScore === awayScore
  const winner = homeWon ? home : away
  const loser = homeWon ? away : home
  const winScore = homeWon ? homeScore : awayScore
  const loseScore = homeWon ? awayScore : homeScore

  if (draw) {
    const templates: NewsTemplate[] = [
      {
        headline: `${home} og ${away} deler point`,
        body: `En jævnbyrdig kamp i ${tournament} endte uden en vinder. Begge hold kæmpede hårdt men måtte nøjes med ét point hver.`,
      },
      {
        headline: `Pointdeling i ${tournament}`,
        body: `${home} og ${away} kunne ikke finde afgørelsen. Kampen endte ${homeScore}-${awayScore} efter 90 minutter.`,
      },
      {
        headline: `Ingen vinder i ${tournament}`,
        body: `${home} og ${away} spillede ${homeScore}-${awayScore}. Et resultat der kan glæde og skuffe i lige måde.`,
      },
    ]
    return pick(templates)
  }

  if (diff >= 3) {
    const templates: NewsTemplate[] = [
      {
        headline: `${winner} knuser ${loser}`,
        body: `En imponerende præstation i ${tournament}. ${winner} var suveræn og vandt overbevisende ${winScore}-${loseScore}.`,
      },
      {
        headline: `Storsejr til ${winner}`,
        body: `${loser} havde ingen svar på ${winner}s angrebsspil. Slutresultatet ${winScore}-${loseScore} taler sit tydelige sprog.`,
      },
      {
        headline: `${winner} dominerer ${loser}`,
        body: `En aften at glemme for ${loser}. ${winner} vandt ${winScore}-${loseScore} i ${tournament}.`,
      },
      {
        headline: `${winner} i storform`,
        body: `Med en ${winScore}-${loseScore} sejr over ${loser} viser ${winner} klassen i ${tournament}.`,
      },
    ]
    return pick(templates)
  }

  if (diff === 2) {
    const templates: NewsTemplate[] = [
      {
        headline: `${winner} besejrer ${loser}`,
        body: `${winner} tog tre vigtige point i ${tournament} med en ${winScore}-${loseScore} sejr over ${loser}.`,
      },
      {
        headline: `Sikker sejr til ${winner}`,
        body: `${winner} kontrollerede kampen og vandt fortjent ${winScore}-${loseScore} mod ${loser}.`,
      },
      {
        headline: `${winner} for stærk`,
        body: `${loser} kunne ikke følge med. ${winner} vandt ${winScore}-${loseScore} i ${tournament}.`,
      },
    ]
    return pick(templates)
  }

  // diff === 1
  const templates: NewsTemplate[] = [
    {
      headline: `${winner} sniger sig forbi ${loser}`,
      body: `En nervepirrende kamp i ${tournament} endte ${winScore}-${loseScore}. ${winner} holdt snuden over vande i et tæt opgør.`,
    },
    {
      headline: `Dramatisk sejr til ${winner}`,
      body: `${loser} kæmpede til det sidste men ${winner} tog de tre point med ${winScore}-${loseScore}.`,
    },
    {
      headline: `${winner} vinder tæt kamp`,
      body: `Kun ét mål skilte de to hold i ${tournament}. ${winner} vandt ${winScore}-${loseScore} i en jævnbyrdig kamp.`,
    },
    {
      headline: `Tæt sejr til ${winner}`,
      body: `${winner} og ${loser} leverede en intens kamp i ${tournament}. ${winner} snuppede de tre point med ${winScore}-${loseScore}.`,
    },
  ]
  return pick(templates)
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}
