/**
 * Runtime live fetches — the ones a browser can actually do.
 *
 * Only sources that (a) send permissive CORS headers, (b) need no API key, and
 * (c) return a small payload belong here. Everything else is pulled at build
 * time by `scripts/fetch-data.mjs`.
 *
 * Every function here fails soft: on timeout, network error or unexpected
 * shape it returns null and the caller falls back to seed data. A dashboard
 * that white-screens because Hacker News is down is worse than a stale one.
 */

import type { NewsItem } from './types'

const TIMEOUT_MS = 6000

async function getJson<T>(url: string): Promise<T | null> {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS)
  try {
    const res = await fetch(url, { signal: ctrl.signal })
    if (!res.ok) return null
    return (await res.json()) as T
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

interface AlgoliaHit {
  objectID: string
  title: string | null
  url: string | null
  points: number | null
  num_comments: number | null
  created_at: string
}

/**
 * Hacker News via the Algolia API — public, keyless, `Access-Control-Allow-
 * Origin: *`, and the closest thing this industry has to a shared front page.
 *
 * Two queries so the wire has both halves of the story, then interleaved.
 */
export async function fetchHackerNews(): Promise<NewsItem[] | null> {
  const base = 'https://hn.algolia.com/api/v1/search_by_date'
  const common = 'tags=story&hitsPerPage=24&numericFilters=points>40'

  const [ai, jobs] = await Promise.all([
    getJson<{ hits: AlgoliaHit[] }>(
      `${base}?query=${encodeURIComponent('AI coding agent')}&${common}`,
    ),
    getJson<{ hits: AlgoliaHit[] }>(
      `${base}?query=${encodeURIComponent('software engineer hiring layoffs')}&${common}`,
    ),
  ])
  if (!ai && !jobs) return null

  const map = (hits: AlgoliaHit[] | undefined, category: NewsItem['category']): NewsItem[] =>
    (hits ?? [])
      .filter((h) => h.title)
      .map((h) => ({
        id: `hn-${h.objectID}`,
        headline: h.title as string,
        outlet: `HN · ${h.points ?? 0} pts · ${h.num_comments ?? 0} comments`,
        date: h.created_at.slice(0, 10),
        category,
        // Engagement as a crude proxy for "how much did this rattle people".
        // Editorial and deliberately unscientific, exactly as the panel says.
        sentiment: Math.min(1, (h.points ?? 0) / 400),
        url: h.url ?? `https://news.ycombinator.com/item?id=${h.objectID}`,
      }))

  const merged: NewsItem[] = []
  const a = map(ai?.hits, 'ai')
  const b = map(jobs?.hits, 'jobs')
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    if (a[i]) merged.push(a[i])
    if (b[i]) merged.push(b[i])
  }

  const seen = new Set<string>()
  const deduped = merged.filter((n) => !seen.has(n.id) && seen.add(n.id))
  return deduped.length ? deduped.slice(0, 24) : null
}
