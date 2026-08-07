#!/usr/bin/env node
/**
 * Pulls live data from public sources into `src/data/generated/`.
 *
 *   npm run fetch-data
 *
 * This runs in Node, not the browser, for two reasons: the Indeed sector file is
 * ~10 MB (nobody should download that to render a dashboard), and several
 * sources send no CORS headers. The committed JSON snapshots keep `npm run
 * build` green without a network call; re-run this whenever you want fresh
 * numbers.
 *
 * Sources — all public, free, no API keys:
 *
 *   Indeed Hiring Lab   github.com/hiring-lab/job_postings_tracker
 *                       github.com/hiring-lab/ai-tracker
 *                       Job postings indices, Feb 2020 = 100. CC BY.
 *   SWE-bench           github.com/SWE-bench/experiments
 *                       Official leaderboard submissions (Princeton NLP).
 *   FRED (St. Louis Fed) api.stlouisfed.org — BLS series republished by FRED.
 *                       Needs a free key in FRED_API_KEY; skipped without one.
 *                       FRED sends no CORS headers, so this can only ever run
 *                       here, server-side. The key must never reach the bundle.
 *   METR                metr.org/time-horizons — the published p50 time-horizon
 *                       dataset and METR's own fitted doubling time. Extracted
 *                       from an inline <script> blob, NOT an API — see the note
 *                       on fetchMetr for why that is load-bearing.
 *   Aider blame data    github.com/Aider-AI/aider — per-release git-blame of how
 *                       much of aider's own code aider wrote. The only public
 *                       MEASURED AI-authorship series; one project, so it is a
 *                       labelled case study, not a population estimate.
 *   SO Developer Survey github.com/StackExchange/Survey — the full anonymised
 *                       response CSV (~140 MB). Figures are COMPUTED from
 *                       responses, not transcribed from the write-up.
 *   Stack Exchange      api.stackexchange.com — monthly question counts. Free,
 *                       keyless, CORS-open. The clearest public trace of
 *                       developers no longer asking other humans.
 *   BLS JOLTS           api.bls.gov — Job Openings and Labor Turnover Survey.
 *                       Needs a free key in BLS_API_KEY; skipped without one.
 *                       Also server-side only.
 *
 * Deliberately NOT wired, because no reputable free feed exists:
 *   - Named layoff events: layoffs.fyi has no public API and WARN notices are
 *     per-state and inconsistent. The aggregate TREND is live from JOLTS; the
 *     per-company rows are not.
 *   - Entry-level share of postings: no public breakdown exists.
 * Those stay as clearly-labelled seed data. See README.
 */

import { writeFile, readFile, mkdir } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'data', 'generated')
const RAW = 'https://raw.githubusercontent.com'

/** SWE-bench Verified is a fixed 500-instance split. */
const SWE_BENCH_VERIFIED_N = 500

const log = (...a) => console.log('  ', ...a)

async function get(url, { json = false, timeoutMs = 120_000 } = {}) {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    const res = await fetch(url, { signal: ctrl.signal, headers: { 'user-agent': 'howfuckedareswe' } })
    if (!res.ok) throw new Error(`${res.status} ${res.statusText} — ${url}`)
    return json ? res.json() : res.text()
  } finally {
    clearTimeout(timer)
  }
}

/** CSV parser that respects quoted fields (Indeed has sectors with commas). */
function parseCsv(text) {
  const rows = []
  let row = []
  let field = ''
  let quoted = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++ } else quoted = false
      } else field += c
    } else if (c === '"') quoted = true
    else if (c === ',') { row.push(field); field = '' }
    else if (c === '\n') { row.push(field); rows.push(row); row = []; field = '' }
    else if (c !== '\r') field += c
  }
  if (field.length || row.length) { row.push(field); rows.push(row) }
  const header = rows.shift().map((h) => h.trim())
  return rows
    .filter((r) => r.length === header.length)
    .map((r) => Object.fromEntries(header.map((h, i) => [h, r[i]])))
}

/** Collapse daily observations to one point per month (last obs wins). */
function toMonthly(points) {
  const byMonth = new Map()
  for (const p of points.sort((a, b) => a.t.localeCompare(b.t))) {
    byMonth.set(p.t.slice(0, 7), p)
  }
  return [...byMonth.values()].map((p) => ({ t: p.t, v: Math.round(p.v * 100) / 100 }))
}

async function pool(items, size, fn) {
  const out = new Array(items.length)
  let i = 0
  await Promise.all(
    Array.from({ length: Math.min(size, items.length) }, async () => {
      while (i < items.length) {
        const idx = i++
        try { out[idx] = await fn(items[idx]) } catch { out[idx] = null }
      }
    }),
  )
  return out.filter(Boolean)
}

