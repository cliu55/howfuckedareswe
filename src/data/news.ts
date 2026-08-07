import type { NewsItem, Sourced } from '../lib/types'

/**
 * SEED DATA — illustrative, hand-curated, NOT live.
 *
 * These are written as satirical placeholder headlines, not attributed quotes
 * from real articles. Outlet names are stand-ins for the shape of a real feed.
 * Wire `newsAdapter` in `lib/sources.ts` to an RSS/HN source to replace them.
 */

export const news: Sourced<NewsItem[]> = {
  provenance: 'seed',
  asOf: '2026-07-28',
  source: 'Satirical placeholder headlines — illustrative',
  data: [
    {
      id: 'n1',
      headline: 'Lab announces model that "reasons about codebases holistically", declines to define holistically',
      outlet: 'The Gradient Descent',
      date: '2026-07-28',
      category: 'ai',
      sentiment: 0.6,
    },
    {
      id: 'n2',
      headline: 'Startup raises $400M to build AI that reviews the AI that wrote the code',
      outlet: 'TechFunding Daily',
      date: '2026-07-24',
      category: 'ai',
      sentiment: 0.4,
    },
    {
      id: 'n3',
      headline: 'Junior developer openings hit record low; bootcamp pivots to teaching prompt hygiene',
      outlet: 'Hiring Lab Weekly',
      date: '2026-07-21',
      category: 'jobs',
      sentiment: 0.8,
    },
    {
      id: 'n4',
      headline: 'CTO insists AI will "augment, not replace" engineers, from a team of four that used to be forty',
      outlet: 'Enterprise Weekly',
      date: '2026-07-19',
      category: 'copium',
      sentiment: 0.7,
    },
    {
      id: 'n5',
      headline: 'New benchmark released Tuesday, saturated Thursday',
      outlet: 'Benchmark Observer',
      date: '2026-07-16',
      category: 'ai',
      sentiment: 0.9,
    },
    {
      id: 'n6',
      headline: 'Study finds AI-generated code has 3x more subtle bugs, engineers hired to fix them',
      outlet: 'ACM Queue-ish',
      date: '2026-07-12',
      category: 'jobs',
      sentiment: -0.6,
    },
    {
      id: 'n7',
      headline: 'Company rehires laid-off staff as contractors to "supervise the agents"',
      outlet: 'Labour Report',
      date: '2026-07-08',
      category: 'jobs',
      sentiment: 0.3,
    },
    {
      id: 'n8',
      headline: 'Legacy COBOL system remains the only thing no model will touch',
      outlet: 'Mainframe Monthly',
      date: '2026-07-03',
      category: 'copium',
      sentiment: -0.9,
    },
    {
      id: 'n9',
      headline: 'Model achieves 85% on SWE-bench, immediately blamed for the outage',
      outlet: 'Postmortem Post',
      date: '2026-06-29',
      category: 'ai',
      sentiment: 0.5,
    },
    {
      id: 'n10',
      headline: 'Senior engineers report spending 80% of the week reading diffs they did not write',
      outlet: 'Developer Survey Co.',
      date: '2026-06-25',
      category: 'jobs',
      sentiment: 0.6,
    },
    {
      id: 'n11',
      headline: 'Recruiter posts role requiring 10 years of experience with a framework released in 2024',
      outlet: 'Hiring Lab Weekly',
      date: '2026-06-20',
      category: 'copium',
      sentiment: -0.2,
    },
    {
      id: 'n12',
      headline: 'Regulator opens consultation on automated employment displacement, replies due 2031',
      outlet: 'Policy Wire',
      date: '2026-06-15',
      category: 'jobs',
      sentiment: -0.4,
    },
  ],
}
