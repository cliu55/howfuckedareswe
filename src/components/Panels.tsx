import { useState } from 'react'
import { Panel, ProvenanceBadge, SeriesSource } from './Panel'
import { LineChart, fmtDate } from './LineChart'
import type { Dataset, NewsItem, Series } from '../lib/types'
import { mixOf } from '../lib/sources'
import { fmtHours } from '../lib/doom'

const pct = (v: number) => `${v.toFixed(0)}%`

/** Pull just the attribution fields off a series for <SeriesSource>. */
const src = (s: Series) => ({
  provenance: s.provenance,
  source: s.source,
  sourceUrl: s.sourceUrl,
})
const share = (v: number) => `${(v * 100).toFixed(0)}%`


/**
 * Satire attached to real numbers: the runs are the actual SWE-bench Verified
 * leaderboard, the commentary is keyed off whatever model is in the slug.
 */
const RUN_QUIPS: [RegExp, string][] = [
  [/opus/i, 'Ships more than you. Asks for less than you.'],
  [/gemini/i, 'Read the whole monorepo and still had context to spare.'],
  [/gpt|codex/i, 'Has no concept of Friday.'],
  [/sonnet/i, 'The one that started showing up in your PR reviews.'],
  [/doubao|seed[-_]code/i, 'Trained somewhere you cannot outsource to.'],
  [/openhands|opendevin/i, 'Open source, which is where your salary is heading.'],
  [/rovo|atlassian/i, 'Lives inside the ticket tracker now. It was always going to.'],
  [/qwen|deepseek|glm/i, 'Cost less to train than your team offsite.'],
]
const quipFor = (slug: string) =>
  RUN_QUIPS.find(([re]) => re.test(slug))?.[1] ?? 'Resolved real GitHub issues. Requested no equity.'

/** `livesweagent_claude-opus-4-5` → `livesweagent · claude opus 4 5` */
const prettySlug = (slug: string) =>
  slug.replace(/_/g, ' · ').replace(/-/g, ' ')


/**
 * Published survey figures, not a feed and not in the doom model.
 *
 * The point of the block is the divergence: adoption keeps climbing while
 * trust, sentiment and job confidence all fall. Colour follows the *reading*,
 * never the direction — a figure can be ominous for rising or for falling.
 */
function SentimentBlock({ ds }: { ds: Dataset }) {
  const stats = ds.sentiment.data
  return (
    <div className="border-t border-[var(--color-line)] pt-5">
      <h3 className="mb-2 text-[11px] text-[var(--color-ink)]">
        Developer sentiment
        <span className="ml-2 text-[var(--color-ink-faint)]">
          — computed from the annual developer survey
        </span>
      </h3>
      <p className="mb-3 text-[10px] leading-relaxed text-[var(--color-ink-mute)]">
        Adoption is climbing and confidence is falling at the same time. None of this feeds
        the countdown — it measures what developers <em>report</em>, not what agents can do.
      </p>

      <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
        {stats.map((st) => {
          const rising = st.prev ? st.value > st.prev.value : null
          const color = st.tone === 'ominous' ? 'var(--color-amber)' : 'var(--color-phos)'
          return (
            <div key={st.id} className="flex items-baseline gap-2.5">
              <dd
                className="w-[3.2rem] shrink-0 text-right text-[17px] leading-none tabular-nums"
                style={{ color }}
              >
                {st.value}%
              </dd>
              <div className="min-w-0">
                <dt className="text-[10px] leading-snug text-[var(--color-ink)]">{st.label}</dt>
                {st.prev && (
                  <p className="mt-0.5 text-[9px] text-[var(--color-ink-faint)]">
                    <span aria-hidden style={{ color }}>
                      {rising ? '▲' : '▼'}
                    </span>{' '}
                    from {st.prev.value}% in {st.prev.year}
                  </p>
                )}
                {st.note && (
                  <p className="mt-0.5 text-[9px] leading-snug text-[var(--color-ink-faint)]">
                    {st.note}
                  </p>
                )}
              </div>
            </div>
          )
        })}
      </dl>

      <SeriesSource
        provenance={ds.sentiment.provenance}
        source={`${ds.sentiment.source} — annual; percentages over non-NA respondents`}
        sourceUrl="https://survey.stackoverflow.co/2025/ai"
      />
    </div>
  )
}

