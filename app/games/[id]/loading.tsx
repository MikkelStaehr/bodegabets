export default function GameRoomLoading() {
  return (
    <div className="min-h-screen bg-[#F2EDE4]">
      {/* Ticker placeholder */}
      <div className="h-[36px] bg-[#1a3329] w-full" />

      {/* Header — mørk grøn boks */}
      <div className="bg-[#1a3329] w-full px-6 py-8">
        <div className="max-w-[720px] mx-auto">
          {/* Spilnavn */}
          <div className="h-8 w-48 rounded bg-[#2C4A3E] animate-pulse mb-2" />
          {/* AKTIV badge */}
          <div className="h-5 w-16 rounded bg-[#2C4A3E] animate-pulse mb-6" />
          {/* Stats række */}
          <div className="flex gap-8">
            {[...Array(4)].map((_, i) => (
              <div key={i}>
                <div className="h-3 w-16 rounded bg-[#2C4A3E] animate-pulse mb-1" />
                <div className="h-6 w-10 rounded bg-[#2C4A3E] animate-pulse" />
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-[720px] mx-auto px-4 py-6 flex flex-col gap-4">

        {/* Kalender strip */}
        <div className="bg-white rounded-xl p-4">
          <div className="h-4 w-24 rounded bg-[#e5e0d8] animate-pulse mb-4" />
          <div className="flex gap-3 overflow-hidden">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="flex flex-col items-center gap-1 shrink-0">
                <div className="h-3 w-8 rounded bg-[#e5e0d8] animate-pulse" />
                <div className="w-10 h-10 rounded-full bg-[#e5e0d8] animate-pulse" />
                <div className="h-4 w-6 rounded bg-[#e5e0d8] animate-pulse" />
                <div className="h-3 w-8 rounded bg-[#e5e0d8] animate-pulse" />
              </div>
            ))}
          </div>
        </div>

        {/* Kampprogram boks */}
        <div className="bg-[#1a3329] rounded-xl overflow-hidden">
          <div className="px-4 py-3 flex justify-between items-center border-b border-white/10">
            <div className="h-4 w-32 rounded bg-[#2C4A3E] animate-pulse" />
            <div className="h-3 w-24 rounded bg-[#2C4A3E] animate-pulse" />
          </div>
          <div className="px-4 py-3 flex flex-col gap-3">
            {/* Dato separator */}
            <div className="h-3 w-28 rounded bg-[#2C4A3E] animate-pulse mx-auto" />
            {[...Array(3)].map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="w-5 h-5 rounded-full bg-[#2C4A3E] animate-pulse shrink-0" />
                <div className="h-4 w-28 rounded bg-[#2C4A3E] animate-pulse flex-1" />
                <div className="h-3 w-8 rounded bg-[#2C4A3E] animate-pulse" />
                <div className="h-4 w-28 rounded bg-[#2C4A3E] animate-pulse flex-1" />
                <div className="w-5 h-5 rounded-full bg-[#2C4A3E] animate-pulse shrink-0" />
                <div className="h-5 w-6 rounded bg-[#2C4A3E] animate-pulse" />
              </div>
            ))}
            {/* Dato separator */}
            <div className="h-3 w-28 rounded bg-[#2C4A3E] animate-pulse mx-auto mt-1" />
            {[...Array(4)].map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="w-5 h-5 rounded-full bg-[#2C4A3E] animate-pulse shrink-0" />
                <div className="h-4 w-28 rounded bg-[#2C4A3E] animate-pulse flex-1" />
                <div className="h-3 w-8 rounded bg-[#2C4A3E] animate-pulse" />
                <div className="h-4 w-28 rounded bg-[#2C4A3E] animate-pulse flex-1" />
                <div className="w-5 h-5 rounded-full bg-[#2C4A3E] animate-pulse shrink-0" />
                <div className="h-5 w-6 rounded bg-[#2C4A3E] animate-pulse" />
              </div>
            ))}
          </div>
        </div>

        {/* Aktive betting runder */}
        <div className="bg-white rounded-xl p-4">
          <div className="h-4 w-40 rounded bg-[#e5e0d8] animate-pulse mb-3" />
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-[#e5e0d8] animate-pulse shrink-0" />
            <div className="flex-1">
              <div className="h-4 w-24 rounded bg-[#e5e0d8] animate-pulse mb-1" />
              <div className="h-3 w-32 rounded bg-[#e5e0d8] animate-pulse" />
            </div>
            <div className="h-8 w-28 rounded bg-[#e5e0d8] animate-pulse" />
          </div>
        </div>

        {/* Leaderboard */}
        <div className="bg-white rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-black/10">
            <div className="h-4 w-28 rounded bg-[#e5e0d8] animate-pulse" />
          </div>
          {/* Header række */}
          <div className="flex items-center gap-3 px-4 py-2 border-b border-black/[0.06]">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-3 w-8 rounded bg-[#e5e0d8] animate-pulse" />
            ))}
          </div>
          {/* Bruger rækker */}
          {[...Array(4)].map((_, i) => (
            <div key={i} className="flex items-center gap-3 px-4 py-3 border-b border-black/[0.06]">
              <div className="h-4 w-4 rounded bg-[#e5e0d8] animate-pulse" />
              <div className="w-8 h-8 rounded-full bg-[#e5e0d8] animate-pulse" />
              <div className="h-4 w-24 rounded bg-[#e5e0d8] animate-pulse flex-1" />
              <div className="h-4 w-6 rounded bg-[#e5e0d8] animate-pulse" />
              <div className="h-4 w-6 rounded bg-[#e5e0d8] animate-pulse" />
              <div className="h-4 w-6 rounded bg-[#e5e0d8] animate-pulse" />
              <div className="h-4 w-10 rounded bg-[#e5e0d8] animate-pulse" />
            </div>
          ))}
        </div>

      </div>
    </div>
  )
}
