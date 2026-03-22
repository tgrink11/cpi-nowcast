import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  Legend,
} from 'recharts';
import type { CpiChartPoint } from '../types/cpiNowcast';
import { formatPercent } from '../utils/formatPercent';

interface Props {
  data: CpiChartPoint[];
}

export function CpiChart({ data }: Props) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
      <h2 className="text-lg font-semibold text-slate-900 mb-1">
        CPI YoY: Actual vs Model vs Projection
      </h2>
      <p className="text-sm text-slate-500 mb-4">
        36-month backtest with 6-month forward projection
      </p>
      <div className="h-72 md:h-96">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 11, fill: '#64748b' }}
              tickLine={false}
              interval="preserveStartEnd"
              angle={-45}
              textAnchor="end"
              height={60}
            />
            <YAxis
              tickFormatter={(v: number) => `${v.toFixed(1)}%`}
              tick={{ fontSize: 12, fill: '#64748b' }}
              tickLine={false}
              axisLine={false}
              domain={['auto', 'auto']}
            />
            <Tooltip
              content={({ active, payload, label }) => {
                if (!active || !payload?.length) return null;
                const point = payload[0]?.payload as CpiChartPoint;
                return (
                  <div className="bg-white p-3 rounded-lg shadow-lg border border-slate-200 text-sm">
                    <p className="font-semibold text-slate-700 mb-1">{label}</p>
                    {point.actualYoY != null && (
                      <p className="text-blue-600">
                        Actual: {formatPercent(point.actualYoY)}
                      </p>
                    )}
                    {point.modelYoY != null && (
                      <p className="text-slate-500">
                        Model: {formatPercent(point.modelYoY)}
                      </p>
                    )}
                    {point.projectedYoY != null && (
                      <p className="text-orange-600">
                        Projected: {formatPercent(point.projectedYoY)}
                      </p>
                    )}
                  </div>
                );
              }}
            />
            <ReferenceLine
              y={2}
              stroke="#94a3b8"
              strokeDasharray="8 4"
              label={{
                value: 'Fed Target 2%',
                position: 'insideTopRight',
                fill: '#94a3b8',
                fontSize: 11,
              }}
            />
            <Legend verticalAlign="top" height={36} />

            {/* Projection shaded area */}
            <Area
              type="monotone"
              dataKey="projectedYoY"
              fill="#fb923c"
              fillOpacity={0.15}
              stroke="none"
              name="Projection Range"
              connectNulls={false}
            />

            {/* Actual CPI YoY - solid blue */}
            <Line
              type="monotone"
              dataKey="actualYoY"
              stroke="#2563eb"
              strokeWidth={2.5}
              dot={false}
              name="Actual CPI YoY"
              connectNulls
            />

            {/* Model backtest - dashed gray */}
            <Line
              type="monotone"
              dataKey="modelYoY"
              stroke="#94a3b8"
              strokeWidth={1.5}
              strokeDasharray="6 3"
              dot={false}
              name="Model Nowcast"
              connectNulls
            />

            {/* Projection line - dotted orange */}
            <Line
              type="monotone"
              dataKey="projectedYoY"
              stroke="#ea580c"
              strokeWidth={2}
              strokeDasharray="4 4"
              dot={{ r: 3, fill: '#ea580c' }}
              name="Projected"
              connectNulls={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
