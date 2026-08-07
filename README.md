# howfuckedareswe

A satirical dashboard that tracks AI progress, the software engineering job
market, and counts down to total developer obsolescence. The countdown is
arithmetic over five stated assumptions, all of which you can drag.

```bash
npm install && npm run dev
```

## What's here

| Area | Where |
|---|---|
| Doom model (the countdown maths) | [`src/lib/doom.ts`](src/lib/doom.ts) |
| Data adapters | [`src/lib/sources.ts`](src/lib/sources.ts) |
| Build-time fetch | [`scripts/fetch-data.mjs`](scripts/fetch-data.mjs) |
| Runtime fetch | [`src/lib/live.ts`](src/lib/live.ts) |
| Seed datasets | [`src/data/`](src/data) |
| Charts | [`src/components/LineChart.tsx`](src/components/LineChart.tsx) |
| ASCII scene | [`src/components/DoomAnimation.tsx`](src/components/DoomAnimation.tsx) |

## Data sources

Refresh the build-time snapshots any time:

```bash
npm run fetch-data
```

### Live

| Data | Source | How |
|---|---|---|
| Autonomous task horizon (p50) + METR's fitted doubling time | [METR time horizons](https://metr.org/time-horizons/) | build-time (HTML scrape) |
| Software dev + all-jobs postings index | [Indeed Hiring Lab](https://github.com/hiring-lab/job_postings_tracker) (Feb 2020 = 100) | build-time |
| Share of US postings mentioning AI | [Indeed Hiring Lab AI tracker](https://github.com/hiring-lab/ai-tracker) | build-time |
| SWE-bench Verified frontier + top runs | [SWE-bench official submissions](https://github.com/SWE-bench/experiments) | build-time |
| Information industry unemployment (12-mo avg) | [BLS via FRED](https://fred.stlouisfed.org/series/LNU04032237) `LNU04032237` | build-time, **needs key** |
| Computer systems design employment | [BLS via FRED](https://fred.stlouisfed.org/series/CES6054150001) `CES6054150001` | build-time, **needs key** |
| Information sector job openings | [BLS JOLTS](https://www.bls.gov/jlt/) `JTS510000000000000JOL` | build-time, **needs key** |
| Layoffs & discharges, monthly | [BLS JOLTS](https://www.bls.gov/jlt/) `JTS510000000000000LDL` | build-time, **needs key** |
| Stack Overflow question volume + control | [Stack Exchange API](https://api.stackexchange.com) | build-time |
| Aider's AI-authored share of its own code | [Aider blame data](https://github.com/Aider-AI/aider/blob/main/aider/website/_data/blame.yml) — git blame per release | build-time |
| Junior/senior mention share in hiring posts | HN "Who is hiring?" threads via the Algolia API | build-time |
| Unemployment level + median weeks unemployed | [FRED](https://fred.stlouisfed.org) `LNU03032237`, `UEMPMED` | build-time, **needs key** |
| Headlines | Hacker News via the Algolia API | runtime |
| Named layoff events | [layoffs.fyi](https://layoffs.fyi) shared Airtable view | **embed** (click-to-load iframe) |

All free. FRED and BLS need free keys; everything else is keyless. `fetch-data`
**skips** a keyed source cleanly when its key is absent rather than failing the
run, so the repo works for anyone who clones it.

```bash
cp .env.example .env      # then paste your key — .env is gitignored
npm run fetch-data
```

Neither FRED nor BLS sends CORS headers, so both can only ever run server-side.
Keys stay in `.env` (gitignored, `chmod 600`), are read via Node's
`--env-file-if-exists`, and never enter the bundle — only the fetched numbers
are committed. Get keys at
[FRED](https://fredaccount.stlouisfed.org/apikeys) and
[BLS](https://data.bls.gov/registrationEngine/).

The build-time ones run in Node because the Indeed sector
file is ~10 MB and several sources send no CORS headers; committed JSON
snapshots in `src/data/generated/` keep `npm run build` green offline. The
Hacker News adapter runs in the browser and fails soft to seed headlines.

### Still seed

Nothing. Every series and stat tile on the page is fetched, computed, cited, or
measured. The entry-level gap is covered by a labelled proxy (share of HN "Who
is hiring?" posts mentioning "junior", with "senior" as the contrast series —
word counts, constant method since 2019, trend-meaningful). The old invented
stat tiles (applications per hire, time to offer) were replaced with computed
ones: unemployed-per-opening (FRED level ÷ JOLTS openings, matched month) and
median weeks unemployed (UEMPMED). The satirical euphemism decoder remains, and
remains satire.

### AI-authored code: cited, measured, and still not a feed

Three tiers now stand in for the number nobody publishes:

- **Cited** — Google's dated earnings-call statements (25% Oct 2024 → 30%+
  Apr 2025 → ~50% fall 2025 → 75% Apr 2026). Four real points from one named
  company, each quoted with its source in `src/data/ai.ts`. This series feeds
  the doom model's AI_AUTHORED_CODE component; caveats (one company, their
  definition, the 50% point secondhand) are printed beside the chart.
- **Measured** — aider's per-release git blame of its own repo: the only public
  series where AI authorship is measured rather than claimed. A ceiling, not an
  average (an AI tool dogfooding itself), so it is charted as a case study and
  kept out of the model.
- **Rejected as substitutes** — SO survey adoption rates (people, not lines),
  Indeed AI-mention share (demand, not authorship), GitHub Octoverse (activity
  counts; GitHub explicitly declines the causal claim).

### The layoffs.fyi embed

Their shared Airtable view is framed at the official `airtable.com/embed/...`
URL. Two consequences worth knowing:

- **It cannot be themed.** It renders Airtable's own light UI inside the dark
  terminal, and cross-origin content can't be restyled. That is the honest
  trade: their table, their styling, their numbers.
- **It cannot feed the model.** No data extraction means the countdown still
  can't use per-company events — only the JOLTS aggregate.

It is gated behind a click, so the page never contacts Airtable or lets them set
cookies unless the reader asks. Nothing is fetched on load.

This replaced the project's worst data: hand-invented layoff figures attached to
real company names. Those are gone. What remains of the satire is an
**unattributed** euphemism decoder — phrase genres, not quotes, tied to no
employer.

The UI is honest about all of this on its own: every panel carries a
LIVE/MIXED/SEED badge, every chart carries a source line, seed stat tiles carry
an asterisk, and the footer lists exactly what is still fake.

### Sources investigated and rejected

Recorded so nobody re-does the search:

| Candidate | Verdict |
|---|---|
| METR `eval-analysis-public` (the *repo*) | horizon outputs are DVC-tracked, not in git. **But the published page carries the finished dataset inline** — see below. The repo was the wrong place to look |
| Epoch AI data hub | publishes hardware, models, companies, polling — no time-horizon or benchmark-score dataset |
| Aider polyglot leaderboard | real and popular, but last entry is 2025-10 — stale, would ship as "live" while frozen |
| Terminal-Bench / HAL (Princeton) | leaderboards are site-rendered; no public data endpoint |
| Big Local News `warn-scraper` | CLI only; `warn-github-flow` is CI machinery. The actual WARN data sits behind their platform |
| layoffs.fyi Airtable **as data** | `readSharedViewData` redirects to a login, so the rows cannot be read out. The view sets no `frame-ancestors`, so it is **embedded** instead — see below |
| Indeed wage tracker | sector taxonomy covers service/hourly work only — no software sector |

### The METR scrape — read this before trusting it

`metr.org/time-horizons/` ships the finished `METR-Horizon-v1.1` dataset inline,
as a `benchmarkDataV1_1` object inside a `<script>` tag: per-model
`p50_horizon_length` in minutes with confidence intervals, an `is_sota` flag,
and METR's own fitted `doubling_time_in_days`.

**This is a scrape, not an API.** There is no stability promise; a page
restructure breaks it. The parser brace-matches the object (so a `}` inside a
string can't truncate it), validates that it got ≥ 5 agents and a doubling time,
and throws otherwise — at which point `fetch-data` keeps the last good snapshot
rather than shipping garbage. robots.txt permits `/time-horizons`; only
`/time-horizon-draft` is disallowed.

Two things changed as a result:

- The horizon series is now **measured**: GPT-2 at 3 seconds (Feb 2019) through
  17.4 hours (Apr 2026), frontier models only.
- **The model's most important assumption is no longer ours.** `doublingMonths`
  defaulted to a hand-picked 7. METR's own fit is **4.23 months** since 2023
  (CI 3.43–5.19), 6.17 all-time. `defaultParams()` now reads it from the data,
  and the slider shows METR's figure and CI beneath it. The doom date moved
  ~18 months closer as a direct result.

Three notes on labelling, all deliberate:

- The Stack Overflow chart ships **with a non-technical control**, because every
  Stack Exchange site is in decline and a bare SO line would be a motivated
  stat. The honest signal is the crossover: SO tracked *above* the control for
  five years, fell below it in August 2024, and now runs ~4.7× lower. Plotted on
  a log axis because both fell far enough that a linear one hides the ending.

- The AI-postings series measures *demand for AI skills*, not AI displacing
  engineers. Charted separately, kept out of the doom model.
- `LNU04032237` is the **information industry** unemployment rate, and the JOLTS
  series are the **information sector** (NAICS 51). Neither BLS nor JOLTS
  publishes anything for software engineers alone, so these are the closest
  public proxies and every chart says so rather than passing them off as SWE
  numbers. `LNU*` is not seasonally adjusted, so a 12-month trailing mean is
  published instead of the raw print, which swings ~1.5pp on seasonality.

## Deploying

Static build, no server. Cloudflare Pages settings:

| Setting | Value |
|---|---|
| Build command | `npm run build` |
| Output directory | `dist` |
| Node version | from `.nvmrc` (22) |

No environment variables are needed **at build time on the host** — the data
snapshots in `src/data/generated/` are committed, so the site builds offline.
The API keys are only needed by `npm run fetch-data`, which runs in GitHub
Actions, not on Cloudflare.

`.github/workflows/refresh-data.yml` re-runs the fetchers weekly, builds to
verify nothing broke, and commits the updated snapshots — which triggers a
Cloudflare redeploy. Add `FRED_API_KEY` and `BLS_API_KEY` as repository secrets;
without them the keyed sources skip cleanly and everything else still refreshes.

## Data attribution and licensing

The dashboard redistributes derived figures from other people's data. Each
chart carries its own source line in the UI; the licences that come with
obligations are:

| Source | Licence | What it means here |
|---|---|---|
| Indeed Hiring Lab | CC BY 4.0 | attribution required — given per chart and in the footer |
| Stack Overflow Developer Survey | ODbL 1.0 | attribution + share-alike on derived databases; we publish aggregate percentages and the computation is open in `scripts/fetch-data.mjs` |
| BLS / FRED | US public domain | no restriction; attributed anyway |
| METR, SWE-bench, Aider | see each project | attributed with links |
| layoffs.fyi | embedded, not copied | their table renders from their own servers |

If you fork this and strip the attribution, you break the first two.

## Adding a source

Each dataset flows through one adapter in `src/lib/sources.ts`. Build-time
sources go in `scripts/fetch-data.mjs` and write to `src/data/generated/`;
runtime ones go in `src/lib/live.ts` and must be CORS-open, keyless, small, and
fail soft. Mark per-series provenance with `live()` / `asSeed()` and the badges
update themselves.

## The doom model

Two halves, in `computeDoom()`:

1. **Capability** — the 50%-success autonomous task horizon doubles every
   `doublingMonths`, so reaching a target horizon takes
   `log2(target / current) × doublingMonths`.
2. **Diffusion** — capability isn't deployment. Add an adoption lag, then
   shorten it in proportion to how fast job postings are already falling, and
   stretch the tail by the automation ceiling.

The "fucked score" is a weighted blend of agent autonomy (0.35), market
deterioration (0.35), benchmark saturation (0.15) and AI-authored code share
(0.15). "Show your work" in the UI prints every step.

### Why the doom date is anchored to the data

`computeDoom` produces a *duration* — months remaining. Turning that into a date
needs an anchor, and the anchor is the latest observation the model saw
(`dataAnchor`), never page-load time.

Anchoring to "now" is the obvious-looking choice and it is wrong: the doom date
walks forward on every page load, so the clock resets instead of counting down
and would still read the same time remaining a year later. Anchored to the data,
the doom date is fixed between refreshes — real time eats into it, the dial
climbs on its own, and the date only moves when new data moves the projection.

### The dial and the evidence

The meter and the clock show the same quantity, on purpose:

- **The dial** (`fuckedScore`) is the countdown as a percentage — the share of
  the runway from ChatGPT's launch (the epoch) to your projected doom date
  that is already behind us. Sliders move it, and clock-zero reads exactly 100.
- **The evidence** (`evidenceScore`) is the empirical blend of today's
  indicators, shown under the dial. Sliders barely move it, because settings
  can't rewrite measurements.

An earlier design used the evidence blend as the dial, with the projection as a
tick mark. It was defensible and unusable: everyone read the dial as progress
toward the doom date, and was rightly confused that tuning didn't move it and
that clock-zero wasn't 100. A dial next to a countdown must agree with the
countdown; the measurements live one row below, labelled as measurements.

It is not a forecast. It is a spreadsheet with a skull on it.

## Notes

- Chart series colours are validated for the OKLCH lightness band, chroma floor,
  colour-vision-deficiency separation and contrast against the `#0b0f14` chart
  surface. If you change them, re-validate.
- Scanlines, flicker and the marquee all respect `prefers-reduced-motion`.
- Every chart has a data-table toggle, so nothing is conveyed by colour alone.
