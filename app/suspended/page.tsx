export default function SuspendedPage() {
  return (
    <div className="min-h-screen bg-[#F2EDE4] flex flex-col items-center justify-center p-8">
      <div className="max-w-md w-full bg-white rounded-2xl border border-black/8 p-8 text-center shadow-sm">
        <div className="w-16 h-16 rounded-full bg-amber-100 flex items-center justify-center mx-auto mb-6">
          <span className="text-3xl">⚠️</span>
        </div>
        <h1 className="font-['Playfair_Display'] text-2xl font-bold text-[#1a3329] mb-2">
          Din konto er midlertidigt suspenderet
        </h1>
        <p className="text-[#7a7060] text-sm leading-relaxed mb-6">
          Kontakt administratoren for at få genaktiveret din konto.
        </p>
        <a
          href="/login"
          className="inline-block text-[12px] font-semibold text-[#2C4A3E] hover:underline"
        >
          Tilbage til login
        </a>
      </div>
    </div>
  )
}
