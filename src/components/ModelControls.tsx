import type { DoomParams, DoomResult } from '../lib/doom'
import { PARAM_BOUNDS, fmtHours } from '../lib/doom'

interface ControlsProps {
  params: DoomParams
  onChange: (p: DoomParams) => void
  doom: DoomResult
  /** Dataset-derived defaults, so "reset" returns to METR's figure. */
  defaults: DoomParams
  /** METR's published CI for the doubling time, when available. */
  doublingNote?: string
}

const FIELDS: {
  key: keyof DoomParams
  label: string
  help: string
  fmt: (v: number) => string
}[] = [
  {
    key: 'doublingMonths',
    label: 'CAPABILITY DOUBLING',
    help: 'Months for an agent’s unsupervised task length to double. Lower = faster apocalypse.',
    fmt: (v) => `${v} mo`,
  },
  {
    key: 'targetHorizonHours',
    label: 'REPLACEMENT THRESHOLD',
    help: 'How long an agent must work unsupervised before it can hold the whole job.',
    fmt: (v) => fmtHours(v),
  },
  {
    key: 'adoptionLagMonths',
    label: 'ENTERPRISE INERTIA',
    help: 'Months between “capability exists” and “procurement approves it”.',
    fmt: (v) => `${v} mo`,
  },
  {
    key: 'automationCeiling',
    label: 'AUTOMATION CEILING',
    help: 'Share of engineering work that is ever automated. The rest is meetings.',
    fmt: (v) => `${(v * 100).toFixed(0)}%`,
  },
  {
    key: 'marketPressure',
    label: 'MARKET PANIC',
    help: 'How much a collapsing job market accelerates adoption. 0 = employers are calm.',
    fmt: (v) => `${v.toFixed(2)}×`,
  },
]

export function ModelControls({ params, onChange, doom, defaults, doublingNote }: ControlsProps) {
  const set = (k: keyof DoomParams, v: number) => onChange({ ...params, [k]: v })
  const dirty = FIELDS.some((f) => params[f.key] !== defaults[f.key])

  return (
    <div>
      <p className="mb-4 text-[11px] leading-relaxed text-[var(--color-ink-mute)]">
        The countdown is not a vibe — it is arithmetic over five assumptions. Disagree with
        one? Move it. The clock recomputes as you drag.
      </p>

      <div className="space-y-4">
        {FIELDS.map((f) => {
          const b = PARAM_BOUNDS[f.key]
          const id = `param-${f.key}`
          return (
            <div key={f.key}>
              <div className="flex items-baseline justify-between gap-2">
                <label htmlFor={id} className="text-[10px] tracking-[0.1em] text-[var(--color-ink-mute)]">
                  {f.label}
                </label>
                <output htmlFor={id} className="tabular-nums text-[11px] text-[var(--color-phos)]">
                  {f.fmt(params[f.key])}
                </output>
              </div>
              <input
                id={id}
                type="range"
                min={b.min}
                max={b.max}
                step={b.step}
                value={params[f.key]}
                onChange={(e) => set(f.key, Number(e.target.value))}
                className="mt-2 w-full"
                aria-describedby={`${id}-help`}
              />
              <p id={`${id}-help`} className="mt-1 text-[9px] leading-snug text-[var(--color-ink-faint)]">
                {f.help}
                {f.key === 'doublingMonths' && doublingNote && (
                  <span className="text-[var(--color-phos-dim)]"> {doublingNote}</span>
                )}
              </p>
            </div>
          )
        })}
      </div>

      <button
        type="button"
        onClick={() => onChange(defaults)}
        disabled={!dirty}
        className="mt-4 w-full border border-[var(--color-line)] px-3 py-1.5 text-[10px] tracking-[0.12em] text-[var(--color-ink-mute)] transition-colors hover:border-[var(--color-phos-dim)] hover:text-[var(--color-phos)] disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:border-[var(--color-line)] disabled:hover:text-[var(--color-ink-mute)]"
      >
        RESET TO MEASURED DOOM
      </button>

      <details className="mt-4 border-t border-[var(--color-line)] pt-3">
        <summary className="cursor-pointer text-[10px] tracking-[0.12em] text-[var(--color-ink-mute)] hover:text-[var(--color-phos)]">
          SHOW YOUR WORK
        </summary>
        <pre className="mt-2 overflow-x-auto text-[9.5px] leading-relaxed text-[var(--color-ink-faint)]">
          {doom.workings.join('\n')}
        </pre>
      </details>
    </div>
  )
}
