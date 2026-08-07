/**
 * The Doom Model.
 *
 * This is satire with real arithmetic underneath. Nothing here is a magic
 * number pulled from the air — every step is a stated assumption you can argue
 * with, and every assumption is exposed as a slider in the UI.
 *
 * The model has two halves:
 *
 *   1. CAPABILITY — when does an AI system become able, in principle, to do the
 *      full job? Built on the observed doubling of the "50%-success task time
 *      horizon" (the length of task an agent completes half the time). If that
 *      horizon doubles every `doublingMonths`, reaching a target horizon takes
 *      log2(target / current) * doublingMonths.
 *
 *   2. DIFFUSION — capability is not deployment. Enterprises move slowly, and
 *      the market absorbs the shock over years, not overnight. We add an
 *      adoption lag, then modulate it by how fast the job market is already
 *      deteriorating (a market in freefall adopts faster; a healthy one drags).
 *
 * Two scores, with different jobs:
 *
 *   - fuckedScore  — the DIAL. Share of the runway already burned: elapsed time
 *                    since the epoch over total time from epoch to the doom
 *                    date. It is the clock expressed as a percentage, so the
 *                    sliders move it, and clock-zero is 100 by construction.
 *                    Because the doom date is anchored to the data rather than
 *                    to page-load time, this also advances on its own as real
 *                    time passes — see dataAnchor().
 *   - evidenceScore — the EVIDENCE. A weighted blend of what the data actually
 *                    shows today. Sliders barely move it, because a forecast
 *                    cannot rewrite measurements; it is displayed as context
 *                    under the dial, never as the headline.
 *
 * An earlier design used the evidence blend as the dial. Every user read the
 * dial as "progress toward the doom date" and was confused that tuning the
 * model didn't move it and that clock-zero wasn't 100. They were right: a dial
 * next to a countdown must agree with the countdown.
 *
 * Neither number is a prediction.
 */

import type { Dataset, Series } from './types'

export interface DoomParams {
  /** Months for the 50%-success task horizon to double. METR-ish prior: ~7. */
  doublingMonths: number
  /** Task length (hours) an agent must sustain to replace a whole engineer. */
  targetHorizonHours: number
  /** Months between "capability exists" and "your employer actually ships it". */
  adoptionLagMonths: number
  /** Ceiling on the fraction of SWE work that is ever automated, 0..1. */
  automationCeiling: number
  /** Multiplier on how much a deteriorating market accelerates adoption. */
  marketPressure: number
}

const DEFAULT_PARAMS: DoomParams = {
  // Fallback only. When METR's fitted doubling time is available,
  // `defaultParams()` uses it instead of this hand-picked prior.
  doublingMonths: 7,
  targetHorizonHours: 320, // ~2 engineer-months of unsupervised work
  adoptionLagMonths: 30,
  automationCeiling: 0.85,
  marketPressure: 1,
}

/** Sane slider bounds, kept next to the defaults so the UI can't drift. */
export const PARAM_BOUNDS: Record<keyof DoomParams, { min: number; max: number; step: number }> = {
  doublingMonths: { min: 2, max: 24, step: 0.5 },
  // Floor is deliberately below the current observed horizon: dragging it there
  // asserts "the threshold has already been crossed", which zeroes the clock.
  targetHorizonHours: { min: 8, max: 2000, step: 4 },
  adoptionLagMonths: { min: 0, max: 120, step: 1 },
  automationCeiling: { min: 0.3, max: 1, step: 0.01 },
  marketPressure: { min: 0, max: 3, step: 0.05 },
}

/**
 * Model defaults, derived from the data where the data has an opinion.
 *
 * METR publish their own fitted doubling time for the horizon, so we use it
 * rather than a prior of ours. Everything else stays a stated assumption.
 */
export function defaultParams(ds: Dataset): DoomParams {
  const d = ds.ai.data.horizonDoubling
  const months = d?.months ?? d?.allTimeMonths
  return months && months > 0 ? { ...DEFAULT_PARAMS, doublingMonths: months } : DEFAULT_PARAMS
}

const MS_PER_YEAR = 3.15576e10
const MS_PER_MONTH = MS_PER_YEAR / 12
/** When the countdown started: ChatGPT's public launch. */
export const EPOCH = new Date('2022-11-30')

