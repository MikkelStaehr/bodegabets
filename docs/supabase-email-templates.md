# Supabase Auth Email Templates — Bodega Bets

Klar til paste i **Supabase Dashboard** → projekt `vm-bet` →
**Authentication** → **Emails** → **Templates**.

For hver template:
1. Vælg template-typen i dropdown (Confirm signup / Reset password)
2. Sæt **Subject** (jeg har skrevet et forslag)
3. Paste HTML-blokken nedenunder i body
4. Klik **Save**

Bemærk: Supabase bruger Go-template syntaks `{{ .Variable }}` —
eksempelvis `{{ .ConfirmationURL }}` der erstattes ved send-tid.

---

## 1. Confirm signup

**Subject**:
```
Bekræft din email — Bodega Bets
```

**Body (HTML)**:
```html
<!DOCTYPE html>
<html lang="da">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Bekræft din email</title>
</head>
<body style="margin:0;padding:0;background:#F2EDE4;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#1a1a1a;">
<div style="display:none;max-height:0;overflow:hidden;">Bekræft din email-adresse for at aktivere din Bodega Bets konto</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F2EDE4;">
  <tr>
    <td align="center" style="padding:40px 16px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#fff;border:1px solid #E5DFD2;border-radius:2px;">
        <tr>
          <td style="padding:32px 32px 16px;border-bottom:1px solid #E5DFD2;">
            <p style="margin:0;font-size:24px;font-weight:700;color:#1a3329;letter-spacing:-0.01em;">
              bodega bets
            </p>
          </td>
        </tr>
        <tr>
          <td style="padding:32px;">
            <p style="margin:0 0 4px;font-size:11px;letter-spacing:0.14em;text-transform:uppercase;color:#7a7060;font-weight:600;">
              Næsten færdig
            </p>
            <h1 style="margin:0 0 16px;font-size:28px;font-weight:700;color:#1a3329;letter-spacing:-0.01em;line-height:1.1;">
              Bekræft din email
            </h1>
            <p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#1a1a1a;">
              Tak fordi du oprettede en konto på Bodega Bets. Klik på knappen
              herunder for at bekræfte din email-adresse og aktivere din konto.
            </p>
            <p style="margin:0 0 32px;">
              <a href="{{ .ConfirmationURL }}" style="display:inline-block;padding:14px 28px;background:#1a3329;color:#F2EDE4;text-decoration:none;font-weight:700;font-size:13px;letter-spacing:0.08em;text-transform:uppercase;border-radius:2px;">
                Bekræft email
              </a>
            </p>
            <p style="margin:0 0 16px;font-size:13px;line-height:1.5;color:#5C5C4A;">
              Eller kopiér linket til din browser:
            </p>
            <p style="margin:0 0 24px;font-size:12px;line-height:1.5;color:#1a3329;word-break:break-all;background:#F8F5ED;padding:12px;border-radius:2px;border:1px solid #E5DFD2;">
              {{ .ConfirmationURL }}
            </p>
            <p style="margin:0;font-size:13px;line-height:1.5;color:#7a7060;border-top:1px solid #E5DFD2;padding-top:16px;">
              Linket virker i 24 timer. Hvis du ikke oprettede en konto,
              kan du bare ignorere denne mail.
            </p>
          </td>
        </tr>
        <tr>
          <td style="padding:24px 32px;border-top:1px solid #E5DFD2;background:#FBF8F2;">
            <p style="margin:0 0 8px;font-size:12px;color:#5C5C4A;">
              Du modtager denne mail fordi du har oprettet en konto på bodega-bets.com.
            </p>
            <p style="margin:0;font-size:12px;color:#5C5C4A;">
              <a href="https://bodega-bets.com/faq" style="color:#1a3329;text-decoration:underline;">FAQ</a>
              &nbsp;·&nbsp;
              <a href="mailto:hej@bodega-bets.com" style="color:#1a3329;text-decoration:underline;">Kontakt</a>
              &nbsp;·&nbsp;
              <a href="https://bodega-bets.com/privatlivspolitik" style="color:#1a3329;text-decoration:underline;">Privatliv</a>
            </p>
          </td>
        </tr>
      </table>
      <p style="margin:16px 0 0;font-size:11px;color:#5C5C4A;letter-spacing:0.04em;">
        Bodega Bets · Spil mod vennerne. Ingen rigtige penge.
      </p>
    </td>
  </tr>
</table>
</body>
</html>
```

---

## 2. Reset password

**Subject**:
```
Nulstil din adgangskode — Bodega Bets
```

