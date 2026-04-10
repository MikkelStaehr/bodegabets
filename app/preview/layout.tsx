export default function PreviewLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="da">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body style={{ margin: 0, padding: 0, background: '#EDE8DF' }}>
        {children}
      </body>
    </html>
  )
}