/**
 * The date the projection is anchored to: the most recent observation the
 * model actually saw.
 *
 * This must NOT be "now". The model outputs a DURATION (months remaining), and
 * anchoring that to page-load time meant the doom date walked forward on every
 * refresh — the clock reset instead of counting down, and would have shown the
 * same time remaining a year later. Anchoring to the data's as-of date fixes
 * the doom date between refreshes, so real time genuinely eats into it and the
 * date only moves when new data moves the projection.
 *
 * Only the two datasets that feed the model count. News carries a runtime
 * as-of and would reintroduce the drift.
 */
export function dataAnchor(ds: Dataset): Date {
  const times = [ds.ai.asOf, ds.jobs.asOf]
    .map((d) => new Date(d).getTime())
    .filter((t) => Number.isFinite(t))
  return times.length ? new Date(Math.max(...times)) : new Date()
}

const last = <T,>(xs: T[]): T => xs[xs.length - 1]
const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / (xs.length || 1)
const lastValue = (s: Series): number => last(s.points).v
const clamp = (v: number, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v))
const years = (t: string | Date) => new Date(t).getTime() / MS_PER_YEAR

/** Least-squares slope of ys against xs. */
function lsSlope(xs: number[], ys: number[]): number {
  const n = xs.length
  if (n < 2) return 0
  const mx = xs.reduce((a, x) => a + x, 0) / n
  const my = ys.reduce((a, y) => a + y, 0) / n
  const num = xs.reduce((a, x, i) => a + (x - mx) * (ys[i] - my), 0)
  const den = xs.reduce((a, x) => a + (x - mx) ** 2, 0)
  return den === 0 ? 0 : num / den
}

/**
 * Slope over a trailing *time* window, in units per year.
 *
 * Deliberately time-based rather than point-based: live sources arrive monthly
 * and seed series are quarterly, so "last 8 points" would silently mean two
 * different things depending on which tier the data came from.
 */
function recentSlopePerYear(s: Series, months = 24): number {
  const cutoff = years(last(s.points).t) - months / 12
  const window = s.points.filter((p) => years(p.t) >= cutoff)
  const pts = window.length >= 3 ? window : s.points.slice(-3)
  return lsSlope(pts.map((p) => years(p.t)), pts.map((p) => p.v))
}

/** The four things the score is made of, each 0..1. */
interface Indicators {
  capProgress: number
  benchProgress: number
  marketPain: number
  codeShare: number
}

export interface Component {
  label: string
  value: number
  weight: number
  detail: string
}

const WEIGHTS = {
  capProgress: 0.35,
  benchProgress: 0.15,
  marketPain: 0.35,
  codeShare: 0.15,
} as const

const LABELS = {
  capProgress: 'AGENT_AUTONOMY',
  benchProgress: 'BENCHMARK_SATURATION',
  marketPain: 'MARKET_DETERIORATION',
  codeShare: 'AI_AUTHORED_CODE',
} as const

function scoreOf(ind: Indicators): number {
  return Math.round(
    (Object.keys(WEIGHTS) as (keyof Indicators)[]).reduce(
      (a, k) => a + clamp(ind[k]) * WEIGHTS[k],
      0,
    ) * 100,
  )
}

function componentsOf(ind: Indicators, details: Record<keyof Indicators, string>): Component[] {
  return (Object.keys(WEIGHTS) as (keyof Indicators)[]).map((k) => ({
    label: LABELS[k],
    value: clamp(ind[k]),
    weight: WEIGHTS[k],
    detail: details[k],
  }))
}

export interface DoomResult {
  /** Projected date the last SWE job is automated away. */
  doomDate: Date
  /** Months from now until doomDate. */
  monthsRemaining: number
  /** Date capability alone crosses the threshold, before diffusion lag. */
  capabilityDate: Date
  /**
   * 0-100. The dial: share of the runway from EPOCH to doomDate that is already
   * behind us. Slider-responsive; exactly 100 when the clock reads zero.
   */
  fuckedScore: number
  /** 0-100, empirical blend of today's indicators. Context, not the headline. */
  evidenceScore: number
  /** The four weighted components behind evidenceScore. */
  components: Component[]
  /** Human-readable trace of the arithmetic, shown in the "show your work" panel. */
  workings: string[]
  /** Doubling-adjusted horizon needed, for display. */
  doublingsNeeded: number
}

