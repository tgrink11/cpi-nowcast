export function Header() {
  return (
    <header className="bg-white border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4">
        <div className="flex items-center justify-between">
          <img src="/logo.png" alt="Best of US Investors" className="h-[92px]" />
          <h1 className="text-xl font-bold text-slate-900">
            CPI Nowcast
          </h1>
        </div>
      </div>
    </header>
  );
}
