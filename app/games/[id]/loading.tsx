import HideNav from '@/components/layout/HideNav'

export default function GameRoomLoading() {
  return (
    <div className="fixed inset-0 z-[300] bg-[#1a3329] flex flex-col items-center justify-center gap-6">
      <HideNav />
      <div className="flex flex-col items-center gap-4">
        <span
          style={{ display: 'inline-flex', alignItems: 'baseline', lineHeight: 1, whiteSpace: 'nowrap' }}
        >
          <span style={{ fontFamily: "var(--font-lobster), 'Lobster', cursive", fontSize: 'clamp(48px, 12vw, 96px)', color: '#F2EDE4', marginRight: '-4px' }}>B</span>
          <span style={{ fontFamily: "var(--font-pacifico), 'Pacifico', cursive", fontSize: 'clamp(24px, 6vw, 48px)', color: '#F2EDE4' }}>odega</span>
          <span style={{ display: 'inline-block', width: 'clamp(4px, 1vw, 8px)' }} />
          <span style={{ fontFamily: "var(--font-lobster), 'Lobster', cursive", fontSize: 'clamp(48px, 12vw, 96px)', color: '#F2EDE4', marginRight: '-4px' }}>B</span>
          <span style={{ fontFamily: "var(--font-pacifico), 'Pacifico', cursive", fontSize: 'clamp(24px, 6vw, 48px)', color: '#F2EDE4' }}>ets</span>
        </span>
        <span
          className="font-['Barlow_Condensed'] text-[13px] font-bold tracking-widest uppercase text-[#B8963E]"
        >
          Indlæser spilrum...
        </span>
      </div>
      <div className="w-48 h-[2px] bg-[#2C4A3E] rounded overflow-hidden">
        <div className="h-full bg-[#B8963E] rounded animate-[loading_1.2s_ease-in-out_infinite]" />
      </div>
      <style>{`
        @keyframes loading {
          0% { width: 0%; margin-left: 0%; }
          50% { width: 60%; margin-left: 20%; }
          100% { width: 0%; margin-left: 100%; }
        }
      `}</style>
    </div>
  )
}
