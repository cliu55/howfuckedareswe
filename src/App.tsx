import { useEffect, useMemo, useState } from 'react'
import { loadDataset, seedSeries } from './lib/sources'
import { computeDoom, defaultParams, verdict } from './lib/doom'
import type { DoomParams } from './lib/doom'
import type { Dataset } from './lib/types'
import { DoomClock } from './components/DoomClock'
import { DoomAnimation } from './components/DoomAnimation'
import { FuckedMeter } from './components/FuckedMeter'
import { ModelControls } from './components/ModelControls'
import { Panel } from './components/Panel'
import { AiPanel, JobsPanel, LayoffsPanel, NewsPanel } from './components/Panels'

export default function App() {
  const [ds, setDs] = useState<Dataset | null>(null)
  // Defaults come from the data (METR's fitted doubling time), so they can't be
  // set until the dataset lands.
  const [params, setParams] = useState<DoomParams | null>(null)

  useEffect(() => {
    loadDataset().then((d) => {
      setDs(d)
      setParams((p) => p ?? defaultParams(d))
    })
  }, [])

  const doom = useMemo(() => (ds && params ? computeDoom(ds, params) : null), [ds, params])

  if (!ds || !doom || !params) return <Booting />

  const hd = ds.ai.data.horizonDoubling
  const doublingNote =
    hd?.months != null
      ? `METR measure ${hd.months} mo since 2023` +
        (hd.ciLowMonths != null && hd.ciHighMonths != null
          ? ` (CI ${hd.ciLowMonths}–${hd.ciHighMonths})`
          : '') +
        (hd.allTimeMonths != null ? `, ${hd.allTimeMonths} mo all-time.` : '.')
      : undefined

  const v = verdict(doom.fuckedScore)
  const doomDateStr = doom.doomDate.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  return (
    <div className="relative z-10 mx-auto max-w-6xl px-4 pb-16 sm:px-6">
      <Header />
      <Ticker ds={ds} />

      {/* ── HERO ─────────────────────────────────────────────────────────── */}
      <section className="mt-6">
        <div className="bracket border border-[var(--color-line)] bg-[var(--color-surface)] p-4 sm:p-6">
          <p className="text-[10px] tracking-[0.22em] text-[var(--color-ink-faint)]">
            TIME UNTIL TOTAL SOFTWARE ENGINEERING OBSOLESCENCE
          </p>
          <div className="mt-4">
            <DoomClock target={doom.doomDate} tone={v.tone} />
          </div>
          <p className="mt-5 border-t border-[var(--color-line)] pt-4 text-[11px] leading-relaxed text-[var(--color-ink-mute)]">
            Projected obsolescence:{' '}
            <span className="text-[var(--color-phos)]">{doomDateStr}</span>. Capability
            threshold crossed{' '}
            <span className="text-[var(--color-ink)]">
              {doom.capabilityDate.toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
              })}
            </span>
            ; the rest is procurement.{' '}
            <span className="text-[var(--color-ink-faint)]">
              ({doom.doublingsNeeded.toFixed(1)} capability doublings remaining.)
            </span>
          </p>
        </div>
      </section>

      {/* ── METER + ANIMATION + CONTROLS ─────────────────────────────────── */}
      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Panel title="Fucked-o-meter">
          <FuckedMeter doom={doom} />
        </Panel>

        <div className="flex flex-col gap-4 lg:col-span-2">
          <Panel title="Live simulation" className="flex-1">
            <DoomAnimation score={doom.fuckedScore} />
          </Panel>
          <Panel title="Tune your own apocalypse">
            <ModelControls
              params={params}
              onChange={setParams}
              doom={doom}
              defaults={defaultParams(ds)}
              doublingNote={doublingNote}
            />
          </Panel>
        </div>
      </div>

      {/* ── DATA PANELS ──────────────────────────────────────────────────── */}
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <AiPanel ds={ds} />
        <JobsPanel ds={ds} />
        <LayoffsPanel ds={ds} />
        <NewsPanel ds={ds} />
      </div>

      <Footer stillSeed={seedSeries(ds)} />
    </div>
  )
}

function Header() {
  return (
    <header className="pt-8 sm:pt-12">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[clamp(1.4rem,5.5vw,2.4rem)] leading-none font-bold tracking-tight">
            <span className="text-[var(--color-ink-faint)]">how</span>
            <span className="text-[var(--color-crit)] glow-crit">fucked</span>
            <span className="text-[var(--color-ink-faint)]">are</span>
            <span className="text-[var(--color-phos)] glow">swe</span>
            <span className="cursor" aria-hidden />
          </h1>
          <p className="mt-2 text-[11px] text-[var(--color-ink-mute)]">
            A dashboard for watching your own profession implode from a safe distance.
          </p>
        </div>
        <div className="flex items-center gap-2 text-[9px] tracking-[0.14em] text-[var(--color-ink-faint)]">
          <span className="relative flex h-1.5 w-1.5" aria-hidden>
            <span
              className="absolute inline-flex h-full w-full rounded-full bg-[var(--color-phos)]"
              style={{ animation: 'pulse-ring 1.8s ease-out infinite' }}
            />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[var(--color-phos)]" />
          </span>
          MONITORING
        </div>
      </div>
      <div className="mt-5 h-px bg-gradient-to-r from-[var(--color-phos-dim)] via-[var(--color-line)] to-transparent" />
    </header>
  )
}

