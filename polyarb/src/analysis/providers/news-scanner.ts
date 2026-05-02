/**
 * News Scanner — CryptoPanic API + CoinTelegraph RSS fallback.
 *
 * Primary: CryptoPanic (CRYPTOPANIC_API_TOKEN env var — free tier at cryptopanic.com).
 * Fallback: CoinTelegraph RSS (https://cointelegraph.com/rss) — public, no token.
 *
 * RSS path is automatic when CRYPTOPANIC_API_TOKEN is unset. Tradeoff vs paid:
 *   - CoinTelegraph: ~30-50 fresh BTC-relevant items/hour, 2-5 min latency, free
 *   - CryptoPanic:   ~50-100 multi-source items/hour, <1 min latency, paid
 * RSS is enough to keep the news component live for sentiment-divergence and
 * the fundamental composite — quality is comparable for keyword-based scoring.
 *
 * Scoring engine:
 *   - Keyword NLP: bullish/bearish word lists with weighted scoring
 *   - Urgency decay: headlines >15min old lose urgency; >45min: ignored
 *   - Source weight: major outlets (coindesk, reuters, bloomberg) weighted higher
 *   - Recency boost: breaking news (<2min old) gets urgency × 2
 *   - Deduplication: title hash prevents re-counting the same story
 *
 * Score range: -30 to +30.
 */

import type { NewsComponent, ScoredHeadline } from '../types.js';

const TTL_MS = 3 * 60_000;  // refresh every 3 minutes
const MAX_HEADLINE_AGE_MS = 45 * 60_000;  // CryptoPanic: high freq → 45 min cutoff
/** CoinTelegraph publishes ~20 articles/day (~1/h) — using the CryptoPanic
 *  45-min cutoff would frequently zero the news component. 4 hours captures
 *  recent context without going stale; the recency-weighted aggregator already
 *  de-weights older items so older headlines contribute proportionally less. */
const MAX_HEADLINE_AGE_MS_RSS = 4 * 60 * 60_000;
const BREAKING_THRESHOLD_MS = 2 * 60_000; // "breaking" if younger than 2 min

// ── Weighted keyword lexicon ──────────────────────────────────────────────────

const BULLISH: Array<{ kw: string; weight: number }> = [
  // Strong signals (weight 3)
  { kw: 'etf inflow', weight: 3 }, { kw: 'all-time high', weight: 3 },
  { kw: 'ath', weight: 3 }, { kw: 'institutional buy', weight: 3 },
  { kw: 'fed pivot', weight: 3 }, { kw: 'rate cut', weight: 3 },
  { kw: 'spot etf', weight: 3 }, { kw: 'whale buy', weight: 3 },
  { kw: 'short squeeze', weight: 3 }, { kw: 'breakout', weight: 3 },
  // Medium signals (weight 2)
  { kw: 'rally', weight: 2 }, { kw: 'surge', weight: 2 },
  { kw: 'adoption', weight: 2 }, { kw: 'accumulate', weight: 2 },
  { kw: 'partnership', weight: 2 }, { kw: 'integration', weight: 2 },
  { kw: 'upgrade', weight: 2 }, { kw: 'approval', weight: 2 },
  { kw: 'record volume', weight: 2 }, { kw: 'milestone', weight: 2 },
  { kw: 'inflow', weight: 2 }, { kw: 'halving', weight: 2 },
  // Weak signals (weight 1)
  { kw: 'bull', weight: 1 }, { kw: 'soar', weight: 1 },
  { kw: 'gain', weight: 1 }, { kw: 'rise', weight: 1 },
  { kw: 'green', weight: 1 }, { kw: 'buy', weight: 1 },
  { kw: 'positive', weight: 1 }, { kw: 'launch', weight: 1 },
  { kw: 'moon', weight: 1 }, { kw: 'pump', weight: 1 },
];

