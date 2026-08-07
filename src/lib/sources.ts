/**
 * Data source adapters.
 *
 * Everything the dashboard renders comes through `loadDataset()`. Each adapter
 * composes the best available data for its slice and marks provenance honestly,
 * per-series where a dataset is mixed.
 *
 * Three tiers, in order of preference:
 *
 *   1. BUILD-TIME LIVE — `src/data/generated/*.json`, written by
 *      `npm run fetch-data`. Used for anything large or CORS-blocked.
 *   2. RUNTIME LIVE — `lib/live.ts`, for small CORS-open keyless endpoints.
 *      Fails soft to seed.
 *   3. SEED — `src/data/*.ts`, hand-curated placeholders. Still used for the
 *      three things with no reputable free feed (see README).
 */

import type {
  AiProgress,
  Dataset,
  JobMarketStats,
  Euphemism,
  SentimentStat,
  NewsItem,
  Point,
  Provenance,
  Series,
  Sourced,
} from './types'
import { googleAiCodeShare } from '../data/ai'
import { euphemisms as euphemismSeed } from '../data/jobs'
import { news as newsSeed } from '../data/news'
import survey from '../data/generated/survey.json'
import { fetchHackerNews } from './live'

import jobPostings from '../data/generated/jobPostings.json'
import aiPostings from '../data/generated/aiPostings.json'
import sweBench from '../data/generated/sweBench.json'
import metr from '../data/generated/metr.json'
import aider from '../data/generated/aider.json'
import fred from '../data/generated/fred.json'
import bls from '../data/generated/bls.json'
import stackOverflow from '../data/generated/stackOverflow.json'
import hnHiring from '../data/generated/hnHiring.json'

export type Adapter<T> = () => Promise<Sourced<T>>

const INDEED_URL = 'https://github.com/hiring-lab/job_postings_tracker'
const SWEBENCH_URL = 'https://github.com/SWE-bench/experiments'
const FRED_URL = 'https://fred.stlouisfed.org/series'

const live = (
  s: Omit<Series, 'provenance'>,
  source: string,
  sourceUrl: string,
): Series => ({ ...s, provenance: 'live', source, sourceUrl })

/**
 * Roll per-series provenance up to a single badge for the panel header.
 *
 * The badge's job is to flag INVENTED data. A panel mixing live and cited
 * series is all-real, so it reads LIVE (each chart's own source line still
 * distinguishes cited from fetched); MIXED means seed data is present.
 */
export function mixOf(series: (Series | undefined)[]): Provenance | 'mixed' {
  const present = series.filter((s): s is Series => !!s)
  const kinds = new Set(present.map((s) => s.provenance ?? 'seed'))
  if (kinds.has('seed')) return kinds.size > 1 ? 'mixed' : 'seed'
  return 'live'
}

// ── AI progress ────────────────────────────────────────────────────────────
/**
 * SWE-bench Verified is live (official leaderboard frontier).
 * The METR-style time horizon and AI-authored code share stay seed: METR does
 * not publish the computed horizons as a small dataset, and "% of code written
 * by AI" only exists as press statements, not a feed.
 */
export const aiAdapter: Adapter<AiProgress> = async () => {
  const sweBenchSeries = live(
    {
      id: 'swebench',
      label: 'SWE-bench Verified',
      unit: '% resolved',
      points: sweBench.frontier as Point[],
    },
    sweBench.source,
    SWEBENCH_URL,
  )

  const aiPostingShare = live(
    {
      id: 'ai-postings',
      label: 'US postings mentioning AI',
      unit: '% of postings',
      points: aiPostings.points as Point[],
    },
    aiPostings.source,
    aiPostings.url,
  )

  return {
    provenance: 'live',
    asOf: metr.asOf > sweBench.asOf ? metr.asOf : sweBench.asOf,
    source: `${metr.source}; SWE-bench; Indeed Hiring Lab; Stack Exchange`,
    data: {
      sweBench: sweBenchSeries,
      aiPostingShare,
      topRuns: sweBench.top,
      devQuestions: live(
        {
          id: 'so-questions',
          label: 'Stack Overflow',
          unit: 'index (2019 = 100)',
          points: stackOverflow.stackOverflow as Point[],
        },
        stackOverflow.source,
        'https://api.stackexchange.com',
      ),
      devQuestionsControl: live(
        {
          id: 'so-control',
          label: stackOverflow.controlLabel,
          unit: 'index (2019 = 100)',
          points: stackOverflow.control as Point[],
        },
        stackOverflow.source,
        'https://api.stackexchange.com',
      ),
      timeHorizon: live(
        {
          id: 'horizon',
          label: '50% task time horizon',
          unit: 'hours',
          points: metr.frontier as Point[],
        },
        metr.source,
        metr.url,
      ),
      horizonDoubling: {
        months: metr.doubling.fromRecent.months,
        ciLowMonths: metr.doubling.fromRecent.ciLowMonths,
        ciHighMonths: metr.doubling.fromRecent.ciHighMonths,
        allTimeMonths: metr.doubling.allTimeMonths,
      },
      // Cited, not fetched: earnings-call statements have no API. The dates
      // and quotes live in data/ai.ts; the doom model reads this series.
      aiAuthoredCodeShare: googleAiCodeShare,
      aiAuthoredMeasured: live(
        {
          id: 'aicode-aider',
          label: "Aider's own code written by aider",
          unit: '% per release',
          points: aider.points as Point[],
        },
        aider.source,
        aider.url,
      ),
    },
  }
}