// ── Indeed Hiring Lab: job postings ────────────────────────────────────────
async function fetchJobPostings() {
  log('Indeed Hiring Lab — sector postings (~10 MB)…')
  const sectorCsv = await get(
    `${RAW}/hiring-lab/job_postings_tracker/master/US/job_postings_by_sector_US.csv`,
  )
  const sector = parseCsv(sectorCsv)
  const softwareDev = toMonthly(
    sector
      .filter((r) => r.display_name === 'Software Development' && r.variable === 'total postings')
      .map((r) => ({ t: r.date, v: Number(r.indeed_job_postings_index) }))
      .filter((p) => Number.isFinite(p.v)),
  )

  log('Indeed Hiring Lab — aggregate postings…')
  const aggCsv = await get(
    `${RAW}/hiring-lab/job_postings_tracker/master/US/aggregate_job_postings_US.csv`,
  )
  const allJobs = toMonthly(
    parseCsv(aggCsv)
      .filter((r) => r.variable === 'total postings')
      .map((r) => ({ t: r.date, v: Number(r.indeed_job_postings_index_SA) }))
      .filter((p) => Number.isFinite(p.v)),
  )

  if (!softwareDev.length || !allJobs.length) throw new Error('Indeed: empty series')
  log(`software dev: ${softwareDev.length} months, latest ${softwareDev.at(-1).v}`)
  log(`all jobs:     ${allJobs.length} months, latest ${allJobs.at(-1).v}`)

  return {
    asOf: softwareDev.at(-1).t,
    source: 'Indeed Hiring Lab job postings tracker (Feb 2020 = 100)',
    url: 'https://github.com/hiring-lab/job_postings_tracker',
    softwareDev,
    allJobs,
  }
}

// ── Indeed Hiring Lab: AI share of postings ────────────────────────────────
async function fetchAiPostings() {
  log('Indeed Hiring Lab — AI share of postings…')
  const csv = await get(`${RAW}/hiring-lab/ai-tracker/main/AI_posting.csv`)
  const points = toMonthly(
    parseCsv(csv)
      .filter((r) => r.jobcountry === 'US')
      .map((r) => ({ t: r.date, v: Number(r.AI_share_postings) }))
      .filter((p) => Number.isFinite(p.v)),
  )
  if (!points.length) throw new Error('AI tracker: empty series')
  log(`${points.length} months, latest ${points.at(-1).v}% of postings mention AI`)
  return {
    asOf: points.at(-1).t,
    source: 'Indeed Hiring Lab AI tracker — share of US postings mentioning AI',
    url: 'https://github.com/hiring-lab/ai-tracker',
    points,
  }
}

// ── SWE-bench Verified leaderboard ─────────────────────────────────────────
async function fetchSweBench() {
  log('SWE-bench — listing verified submissions…')
  const tree = await get(
    'https://api.github.com/repos/SWE-bench/experiments/git/trees/HEAD?recursive=1',
    { json: true },
  )
  const entries = tree.tree
    .map((n) => n.path)
    .filter((p) => /^evaluation\/verified\/[^/]+\/results\/results\.json$/.test(p))
    .map((p) => {
      const dir = p.split('/')[2]
      const m = dir.match(/^(\d{4})(\d{2})(\d{2})_(.+)$/)
      return m ? { path: p, date: `${m[1]}-${m[2]}-${m[3]}`, slug: m[4] } : null
    })
    .filter(Boolean)

  log(`${entries.length} submissions — fetching results…`)
  const scored = await pool(entries, 8, async (e) => {
    const r = await get(`${RAW}/SWE-bench/experiments/main/${e.path}`, { json: true })
    const resolved = Array.isArray(r.resolved) ? r.resolved.length : null
    if (resolved == null) return null
    return { ...e, score: Math.round((resolved / SWE_BENCH_VERIFIED_N) * 1000) / 10 }
  })

  scored.sort((a, b) => a.date.localeCompare(b.date))

  // The frontier: best score achieved on or before each date. This is the line
  // people mean by "SWE-bench progress" — not every submission is an advance.
  const frontier = []
  let best = 0
  for (const s of scored) {
    if (s.score > best) {
      best = s.score
      frontier.push({ t: s.date, v: best, slug: s.slug })
    }
  }

  if (!frontier.length) throw new Error('SWE-bench: no results parsed')
  log(`${scored.length} scored, ${frontier.length} frontier points, best ${best}%`)

  return {
    asOf: scored.at(-1).date,
    source: `SWE-bench Verified official submissions (${scored.length} runs, n=${SWE_BENCH_VERIFIED_N})`,
    url: 'https://github.com/SWE-bench/experiments',
    frontier: frontier.map(({ t, v }) => ({ t, v })),
    top: scored
      .slice()
      .sort((a, b) => b.score - a.score)
      .slice(0, 8)
      .map(({ slug, date, score }) => ({ slug, date, score })),
  }
}