const BEARISH: Array<{ kw: string; weight: number }> = [
  // Strong signals (weight 3)
  { kw: 'etf outflow', weight: 3 }, { kw: 'exchange hack', weight: 3 },
  { kw: 'exploit', weight: 3 }, { kw: 'sec charges', weight: 3 },
  { kw: 'fed hike', weight: 3 }, { kw: 'rate hike', weight: 3 },
  { kw: 'liquidation cascade', weight: 3 }, { kw: 'bankrupt', weight: 3 },
  { kw: 'insolvent', weight: 3 }, { kw: 'ban', weight: 3 },
  { kw: 'seizure', weight: 3 }, { kw: 'fraud', weight: 3 },
  // Medium signals (weight 2)
  { kw: 'crash', weight: 2 }, { kw: 'sell-off', weight: 2 },
  { kw: 'dump', weight: 2 }, { kw: 'outflow', weight: 2 },
  { kw: 'regulation', weight: 2 }, { kw: 'fine', weight: 2 },
  { kw: 'penalty', weight: 2 }, { kw: 'restrict', weight: 2 },
  { kw: 'reject', weight: 2 }, { kw: 'delay', weight: 2 },
  { kw: 'whale sell', weight: 2 }, { kw: 'bear market', weight: 2 },
  // Weak signals (weight 1)
  { kw: 'bear', weight: 1 }, { kw: 'drop', weight: 1 },
  { kw: 'fall', weight: 1 }, { kw: 'decline', weight: 1 },
  { kw: 'red', weight: 1 }, { kw: 'short', weight: 1 },
  { kw: 'fear', weight: 1 }, { kw: 'loss', weight: 1 },
  { kw: 'plunge', weight: 1 }, { kw: 'risk', weight: 1 },
];

const URGENCY_BOOSTERS = [
  'breaking', 'flash', 'alert', 'just in', 'just now', 'urgent',
  'emergency', 'shock', 'sudden', 'unexpected', 'surprise', 'live',
];

const HIGH_WEIGHT_SOURCES = ['reuters', 'bloomberg', 'wsj', 'ft.com', 'coindesk', 'cointelegraph'];

// ── Simple title hash for dedup ────────────────────────────────────────────────

function titleHash(title: string): string {
  // First 60 chars normalized → dedup similar headlines
  return title.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 60);
}

// ── Score a single headline ────────────────────────────────────────────────────

function scoreHeadline(
  title: string,
  url: string,
  source: string,
  publishedAt: Date,
  maxAgeMs: number = MAX_HEADLINE_AGE_MS,
): ScoredHeadline | null {
  const ageMs = Date.now() - publishedAt.getTime();
  if (ageMs > maxAgeMs) return null;

  const lower = title.toLowerCase();

  let bullishScore = 0;
  let bearishScore = 0;

  for (const { kw, weight } of BULLISH) {
    if (lower.includes(kw)) bullishScore += weight;
  }
  for (const { kw, weight } of BEARISH) {
    if (lower.includes(kw)) bearishScore += weight;
  }

  // Urgency from keywords
  let urgency = 0;
  for (const kw of URGENCY_BOOSTERS) {
    if (lower.includes(kw)) urgency = Math.min(10, urgency + 3);
  }

  // Recency boost
  if (ageMs < BREAKING_THRESHOLD_MS) urgency = Math.min(10, urgency + 3);

  // Age decay: linearly reduce urgency for older news
  const ageFraction = ageMs / maxAgeMs; // 0=new, 1=old
  urgency = Math.max(0, Math.round(urgency * (1 - ageFraction * 0.8)));

  // Source weight: trusted sources count more
  const srcLower = source.toLowerCase();
  const srcWeight = HIGH_WEIGHT_SOURCES.some(s => srcLower.includes(s)) ? 1.5 : 1.0;

  const netBullish = bullishScore * srcWeight;
  const netBearish = bearishScore * srcWeight;

  let sentiment: ScoredHeadline['sentiment'] = 'NEUTRAL';
  let score = 0;

  if (netBullish > netBearish) {
    sentiment = 'BULLISH';
    score = Math.min(10, Math.round((netBullish - netBearish) * 2));
  } else if (netBearish > netBullish) {
    sentiment = 'BEARISH';
    score = -Math.min(10, Math.round((netBearish - netBullish) * 2));
  }

  if (sentiment === 'NEUTRAL' && urgency === 0) return null; // no signal at all

  return { title, url, source, sentiment, urgency, ageMs, score };
}

// ── CryptoPanic API response types ─────────────────────────────────────────────

interface CryptoPanicPost {
  title?: string;
  url?: string;
  published_at?: string;
  source?: { title?: string; domain?: string };
  currencies?: Array<{ code?: string }>;
}

interface CryptoPanicResponse {
  results?: CryptoPanicPost[];
  count?: number;
}

// ── Multi-source RSS fallback (no token required) ─────────────────────────────

/** Free RSS feeds aggregated when CRYPTOPANIC_API_TOKEN is unset. Two sources
 *  give weekend coverage — CoinTelegraph has long quiet stretches on weekends
 *  while Decrypt publishes more steadily. Add more if dispersion of pubDates
 *  shows gaps. */
