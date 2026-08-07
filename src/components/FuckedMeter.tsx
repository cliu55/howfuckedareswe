import type { DoomResult } from '../lib/doom'
import { verdict } from '../lib/doom'

const TONE_HEX: Record<string, string> = {
  ok: 'var(--color-phos)',
  warn: 'var(--color-amber)',
  bad: 'var(--color-amber)',
  crit: 'var(--color-crit)',
}

/**
 * The dial is the countdown as a percentage — share of the runway (ChatGPT
 * launch → projected doom date) already behind us. It moves when the sliders
 * move and reads exactly 100 when the clock reads zero.
 *
 * Below it, the evidence: the empirical blend of today's indicators. That one
 * deliberately does NOT respond to sliders — measurements don't care about
 * your model settings — and the copy says so.
 */
export function FuckedMeter({ doom }: { doom: DoomResult }) {
  const v = verdict(doom.fuckedScore)
  const color = TONE_HEX[v.tone]

  // Semicircular arc, 180° sweep.
  const R = 78
  const CX = 100
  const CY = 96
  const arcLen = Math.PI * R
  const filled = (doom.fuckedScore / 100) * arcLen

  return (
    <div className="flex flex-col items-center">
      <svg
        viewBox="0 0 200 118"
        className="w-full max-w-[260px]"
        role="img"
        aria-label={`Doom progress ${doom.fuckedScore} out of 100 — ${v.label}. Evidence blend today: ${doom.evidenceScore}.`}
      >
        <path
          d={`M ${CX - R} ${CY} A ${R} ${R} 0 0 1 ${CX + R} ${CY}`}
          fill="none"
          stroke="var(--color-line)"
          strokeWidth={10}
        />
        <path
          d={`M ${CX - R} ${CY} A ${R} ${R} 0 0 1 ${CX + R} ${CY}`}
          fill="none"
          stroke={color}
          strokeWidth={10}
          strokeLinecap="butt"
          strokeDasharray={`${filled} ${arcLen}`}
          style={{ transition: 'stroke-dasharray 600ms ease, stroke 400ms ease' }}
        />
        {/* Tick marks every 25 */}
        {[0, 25, 50, 75, 100].map((p) => {
          const a = Math.PI - (p / 100) * Math.PI
          const x1 = CX + Math.cos(a) * (R - 9)
          const y1 = CY - Math.sin(a) * (R - 9)
          const x2 = CX + Math.cos(a) * (R + 9)
          const y2 = CY - Math.sin(a) * (R + 9)
          return (
            <line key={p} x1={x1} y1={y1} x2={x2} y2={y2} stroke="var(--color-void)" strokeWidth={2} />
          )
        })}
        <text
          x={CX}
          y={CY - 16}
          textAnchor="middle"
          fontSize={44}
          fontWeight="700"
          fill={color}
          className="tabular-nums"
        >
          {doom.fuckedScore}
        </text>
        <text x={CX} y={CY + 4} textAnchor="middle" fontSize={10} fill="var(--color-ink-faint)">
          % FUCKED
        </text>
      </svg>

      <div className="mt-1 text-center">
        <div className="text-[13px] font-bold tracking-[0.14em]" style={{ color }}>
          {v.label}
        </div>
        <p className="mt-1.5 max-w-[34ch] text-[11px] leading-relaxed text-[var(--color-ink-mute)]">
          {v.blurb}
        </p>
      </div>

      <p className="mt-3 w-full border-t border-[var(--color-line)] pt-3 text-[10px] leading-relaxed text-[var(--color-ink-mute)]">
        The dial is the countdown as a percentage: how much of the runway from ChatGPT&rsquo;s
        launch to your projected doom date is already gone. Drag the sliders and it moves;
        when the clock hits zero it reads 100.
      </p>

      <div className="mt-4 w-full">
        <div className="flex items-baseline justify-between border-b border-[var(--color-line)] pb-2">
          <h3 className="text-[10px] tracking-[0.14em] text-[var(--color-ink-mute)]">
            THE EVIDENCE TODAY
          </h3>
          <span className="tabular-nums text-[13px] text-[var(--color-ink)]">
            {doom.evidenceScore}%
          </span>
        </div>
        <dl className="mt-3 space-y-2.5">
          {doom.components.map((c) => (
            <div key={c.label}>
              <div className="flex items-baseline justify-between gap-2 text-[10px]">
                <dt className="text-[var(--color-ink-mute)]">{c.label}</dt>
                <dd className="tabular-nums text-[var(--color-ink)]">
                  {(c.value * 100).toFixed(0)}%
                  <span className="ml-1.5 text-[var(--color-ink-faint)]">×{c.weight}</span>
                </dd>
              </div>
              <div className="mt-1 h-1 w-full bg-[var(--color-line)]">
                <div
                  className="h-full transition-[width] duration-500"
                  style={{ width: `${c.value * 100}%`, background: color, opacity: 0.55 + c.weight }}
                />
              </div>
              <p className="mt-1 text-[9px] leading-snug text-[var(--color-ink-faint)]">{c.detail}</p>
            </div>
          ))}
        </dl>
        <p className="mt-2 text-[9px] leading-snug text-[var(--color-ink-faint)]">
          Measured today, from the data panels below. Sliders don&rsquo;t move these —
          settings can&rsquo;t rewrite measurements.
        </p>
      </div>
    </div>
  )
}