// ── FRED: BLS labour series ────────────────────────────────────────────────
/**
 * Two series, both monthly and current:
 *
 *   LNU04032237   Unemployment Rate — Information Industry, private wage and
 *                 salary workers. The closest public proxy for "are software
 *                 people out of work"; there is no BLS series for software
 *                 engineers specifically, and this is labelled honestly in the
 *                 UI as the information industry, not as SWEs.
 *   CES6054150001 All Employees, Computer Systems Design and Related Services.
 *                 A headcount, which is harder to argue with than a rate.
 *
 * LNU* series are NOT seasonally adjusted, so the raw monthly print swings
 * ~1.5pp on seasonality alone. We publish a 12-month trailing mean, which
 * removes the annual cycle without pretending to a smoothing model we haven't
 * validated. The chart is labelled as the average.
 */
async function fetchFred() {
  const key = process.env.FRED_API_KEY
  if (!key) {
    const err = new Error('FRED_API_KEY not set — skipping (see .env.example)')
    err.skip = true
    throw err
  }

  const series = async (id) => {
    const url =
      `https://api.stlouisfed.org/fred/series/observations?series_id=${id}` +
      `&api_key=${key}&file_type=json&observation_start=2019-01-01`
    const body = await get(url, { json: true })
    return (body.observations ?? [])
      .filter((o) => o.value !== '.')
      .map((o) => ({ t: o.date, v: Number(o.value) }))
      .filter((p) => Number.isFinite(p.v))
  }

  const trailingMean = (points, n) =>
    points.slice(n - 1).map((p, i) => ({
      t: p.t,
      v: Math.round((points.slice(i, i + n).reduce((a, q) => a + q.v, 0) / n) * 100) / 100,
    }))

  log('FRED — information industry unemployment (LNU04032237)…')
  const unemploymentRaw = await series('LNU04032237')
  const unemployment = trailingMean(unemploymentRaw, 12)

  log('FRED — computer systems design employment (CES6054150001)…')
  const techEmployment = await series('CES6054150001')

  log('FRED — information industry unemployment level (LNU03032237)…')
  const unemploymentLevel = await series('LNU03032237') // thousands, NSA

  log('FRED — median weeks unemployed (UEMPMED)…')
  const medianWeeksUnemployed = await series('UEMPMED') // weeks, SA, all workers

  if (!unemployment.length || !techEmployment.length || !unemploymentLevel.length || !medianWeeksUnemployed.length)
    throw new Error('FRED: empty series')
  log(`unemployment: ${unemployment.length} months, latest ${unemployment.at(-1).v}% (12-mo avg)`)
  log(`employment:   ${techEmployment.length} months, latest ${techEmployment.at(-1).v}k`)

  return {
    asOf: techEmployment.at(-1).t,
    source: 'BLS via FRED (St. Louis Fed)',
    url: 'https://fred.stlouisfed.org',
    unemployment,
    unemploymentSeriesId: 'LNU04032237',
    techEmployment,
    techEmploymentSeriesId: 'CES6054150001',
    // NSA monthly level, thousands — consumers should average before headline use.
    unemploymentLevel,
    unemploymentLevelSeriesId: 'LNU03032237',
    medianWeeksUnemployed,
    medianWeeksUnemployedSeriesId: 'UEMPMED',
  }
}


// ── BLS JOLTS ──────────────────────────────────────────────────────────────
/**
 * Job Openings and Labor Turnover Survey, Information sector (NAICS 51):
 *
 *   JTS510000000000000JOL   job openings, level (thousands)
 *   JTS510000000000000LDL   layoffs and discharges, level (thousands)
 *
 * Information is the closest JOLTS industry to "tech". It is a real monthly
 * count of people actually let go, which is a far better aggregate than any
 * scraped list of announcements — and unlike layoffs.fyi it has an API.
 */
