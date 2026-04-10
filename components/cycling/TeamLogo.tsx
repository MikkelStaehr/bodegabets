export default function TeamLogo({ url, team }: { url: string | null; team: string }) {
  if (url) {
    return <img src={url} alt={team} style={{ width: 20, height: 20, objectFit: 'contain', flexShrink: 0 }} />
  }
  return (
    <div style={{
      width: 20, height: 20, borderRadius: 2, background: '#2B4F7A',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: 8, fontWeight: 700, color: '#8FABC4', flexShrink: 0,
    }}>
      {team.slice(0, 2).toUpperCase()}
    </div>
  )
}