**Body (HTML)**:
```html
<!DOCTYPE html>
<html lang="da">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Nulstil din adgangskode</title>
</head>
<body style="margin:0;padding:0;background:#F2EDE4;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#1a1a1a;">
<div style="display:none;max-height:0;overflow:hidden;">Nulstil din adgangskode på Bodega Bets</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F2EDE4;">
  <tr>
    <td align="center" style="padding:40px 16px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#fff;border:1px solid #E5DFD2;border-radius:2px;">
        <tr>
          <td style="padding:32px 32px 16px;border-bottom:1px solid #E5DFD2;">
            <p style="margin:0;font-size:24px;font-weight:700;color:#1a3329;letter-spacing:-0.01em;">
              bodega bets
            </p>
          </td>
        </tr>
        <tr>
          <td style="padding:32px;">
            <p style="margin:0 0 4px;font-size:11px;letter-spacing:0.14em;text-transform:uppercase;color:#7a7060;font-weight:600;">
              Adgangskode
            </p>
            <h1 style="margin:0 0 16px;font-size:28px;font-weight:700;color:#1a3329;letter-spacing:-0.01em;line-height:1.1;">
              Nulstil din adgangskode
            </h1>
            <p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#1a1a1a;">
              Vi har modtaget en anmodning om at nulstille adgangskoden til
              din Bodega Bets konto. Klik på knappen herunder for at vælge
              en ny.
            </p>
            <p style="margin:0 0 32px;">
              <a href="{{ .ConfirmationURL }}" style="display:inline-block;padding:14px 28px;background:#1a3329;color:#F2EDE4;text-decoration:none;font-weight:700;font-size:13px;letter-spacing:0.08em;text-transform:uppercase;border-radius:2px;">
                Vælg ny adgangskode
              </a>
            </p>
            <p style="margin:0 0 16px;font-size:13px;line-height:1.5;color:#5C5C4A;">
              Eller kopiér linket til din browser:
            </p>
            <p style="margin:0 0 24px;font-size:12px;line-height:1.5;color:#1a3329;word-break:break-all;background:#F8F5ED;padding:12px;border-radius:2px;border:1px solid #E5DFD2;">
              {{ .ConfirmationURL }}
            </p>
            <p style="margin:0;font-size:13px;line-height:1.5;color:#7a7060;border-top:1px solid #E5DFD2;padding-top:16px;">
              Linket virker i 1 time. Har du ikke selv anmodet om at nulstille
              din adgangskode, kan du ignorere denne mail — din konto er sikker.
            </p>
          </td>
        </tr>
        <tr>
          <td style="padding:24px 32px;border-top:1px solid #E5DFD2;background:#FBF8F2;">
            <p style="margin:0 0 8px;font-size:12px;color:#5C5C4A;">
              Du modtager denne mail fordi nogen anmodede om at nulstille
              adgangskoden til kontoen knyttet til denne email.
            </p>
            <p style="margin:0;font-size:12px;color:#5C5C4A;">
              <a href="https://bodega-bets.com/faq" style="color:#1a3329;text-decoration:underline;">FAQ</a>
              &nbsp;·&nbsp;
              <a href="mailto:hej@bodega-bets.com" style="color:#1a3329;text-decoration:underline;">Kontakt</a>
              &nbsp;·&nbsp;
              <a href="https://bodega-bets.com/privatlivspolitik" style="color:#1a3329;text-decoration:underline;">Privatliv</a>
            </p>
          </td>
        </tr>
      </table>
      <p style="margin:16px 0 0;font-size:11px;color:#5C5C4A;letter-spacing:0.04em;">
        Bodega Bets · Spil mod vennerne. Ingen rigtige penge.
      </p>
    </td>
  </tr>
</table>
</body>
</html>
```

---

## 3. (Bonus) Magic link / passwordless login

Hvis du senere aktiverer magic link login, brug denne template:

**Subject**:
```
Dit login-link til Bodega Bets
```

**Body**: Samme struktur — bare skift heading til "Log ind med ét klik"
og knaptekst til "Log ind". Sig til hvis du vil have den fuld klar.

---

## Test-checklist når DNS er verified

- [ ] DNS records grøn ✅ i Resend dashboard
- [ ] Custom SMTP enabled i Supabase med `no-reply@bodega-bets.com`
- [ ] Confirm signup template pasted + saved
- [ ] Reset password template pasted + saved
- [ ] Test 1: opret en testkonto med rigtig email → modtag bekræftelse
- [ ] Test 2: anmod password reset på samme konto → modtag mail
- [ ] Test 3: kald `/api/admin/email-test` for app-niveau test

---

## Sender-adresser

| Type | Adresse | Anvendelse |
|---|---|---|
| Auth-mails (Supabase) | `no-reply@bodega-bets.com` | Confirm, reset, magic link |
| App-mails (Resend direkte) | `no-reply@bodega-bets.com` | Welcome, archive warning, reminders |
| Reply-to / kontakt | `hej@bodega-bets.com` | User support |