async function fetchBls() {
  const key = process.env.BLS_API_KEY
  if (!key) {
    const err = new Error('BLS_API_KEY not set — skipping (see .env.example)')
    err.skip = true
    throw err
  }

  const ids = {
    jobOpenings: 'JTS510000000000000JOL',
    layoffsDischarges: 'JTS510000000000000LDL',
  }
  const thisYear = new Date().getFullYear()

  log('BLS JOLTS — information sector openings & separations…')
  const res = await fetch('https://api.bls.gov/publicAPI/v2/timeseries/data/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      seriesid: Object.values(ids),
      startyear: String(thisYear - 7),
      endyear: String(thisYear),
      registrationkey: key,
    }),
  })
  if (!res.ok) throw new Error(`BLS ${res.status} ${res.statusText}`)
  const body = await res.json()
  if (body.status !== 'REQUEST_SUCCEEDED') {
    throw new Error(`BLS: ${body.status} ${JSON.stringify(body.message)}`)
  }

  const byId = new Map(
    (body.Results?.series ?? []).map((s) => [
      s.seriesID,
      (s.data ?? [])
        // M13 is the annual average, not a month — drop it.
        .filter((d) => /^M(0[1-9]|1[0-2])$/.test(d.period) && d.value !== '-')
        .map((d) => ({ t: `${d.year}-${d.period.slice(1)}-01`, v: Number(d.value) }))
        .filter((p) => Number.isFinite(p.v))
        .sort((a, b) => a.t.localeCompare(b.t)),
    ]),
  )

  const jobOpenings = byId.get(ids.jobOpenings) ?? []
  const layoffsDischarges = byId.get(ids.layoffsDischarges) ?? []
  if (!jobOpenings.length || !layoffsDischarges.length) throw new Error('BLS: empty series')
  log(`openings: ${jobOpenings.length} months, latest ${jobOpenings.at(-1).v}k`)
  log(`layoffs:  ${layoffsDischarges.length} months, latest ${layoffsDischarges.at(-1).v}k`)

  return {
    asOf: layoffsDischarges.at(-1).t,
    source: 'BLS JOLTS — information sector (NAICS 51)',
    url: 'https://www.bls.gov/jlt/',
    jobOpenings,
    jobOpeningsSeriesId: ids.jobOpenings,
    layoffsDischarges,
    layoffsSeriesId: ids.layoffsDischarges,
  }
}


// ── Stack Exchange: are developers still asking humans? ────────────────────
/**
 * Monthly question counts on Stack Overflow, against a non-technical control.
 *
 * Stack Overflow volume has fallen off a cliff since 2022. The obvious reading
 * is "developers ask models instead", but Stack Overflow also had its own
 * moderation dramas and a general migration to Discord — so a bare SO line
 * would be a motivated stat. English Language & Usage is a busy, long-running
 * Stack Exchange site with no plausible coding-assistant substitute, so the
 * GAP between the two lines is the part attributable to AI rather than to
 * forums declining generally.
 *
 * Both are indexed to their own 2019 average = 100 so they share one axis;
 * raw counts differ by two orders of magnitude and a dual axis is never the
 * answer.
 *
 * Costs ~1 request per site-month. The keyless quota is 300/day per IP, so a
 * full run is comfortably within budget but two or three are not; failures are
 * tolerated and simply shorten the series.
 */
async function fetchStackOverflow() {
  const START_YEAR = 2019
  const sites = { stackoverflow: 'stackoverflow', control: 'english' }

  const monthsBetween = () => {
    const out = []
    const now = new Date()
    for (let y = START_YEAR; y <= now.getUTCFullYear(); y++) {
      for (let m = 0; m < 12; m++) {
        const from = Date.UTC(y, m, 1) / 1000
        const to = Date.UTC(y, m + 1, 1) / 1000
        if (to > now.getTime() / 1000) break
        out.push({ t: `${y}-${String(m + 1).padStart(2, '0')}-01`, from, to })
      }
    }
    return out
  }

  const months = monthsBetween()

  const countFor = async (site, { t, from, to }) => {
    const url =
      `https://api.stackexchange.com/2.3/questions?site=${site}` +
      `&fromdate=${from}&todate=${to}&filter=total`
    const body = await get(url, { json: true })
    if (typeof body.total !== 'number') throw new Error('no total')
    if (body.backoff) await new Promise((r) => setTimeout(r, body.backoff * 1000))
    return { t, v: body.total }
  }

  const series = {}
  for (const [key, site] of Object.entries(sites)) {
    log(`Stack Exchange — ${site}, ${months.length} months…`)
    const points = (await pool(months, 4, (m) => countFor(site, m))).sort((a, b) =>
      a.t.localeCompare(b.t),
    )
    if (points.length < 12) throw new Error(`${site}: only ${points.length} months returned`)
    // Index to that site's own 2019 average so both share one axis.
    const base2019 = points.filter((p) => p.t.startsWith('2019'))
    const baseline = base2019.reduce((a, p) => a + p.v, 0) / (base2019.length || 1)
    series[key] = {
      raw: points,
      indexed: points.map((p) => ({ t: p.t, v: Math.round((p.v / baseline) * 1000) / 10 })),
    }
    log(`${site}: ${points.length} months, latest ${points.at(-1).v.toLocaleString()} questions`)
  }

  const so = series.stackoverflow
  log(
    `Stack Overflow is at ${so.indexed.at(-1).v}% of its 2019 rate; ` +
      `control at ${series.control.indexed.at(-1).v}%`,
  )

  return {
    asOf: so.raw.at(-1).t,
    source: 'Stack Exchange API — questions asked per month, indexed to 2019 = 100',
    url: 'https://api.stackexchange.com',
    stackOverflow: so.indexed,
    stackOverflowRaw: so.raw,
    control: series.control.indexed,
    controlLabel: 'English Language & Usage (control)',
  }
}