export function computeDoom(ds: Dataset, p: DoomParams, now = new Date()): DoomResult {
  const ai = ds.ai.data
  const jobs = ds.jobs.data

  // --- 1. Capability -------------------------------------------------------
  const currentHorizon = lastValue(ai.timeHorizon)
  const doublingsNeeded = Math.max(0, Math.log2(p.targetHorizonHours / currentHorizon))
  const monthsToCapability = doublingsNeeded * p.doublingMonths

  // --- 2. Market deterioration --------------------------------------------
  const postings = lastValue(jobs.postingsIndex)
  const postingsAll = lastValue(jobs.postingsIndexAllJobs)
  const relativeRot = clamp((postingsAll - postings) / Math.max(postingsAll, 1))
  const postingsTrend = recentSlopePerYear(jobs.postingsIndex) // index pts/yr, negative = bad
  // Averaged baselines: the junior series is real monthly data now, and single
  // months swing enough that first-point/last-point would be sampling noise.
  const juniorBase = mean(jobs.juniorShare.points.slice(0, 12).map((p) => p.v))
  const juniorNow = mean(jobs.juniorShare.points.slice(-3).map((p) => p.v))
  const juniorCollapse = clamp(1 - juniorNow / Math.max(juniorBase, 1e-9))
  const unemployment = lastValue(jobs.unemploymentRate)

  // A market already falling apart shortens the adoption lag; a stable one
  // lengthens it. Normalised so "flat postings" leaves the lag untouched.
  const decayRate = clamp(-postingsTrend / 20, 0, 1.5)
  const lagMultiplier = clamp(1 - decayRate * 0.5 * p.marketPressure, 0.25, 1.5)
  const effectiveLag = p.adoptionLagMonths * lagMultiplier

  // --- 3. Ceiling ----------------------------------------------------------
  // Not every job goes. The residual `1 - ceiling` of work that stays human
  // stretches the tail: the closer the ceiling is to 1, the sooner "all of it".
  const ceilingStretch = 1 / Math.max(p.automationCeiling, 0.01)
  const monthsRemaining = Math.max(0, (monthsToCapability + effectiveLag) * ceilingStretch)

  // Anchored to the data, not to `now` — see dataAnchor().
  const anchor = dataAnchor(ds)
  const capabilityDate = addMonths(anchor, monthsToCapability)
  const doomDate = addMonths(anchor, monthsRemaining)

  // --- 4a. The score, NOW (empirical) --------------------------------------
  const startHorizon = ai.timeHorizon.points[0].v
  const nowInd: Indicators = {
    capProgress: clamp(
      Math.log2(currentHorizon / startHorizon) /
        Math.max(Math.log2(p.targetHorizonHours / startHorizon), 0.001),
    ),
    benchProgress: clamp(lastValue(ai.sweBench) / 100),
    marketPain: clamp(0.45 * relativeRot + 0.35 * juniorCollapse + 0.2 * clamp(unemployment / 8)),
    codeShare: clamp(lastValue(ai.aiAuthoredCodeShare)),
  }

  const components = componentsOf(nowInd, {
    capProgress: `${fmtHours(currentHorizon)} unsupervised → target ${fmtHours(p.targetHorizonHours)} (${doublingsNeeded.toFixed(1)} doublings left)`,
    benchProgress: `SWE-bench Verified at ${lastValue(ai.sweBench).toFixed(1)}%`,
    marketPain: `postings ${postings.toFixed(0)} vs ${postingsAll.toFixed(0)} all-jobs; junior mentions down ${(juniorCollapse * 100).toFixed(0)}% vs 2019`,
    codeShare: `${(nowInd.codeShare * 100).toFixed(0)}% of new code at Google (cited statements)`,
  })

  // --- 4b. The dial ---------------------------------------------------------
  // Share of the runway (ChatGPT's launch → the projected doom date) that real
  // time has already eaten. Because both ends are fixed between data refreshes,
  // this creeps up on its own and reaches exactly 100 when the clock hits zero.
  const elapsedMonths = Math.max(0, (now.getTime() - EPOCH.getTime()) / MS_PER_MONTH)
  const runwayMonths = Math.max((doomDate.getTime() - EPOCH.getTime()) / MS_PER_MONTH, 1e-9)
  const fuckedScore = Math.round(clamp(elapsedMonths / runwayMonths) * 100)
  const evidenceScore = scoreOf(nowInd)

  const workings = [
    `horizon_now        = ${fmtHours(currentHorizon)}`,
    `horizon_target     = ${fmtHours(p.targetHorizonHours)}`,
    `doublings_needed   = log2(${p.targetHorizonHours} / ${currentHorizon.toFixed(2)}) = ${doublingsNeeded.toFixed(2)}`,
    `months_to_capable  = ${doublingsNeeded.toFixed(2)} × ${p.doublingMonths} = ${monthsToCapability.toFixed(1)} mo`,
    `postings_trend     = ${postingsTrend.toFixed(1)} index pts/yr`,
    `lag_multiplier     = clamp(1 − ${decayRate.toFixed(2)} × 0.5 × ${p.marketPressure}) = ${lagMultiplier.toFixed(2)}`,
    `effective_lag      = ${p.adoptionLagMonths} × ${lagMultiplier.toFixed(2)} = ${effectiveLag.toFixed(1)} mo`,
    `ceiling_stretch    = 1 / ${p.automationCeiling} = ${ceilingStretch.toFixed(2)}`,
    `months_remaining   = (${monthsToCapability.toFixed(1)} + ${effectiveLag.toFixed(1)}) × ${ceilingStretch.toFixed(2)} = ${monthsRemaining.toFixed(1)} mo`,
    ``,
    `anchor              = ${anchor.toISOString().slice(0, 10)} (latest observation; doom date is fixed to this)`,
    `doom_date           = anchor + ${monthsRemaining.toFixed(1)} mo = ${doomDate.toISOString().slice(0, 10)}`,
    `elapsed_since_epoch = ${elapsedMonths.toFixed(1)} mo (epoch = ChatGPT launch, 2022-11-30)`,
    `fucked_score        = ${elapsedMonths.toFixed(1)} / ${runwayMonths.toFixed(1)} = ${fuckedScore}%`,
    `evidence_today      = Σ(observed × weight) = ${evidenceScore}%`,
  ]

  return {
    doomDate,
    monthsRemaining,
    capabilityDate,
    fuckedScore,
    evidenceScore,
    components,
    workings,
    doublingsNeeded,
  }
}

