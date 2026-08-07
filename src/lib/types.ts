/**
 * Shared domain types.
 *
 * Every dataset carries `provenance` so the UI can be honest about where a
 * number came from. Today everything ships as `seed` (hand-curated, illustrative
 * figures). When a real feed is wired up behind the adapter in `sources.ts`, the
 * same records come back as `live` and the UI badge changes on its own.
 */

/**
 * `seed`  — hand-curated placeholder, not real.
 * `live`  — fetched from a source, build-time or runtime.
 * `cited` — real published figures transcribed by hand from an annual report.
 *           Not a feed, but not invented either; refreshed when the publisher
 *           publishes.
 */
export type Provenance = 'seed' | 'live' | 'cited'

export interface Sourced<T> {
  provenance: Provenance
  /** ISO date the underlying figures were last true / last fetched. */
  asOf: string
  /** Human-readable origin, shown in the UI. */
  source: string
  data: T
}

/** A single (date, value) observation. */
export interface Point {
  /** ISO date, YYYY-MM-DD. */
  t: string
  v: number
}

export interface Series {
  id: string
  label: string
  unit: string
  points: Point[]
  /**
   * Per-series, because a dataset is often part live and part seed — the job
   * market panel pulls real Indeed indices but still uses seed unemployment.
   * Defaults to the parent dataset's provenance when absent.
   */
  provenance?: Provenance
  source?: string
  sourceUrl?: string
}

export interface Euphemism {
  id: string
  /** The phrase, as a genre. Deliberately not attributed to any company. */
  phrase: string
  /** What it means in English. */
  translation: string
}

export interface NewsItem {
  id: string
  headline: string
  outlet: string
  date: string
  category: 'ai' | 'jobs' | 'copium'
  /** Impact on the doom index, -1 (good for humans) .. +1 (bad for humans). */
  sentiment: number
  url?: string
}

export interface JobMarketStats {
  /** Indeed-style postings index, 100 = Feb 2020 baseline. */
  postingsIndex: Series
  /** Same index for all jobs, as a control series. */
  postingsIndexAllJobs: Series
  /**
   * Unemployment rate, %. Live source is the BLS *information industry* rate —
   * there is no BLS series for software engineers specifically, so this is the
   * closest public proxy and is labelled as such in the UI.
   */
  unemploymentRate: Series
  /** Headcount in computer systems design & related services, thousands. */
  techEmployment?: Series
  /** JOLTS job openings, information sector, thousands. */
  jobOpenings?: Series
  /** JOLTS layoffs and discharges, information sector, thousands per month. */
  layoffsDischarges?: Series
  /**
   * Share of HN "Who is hiring?" posts mentioning "junior", 0..1. The nearest
   * measurable thing to an entry-level postings share; the doom model consumes
   * it normalised to its own 2019 baseline, so only the trend matters.
   */
  juniorShare: Series
  /** Same threads, "senior" — the contrast series. */
  seniorShare?: Series
  /** Real competition stats, computed from FRED + JOLTS at a matched month. */
  competition?: {
    /** Info-industry unemployed (12-mo avg, thousands) per info-sector opening. */
    unemployedPerOpening: number
    /** Median weeks unemployed, all workers (UEMPMED). */
    medianWeeksUnemployed: number
    asOf: string
  }
}

export interface AiProgress {
  sweBench: Series
  /** Log-scale: 50%-success task length in hours over time. */
  timeHorizon: Series
  /**
   * Share of NEW code that is AI-generated, 0..1. Cited from Google's
   * earnings-call statements — one company, their definition. Feeds the doom
   * model's AI_AUTHORED_CODE component.
   */
  aiAuthoredCodeShare: Series
  /** Aider's per-release git-blame of its own code — measured, single project. */
  aiAuthoredMeasured?: Series
  /**
   * Share of job postings that mention AI. A demand-side signal — deliberately
   * NOT the same thing as aiAuthoredCodeShare, and not fed into the doom model.
   */
  aiPostingShare?: Series
  /** Highest-scoring official SWE-bench Verified submissions, live. */
  topRuns?: { slug: string; date: string; score: number }[]
  /**
   * METR's own fitted doubling time for the horizon, in months. When present
   * this sets the doom model's default instead of a hand-picked prior.
   */
  horizonDoubling?: {
    months: number | null
    ciLowMonths: number | null
    ciHighMonths: number | null
    allTimeMonths: number | null
  }
  /** Stack Overflow question volume, indexed to 2019 = 100. */
  devQuestions?: Series
  /** Non-technical Stack Exchange control, same index. */
  devQuestionsControl?: Series
}

/** One published survey figure, with its prior-year value where stated. */
export interface SentimentStat {
  id: string
  /** Percentage, 0-100. */
  value: number
  label: string
  /** The same figure a year earlier, when the publisher reported one. */
  prev?: { value: number; year: string }
  /** Extra published context, shown small. */
  note?: string
  /**
   * What this figure — and its movement — means for engineers. Deliberately not
   * a boolean on the value's direction: "64% believe AI is not a threat" is
   * ominous because it FELL, while "84% use AI tools" is ominous because it
   * ROSE. Only the reading is consistent, so the reading is what we store.
   */
  tone: 'ominous' | 'reassuring'
}

export interface Dataset {
  ai: Sourced<AiProgress>
  jobs: Sourced<JobMarketStats>
  euphemisms: Sourced<Euphemism[]>
  sentiment: Sourced<SentimentStat[]>
  news: Sourced<NewsItem[]>
}