// ── METR: autonomous task time horizon ─────────────────────────────────────
/**
 * METR's published time-horizon results, from metr.org/time-horizons.
 *
 * Their GitHub repo keeps the computed horizons in DVC, not git — but the
 * public page ships the finished dataset inline, as a `benchmarkDataV1_1`
 * object inside a <script> tag. That gives us, per model:
 *
 *   p50_horizon_length   task length (MINUTES) the agent completes 50% of the
 *                        time, with a confidence interval
 *   is_sota              whether it was the frontier at release
 *
 * and, at the top level, METR's own fitted `doubling_time_in_days` — which is
 * the single most important assumption in the doom model. We take it from them
 * rather than inventing one.
 *
 * CAVEAT, and it is a real one: this parses a script blob out of an HTML page.
 * It is not an API and carries no stability promise; a page restructure breaks
 * it. That is why the parse is defensive and the caller keeps the last good
 * snapshot on failure. robots.txt permits /time-horizons (only the draft path
 * is disallowed).
 */
async function fetchMetr() {
  log('METR — time-horizon page…')
  const html = await get('https://metr.org/time-horizons/')

  // Brace-match the object so a nested `}` inside a string can't truncate it.
  const anchor = html.indexOf('benchmarkDataV1_1')
  if (anchor < 0) throw new Error('METR: benchmarkDataV1_1 not found — page layout changed')
  const start = html.indexOf('{', anchor)
  let depth = 0, inStr = false, esc = false, end = -1
  for (let i = start; i < html.length; i++) {
    const c = html[i]
    if (inStr) {
      if (esc) esc = false
      else if (c === '\\') esc = true
      else if (c === '"') inStr = false
    } else if (c === '"') inStr = true
    else if (c === '{') depth++
    else if (c === '}' && --depth === 0) { end = i + 1; break }
  }
  if (end < 0) throw new Error('METR: could not brace-match the data object')
  const data = JSON.parse(html.slice(start, end))

  const MIN_PER_HOUR = 60
  const all = Object.entries(data.results ?? {})
    .map(([slug, r]) => {
      const p50 = r?.metrics?.p50_horizon_length
      if (!p50 || typeof p50.estimate !== 'number' || !r.release_date) return null
      return {
        slug,
        t: r.release_date,
        v: Math.round((p50.estimate / MIN_PER_HOUR) * 1000) / 1000,
        ciLow: p50.ci_low != null ? p50.ci_low / MIN_PER_HOUR : null,
        ciHigh: p50.ci_high != null ? p50.ci_high / MIN_PER_HOUR : null,
        isSota: r.metrics.is_sota === true,
      }
    })
    .filter(Boolean)
    .sort((a, b) => a.t.localeCompare(b.t))

  if (all.length < 5) throw new Error(`METR: only ${all.length} agents parsed`)

  // The frontier line: state-of-the-art at release, kept monotonic.
  const frontier = []
  let best = 0
  for (const a of all.filter((x) => x.isSota)) {
    if (a.v > best) { best = a.v; frontier.push({ t: a.t, v: a.v }) }
  }

  const dd = data.doubling_time_in_days ?? {}
  const recent = dd.from_2023_on ?? {}
  const allTime = dd.all_time_stitched ?? dd.all_time ?? {}
  const DAYS_PER_MONTH = 30.44
  const toMonths = (d) => (typeof d === 'number' ? Math.round((d / DAYS_PER_MONTH) * 100) / 100 : null)

  const doubling = {
    fromRecent: {
      months: toMonths(recent.point_estimate),
      ciLowMonths: toMonths(recent.ci_low),
      ciHighMonths: toMonths(recent.ci_high),
    },
    allTimeMonths: toMonths(allTime.point_estimate),
  }
  if (!doubling.fromRecent.months && !doubling.allTimeMonths) {
    throw new Error('METR: no doubling time found')
  }

  log(`${all.length} agents, ${frontier.length} frontier points, latest ${frontier.at(-1).v} hr`)
  log(
    `doubling time: ${doubling.fromRecent.months} mo since 2023 ` +
      `(CI ${doubling.fromRecent.ciLowMonths}-${doubling.fromRecent.ciHighMonths}), ` +
      `${doubling.allTimeMonths} mo all-time`,
  )

  return {
    asOf: all.at(-1).t,
    source: `METR ${data.benchmark_name ?? 'time horizons'} — 50%-success task length`,
    url: 'https://metr.org/time-horizons/',
    benchmark: data.benchmark_name ?? null,
    frontier,
    agents: all,
    doubling,
  }
}


