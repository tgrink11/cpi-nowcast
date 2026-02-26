export function Header() {
  return (
    <header className="bg-white border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <img src="/logo.png" alt="Best of US Investors" className="h-10" />
            <div>
              <h1 className="text-xl font-bold text-slate-900">
                Retirement Calculator
              </h1>
              <p className="text-sm text-slate-500">Realistic aging-adjusted projections</p>
            </div>
          </div>
          <span className="text-xs text-slate-400 bg-slate-100 px-2 py-1 rounded-full">
            Free Tool
          </span>
        </div>
      </div>
    </header>
  );
}
