import type { Euphemism, Sourced } from '../lib/types'

/**
 * Not data — a joke. These are phrase *genres*, deliberately not attributed to
 * any company, because inventing figures and quotes for real employers is the
 * one thing this project will not do. The factual layoff feed is the embedded
 * layoffs.fyi tracker and the live JOLTS series next to it.
 */
export const euphemisms: Sourced<Euphemism[]> = {
  provenance: 'seed',
  asOf: '2026-08-06',
  source: 'Satire — not attributed to any company',
  data: [
    {
      id: 'e1',
      phrase: 'Reallocating headcount toward agentic products',
      translation: 'The agents do not have a headcount.',
    },
    {
      id: 'e2',
      phrase: 'A year of efficiency',
      translation: 'Efficiency is measured in people who no longer work here.',
    },
    {
      id: 'e3',
      phrase: 'Moving to an AI-first operating model',
      translation: 'We found a model that does not take PTO.',
    },
    {
      id: 'e4',
      phrase: 'Flattening the org, removing layers',
      translation: 'The layer being removed had a mortgage.',
    },
    {
      id: 'e5',
      phrase: 'Sharpening focus on our biggest bets',
      translation: 'The biggest bet was that you were optional.',
    },
    {
      id: 'e6',
      phrase: 'Organizational changes for the AI era',
      translation: 'You trained your replacement in a design doc.',
    },
    {
      id: 'e7',
      phrase: 'Rightsizing after a period of over-hiring',
      translation: 'Over-hiring is a decision executives make and engineers pay for.',
    },
    {
      id: 'e8',
      phrase: 'Investing in AI-driven productivity',
      translation: 'Productivity went up. Population went down.',
    },
    {
      id: 'e9',
      phrase: 'These roles no longer align with our strategic direction',
      translation: 'The strategy is fewer of you.',
    },
    {
      id: 'e10',
      phrase: 'We are grateful for their many contributions',
      translation: 'Gratitude, notably, is not severance.',
    },
  ],
}