function Ticker({ ds }: { ds: Dataset }) {
  const items = ds.news.data.map((n) => n.headline)
  const line = items.join('   ///   ')
  return (
    <div className="mt-4 overflow-hidden border-y border-[var(--color-line)] bg-[var(--color-surface)] py-1.5">
      <div className="flex w-max marquee-track">
        {[0, 1].map((k) => (
          <span
            key={k}
            aria-hidden={k === 1}
            className="px-4 text-[10px] whitespace-nowrap text-[var(--color-ink-mute)]"
          >
            {line}   ///{' '}
          </span>
        ))}
      </div>
    </div>
  )
}

function Booting() {
  return (
    <div className="relative z-10 flex min-h-dvh items-center justify-center p-6">
      <pre className="text-[11px] leading-relaxed text-[var(--color-phos)]">
        {`> initialising doom subsystem...
> loading benchmark telemetry...
> auditing job market...`}
        <span className="cursor" />
      </pre>
    </div>
  )
}

function Footer({ stillSeed }: { stillSeed: string[] }) {
  return (
    <footer className="mt-10 border-t border-[var(--color-line)] pt-5 text-[10px] leading-relaxed text-[var(--color-ink-faint)]">
      <p className="mb-3 border border-[var(--color-line)] bg-[var(--color-raised)]/60 p-3">
        <strong className="font-bold text-[var(--color-phos)]">LIVE:</strong>{' '}
        <span className="text-[var(--color-ink-mute)]">
          job postings and AI-mention share from{' '}
          <a
            href="https://github.com/hiring-lab/job_postings_tracker"
            target="_blank"
            rel="noreferrer noopener"
            className="underline decoration-dotted underline-offset-2 hover:text-[var(--color-phos)]"
          >
            Indeed Hiring Lab
          </a>
          , the SWE-bench Verified frontier from{' '}
          <a
            href="https://github.com/SWE-bench/experiments"
            target="_blank"
            rel="noreferrer noopener"
            className="underline decoration-dotted underline-offset-2 hover:text-[var(--color-phos)]"
          >
            official submissions
          </a>
          , labour series from{' '}
          <a
            href="https://fred.stlouisfed.org"
            target="_blank"
            rel="noreferrer noopener"
            className="underline decoration-dotted underline-offset-2 hover:text-[var(--color-phos)]"
          >
            BLS via FRED
          </a>
          , the autonomous task horizon from{' '}
          <a
            href="https://metr.org/time-horizons/"
            target="_blank"
            rel="noreferrer noopener"
            className="underline decoration-dotted underline-offset-2 hover:text-[var(--color-phos)]"
          >
            METR
          </a>
          , labour turnover from{' '}
          <a
            href="https://www.bls.gov/jlt/"
            target="_blank"
            rel="noreferrer noopener"
            className="underline decoration-dotted underline-offset-2 hover:text-[var(--color-phos)]"
          >
            BLS JOLTS
          </a>
          , question volume from the{' '}
          <a
            href="https://api.stackexchange.com"
            target="_blank"
            rel="noreferrer noopener"
            className="underline decoration-dotted underline-offset-2 hover:text-[var(--color-phos)]"
          >
            Stack Exchange API
          </a>
          , junior-vs-senior demand from HN hiring threads, headlines from Hacker News.
        </span>
      </p>
      {stillSeed.length === 0 && (
        <p className="mb-3 border border-[var(--color-line)] bg-[var(--color-raised)]/60 p-3 text-[var(--color-ink-mute)]">
          <strong className="font-bold text-[var(--color-phos)]">NO SEED DATA.</strong>{' '}
          Every series and stat on this page is fetched, computed, cited or measured — the
          per-chart source dots say which. The only hand-written content left is the
          satire, and it claims nothing.
        </p>
      )}
      {stillSeed.length > 0 && (
        <p className="mb-3 border border-[var(--color-amber)]/35 bg-[var(--color-amber)]/5 p-3 text-[var(--color-amber)]">
          <strong className="font-bold">STILL SEED:</strong> {stillSeed.join(', ')}. These
          are hand-curated placeholders with no public source. Everything else on this page
          is fetched, computed, cited or measured.
        </p>
      )}
      <p>
        howfuckedareswe is satire. It is not career advice, financial advice, or a reason to
        do anything drastic. If the number worries you, remember it is computed from five
        sliders you can drag yourself.
      </p>
      <p className="mt-2">
        Built with entirely too much confidence. No engineers were replaced in the making of
        this dashboard.
      </p>
    </footer>
  )
}
