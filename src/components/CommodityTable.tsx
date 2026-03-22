import type { CommodityInputs } from '../types/cpiNowcast';
import { formatPercent } from '../utils/formatPercent';

interface Props {
  commodityInputs: CommodityInputs;
}

export function CommodityTable({ commodityInputs }: Props) {
  const rows = [
    { name: 'Brent Crude Oil', yoy: commodityInputs.brentCrudeYoY, weight: '35%' },
    { name: 'CRB / PPI Commodities', yoy: commodityInputs.crbIndexYoY, weight: '30%' },
    { name: 'FAO Food Price Index', yoy: commodityInputs.faoFoodPriceYoY, weight: '35%' },
  ];

  const signalColor =
    commodityInputs.signalDirection === 'inflationary'
      ? 'text-red-600'
      : commodityInputs.signalDirection === 'deflationary'
        ? 'text-green-600'
        : 'text-slate-600';

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
      <h3 className="text-lg font-semibold text-slate-900 mb-3">
        Commodity Price Inputs
      </h3>

      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200">
            <th className="text-left py-2 text-slate-500 font-medium">Commodity</th>
            <th className="text-right py-2 text-slate-500 font-medium">Weight</th>
            <th className="text-right py-2 text-slate-500 font-medium">YoY Change</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.name} className="border-b border-slate-100">
              <td className="py-2 text-slate-700">{row.name}</td>
              <td className="py-2 text-right text-slate-500">{row.weight}</td>
              <td
                className={`py-2 text-right font-medium ${
                  row.yoy != null && row.yoy > 0
                    ? 'text-red-600'
                    : row.yoy != null && row.yoy < 0
                      ? 'text-green-600'
                      : 'text-slate-500'
                }`}
              >
                {row.yoy != null ? formatPercent(row.yoy) : 'N/A'}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-slate-200">
            <td className="py-2 font-semibold text-slate-900">Composite Signal</td>
            <td />
            <td className={`py-2 text-right font-bold ${signalColor}`}>
              {formatPercent(commodityInputs.compositeSignal)}
            </td>
          </tr>
        </tfoot>
      </table>

      <p className="text-xs text-slate-500 mt-3">
        Direction:{' '}
        <span className={`font-medium ${signalColor}`}>
          {commodityInputs.signalDirection}
        </span>
        {' '}&middot; Positive = inflationary pressure, Negative = deflationary
      </p>
    </div>
  );
}