// ── Stack Overflow Developer Survey ────────────────────────────────────────
/**
 * Computes the AI figures from the raw response CSV rather than transcribing
 * the published write-up: github.com/StackExchange/Survey, ~140 MB, CORS-open,
 * no key. 49,191 responses for 2025.
 *
 * Two things worth knowing about the arithmetic:
 *
 *  - Denominators exclude "NA". Roughly a third of respondents skip each AI
 *    question, and counting them as "no" understates every figure. Computing
 *    over non-NA reproduces Stack Overflow's own published numbers exactly
 *    (84% adoption, 64% not-a-threat, 60% favourable, 46/33/3 on trust), which
 *    is the check that the method is right.
 *  - The `AITool*` columns are a semicolon-delimited task matrix, one column
 *    per usage level. "Writing code" at mostly/partially is the closest thing
 *    any public dataset has to "how much code is AI-written" — though it counts
 *    DEVELOPERS, not lines of code, and is labelled that way in the UI.
 *
 * The survey is annual and historical years never change, so this skips the
 * download when the snapshot already has the current year. Force with
 * SURVEY_REFRESH=1.
 */
const SURVEY_YEAR = '2025'

/** Streaming CSV row reader — the file is far too big to hold as one string. */
async function* csvRows(res) {
  const reader = res.body.getReader()
  const decoder = new TextDecoder('utf-8')
  let header = null
  let row = []
  let field = ''
  let quoted = false
  let pending = ''

  const pushRow = () => {
    row.push(field); field = ''
    const r = row; row = []
    return r
  }

  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    pending = decoder.decode(value, { stream: true })
    for (let i = 0; i < pending.length; i++) {
      const c = pending[i]
      if (quoted) {
        if (c === '"') {
          if (pending[i + 1] === '"') { field += '"'; i++ } else quoted = false
        } else field += c
      } else if (c === '"') quoted = true
      else if (c === ',') { row.push(field); field = '' }
      else if (c === '\n') {
        const r = pushRow()
        if (!header) header = r.map((h) => h.replace(/^﻿/, '').replace(/^"|"$/g, '').trim())
        else if (r.length === header.length) {
          const o = {}
          for (let k = 0; k < header.length; k++) o[header[k]] = r[k]
          yield o
        }
      } else if (c !== '\r') field += c
    }
  }
  if (field || row.length) {
    const r = pushRow()
    if (header && r.length === header.length) {
      const o = {}
      for (let k = 0; k < header.length; k++) o[header[k]] = r[k]
      yield o
    }
  }
}