// ── Job market ─────────────────────────────────────────────────────────────
/** Postings indices are live from Indeed; unemployment and junior share are not. */
export const jobsAdapter: Adapter<JobMarketStats> = async () => {
  return {
    provenance: 'live',
    asOf: jobPostings.asOf,
    source: `${jobPostings.source}; ${fred.source}; ${bls.source}`,
    data: {
      competition: competitionStats(),
      postingsIndex: live(
        {
          id: 'postings-swe',
          label: 'Software dev postings',
          unit: 'index (Feb 2020 = 100)',
          points: jobPostings.softwareDev as Point[],
        },
        jobPostings.source,
        INDEED_URL,
      ),
      postingsIndexAllJobs: live(
        {
          id: 'postings-all',
          label: 'All job postings',
          unit: 'index (Feb 2020 = 100)',
          points: jobPostings.allJobs as Point[],
        },
        jobPostings.source,
        INDEED_URL,
      ),
      unemploymentRate: live(
        {
          id: 'unemp-info',
          label: 'Information industry unemployment (12-mo avg)',
          unit: '%',
          points: fred.unemployment as Point[],
        },
        `${fred.source} · ${fred.unemploymentSeriesId} — information industry, the closest public proxy for SWEs`,
        `${FRED_URL}/${fred.unemploymentSeriesId}`,
      ),
      techEmployment: live(
        {
          id: 'tech-employment',
          label: 'Computer systems design employment',
          unit: 'thousands',
          points: fred.techEmployment as Point[],
        },
        `${fred.source} · ${fred.techEmploymentSeriesId}`,
        `${FRED_URL}/${fred.techEmploymentSeriesId}`,
      ),
      jobOpenings: live(
        {
          id: 'jolts-openings',
          label: 'Information sector job openings',
          unit: 'thousands',
          points: bls.jobOpenings as Point[],
        },
        `${bls.source} · ${bls.jobOpeningsSeriesId}`,
        bls.url,
      ),
      layoffsDischarges: live(
        {
          id: 'jolts-layoffs',
          label: 'Layoffs & discharges',
          unit: 'thousands / month',
          points: bls.layoffsDischarges as Point[],
        },
        `${bls.source} · ${bls.layoffsSeriesId}`,
        bls.url,
      ),
      juniorShare: live(
        {
          id: 'hn-junior',
          label: '“junior”',
          unit: 'share of posts',
          points: hnHiring.juniorShare as Point[],
        },
        hnHiring.source,
        hnHiring.url,
      ),
      seniorShare: live(
        {
          id: 'hn-senior',
          label: '“senior”',
          unit: 'share of posts',
          points: hnHiring.seniorShare as Point[],
        },
        hnHiring.source,
        hnHiring.url,
      ),
    },
  }
}

/**
 * Competition tiles, computed from series we already fetch, at a matched month.
 * The unemployment level is NSA, so it is averaged over the trailing 12 months
 * before dividing by the (seasonally adjusted) JOLTS openings figure.
 */
function competitionStats() {
  const openings = new Map((bls.jobOpenings as Point[]).map((p) => [p.t.slice(0, 7), p.v]))
  const level = fred.unemploymentLevel as Point[]
  const matched = level.filter((p) => openings.has(p.t.slice(0, 7)))
  if (matched.length < 12) return undefined
  const last12 = matched.slice(-12)
  const avgLevel = last12.reduce((a, p) => a + p.v, 0) / last12.length
  const asOf = last12[last12.length - 1].t
  const opening = openings.get(asOf.slice(0, 7))
  const weeks = (fred.medianWeeksUnemployed as Point[]).at(-1)
  if (!opening || !weeks) return undefined
  return {
    unemployedPerOpening: Math.round((avgLevel / opening) * 10) / 10,
    medianWeeksUnemployed: weeks.v,
    asOf,
  }
}