function addMonths(d: Date, months: number): Date {
  const out = new Date(d.getTime())
  const whole = Math.floor(months)
  const frac = months - whole
  out.setMonth(out.getMonth() + whole)
  out.setDate(out.getDate() + Math.round(frac * 30.44))
  return out
}

export function fmtHours(h: number): string {
  if (h < 1) return `${Math.round(h * 60)} min`
  if (h < 40) return `${h.toFixed(h < 10 ? 1 : 0)} hr`
  if (h < 320) return `${(h / 40).toFixed(1)} wk`
  return `${(h / 173).toFixed(1)} mo`
}

/**
 * Verdict band for a given score. Bands are set against the range the meter can
 * actually reach from observed data — a band you cannot enter is dead UI.
 */
export function verdict(score: number): { label: string; tone: 'ok' | 'warn' | 'bad' | 'crit'; blurb: string } {
  if (score < 25)
    return {
      label: 'MILDLY INCONVENIENCED',
      tone: 'ok',
      blurb: 'Your job is safe. Your equity is not. Continue as normal.',
    }
  if (score < 45)
    return {
      label: 'NOTICEABLY FUCKED',
      tone: 'warn',
      blurb: 'Still employed, but the standup has a new attendee and it does not blink.',
    }
  if (score < 65)
    return {
      label: 'SUBSTANTIALLY FUCKED',
      tone: 'bad',
      blurb: 'You are now a code reviewer for something that never asks for feedback.',
    }
  return {
    label: 'TERMINALLY FUCKED',
    tone: 'crit',
    blurb: 'Update your LinkedIn to "prompt-adjacent thought leader" and start a newsletter.',
  }
}