const RSS_SOURCES: Array<{ url: string; name: string }> = [
  { url: 'https://cointelegraph.com/rss', name: 'cointelegraph' },
  { url: 'https://decrypt.co/feed',       name: 'decrypt' },
];

/** Headlines must mention one of these to be kept (the RSS feed has no
 *  currency tags, so we approximate Polymarket's BTC-only filter via keywords).
 *  Broad enough to catch macro/regulatory items that move BTC even without
 *  explicit BTC mention (e.g. "Fed rate cut", "spot ETF approval"). */
const BTC_KEYWORDS = [
  'bitcoin', 'btc', 'satoshi', 'hodl', 'halving',
  'crypto', 'cryptocurrency', 'blockchain',
  'etf', 'spot etf',
  'fed ', 'fomc', 'rate cut', 'rate hike',
];

interface RssItem {
  title: string;
  link: string;
  publishedAt: Date;
  source: string;
}

/** Strip CDATA wrappers and decode HTML entities common in RSS payloads. */
function decodeRssText(raw: string): string {
  return raw
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .trim();
}

function extractTag(itemXml: string, tag: string): string | null {
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'i');
  const m = itemXml.match(re);
  return m ? decodeRssText(m[1]) : null;
}

async function fetchRssFeed(url: string, source: string): Promise<RssItem[]> {
  const res = await fetch(url, {
    headers: { 'Accept': 'application/rss+xml, application/xml, text/xml' },
    signal: AbortSignal.timeout(8_000),
  });
  if (!res.ok) {
    console.warn(`[news-scanner:rss] ${source} HTTP ${res.status}`);
    return [];
  }
  const xml = await res.text();
  const items: RssItem[] = [];
  const itemRegex = /<item[^>]*>([\s\S]*?)<\/item>/g;
  let match: RegExpExecArray | null;
  while ((match = itemRegex.exec(xml)) !== null) {
    const itemXml = match[1];
    const title = extractTag(itemXml, 'title');
    const link = extractTag(itemXml, 'link');
    const pubDate = extractTag(itemXml, 'pubDate');
    if (!title || !pubDate) continue;
    const dt = new Date(pubDate);
    if (Number.isNaN(dt.getTime())) continue;
    items.push({ title, link: link ?? '', publishedAt: dt, source });
  }
  return items;
}

// ── Provider ───────────────────────────────────────────────────────────────────

export class NewsScannerProvider {
  private cached: NewsComponent | null = null;
  private fetching = false;
  private seenHashes = new Set<string>();

  get(): NewsComponent | null {
    return this.cached;
  }

  async refresh(): Promise<void> {
    if (this.fetching) return;
    if (this.cached && Date.now() - this.cached.fetchedAt < TTL_MS) return;
    this.fetching = true;

    try {
      const token = process.env.CRYPTOPANIC_API_TOKEN;
      if (!token) {
        // No paid token — fall back to CoinTelegraph's free RSS feed.
        await this.refreshFromRss();
        return;
      }

      const url = `https://cryptopanic.com/api/v1/posts/?auth_token=${token}&currencies=BTC&filter=hot&kind=news&public=true`;

      const res = await fetch(url, {
        headers: { 'Accept': 'application/json' },
        signal: AbortSignal.timeout(8_000),
      });

      if (!res.ok) {
        console.warn(`[news-scanner] CryptoPanic returned HTTP ${res.status}`);
        return;
      }

      const json = await res.json() as CryptoPanicResponse;
      const posts = json.results ?? [];

      const headlines: ScoredHeadline[] = [];
      const batchHashes = new Set<string>();

      for (const post of posts) {
        if (!post.title || !post.published_at) continue;

        // Only keep BTC-relevant posts
        const currencies = post.currencies?.map(c => c.code?.toUpperCase()) ?? [];
        if (currencies.length > 0 && !currencies.includes('BTC')) continue;

        const hash = titleHash(post.title);
        batchHashes.add(hash);
        if (this.seenHashes.has(hash)) continue;
        this.seenHashes.add(hash);

        const scored = scoreHeadline(
          post.title,
          post.url ?? '',
          post.source?.domain ?? post.source?.title ?? 'cryptopanic',
          new Date(post.published_at),
        );
        if (scored) headlines.push(scored);
      }

      // Keep seenHashes bounded: replace with only current batch hashes so old
      // stories remain deduped on next fetch (clearing entirely would re-score them all)
      if (this.seenHashes.size > 500) {
        this.seenHashes = batchHashes;
      }

      this.cached = computeNewsComponent(headlines);
      console.log(
        `[news-scanner] ${headlines.length} scored headlines → ` +
        `${this.cached.signal} score=${this.cached.score} urgencyPeak=${this.cached.urgencyPeak}`
      );
    } catch (err) {
      console.warn('[news-scanner] Fetch failed (using stale):', err instanceof Error ? err.message : String(err));
    } finally {
      this.fetching = false;
    }
  }

