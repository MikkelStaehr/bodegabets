/**
 * Email templates — pure HTML strings (ingen React-render dependency).
 * Branded med Bodega Bets farver + Playfair/Barlow fonts via system fallback.
 */

const BRAND_PRIMARY = '#1a3329'
const BRAND_GOLD = '#B8963E'
const BRAND_CREAM = '#F2EDE4'
const BRAND_TEXT = '#1a1a1a'
const BRAND_TEXT_MUTED = '#5C5C4A'

function emailLayout(content: string, preheader?: string): string {
  return `<!DOCTYPE html>
<html lang="da">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Bodega Bets</title>
</head>
<body style="margin:0;padding:0;background:${BRAND_CREAM};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:${BRAND_TEXT};">
${preheader ? `<div style="display:none;max-height:0;overflow:hidden;">${preheader}</div>` : ''}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BRAND_CREAM};">
  <tr>
    <td align="center" style="padding:40px 16px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#fff;border:1px solid #E5DFD2;border-radius:2px;">
        <tr>
          <td style="padding:32px 32px 16px;border-bottom:1px solid #E5DFD2;">
            <p style="margin:0;font-size:24px;font-weight:700;color:${BRAND_PRIMARY};letter-spacing:-0.01em;">
              bodega bets
            </p>
          </td>
        </tr>
        <tr>
          <td style="padding:32px;">
            ${content}
          </td>
        </tr>
        <tr>
          <td style="padding:24px 32px;border-top:1px solid #E5DFD2;background:#FBF8F2;">
            <p style="margin:0 0 8px;font-size:12px;color:${BRAND_TEXT_MUTED};">
              Du modtager denne mail fordi du har en konto på bodega-bets.com.
            </p>
            <p style="margin:0;font-size:12px;color:${BRAND_TEXT_MUTED};">
              <a href="https://bodega-bets.com/profile" style="color:${BRAND_PRIMARY};text-decoration:underline;">Indstillinger</a>
              &nbsp;·&nbsp;
              <a href="https://bodega-bets.com/faq" style="color:${BRAND_PRIMARY};text-decoration:underline;">FAQ</a>
              &nbsp;·&nbsp;
              <a href="mailto:hej@bodega-bets.com" style="color:${BRAND_PRIMARY};text-decoration:underline;">Kontakt</a>
            </p>
          </td>
        </tr>
      </table>
      <p style="margin:16px 0 0;font-size:11px;color:${BRAND_TEXT_MUTED};letter-spacing:0.04em;">
        Bodega Bets · Spil mod vennerne. Ingen rigtige penge.
      </p>
    </td>
  </tr>
</table>
</body>
</html>`
}

function button(href: string, label: string, color: 'primary' | 'gold' = 'primary'): string {
  const bg = color === 'gold' ? BRAND_GOLD : BRAND_PRIMARY
  return `<a href="${href}" style="display:inline-block;padding:12px 24px;background:${bg};color:${BRAND_CREAM};text-decoration:none;font-weight:700;font-size:13px;letter-spacing:0.08em;text-transform:uppercase;border-radius:2px;">${label}</a>`
}

// ─── Welcome email ──────────────────────────────────────────────────────────

export function welcomeEmail(args: { username: string }): { subject: string; html: string } {
  const content = `
    <h1 style="margin:0 0 16px;font-size:28px;font-weight:700;color:${BRAND_PRIMARY};">
      Velkommen, ${escapeHtml(args.username)}!
    </h1>
    <p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:${BRAND_TEXT};">
      Tak fordi du oprettede en konto på Bodega Bets. Du kan nu joine spilrum
      med dine venner og konkurrere om at samle flest point hen over sæsonen.
    </p>
    <p style="margin:0 0 32px;font-size:15px;line-height:1.6;color:${BRAND_TEXT};">
      Hop ind på dashboardet og opret dit første spilrum, eller join et
      eksisterende med en invitationskode.
    </p>
    <p style="margin:0 0 24px;">
      ${button('https://bodega-bets.com/dashboard', 'Til dashboard')}
    </p>
    <p style="margin:0;font-size:13px;color:${BRAND_TEXT_MUTED};line-height:1.5;">
      Husk: pointene er virtuelle, og platformen bruger aldrig rigtige penge.
    </p>
  `
  return {
    subject: `Velkommen til Bodega Bets, ${args.username}`,
    html: emailLayout(content, 'Tak fordi du oprettede en konto'),
  }
}

// ─── Archive warning (7 dage før gameroom afsluttes) ────────────────────────

export function archiveWarningEmail(args: {
  username: string
  gameName: string
  gameId: number
  daysUntilArchive: number
  isHost: boolean
}): { subject: string; html: string } {
  const content = `
    <h1 style="margin:0 0 16px;font-size:24px;font-weight:700;color:${BRAND_PRIMARY};">
      ${args.gameName} arkiveres snart
    </h1>
    <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:${BRAND_TEXT};">
      Hej ${escapeHtml(args.username)},
    </p>
    <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:${BRAND_TEXT};">
      Sidste løb i <strong>${escapeHtml(args.gameName)}</strong> er kørt.
      Spilrummet bliver automatisk arkiveret om <strong>${args.daysUntilArchive} dage</strong>
      hvis der ikke tilføjes flere løb.
    </p>
    ${args.isHost ? `
    <p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:${BRAND_TEXT};">
      Som spilrums-vært kan du tilføje nye løb og fortsætte konkurrencen — fx
      Tour de France, Vuelta'en eller efterårs-klassikerne.
    </p>
    <p style="margin:0 0 24px;">
      ${button(`https://bodega-bets.com/games/${args.gameId}/cycling/add-races`, 'Tilføj nye løb')}
    </p>
    ` : `
    <p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:${BRAND_TEXT};">
      Tjek dashboardet for at se slut-placeringen og din historik.
    </p>
    <p style="margin:0 0 24px;">
      ${button(`https://bodega-bets.com/games/${args.gameId}`, 'Til spilrummet')}
    </p>
    `}
    <p style="margin:0;font-size:13px;color:${BRAND_TEXT_MUTED};line-height:1.5;">
      Arkiverede spilrum forsvinder fra "Aktive spil" men kan stadig ses i historikken.
    </p>
  `
  return {
    subject: `${args.gameName} arkiveres om ${args.daysUntilArchive} dage`,
    html: emailLayout(content, `Sidste løb er kørt — ${args.daysUntilArchive} dage til arkivering`),
  }
}

// ─── Test email til admin ───────────────────────────────────────────────────

export function testEmail(args: { recipientEmail: string }): { subject: string; html: string } {
  const content = `
    <h1 style="margin:0 0 16px;font-size:24px;font-weight:700;color:${BRAND_PRIMARY};">
      Test-mail fra Bodega Bets
    </h1>
    <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:${BRAND_TEXT};">
      Hvis du modtager denne mail, virker email-opsætningen som forventet.
    </p>
    <ul style="margin:0 0 24px;padding-left:20px;font-size:14px;line-height:1.7;color:${BRAND_TEXT};">
      <li>Send via Resend SMTP ✓</li>
      <li>HTML rendering ✓</li>
      <li>Branding loadet ✓</li>
      <li>Modtaget af: ${escapeHtml(args.recipientEmail)}</li>
    </ul>
    <p style="margin:0;font-size:13px;color:${BRAND_TEXT_MUTED};">
      Sendt: ${new Date().toLocaleString('da-DK')}
    </p>
  `
  return {
    subject: 'Test-mail fra Bodega Bets',
    html: emailLayout(content),
  }
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}