async function fetchSurvey({ existing } = {}) {
  if (!process.env.SURVEY_REFRESH && existing?.year === SURVEY_YEAR) {
    const err = new Error(`already have ${SURVEY_YEAR} (SURVEY_REFRESH=1 to re-download 140 MB)`)
    err.skip = true
    throw err
  }

  log('Stack Overflow Developer Survey — streaming ~140 MB…')
  const url =
    'https://media.githubusercontent.com/media/StackExchange/Survey/refs/heads/main/' +
    `packages/archive/${SURVEY_YEAR}/results.csv`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`survey ${res.status} ${res.statusText}`)

  const real = (v) => { const t = (v ?? '').trim(); return t && t !== 'NA' ? t : null }
  const tally = {}
  const bump = (k, v) => { (tally[k] ??= new Map()).set(v, (tally[k].get(v) ?? 0) + 1) }

  const LEVELS = [
    'AIToolCurrently mostly AI',
    'AIToolCurrently partially AI',
    "AIToolDon't plan to use AI for this task",
  ]
  const writing = { mostly: 0, partially: 0, wont: 0 }
  let matrixBase = 0
  let n = 0
  let proTotal = 0
  let proDaily = 0

  for await (const row of csvRows(res)) {
    n++
    for (const col of ['AISelect', 'AISent', 'AIAcc', 'AIThreat']) {
      const v = real(row[col])
      if (v) bump(col, v)
    }
    // Exact match, not `includes`: "I used to be a developer by profession, but
    // no longer am" is a separate option and must not count as a professional.
    const pro = (row.MainBranch ?? '').trim() === 'I am a developer by profession'
    const sel = real(row.AISelect)
    if (pro && sel) { proTotal++; if (sel === 'Yes, I use AI tools daily') proDaily++ }

    const vals = LEVELS.map((l) => real(row[l]))
    if (vals.some(Boolean)) {
      matrixBase++
      const has = (i) => (vals[i] ?? '').split(';').some((t) => t.trim() === 'Writing code')
      if (has(0)) writing.mostly++
      else if (has(1)) writing.partially++
      if (has(2)) writing.wont++
    }
  }

  if (n < 1000) throw new Error(`survey: only ${n} rows parsed`)
  const pct = (num, den) => (den ? Math.round((num / den) * 1000) / 10 : null)
  const sum = (col, keys) => {
    const m = tally[col] ?? new Map()
    const den = [...m.values()].reduce((a, b) => a + b, 0)
    const num = keys.reduce((a, k) => a + (m.get(k) ?? 0), 0)
    return { pct: pct(num, den), base: den }
  }

  const adoption = sum('AISelect', [
    'Yes, I use AI tools daily',
    'Yes, I use AI tools weekly',
    'Yes, I use AI tools monthly or infrequently',
    'No, but I plan to soon',
  ])
  const favourable = sum('AISent', ['Favorable', 'Very favorable'])
  const distrust = sum('AIAcc', ['Somewhat distrust', 'Highly distrust'])
  const trust = sum('AIAcc', ['Somewhat trust', 'Highly trust'])
  const notThreat = sum('AIThreat', ['No'])

  log(`${n.toLocaleString()} responses`)
  log(`adoption ${adoption.pct}% · favourable ${favourable.pct}% · not-a-threat ${notThreat.pct}%`)
  log(`writing code with AI: ${pct(writing.mostly + writing.partially, matrixBase)}% (mostly ${pct(writing.mostly, matrixBase)}%)`)

  return {
    year: SURVEY_YEAR,
    asOf: SURVEY_YEAR,
    responses: n,
    source: `Stack Overflow Developer Survey ${SURVEY_YEAR} — computed from ${n.toLocaleString()} responses`,
    url: 'https://survey.stackoverflow.co/2025/ai',
    adoption,
    proDailyPct: pct(proDaily, proTotal),
    favourable,
    distrust,
    trust,
    highlyTrust: sum('AIAcc', ['Highly trust']),
    notThreat,
    writingCode: {
      mostlyPct: pct(writing.mostly, matrixBase),
      mostlyOrPartlyPct: pct(writing.mostly + writing.partially, matrixBase),
      wontPct: pct(writing.wont, matrixBase),
      base: matrixBase,
    },
  }
}


// ── Aider: measured AI-authored share, single project ──────────────────────
/**
 * Aider (the AI pair-programming tool) publishes per-release git-blame stats
 * of how many of its own new lines were written by aider itself:
 * `aider/website/_data/blame.yml`. This is the only public series where
 * AI-authorship is MEASURED (git blame) rather than claimed.
 *
 * Selection bias is the caveat and it is disqualifying for generalisation: an
 * AI coding tool, built by an AI-tools enthusiast, dogfooding itself. Treated
 * strictly as a case study; it does not feed the doom model.
 *
 * Parsed with a line scanner rather than a YAML lib — the file nests large
 * per-file blame tables we don't want, and the three top-level fields per
 * release are stable and flat.
 */
async function fetchAider() {
  log('Aider — per-release blame data…')
  const yml = await get(`${RAW}/Aider-AI/aider/main/aider/website/_data/blame.yml`)
  const rows = []
  let pct = null
  let date = null
  for (const line of yml.split('\n')) {
    let m = line.match(/^- aider_percentage: ([\d.]+)/)
    if (m) { pct = Number(m[1]); date = null; continue }
    m = line.match(/^  end_date: '([\d-]+)'/)
    if (m) { date = m[1]; continue }
    m = line.match(/^  end_tag: (\S+)/)
    if (m && pct != null && date) {
      rows.push({ t: date, v: Math.round(pct * 10) / 10, tag: m[1] })
      pct = null
    }
  }
  rows.sort((a, b) => a.t.localeCompare(b.t))
  if (rows.length < 10) throw new Error(`aider: only ${rows.length} releases parsed`)
  log(`${rows.length} releases, ${rows[0].t} → ${rows.at(-1).t}, latest ${rows.at(-1).v}%`)
  return {
    asOf: rows.at(-1).t,
    source: `Aider git-blame per release (${rows.length} releases) — aider's own codebase`,
    url: 'https://github.com/Aider-AI/aider/blob/main/aider/website/_data/blame.yml',
    points: rows.map(({ t, v }) => ({ t, v })),
  }
}