// ── Euphemisms ─────────────────────────────────────────────────────────────
/**
 * Satire, not data. The factual layoff feed is the embedded layoffs.fyi tracker
 * plus the live JOLTS series — layoffs.fyi's shared Airtable view can be framed
 * but its JSON endpoint requires a login, so it is embedded, never scraped.
 */
export const euphemismAdapter: Adapter<Euphemism[]> = async () => euphemismSeed

// ── Developer sentiment ────────────────────────────────────────────────────
/**
 * Computed from the Stack Overflow Developer Survey response CSV — see
 * `scripts/fetch-data.mjs`. Percentages are over non-NA respondents, which
 * reproduces Stack Overflow's own published figures.
 *
 * The `prev` values are the ONE part not computed: they are prior-year figures
 * quoted in Stack Overflow's write-up. Computing them would mean two more
 * ~140 MB downloads for three numbers, and the 2025 questionnaire changed
 * shape, so they are cited rather than recomputed. Each is quoted below.
 */
const PUBLISHED_PRIOR = {
  // "an increase over last year (76%)"
  adoption: { value: 76, year: '2024' },
  // "70%+ in 2023 and 2024 to just 60% this year"
  favourable: { value: 70, year: '2023–24' },
  // "64% believe AI is not a threat to their job, a decrease from 68% last year"
  notThreat: { value: 68, year: '2024' },
}

export const sentimentAdapter: Adapter<SentimentStat[]> = async () => ({
  provenance: 'live',
  asOf: survey.asOf,
  source: survey.source,
  data: [
    {
      id: 'adoption',
      value: Math.round(survey.adoption.pct),
      label: 'using or planning to use AI tools',
      prev: PUBLISHED_PRIOR.adoption,
      tone: 'ominous',
    },
    {
      id: 'daily',
      value: Math.round(survey.proDailyPct),
      label: 'of professional developers use them daily',
      tone: 'ominous',
    },
    {
      id: 'writing-partly',
      value: Math.round(survey.writingCode.mostlyOrPartlyPct),
      label: 'write code at least partially with AI',
      note: `but only ${survey.writingCode.mostlyPct}% mostly with AI; ${survey.writingCode.wontPct}% don’t plan to at all`,
      tone: 'ominous',
    },
    {
      id: 'favourable',
      value: Math.round(survey.favourable.pct),
      label: 'report favourable sentiment toward AI tools',
      prev: PUBLISHED_PRIOR.favourable,
      tone: 'reassuring',
    },
    {
      id: 'not-threat',
      value: Math.round(survey.notThreat.pct),
      label: 'believe AI is not a threat to their job',
      prev: PUBLISHED_PRIOR.notThreat,
      tone: 'ominous',
    },
    {
      id: 'distrust',
      value: Math.round(survey.distrust.pct),
      label: 'actively distrust AI accuracy',
      note: `vs ${Math.round(survey.trust.pct)}% who trust it; only ${survey.highlyTrust.pct}% “highly trust” it`,
      tone: 'reassuring',
    },
  ],
})

// ── News ───────────────────────────────────────────────────────────────────
/** Hacker News at runtime, falling back to the satirical seed headlines. */
export const newsAdapter: Adapter<NewsItem[]> = async () => {
  const hits = await fetchHackerNews()
  if (!hits) return newsSeed
  return {
    provenance: 'live',
    asOf: new Date().toISOString().slice(0, 10),
    source: 'Hacker News via the Algolia API',
    data: hits,
  }
}

export async function loadDataset(): Promise<Dataset> {
  const [ai, jobs, euphemisms, sentiment, news] = await Promise.all([
    aiAdapter(),
    jobsAdapter(),
    euphemismAdapter(),
    sentimentAdapter(),
    newsAdapter(),
  ])
  return { ai, jobs, euphemisms, sentiment, news }
}

/** Series still on seed data, for the footer's honesty note. */
export function seedSeries(ds: Dataset): string[] {
  const all = [
    ds.ai.data.aiAuthoredCodeShare,
    ds.jobs.data.juniorShare,
  ]
  return all.filter((s) => (s.provenance ?? 'seed') === 'seed').map((s) => s.label)
}