  /** Free fallback when CRYPTOPANIC_API_TOKEN is unset. Aggregates all RSS_SOURCES
   *  in parallel — single-source coverage gaps (e.g. CoinTelegraph weekend lulls)
   *  zero out the news component, so we merge multiple feeds before scoring. */
  private async refreshFromRss(): Promise<void> {
    try {
      const batches = await Promise.all(
        RSS_SOURCES.map(s =>
          fetchRssFeed(s.url, s.name).catch(err => {
            console.warn(`[news-scanner:rss] ${s.name} failed: ${err instanceof Error ? err.message : String(err)}`);
            return [] as RssItem[];
          }),
        ),
      );
      const items = batches.flat();
      const headlines: ScoredHeadline[] = [];
      const batchHashes = new Set<string>();

      for (const item of items) {
        const lower = item.title.toLowerCase();
        // RSS lacks currency tags — approximate Polymarket's BTC-only filter.
        if (!BTC_KEYWORDS.some(kw => lower.includes(kw))) continue;

        const hash = titleHash(item.title);
        batchHashes.add(hash);
        if (this.seenHashes.has(hash)) continue;
        this.seenHashes.add(hash);

        const scored = scoreHeadline(
          item.title, item.link, item.source, item.publishedAt, MAX_HEADLINE_AGE_MS_RSS,
        );
        if (scored) headlines.push(scored);
      }

      if (this.seenHashes.size > 500) {
        this.seenHashes = batchHashes;
      }

      this.cached = computeNewsComponent(headlines, MAX_HEADLINE_AGE_MS_RSS);
      const sourcesUsed = RSS_SOURCES.map(s => s.name).join('+');
      console.log(
        `[news-scanner:rss] ${headlines.length} scored headlines (${sourcesUsed}, ${items.length} raw) → ` +
        `${this.cached.signal} score=${this.cached.score} urgencyPeak=${this.cached.urgencyPeak}`,
      );
    } catch (err) {
      console.warn('[news-scanner:rss] Fetch failed:', err instanceof Error ? err.message : String(err));
    }
  }
}

function computeNewsComponent(
  headlines: ScoredHeadline[],
  maxAgeMs: number = MAX_HEADLINE_AGE_MS,
): NewsComponent {
  if (headlines.length === 0) {
    return {
      headlines: [],
      aggregateScore: 0,
      urgencyPeak: 0,
      signal: 'NEUTRAL',
      score: 0,
      fetchedAt: Date.now(),
    };
  }

  // Weight each headline by recency and urgency
  let weightedSum = 0;
  let totalWeight = 0;
  let urgencyPeak = 0;

  for (const h of headlines) {
    // Weight = (1 - ageFraction)^2 × (1 + urgency/10)
    const ageFraction = h.ageMs / maxAgeMs;
    const recencyWeight = Math.pow(1 - ageFraction, 2);
    const urgencyWeight = 1 + h.urgency / 10;
    const w = recencyWeight * urgencyWeight;

    weightedSum += h.score * w;
    totalWeight += w;
    urgencyPeak = Math.max(urgencyPeak, h.urgency);
  }

  const aggregateScore = totalWeight > 0 ? (weightedSum / totalWeight) * 10 : 0;

  // Map to component score (-30 to +30)
  // aggregateScore is in roughly -10..+10 range, scale to -30..+30
  const score = Math.max(-30, Math.min(30, Math.round(aggregateScore * 3)));

  const signal: NewsComponent['signal'] =
    score > 8 ? 'BULLISH' : score < -8 ? 'BEARISH' : 'NEUTRAL';

  return {
    headlines: headlines.slice(0, 20), // cap stored headlines for telemetry
    aggregateScore: Math.round(aggregateScore * 10) / 10,
    urgencyPeak,
    signal,
    score,
    fetchedAt: Date.now(),
  };
}
