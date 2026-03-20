export default function GameRoomLoading() {
  return (
    <div className="min-h-screen bg-[#1a3329] flex flex-col items-center justify-center gap-6">
      <div className="flex flex-col items-center gap-4">
        <span
          className="font-['Playfair_Display'] text-[32px] font-bold text-[#F2EDE4] tracking-wide"
        >
          Bodega Bets
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
