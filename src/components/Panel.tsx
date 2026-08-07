import type { ReactNode } from 'react'

interface PanelProps {
  title: string
  /** Right-hand slot in the title bar — badges, toggles. */
  aside?: ReactNode
  children: ReactNode
  className?: string
}

export function Panel({ title, aside, children, className = '' }: PanelProps) {
  // min-w-0 keeps a wide child (e.g. the releases table) scrolling inside its own
  // container instead of stretching the grid track and the whole page with it.
  return (
    <section
      className={`bracket relative min-w-0 border border-[var(--color-line)] bg-[var(--color-surface)] ${className}`}
    >
      <header className="flex items-center gap-3 border-b border-[var(--color-line)] px-3 py-2">
        <span className="text-[var(--color-phos-dim)]" aria-hidden>
          ▸
        </span>
        <h2 className="text-[11px] tracking-[0.18em] text-[var(--color-phos)] uppercase">
          {title}
        </h2>
        <div className="h-px flex-1 bg-[var(--color-line)]" aria-hidden />
        {aside}
      </header>
      <div className="p-3 sm:p-4">{children}</div>
    </section>
  )
}

const BADGE = {
  live: { label: 'LIVE', cls: 'border-[var(--color-phos)]/45 text-[var(--color-phos)]' },
  mixed: { label: 'MIXED', cls: 'border-[var(--color-amber)]/45 text-[var(--color-amber)]' },
  seed: { label: 'SEED', cls: 'border-[var(--color-amber)]/45 text-[var(--color-amber)]' },
  cited: { label: 'CITED', cls: 'border-[var(--color-ink-mute)]/50 text-[var(--color-ink-mute)]' },
} as const

export function ProvenanceBadge({
  kind,
  asOf,
  source,
}: {
  kind: keyof typeof BADGE
  asOf: string
  source: string
}) {
  const b = BADGE[kind]
  return (
    <span
      title={`${source} · as of ${asOf}`}
      className={`shrink-0 border px-1.5 py-0.5 text-[9px] tracking-[0.14em] ${b.cls}`}
    >
      {b.label}
    </span>
  )
}

/** Per-chart attribution line — says where this specific series came from. */
export function SeriesSource({
  provenance = 'seed',
  source,
  sourceUrl,
}: {
  provenance?: 'live' | 'seed' | 'cited'
  source?: string
  sourceUrl?: string
}) {
  if (!source) return null
  const dot =
    provenance === 'live'
      ? 'var(--color-phos)'
      : provenance === 'cited'
        ? 'var(--color-ink-mute)'
        : 'var(--color-amber)'
  return (
    <p className="mt-1 flex items-center gap-1.5 text-[9px] text-[var(--color-ink-faint)]">
      <span aria-hidden className="inline-block h-1 w-1 rounded-full" style={{ background: dot }} />
      <span className="sr-only">
        {provenance === 'live' ? 'Live data. ' : provenance === 'cited' ? 'Cited data. ' : 'Seed data. '}
      </span>
      {sourceUrl ? (
        <a
          href={sourceUrl}
          target="_blank"
          rel="noreferrer noopener"
          className="underline decoration-dotted underline-offset-2 hover:text-[var(--color-phos)]"
        >
          {source}
        </a>
      ) : (
        source
      )}
    </p>
  )
}