// ── HN Who's Hiring: junior vs senior demand ───────────────────────────────
/**
 * No one publishes an entry-level share of job postings, so this measures the
 * nearest real thing: the monthly "Ask HN: Who is hiring?" threads, counting
 * posts that mention "junior" and, as the contrast series, "senior".
 *
 * Methodology, stated because it is the caveat: full-text match via the HN
 * Algolia API within each thread's comments. It counts the word, not the
 * intent — "no juniors please" counts as a junior mention — and HN skews
 * startup/US. What makes it worth having anyway: the method is constant across
 * seven years, so the TREND is meaningful even if the level is approximate.
 * The doom model consumes it ratio-normalised to its own 2019 baseline, so
 * only the trend matters there.
 */
async function fetchHnHiring() {
  log('HN — listing whoishiring threads…')
  const threads = []
  for (let page = 0; page < 4; page++) {
    const body = await get(
      `https://hn.algolia.com/api/v1/search_by_date?tags=story,author_whoishiring&hitsPerPage=200&page=${page}`,
      { json: true },
    )
    for (const h of body.hits ?? []) {
      const m = (h.title ?? '').match(/^Ask HN: Who is hiring\? \((\w+) (\d{4})\)/)
      if (m) threads.push({ id: h.objectID, month: m[1], year: Number(m[2]) })
    }
    if (!body.hits?.length) break
  }
  const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']
  const wanted = threads
    .map((t) => ({ ...t, mi: MONTHS.indexOf(t.month) }))
    .filter((t) => t.mi >= 0 && t.year >= 2019)
    .map((t) => ({ ...t, t: `${t.year}-${String(t.mi + 1).padStart(2, '0')}-01` }))
  log(`${wanted.length} monthly threads since 2019`)

  const count = async (id, query) => {
    const q = query ? `&query=${encodeURIComponent(query)}` : ''
    const body = await get(
      `https://hn.algolia.com/api/v1/search?tags=comment,story_${id}&hitsPerPage=0${q}`,
      { json: true },
    )
    if (typeof body.nbHits !== 'number') throw new Error('no nbHits')
    return body.nbHits
  }

  const rows = await pool(wanted, 6, async (th) => {
    const [total, junior, senior] = await Promise.all([
      count(th.id, ''),
      count(th.id, 'junior'),
      count(th.id, 'senior'),
    ])
    if (total < 20) return null // dead/duplicate thread
    return { t: th.t, total, junior, senior }
  })
  rows.sort((a, b) => a.t.localeCompare(b.t))
  if (rows.length < 24) throw new Error(`hn: only ${rows.length} usable months`)

  const share = (n, d) => Math.round((n / d) * 1000) / 1000
  const juniorShare = rows.map((r) => ({ t: r.t, v: share(r.junior, r.total) }))
  const seniorShare = rows.map((r) => ({ t: r.t, v: share(r.senior, r.total) }))
  log(`${rows.length} months; latest total ${rows.at(-1).total}, junior ${rows.at(-1).junior}, senior ${rows.at(-1).senior}`)

  return {
    asOf: rows.at(-1).t,
    source: `HN "Who is hiring?" threads — share of posts mentioning the term (${rows.length} months)`,
    url: 'https://news.ycombinator.com/submitted?id=whoishiring',
    juniorShare,
    seniorShare,
    raw: rows,
  }
}

// ── main ───────────────────────────────────────────────────────────────────
const TASKS = [
  ['jobPostings', fetchJobPostings],
  ['aiPostings', fetchAiPostings],
  ['sweBench', fetchSweBench],
  ['metr', fetchMetr],
  ['aider', fetchAider],
  ['fred', fetchFred],
  ['bls', fetchBls],
  ['hnHiring', fetchHnHiring],
  ['stackOverflow', fetchStackOverflow],
  ['survey', fetchSurvey],
]

const failures = []
await mkdir(OUT, { recursive: true })

for (const [name, fn] of TASKS) {
  console.log(`\n▸ ${name}`)
  try {
    let existing
    try {
      existing = JSON.parse(await readFile(join(OUT, `${name}.json`), 'utf8'))
    } catch { /* first run */ }
    const data = await fn({ existing })
    await writeFile(
      join(OUT, `${name}.json`),
      JSON.stringify({ provenance: 'live', fetchedAt: new Date().toISOString(), ...data }, null, 2) + '\n',
    )
    log(`✓ wrote src/data/generated/${name}.json`)
  } catch (err) {
    if (err.skip) {
      log(`– ${err.message}`)
      continue
    }
    failures.push(name)
    console.error(`   ✗ ${err.message}`)
    console.error(`   keeping the existing snapshot for ${name}`)
  }
}

console.log(
  failures.length
    ? `\nDone with ${failures.length} failure(s): ${failures.join(', ')}. Existing snapshots left in place.`
    : '\nDone — all sources refreshed.',
)
process.exit(failures.length === TASKS.length ? 1 : 0)
