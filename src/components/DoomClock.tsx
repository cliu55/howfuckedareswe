import { useEffect, useState } from 'react'

interface DoomClockProps {
  target: Date
  tone: 'ok' | 'warn' | 'bad' | 'crit'
}

const TONE_CLASS: Record<DoomClockProps['tone'], string> = {
  ok: 'text-[var(--color-phos)] glow',
  warn: 'text-[var(--color-amber)] glow-amber',
  bad: 'text-[var(--color-amber)] glow-amber',
  crit: 'text-[var(--color-crit)] glow-crit',
}

function breakdown(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000))
  return {
    years: Math.floor(s / 31_557_600),
    days: Math.floor((s % 31_557_600) / 86_400),
    hours: Math.floor((s % 86_400) / 3600),
    mins: Math.floor((s % 3600) / 60),
    secs: s % 60,
  }
}

export function DoomClock({ target, tone }: DoomClockProps) {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])

  const b = breakdown(target.getTime() - now)
  const units: [string, number, number][] = [
    ['YRS', b.years, 2],
    ['DAYS', b.days, 3],
    ['HRS', b.hours, 2],
    ['MIN', b.mins, 2],
    ['SEC', b.secs, 2],
  ]

  return (
    <div>
      {/* Grid on small screens so the units wrap in even rows; a single flex row
          with separators once there is width for it. */}
      <div className="grid grid-cols-3 gap-x-2 gap-y-4 sm:flex sm:items-end sm:gap-x-3">
        {units.map(([label, value, pad], i) => (
          <div key={label} className="flex items-end gap-2 sm:gap-3">
            <div className="text-center sm:text-left">
              <div
                className={`flicker tabular-nums ${TONE_CLASS[tone]} text-[clamp(1.9rem,7.5vw,4.2rem)] leading-none font-bold`}
              >
                {String(value).padStart(pad, '0')}
              </div>
              <div className="mt-1.5 text-[9px] tracking-[0.25em] text-[var(--color-ink-faint)]">
                {label}
              </div>
            </div>
            {i < units.length - 1 && (
              <span
                aria-hidden
                className="hidden pb-6 text-[clamp(1.2rem,4vw,2rem)] leading-none text-[var(--color-ink-faint)] sm:inline"
              >
                :
              </span>
            )}
          </div>
        ))}
      </div>
      <p className="sr-only">
        Projected time until total software engineering obsolescence: {b.years} years,{' '}
        {b.days} days, {b.hours} hours, {b.mins} minutes, {b.secs} seconds.
      </p>
    </div>
  )
}
