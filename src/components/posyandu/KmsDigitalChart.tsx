import React from 'react';
import { ToddlerRecord } from '../../types/posyandu';
import { generateWhoGrowthCurves } from '../../utils/whoZScoreCalculator';
import { AlertTriangle, CheckCircle2, Info, TrendingUp } from 'lucide-react';

interface KmsDigitalChartProps {
  toddler: ToddlerRecord;
}

export const KmsDigitalChart: React.FC<KmsDigitalChartProps> = ({ toddler }) => {
  const whoCurves = generateWhoGrowthCurves(toddler.gender);

  // Measurements sorted by age
  const sortedMeasurements = [...toddler.measurements].sort((a, b) => a.ageInMonths - b.ageInMonths);
  const latestMeasure = sortedMeasurements[sortedMeasurements.length - 1];

  // SVG Chart Dimensions
  const svgWidth = 720;
  const svgHeight = 360;
  const paddingLeft = 55;
  const paddingRight = 30;
  const paddingTop = 30;
  const paddingBottom = 45;

  const chartInnerWidth = svgWidth - paddingLeft - paddingRight;
  const chartInnerHeight = svgHeight - paddingTop - paddingBottom;

  const minMonth = 0;
  const maxMonth = 60;
  const minHeight = 40; // cm
  const maxHeight = 120; // cm

  // Map age month to SVG X coordinate
  const mapX = (month: number) => {
    const ratio = (month - minMonth) / (maxMonth - minMonth);
    return paddingLeft + ratio * chartInnerWidth;
  };

  // Map height cm to SVG Y coordinate (inverted)
  const mapY = (heightCm: number) => {
    const ratio = (heightCm - minHeight) / (maxHeight - minHeight);
    return paddingTop + (1 - ratio) * chartInnerHeight;
  };

  // Build SVG polyline paths for WHO standard curves
  const minus3SdPath = whoCurves.map((p) => `${mapX(p.month)},${mapY(p.minus3Sd)}`).join(' L ');
  const minus2SdPath = whoCurves.map((p) => `${mapX(p.month)},${mapY(p.minus2Sd)}`).join(' L ');
  const medianPath = whoCurves.map((p) => `${mapX(p.month)},${mapY(p.median)}`).join(' L ');
  const plus2SdPath = whoCurves.map((p) => `${mapX(p.month)},${mapY(p.plus2Sd)}`).join(' L ');

  // Actual toddler growth path
  const actualPath = sortedMeasurements.map((m) => `${mapX(m.ageInMonths)},${mapY(m.heightCm)}`).join(' L ');

  return (
    <div className="bg-white rounded-3xl border border-slate-200 p-5 sm:p-6 shadow-sm space-y-6">
      {/* Header Info Balita */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-emerald-100 text-emerald-800">
              KMS Digital Balita
            </span>
            <span className="text-xs font-mono text-slate-500">{toddler.kmsCardNumber}</span>
          </div>
          <h3 className="text-xl font-extrabold text-slate-900 mt-1">
            {toddler.name} ({toddler.gender === 'L' ? 'Laki-laki' : 'Perempuan'})
          </h3>
          <p className="text-xs text-slate-600 mt-0.5">
            Tgl Lahir: <span className="font-semibold">{toddler.birthDate}</span> • Orang Tua: <span className="font-semibold">{toddler.parentName}</span> • Dusun: <span className="font-semibold">{toddler.dusunName}</span>
          </p>
        </div>

        {latestMeasure && (
          <div className="flex items-center gap-3">
            <div className={`p-3 rounded-2xl border text-right ${
              latestMeasure.stuntingCategory === 'Severely Stunted'
                ? 'bg-rose-50 border-rose-300 text-rose-900'
                : latestMeasure.stuntingCategory === 'Stunted'
                ? 'bg-amber-50 border-amber-300 text-amber-900'
                : 'bg-emerald-50 border-emerald-300 text-emerald-900'
            }`}>
              <div className="text-[10px] font-bold uppercase tracking-wider">Status Gizi (TB/U)</div>
              <div className="text-sm font-extrabold flex items-center justify-end gap-1">
                {latestMeasure.stuntingCategory === 'Severely Stunted' || latestMeasure.stuntingCategory === 'Stunted' ? (
                  <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
                ) : (
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                )}
                <span>{latestMeasure.overallStatus}</span>
              </div>
              <div className="text-[11px] font-mono mt-0.5">
                TB: {latestMeasure.heightCm} cm • BB: {latestMeasure.weightKg} kg (Z-Score: {latestMeasure.zScoreHeightForAge})
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Interactive Visual KMS Chart */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-bold text-slate-800 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-emerald-700" />
            <span>Grafik Pertumbuhan Panjang/Tinggi Badan (Standar WHO 0 - 60 Bulan)</span>
          </h4>
          <div className="flex items-center gap-3 text-[11px]">
            <span className="flex items-center gap-1 text-rose-600 font-medium">
              <span className="w-3 h-0.5 bg-rose-500 rounded" /> -3 SD (Stunting Berat)
            </span>
            <span className="flex items-center gap-1 text-amber-600 font-medium">
              <span className="w-3 h-0.5 bg-amber-500 rounded" /> -2 SD (Stunting)
            </span>
            <span className="flex items-center gap-1 text-emerald-700 font-bold">
              <span className="w-3 h-0.5 bg-emerald-600 rounded" /> Median WHO
            </span>
            <span className="flex items-center gap-1 text-blue-600 font-bold">
              <span className="w-3 rounded-full h-3 bg-blue-600" /> Hasil Timbang
            </span>
          </div>
        </div>

        <div className="w-full overflow-x-auto bg-slate-50/80 rounded-2xl p-2 border border-slate-200">
          <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} className="w-full min-w-[600px] h-auto font-sans">
            {/* Background Grid Lines & Y-Axis Labels */}
            {[40, 50, 60, 70, 80, 90, 100, 110, 120].map((h) => {
              const y = mapY(h);
              return (
                <g key={h}>
                  <line x1={paddingLeft} y1={y} x2={svgWidth - paddingRight} y2={y} stroke="#e2e8f0" strokeDasharray="3 3" />
                  <text x={paddingLeft - 8} y={y + 4} textAnchor="end" fontSize="10" fill="#64748b" className="font-mono font-medium">
                    {h} cm
                  </text>
                </g>
              );
            })}

            {/* X-Axis Labels (Age in Months) */}
            {[0, 6, 12, 18, 24, 30, 36, 42, 48, 54, 60].map((m) => {
              const x = mapX(m);
              return (
                <g key={m}>
                  <line x1={x} y1={paddingTop} x2={x} y2={svgHeight - paddingBottom} stroke="#f1f5f9" />
                  <text x={x} y={svgHeight - paddingBottom + 16} textAnchor="middle" fontSize="10" fill="#64748b" className="font-mono font-bold">
                    {m} bln
                  </text>
                </g>
              );
            })}

            {/* WHO Curve Area Fill (-3SD to -2SD Warning Area) */}
            <path
              d={`M ${minus3SdPath} L ${whoCurves.slice().reverse().map((p) => `${mapX(p.month)},${mapY(p.minus2Sd)}`).join(' L ')} Z`}
              fill="#fef3c7"
              opacity="0.6"
            />

            {/* WHO Curve Area Fill (< -3SD Danger Area) */}
            <path
              d={`M ${minus3SdPath} L ${whoCurves[whoCurves.length - 1] ? mapX(whoCurves[whoCurves.length - 1].month) : 0},${mapY(40)} L ${mapX(0)},${mapY(40)} Z`}
              fill="#ffe4e6"
              opacity="0.5"
            />

            {/* Standard WHO Lines */}
            <path d={`M ${minus3SdPath}`} fill="none" stroke="#f43f5e" strokeWidth="1.8" strokeDasharray="4 3" />
            <path d={`M ${minus2SdPath}`} fill="none" stroke="#f59e0b" strokeWidth="1.8" strokeDasharray="4 3" />
            <path d={`M ${medianPath}`} fill="none" stroke="#059669" strokeWidth="2.2" />
            <path d={`M ${plus2SdPath}`} fill="none" stroke="#10b981" strokeWidth="1.5" strokeDasharray="4 3" />

            {/* Actual Measurement Line */}
            {sortedMeasurements.length > 1 && (
              <path d={`M ${actualPath}`} fill="none" stroke="#2563eb" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
            )}

            {/* Actual Measurement Data Points */}
            {sortedMeasurements.map((m) => {
              const cx = mapX(m.ageInMonths);
              const cy = mapY(m.heightCm);
              const isStunted = m.stuntingCategory === 'Severely Stunted' || m.stuntingCategory === 'Stunted';

              return (
                <g key={m.id} className="cursor-pointer group">
                  <circle
                    cx={cx}
                    cy={cy}
                    r="6"
                    fill={isStunted ? '#e11d48' : '#2563eb'}
                    stroke="#ffffff"
                    strokeWidth="2"
                    className="transition-transform group-hover:scale-125"
                  />
                  <text x={cx} y={cy - 10} textAnchor="middle" fontSize="10" fontWeight="bold" fill={isStunted ? '#be123c' : '#1d4ed8'}>
                    {m.heightCm} cm
                  </text>
                </g>
              );
            })}
          </svg>
        </div>
      </div>

      {/* History Table Penimbangan Bulanan */}
      <div className="space-y-3 pt-2">
        <h4 className="text-sm font-bold text-slate-800 flex items-center justify-between">
          <span>Riwayat Penimbangan & Pengukuran Posyandu</span>
          <span className="text-xs text-slate-500 font-normal">Total {sortedMeasurements.length} kali penimbangan</span>
        </h4>

        <div className="overflow-x-auto rounded-2xl border border-slate-200">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-100/80 text-slate-700 font-bold border-b border-slate-200">
                <th className="py-2.5 px-3">Tgl Timbang</th>
                <th className="py-2.5 px-3">Usia</th>
                <th className="py-2.5 px-3">BB (kg)</th>
                <th className="py-2.5 px-3">TB (cm)</th>
                <th className="py-2.5 px-3">LK (cm)</th>
                <th className="py-2.5 px-3">Z-Score TB/U</th>
                <th className="py-2.5 px-3">Status Stunting</th>
                <th className="py-2.5 px-3">Vitamin & Imunisasi</th>
                <th className="py-2.5 px-3">Petugas</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-slate-800">
              {sortedMeasurements.map((m) => (
                <tr key={m.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="py-2.5 px-3 font-semibold">{m.measurementDate}</td>
                  <td className="py-2.5 px-3">{m.ageInMonths} Bln</td>
                  <td className="py-2.5 px-3 font-bold">{m.weightKg} kg</td>
                  <td className="py-2.5 px-3 font-bold text-blue-700">{m.heightCm} cm</td>
                  <td className="py-2.5 px-3">{m.headCircumferenceCm} cm</td>
                  <td className="py-2.5 px-3 font-mono font-bold">
                    <span className={m.zScoreHeightForAge < -2 ? 'text-rose-600' : 'text-emerald-700'}>
                      {m.zScoreHeightForAge > 0 ? `+${m.zScoreHeightForAge}` : m.zScoreHeightForAge} SD
                    </span>
                  </td>
                  <td className="py-2.5 px-3">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold inline-block ${
                      m.stuntingCategory === 'Severely Stunted'
                        ? 'bg-rose-100 text-rose-800 border border-rose-300'
                        : m.stuntingCategory === 'Stunted'
                        ? 'bg-amber-100 text-amber-800 border border-amber-300'
                        : 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                    }`}>
                      {m.stuntingCategory}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-[11px] text-slate-600">
                    {m.vitA ? 'Vit A ✓' : ''} {m.deworming ? '• Cacing ✓' : ''} ({m.immunizationStatus})
                  </td>
                  <td className="py-2.5 px-3 text-slate-600 text-[11px]">{m.measuredBy || 'Kader'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
