import { useId, useMemo, useState } from 'react'
import type { Series } from '../lib/types'

const SERIES_COLORS = ['var(--color-series-1)', 'var(--color-series-2)']

interface LineChartProps {
  series: Series[]
  /** Formats a y value for axis ticks, tooltips and the table view. */
  format?: (v: number) => string
  /** Log-scale y axis — for anything growing by doublings. */
  log?: boolean
  height?: number
  /** Force the y axis to start at zero (linear scale only). */
  zeroBased?: boolean
  yLabel?: string
}

const PAD = { t: 14, r: 14, b: 24, l: 44 }

export function LineChart({
  series,
  format = (v) => String(Math.round(v)),
  log = false,
  height = 190,
  zeroBased = true,
  yLabel,
}: LineChartProps) {
  const [hover, setHover] = useState<number | null>(null)
  const [showTable, setShowTable] = useState(false)
  const uid = useId()
  const W = 560
  const H = height

  const model = useMemo(() => {
    const all = series.flatMap((s) => s.points)
    const times = all.map((p) => new Date(p.t).getTime())
    const t0 = Math.min(...times)
    const t1 = Math.max(...times)
    const vals = all.map((p) => p.v)
    let vMin = Math.min(...vals)
    let vMax = Math.max(...vals)
    if (log) {
      vMin = Math.max(vMin, 1e-6)
    } else if (zeroBased) {
      vMin = Math.min(0, vMin)
    }
    const span = vMax - vMin || 1
    if (!log) {
      vMax += span * 0.08
      if (!zeroBased) vMin -= span * 0.08
    }

    const x = (t: string) =>
      PAD.l + ((new Date(t).getTime() - t0) / (t1 - t0 || 1)) * (W - PAD.l - PAD.r)
    const y = (v: number) => {
      const f = log
        ? (Math.log(Math.max(v, 1e-6)) - Math.log(vMin)) / (Math.log(vMax) - Math.log(vMin) || 1)
        : (v - vMin) / (vMax - vMin || 1)
      return H - PAD.b - f * (H - PAD.t - PAD.b)
    }

    const ticks = log
      ? logTicks(vMin, vMax)
      : Array.from({ length: 4 }, (_, i) => vMin + ((vMax - vMin) / 3) * i)

    return { x, y, t0, t1, ticks }
  }, [series, log, zeroBased, H])

  // Hover index is shared across series — they share an x domain by construction.
  const primary = series[0]
  const hoverPoint = hover != null ? primary.points[hover] : null

  const onMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const px = ((e.clientX - rect.left) / rect.width) * W
    let best = 0
    let bestD = Infinity
    primary.points.forEach((p, i) => {
      const d = Math.abs(model.x(p.t) - px)
      if (d < bestD) {
        bestD = d
        best = i
      }
    })
    setHover(best)
  }

  return (
    <figure className="m-0">
      {series.length > 1 && (
        <figcaption className="mb-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] text-[var(--color-ink-mute)]">
          {series.map((s, i) => (
            <span key={s.id} className="flex items-center gap-1.5">
              <span
                aria-hidden
                className="inline-block h-0.5 w-4"
                style={{ background: SERIES_COLORS[i] }}
              />
              {s.label}
            </span>
          ))}
        </figcaption>
      )}

      <div className="relative">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full touch-none"
          style={{ height }}
          onMouseMove={onMove}
          onMouseLeave={() => setHover(null)}
          role="img"
          aria-label={`${series.map((s) => s.label).join(' and ')} over time. ${
            showTable ? '' : 'Use the data table toggle below for exact values.'
          }`}
        >
          {/* Grid + y ticks */}
          {model.ticks.map((v, i) => (
            <g key={i}>
              <line
                x1={PAD.l}
                x2={W - PAD.r}
                y1={model.y(v)}
                y2={model.y(v)}
                stroke="var(--color-line)"
                strokeWidth={1}
              />
              <text
                x={PAD.l - 7}
                y={model.y(v) + 3}
                textAnchor="end"
                fontSize={9}
                fill="var(--color-ink-faint)"
              >
                {format(v)}
              </text>
            </g>
          ))}

          {/* x axis end labels only — no tick soup */}
          <text x={PAD.l} y={H - 7} fontSize={9} fill="var(--color-ink-faint)">
            {fmtDate(new Date(model.t0))}
          </text>
          <text
            x={W - PAD.r}
            y={H - 7}
            textAnchor="end"
            fontSize={9}
            fill="var(--color-ink-faint)"
          >
            {fmtDate(new Date(model.t1))}
          </text>

          {series.map((s, i) => {
            const d = s.points
              .map((p, j) => `${j === 0 ? 'M' : 'L'}${model.x(p.t)},${model.y(p.v)}`)
              .join(' ')
            const lastPt = s.points[s.points.length - 1]
            return (
              <g key={s.id}>
                <defs>
                  <linearGradient id={`${uid}-fill-${i}`} x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor={SERIES_COLORS[i]} stopOpacity={0.22} />
                    <stop offset="100%" stopColor={SERIES_COLORS[i]} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <path
                  d={`${d} L${model.x(lastPt.t)},${H - PAD.b} L${model.x(s.points[0].t)},${H - PAD.b} Z`}
                  fill={`url(#${uid}-fill-${i})`}
                />
                <path d={d} fill="none" stroke={SERIES_COLORS[i]} strokeWidth={2} />
                {/* Direct label on the final point — identity without relying on colour */}
                <circle
                  cx={model.x(lastPt.t)}
                  cy={model.y(lastPt.v)}
                  r={4}
                  fill={SERIES_COLORS[i]}
                  stroke="var(--color-surface)"
                  strokeWidth={2}
                />
              </g>
            )
          })}

          {/* Hover crosshair */}
          {hoverPoint && (
            <g pointerEvents="none">
              <line
                x1={model.x(hoverPoint.t)}
                x2={model.x(hoverPoint.t)}
                y1={PAD.t}
                y2={H - PAD.b}
                stroke="var(--color-phos)"
                strokeWidth={1}
                strokeDasharray="3 3"
                opacity={0.6}
              />
              {series.map((s, i) => {
                const p = s.points[hover!]
                if (!p) return null
                return (
                  <circle
                    key={s.id}
                    cx={model.x(p.t)}
                    cy={model.y(p.v)}
                    r={4.5}
                    fill={SERIES_COLORS[i]}
                    stroke="var(--color-surface)"
                    strokeWidth={2}
                  />
                )
              })}
            </g>
          )}
        </svg>

        {hoverPoint && (
          <div
            className="pointer-events-none absolute top-1 z-10 border border-[var(--color-line)] bg-[var(--color-raised)]/95 px-2 py-1.5 text-[10px] whitespace-nowrap"
            style={{
              left: `${(model.x(hoverPoint.t) / W) * 100}%`,
              transform:
                model.x(hoverPoint.t) > W * 0.6 ? 'translateX(-105%)' : 'translateX(8px)',
            }}
          >
            <div className="mb-1 text-[var(--color-ink-faint)]">{fmtDate(new Date(hoverPoint.t))}</div>
            {series.map((s, i) => (
              <div key={s.id} className="flex items-center gap-2">
                <span
                  aria-hidden
                  className="inline-block h-0.5 w-3 shrink-0"
                  style={{ background: SERIES_COLORS[i] }}
                />
                <span className="text-[var(--color-ink-mute)]">{s.label}</span>
                <span className="ml-auto text-[var(--color-ink)]">
                  {s.points[hover!] ? format(s.points[hover!].v) : '—'}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="mt-1.5 flex items-center gap-3 text-[9px] text-[var(--color-ink-faint)]">
        {yLabel && <span>{yLabel}</span>}
        <button
          type="button"
          onClick={() => setShowTable((s) => !s)}
          className="ml-auto tracking-[0.1em] uppercase hover:text-[var(--color-phos)]"
          aria-expanded={showTable}
        >
          {showTable ? '− hide' : '+ show'} data table
        </button>
      </div>

      {showTable && (
        <div className="mt-2 max-h-44 overflow-auto border border-[var(--color-line)]">
          <table className="w-full text-left text-[10px]">
            <thead className="sticky top-0 bg-[var(--color-raised)] text-[var(--color-ink-faint)]">
              <tr>
                <th scope="col" className="px-2 py-1 font-normal">date</th>
                {series.map((s) => (
                  <th key={s.id} scope="col" className="px-2 py-1 text-right font-normal">
                    {s.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="text-[var(--color-ink-mute)]">
              {primary.points.map((p, i) => (
                <tr key={p.t} className="border-t border-[var(--color-line)]">
                  <td className="px-2 py-1">{fmtDate(new Date(p.t))}</td>
                  {series.map((s) => (
                    <td key={s.id} className="px-2 py-1 text-right tabular-nums">
                      {s.points[i] ? format(s.points[i].v) : '—'}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </figure>
  )
}

function logTicks(min: number, max: number): number[] {
  const out: number[] = []
  const lo = Math.floor(Math.log10(min))
  const hi = Math.ceil(Math.log10(max))
  for (let e = lo; e <= hi; e++) {
    const v = 10 ** e
    if (v >= min && v <= max) out.push(v)
  }
  return out.length >= 2 ? out : [min, max]
}

export function fmtDate(d: Date): string {
  return d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
}