export function AiPanel({ ds }: { ds: Dataset }) {
  const ai = ds.ai.data
  return (
    <Panel title="AI capability" aside={<ProvenanceBadge kind={mixOf([ai.sweBench, ai.timeHorizon, ai.aiAuthoredCodeShare, ai.aiAuthoredMeasured, ai.aiPostingShare, ai.devQuestions])} asOf={ds.ai.asOf} source={ds.ai.source} />}>
      <div className="space-y-6">
        <div>
          <h3 className="mb-2 text-[11px] text-[var(--color-ink)]">
            Autonomous task horizon
            <span className="ml-2 text-[var(--color-ink-faint)]">
              — task length completed 50% of the time, frontier models
            </span>
          </h3>
          <LineChart
            series={[ai.timeHorizon]}
            log
            format={(v) => fmtHours(v)}
            zeroBased={false}
            yLabel="log scale — a straight line here means exponential growth"
          />
          <SeriesSource {...src(ai.timeHorizon)} />
        </div>

        <div className="border-t border-[var(--color-line)] pt-5">
          <h3 className="mb-2 text-[11px] text-[var(--color-ink)]">
            SWE-bench Verified
            <span className="ml-2 text-[var(--color-ink-faint)]">— % of real GitHub issues resolved</span>
          </h3>
          <LineChart series={[ai.sweBench]} format={pct} />
          <SeriesSource {...src(ai.sweBench)} />
        </div>

        {ai.devQuestions && ai.devQuestionsControl && (
          <div className="border-t border-[var(--color-line)] pt-5">
            <h3 className="mb-2 text-[11px] text-[var(--color-ink)]">
              Questions asked to humans
              <span className="ml-2 text-[var(--color-ink-faint)]">— indexed, 2019 = 100</span>
            </h3>
            <LineChart
              series={[ai.devQuestions, ai.devQuestionsControl]}
              format={(v) => (v >= 10 ? v.toFixed(0) : v.toFixed(1))}
              log
              zeroBased={false}
              yLabel="log scale — both fell far enough that a linear axis hides the ending"
            />
            <p className="mt-1.5 text-[10px] leading-relaxed text-[var(--color-ink-mute)]">
              The control matters. Every Stack Exchange site is in decline, so a bare Stack
              Overflow line would prove nothing. The signal is the{' '}
              <span className="text-[var(--color-ink)]">crossover</span>: Stack Overflow
              tracked <em>above</em> the non-technical control for five years, fell below it
              in <span className="text-[var(--color-ink)]">August 2024</span>, and now runs
              about 4.7× lower. That gap is the part you can attribute to something other
              than forums declining generally.
            </p>
            <SeriesSource {...src(ai.devQuestions)} />
          </div>
        )}

        {ai.aiPostingShare && (
          <div className="border-t border-[var(--color-line)] pt-5">
            <h3 className="mb-2 text-[11px] text-[var(--color-ink)]">
              Postings mentioning AI
              <span className="ml-2 text-[var(--color-ink-faint)]">
                — demand for it, not displacement by it
              </span>
            </h3>
            <LineChart
              series={[ai.aiPostingShare]}
              format={(v) => `${v.toFixed(1)}%`}
            />
            <SeriesSource {...src(ai.aiPostingShare)} />
          </div>
        )}

        <div className="border-t border-[var(--color-line)] pt-5">
          <h3 className="mb-2 text-[11px] text-[var(--color-ink)]">
            AI-authored code
            <span className="ml-2 text-[var(--color-ink-faint)]">
              — cited claims vs one measured case
            </span>
          </h3>
          <LineChart series={[ai.aiAuthoredCodeShare]} format={share} />
          <SeriesSource {...src(ai.aiAuthoredCodeShare)} />
          <p className="mt-1.5 text-[10px] leading-relaxed text-[var(--color-ink-mute)]">
            Four dated statements from one company, replacing what used to be an invented
            curve here. Caveats in full: it is Google alone; “generated, then reviewed and
            accepted by engineers” is their definition, not an audit; and the 50% point is
            secondhand (“up from 50% last fall”, per the April 2026 reporting). This series
            feeds the countdown at weight 0.15.
          </p>

          {ai.aiAuthoredMeasured && (
            <div className="mt-4">
              <LineChart
                series={[ai.aiAuthoredMeasured]}
                format={(v) => `${v.toFixed(0)}%`}
              />
              <SeriesSource {...src(ai.aiAuthoredMeasured)} />
              <p className="mt-1.5 text-[10px] leading-relaxed text-[var(--color-ink-mute)]">
                The only public series where AI authorship is <em>measured</em> — git blame
                on aider&rsquo;s own repo, per release. An AI coding tool dogfooding itself
                is a ceiling, not an average, which is why it stays out of the countdown.
                The per-release noise is real: some releases are 90% aider, some are mostly
                human.
              </p>
            </div>
          )}
        </div>

        <SentimentBlock ds={ds} />

        {ai.topRuns && (
          <div className="border-t border-[var(--color-line)] pt-5">
            <h3 className="mb-3 text-[11px] text-[var(--color-ink)]">
              Top SWE-bench runs
              <span className="ml-2 text-[var(--color-ink-faint)]">— official submissions</span>
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[400px] text-left text-[10px]">
                <thead className="text-[var(--color-ink-faint)]">
                  <tr className="border-b border-[var(--color-line)]">
                    <th scope="col" className="py-1.5 pr-3 font-normal">system</th>
                    <th scope="col" className="py-1.5 pr-3 font-normal">submitted</th>
                    <th scope="col" className="py-1.5 text-right font-normal">resolved</th>
                  </tr>
                </thead>
                <tbody>
                  {ai.topRuns.map((r, i) => {
                    const quip = quipFor(r.slug)
                    const repeat = i > 0 && quipFor(ai.topRuns![i - 1].slug) === quip
                    return (
                    <tr key={r.slug} className="border-b border-[var(--color-line)]/60 align-top">
                      <td className="py-2 pr-3">
                        <div className="text-[var(--color-phos)]">{prettySlug(r.slug)}</div>
                        {!repeat && (
                          <div className="mt-0.5 text-[9px] text-[var(--color-ink-faint)]">
                            {quip}
                          </div>
                        )}
                      </td>
                      <td className="py-2 pr-3 whitespace-nowrap text-[var(--color-ink-mute)]">
                        {fmtDate(new Date(r.date))}
                      </td>
                      <td className="py-2 text-right tabular-nums text-[var(--color-ink)]">
                        {r.score.toFixed(1)}%
                      </td>
                    </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <SeriesSource {...src(ai.sweBench)} />
          </div>
        )}
      </div>
    </Panel>
  )
}

export function JobsPanel({ ds }: { ds: Dataset }) {
  const j = ds.jobs.data
  const latest = j.postingsIndex.points[j.postingsIndex.points.length - 1].v
  const peak = Math.max(...j.postingsIndex.points.map((p) => p.v))

  const c = j.competition
  const juniorLatest = j.juniorShare.points[j.juniorShare.points.length - 1]
  const stats = [
    { k: 'postings vs peak', v: `−${(((peak - latest) / peak) * 100).toFixed(0)}%`, sub: 'software dev, Indeed' },
    ...(c
      ? [
          {
            k: 'unemployed per opening',
            v: c.unemployedPerOpening.toFixed(1),
            sub: 'info industry, BLS/JOLTS',
          },
          {
            k: 'median weeks unemployed',
            v: `${c.medianWeeksUnemployed} wk`,
            sub: 'all workers, UEMPMED',
          },
        ]
      : []),
    {
      k: '“junior” in hiring posts',
      v: share(juniorLatest.v),
      sub: `HN, ${fmtDate(new Date(juniorLatest.t))}`,
    },
  ]

  return (
    <Panel title="Job market" aside={<ProvenanceBadge kind={mixOf([j.postingsIndex, j.postingsIndexAllJobs, j.unemploymentRate, j.techEmployment, j.jobOpenings, j.juniorShare])} asOf={ds.jobs.asOf} source={ds.jobs.source} />}>
      <dl className="mb-5 grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">
        {stats.map((s) => (
          <div key={s.k}>
            <dd className="text-[19px] leading-none tabular-nums text-[var(--color-amber)]">
              {s.v}
            </dd>
            <dt className="mt-1.5 text-[9px] leading-snug text-[var(--color-ink-faint)]">
              {s.k}
              <span className="block text-[8px] text-[var(--color-ink-faint)]/70">{s.sub}</span>
            </dt>
          </div>
        ))}
      </dl>

      <div className="space-y-6">
        <div className="border-t border-[var(--color-line)] pt-5">
          <h3 className="mb-2 text-[11px] text-[var(--color-ink)]">
            Job postings index
            <span className="ml-2 text-[var(--color-ink-faint)]">— 100 = Feb 2020</span>
          </h3>
          <LineChart series={[j.postingsIndex, j.postingsIndexAllJobs]} format={(v) => v.toFixed(0)} />
          <SeriesSource {...src(j.postingsIndex)} />
        </div>

        <div className="border-t border-[var(--color-line)] pt-5">
          <h3 className="mb-2 text-[11px] text-[var(--color-ink)]">
            Who employers ask for
            <span className="ml-2 text-[var(--color-ink-faint)]">
              — HN “Who is hiring?” posts mentioning each term
            </span>
          </h3>
          <LineChart
            series={j.seniorShare ? [j.juniorShare, j.seniorShare] : [j.juniorShare]}
            format={share}
          />
          <SeriesSource {...src(j.juniorShare)} />
          <p className="mt-1.5 text-[10px] leading-relaxed text-[var(--color-ink-mute)]">
            Word counts, not intent — “no juniors please” counts as a junior mention. The
            method is constant since 2019, so the trend is the signal: junior mentions have
            roughly halved from their 2019 share while senior mentions held steady. The
            countdown consumes this normalised to its 2019 baseline.
          </p>
        </div>

        <div className="border-t border-[var(--color-line)] pt-5">
          <h3 className="mb-2 text-[11px] text-[var(--color-ink)]">
            Information industry unemployment
            <span className="ml-2 text-[var(--color-ink-faint)]">
              — no BLS series exists for SWEs alone
            </span>
          </h3>
          <LineChart series={[j.unemploymentRate]} format={(v) => `${v.toFixed(1)}%`} />
          <SeriesSource {...src(j.unemploymentRate)} />
        </div>

        {j.techEmployment && (
          <div className="border-t border-[var(--color-line)] pt-5">
            <h3 className="mb-2 text-[11px] text-[var(--color-ink)]">
              Tech employment
              <span className="ml-2 text-[var(--color-ink-faint)]">
                — headcount, harder to argue with than a rate
              </span>
            </h3>
            <LineChart
              series={[j.techEmployment]}
              format={(v) => `${(v / 1000).toFixed(2)}M`}
              zeroBased={false}
            />
            <SeriesSource {...src(j.techEmployment)} />
          </div>
        )}

        {j.jobOpenings && (
          <div className="border-t border-[var(--color-line)] pt-5">
            <h3 className="mb-2 text-[11px] text-[var(--color-ink)]">
              Job openings
              <span className="ml-2 text-[var(--color-ink-faint)]">
                — JOLTS, actual counted vacancies
              </span>
            </h3>
            <LineChart series={[j.jobOpenings]} format={(v) => `${v.toFixed(0)}k`} />
            <SeriesSource {...src(j.jobOpenings)} />
          </div>
        )}
      </div>
    </Panel>
  )
}

/**
 * layoffs.fyi's shared Airtable view. The embed URL is the official one and the
 * view sets no frame-ancestors restriction, so framing is sanctioned — but its
 * JSON endpoint (`readSharedViewData`) redirects to a login, so the numbers
 * cannot be read out, themed, or fed into the doom model. Embed or nothing.
 *
 * Gated behind a click so the page never contacts a third party, or lets one
 * set cookies, unless the reader asks for it.
 */
const LAYOFFS_FYI_EMBED =
  'https://airtable.com/embed/app1PaujS9zxVGUZ4/shroKsHx3SdYYOzeh/tblleV7Pnb6AcPCYL'

function LayoffsFyiEmbed() {
  const [loaded, setLoaded] = useState(false)

  return (
    <div className="border-t border-[var(--color-line)] pt-5">
      <h3 className="mb-2 text-[11px] text-[var(--color-ink)]">
        Tracked layoff events
        <span className="ml-2 text-[var(--color-ink-faint)]">— live from layoffs.fyi</span>
      </h3>

      {loaded ? (
        <div className="overflow-hidden border border-[var(--color-line)]">
          <iframe
            src={LAYOFFS_FYI_EMBED}
            title="layoffs.fyi layoff tracker"
            className="block w-full bg-white"
            height={480}
            loading="lazy"
            referrerPolicy="no-referrer"
            sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox"
          />
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setLoaded(true)}
          className="flex w-full flex-col items-center gap-2 border border-dashed border-[var(--color-line)] px-4 py-8 text-center transition-colors hover:border-[var(--color-phos-dim)]"
        >
          <span className="text-[11px] tracking-[0.12em] text-[var(--color-phos)]">
            [ LOAD EXTERNAL FEED ]
          </span>
          <span className="max-w-[46ch] text-[9px] leading-relaxed text-[var(--color-ink-faint)]">
            Embeds an Airtable frame from layoffs.fyi. Loading it contacts Airtable and lets
            them set cookies, so nothing is fetched until you click.
          </span>
        </button>
      )}

      <p className="mt-1.5 flex items-center gap-1.5 text-[9px] text-[var(--color-ink-faint)]">
        <span aria-hidden className="inline-block h-1 w-1 rounded-full bg-[var(--color-phos)]" />
        <a
          href="https://layoffs.fyi"
          target="_blank"
          rel="noreferrer noopener"
          className="underline decoration-dotted underline-offset-2 hover:text-[var(--color-phos)]"
        >
          layoffs.fyi
        </a>
        — third-party embed; their table, their styling, their numbers
      </p>
    </div>
  )
}

export function LayoffsPanel({ ds }: { ds: Dataset }) {
  const rows = ds.euphemisms.data
  const trend = ds.jobs.data.layoffsDischarges

  return (
    <Panel
      title="Layoffs"
      aside={
        <ProvenanceBadge
          kind={trend ? 'live' : 'seed'}
          asOf={trend?.points.at(-1)?.t ?? ds.euphemisms.asOf}
          source={trend?.source ?? ds.euphemisms.source}
        />
      }
    >
      {trend && (
        <div>
          <h3 className="mb-2 text-[11px] text-[var(--color-ink)]">
            Layoffs &amp; discharges
            <span className="ml-2 text-[var(--color-ink-faint)]">
              — information sector, per month
            </span>
          </h3>
          <LineChart series={[trend]} format={(v) => `${v.toFixed(0)}k`} />
          <SeriesSource {...src(trend)} />
        </div>
      )}

      <div className="mt-5">
        <LayoffsFyiEmbed />
      </div>

      <div className="mt-5 border-t border-[var(--color-line)] pt-4">
        <h3 className="mb-1 text-[11px] text-[var(--color-ink)]">
          Euphemism decoder
          <span className="ml-2 text-[var(--color-ink-faint)]">
            — satire; phrases are genres, not quotes
          </span>
        </h3>
        <ul className="mt-3 divide-y divide-[var(--color-line)]">
          {rows.map((r) => (
            <li key={r.id} className="py-2.5">
              <p className="text-[10px] text-[var(--color-ink-mute)]">
                <span className="text-[var(--color-ink-faint)]">said:</span> “{r.phrase}”
              </p>
              <p className="mt-0.5 text-[10px] text-[var(--color-phos-dim)]">
                <span className="text-[var(--color-ink-faint)]">meant:</span> {r.translation}
              </p>
            </li>
          ))}
        </ul>
      </div>
    </Panel>
  )
}

const CATS: { id: NewsItem['category'] | 'all'; label: string }[] = [
  { id: 'all', label: 'all' },
  { id: 'ai', label: 'ai' },
  { id: 'jobs', label: 'jobs' },
  { id: 'copium', label: 'copium' },
]

export function NewsPanel({ ds }: { ds: Dataset }) {
  const [cat, setCat] = useState<NewsItem['category'] | 'all'>('all')
  const items = ds.news.data.filter((n) => cat === 'all' || n.category === cat)

  return (
    <Panel
      title="Wire"
      aside={<ProvenanceBadge kind={ds.news.provenance} asOf={ds.news.asOf} source={ds.news.source} />}
    >
      <div className="mb-3 flex flex-wrap gap-1.5">
        {CATS.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => setCat(c.id)}
            aria-pressed={cat === c.id}
            className={`border px-2 py-1 text-[9px] tracking-[0.12em] uppercase transition-colors ${
              cat === c.id
                ? 'border-[var(--color-phos)] text-[var(--color-phos)]'
                : 'border-[var(--color-line)] text-[var(--color-ink-faint)] hover:text-[var(--color-ink-mute)]'
            }`}
          >
            {c.label}
          </button>
        ))}
      </div>

      <ul className="divide-y divide-[var(--color-line)] border-t border-[var(--color-line)]">
        {items.map((n) => (
          <li key={n.id} className="flex gap-3 py-2.5">
            <span
              aria-hidden
              className="mt-1 shrink-0 text-[10px]"
              style={{
                color:
                  n.sentiment > 0.4
                    ? 'var(--color-crit)'
                    : n.sentiment > 0
                      ? 'var(--color-amber)'
                      : 'var(--color-phos-dim)',
              }}
            >
              {n.sentiment > 0.4 ? '▲▲' : n.sentiment > 0 ? '▲' : '▼'}
            </span>
            <div className="min-w-0">
              {n.url ? (
                <a
                  href={n.url}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="text-[11px] leading-snug text-[var(--color-ink)] hover:text-[var(--color-phos)] hover:underline"
                >
                  {n.headline}
                </a>
              ) : (
                <p className="text-[11px] leading-snug text-[var(--color-ink)]">{n.headline}</p>
              )}
              <p className="mt-1 text-[9px] text-[var(--color-ink-faint)]">
                {n.outlet} · {fmtDate(new Date(n.date))} · {n.category}
              </p>
            </div>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-[9px] leading-snug text-[var(--color-ink-faint)]">
        ▲ = accelerates the countdown · ▼ = buys you time. Sentiment is editorial and
        deliberately unscientific.
      </p>
    </Panel>
  )
}
