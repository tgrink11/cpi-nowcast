export function LoadingState() {
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4">
      <div className="relative">
        <div className="w-16 h-16 border-4 border-slate-200 border-t-blue-600 rounded-full animate-spin" />
      </div>
      <div className="text-center">
        <p className="text-lg font-medium text-slate-700">Loading CPI Data</p>
        <p className="text-sm text-slate-500 mt-1">
          Fetching from FRED and FMP APIs...
        </p>
      </div>
    </div>
  );
}
