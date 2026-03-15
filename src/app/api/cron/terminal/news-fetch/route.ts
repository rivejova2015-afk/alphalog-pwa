/**
 * POST /api/cron/terminal/news-fetch
 * Scheduled endpoint: runs every 2 hours via Vercel cron
 *
 * Purpose:
 *   - Fetch news from Finnhub (general + forex) and Alpha Vantage (SPY, GLD)
 *   - Analyze with OpenAI gpt-4o-mini for trading relevancy and impact
 *   - Insert relevant news (relevancy_score >= 30) into terminal_news table
 *   - Send push notification for first High Impact item (score >= 70)
 *
 * Security:
 *   - Requires x-cron-secret header matching CRON_SECRET env var (timingSafeEqual)
 *   - Uses Supabase service role for inserting with fixed user_id
 *   - Returns 401 if header missing or invalid
 *
 * Environment:
 *   - FINNHUB_API_KEY       — Finnhub market news API
 *   - ALPHA_VANTAGE_API_KEY — Alpha Vantage news sentiment API
 *   - OPENAI_API_KEY        — GPT-4o-mini analysis
 *   - CRON_SECRET           — Auth token
 *   - INTERNAL_API_SECRET   — Push notification auth
 */

import { createClient } from '@supabase/supabase-js';
import { timingSafeEqual } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

// ─── Constants ────────────────────────────────────────────────────────────────
const USER_ID   = '381e268e-a042-4612-8b39-7a120ace17d6';
const US500_ID  = '4297cc25-57e3-46e3-af8f-792339555e9c';
const XAUUSD_ID = '92a142f7-d857-415e-8ca2-cfcc850ce923';
const MAX_ANALYZE       = 15;
const FETCH_TIMEOUT_MS  = 10_000;

// ─── Keyword Lists ────────────────────────────────────────────────────────────
const US500_KW = [
  'S&P', 'S&P 500', 'SPX', 'SPY', 'US500', 'US 500', 'stock market', 'equities',
  'Wall Street', 'Nasdaq', 'Dow Jones', 'Dow', 'DJIA', 'Russell', 'stocks rally',
  'stocks fall', 'equity market', 'index fund', 'market selloff', 'market rally',
  'Fed rate', 'Federal Reserve', 'FOMC', 'CPI', 'inflation', 'GDP', 'unemployment',
  'nonfarm', 'payroll', 'earnings season',
];
const XAUUSD_KW = [
  'gold', 'XAUUSD', 'XAU', 'precious metal', 'bullion', 'gold price', 'gold rally',
  'gold falls', 'safe haven', 'gold futures', 'spot gold', 'gold demand',
  'central bank gold', 'gold ETF', 'GLD',
];

// ─── Zod Schemas ──────────────────────────────────────────────────────────────
const FinnhubItemSchema = z.object({
  datetime: z.number(),
  headline: z.string(),
  source: z.string().optional(),
  summary: z.string().optional(),
  url: z.string().optional(),
});
const FinnhubSchema = z.array(FinnhubItemSchema);

const AVFeedItemSchema = z.object({
  title: z.string(),
  url: z.string().optional(),
  source: z.string().optional(),
  time_published: z.string(),
  summary: z.string().optional(),
  overall_sentiment_score: z.number().optional(),
  overall_sentiment_label: z.string().optional(),
});
const AVResponseSchema = z.object({
  feed: z.array(AVFeedItemSchema).optional(),
});

const OAIAnalysisItemSchema = z.object({
  index: z.number(),
  relevancy_score: z.number().int().min(0).max(100),
  impact_label: z.enum(['High', 'Medium', 'Low']),
  sentiment: z.enum(['Bullish', 'Bearish', 'Neutral']).optional(),
});
const OAIResponseSchema = z.object({
  items: z.array(OAIAnalysisItemSchema),
});

// ─── Types ────────────────────────────────────────────────────────────────────
interface NormalizedNews {
  title: string;
  url: string | null;
  source: string | null;
  summary: string;
  published_at: string;
  provider: 'finnhub' | 'alphavantage';
  av_sentiment_label?: string;
}

interface ClassifiedNews extends NormalizedNews {
  instrumentId: string;
  instrumentSymbol: string;
}

interface AnalyzedNews extends ClassifiedNews {
  relevancy_score: number;
  impact_label: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fetchWithTimeout(url: string, ms: number): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), ms);
  return fetch(url, { signal: controller.signal }).finally(() => clearTimeout(id));
}

function parseAVTimestamp(ts: string): string {
  // "20260315T143000" → "2026-03-15T14:30:00Z"
  try {
    return `${ts.slice(0, 4)}-${ts.slice(4, 6)}-${ts.slice(6, 8)}T${ts.slice(9, 11)}:${ts.slice(11, 13)}:${ts.slice(13, 15)}Z`;
  } catch {
    return new Date().toISOString();
  }
}

function matchesKeywords(text: string, keywords: string[]): boolean {
  const lower = text.toLowerCase();
  return keywords.some((kw) => lower.includes(kw.toLowerCase()));
}

// ─── Handler ──────────────────────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  try {
    // 1. Auth — x-cron-secret header, timingSafeEqual
    const cronSecret   = request.headers.get('x-cron-secret');
    const expectedSecret = process.env.CRON_SECRET;
    let authorized = false;
    try {
      if (cronSecret && expectedSecret) {
        const a = Buffer.from(cronSecret);
        const b = Buffer.from(expectedSecret);
        authorized = a.length === b.length && timingSafeEqual(a, b);
      }
    } catch {
      authorized = false;
    }
    if (!authorized) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Init Supabase service client (fixed user_id inserts bypass RLS)
    const supabaseUrl        = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json({ error: 'Missing Supabase config' }, { status: 500 });
    }
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false },
    });

    const finnhubKey = process.env.FINNHUB_API_KEY;
    const avKey      = process.env.ALPHA_VANTAGE_API_KEY;

    let fetchedFinnhubGeneral = 0;
    let fetchedFinnhubForex   = 0;
    let fetchedAlphavantage   = 0;

    const allNormalized: NormalizedNews[] = [];

    // 3. Fetch all sources in parallel
    const [fhGeneralResult, fhForexResult, avResult] = await Promise.allSettled([
      finnhubKey
        ? fetchWithTimeout(
            `https://finnhub.io/api/v1/news?category=general&token=${finnhubKey}`,
            FETCH_TIMEOUT_MS
          )
        : Promise.reject(new Error('FINNHUB_API_KEY not set')),
      finnhubKey
        ? fetchWithTimeout(
            `https://finnhub.io/api/v1/news?category=forex&token=${finnhubKey}`,
            FETCH_TIMEOUT_MS
          )
        : Promise.reject(new Error('FINNHUB_API_KEY not set')),
      avKey
        ? fetchWithTimeout(
            `https://www.alphavantage.co/query?function=NEWS_SENTIMENT&tickers=SPY,GLD&topics=economy_macro,financial_markets&apikey=${avKey}&limit=20`,
            FETCH_TIMEOUT_MS
          )
        : Promise.reject(new Error('ALPHA_VANTAGE_API_KEY not set')),
    ]);

    // Process Finnhub General
    if (fhGeneralResult.status === 'fulfilled') {
      try {
        const raw    = await fhGeneralResult.value.json();
        const parsed = FinnhubSchema.parse(raw);
        const items  = parsed.slice(0, 20);
        fetchedFinnhubGeneral = items.length;
        for (const item of items) {
          allNormalized.push({
            title:        item.headline,
            url:          item.url ?? null,
            source:       item.source ?? null,
            summary:      item.summary ?? item.headline,
            published_at: new Date(item.datetime * 1000).toISOString(),
            provider:     'finnhub',
          });
        }
      } catch (e) {
        console.error('[news-fetch] Finnhub general parse error:', e);
      }
    } else {
      console.error('[news-fetch] Finnhub general fetch failed:', fhGeneralResult.reason);
    }

    // Process Finnhub Forex (skip URLs already in general)
    if (fhForexResult.status === 'fulfilled') {
      try {
        const raw    = await fhForexResult.value.json();
        const parsed = FinnhubSchema.parse(raw);
        const items  = parsed.slice(0, 20);
        fetchedFinnhubForex = items.length;
        const existingUrls  = new Set(allNormalized.map((n) => n.url).filter(Boolean));
        for (const item of items) {
          if (item.url && existingUrls.has(item.url)) continue;
          allNormalized.push({
            title:        item.headline,
            url:          item.url ?? null,
            source:       item.source ?? null,
            summary:      item.summary ?? item.headline,
            published_at: new Date(item.datetime * 1000).toISOString(),
            provider:     'finnhub',
          });
        }
      } catch (e) {
        console.error('[news-fetch] Finnhub forex parse error:', e);
      }
    } else {
      console.error('[news-fetch] Finnhub forex fetch failed:', fhForexResult.reason);
    }

    // Process Alpha Vantage
    if (avResult.status === 'fulfilled') {
      try {
        const raw    = await avResult.value.json();
        const parsed = AVResponseSchema.parse(raw);
        const items  = parsed.feed?.slice(0, 20) ?? [];
        fetchedAlphavantage = items.length;
        for (const item of items) {
          allNormalized.push({
            title:              item.title,
            url:                item.url ?? null,
            source:             item.source ?? null,
            summary:            item.summary ?? item.title,
            published_at:       parseAVTimestamp(item.time_published),
            provider:           'alphavantage',
            av_sentiment_label: item.overall_sentiment_label,
          });
        }
      } catch (e) {
        console.error('[news-fetch] Alpha Vantage parse error:', e);
      }
    } else {
      console.error('[news-fetch] Alpha Vantage fetch failed:', avResult.reason);
    }

    // 5. Dedup against DB (last 48h) and within batch
    const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
    const { data: recentRows } = await supabase
      .from('terminal_news')
      .select('url')
      .gt('created_at', cutoff)
      .eq('user_id', USER_ID);

    const seenUrls = new Set<string>(
      (recentRows ?? []).map((r: { url: string | null }) => r.url).filter((u): u is string => Boolean(u))
    );

    const dedupedNews: NormalizedNews[] = [];
    for (const item of allNormalized) {
      if (item.url && seenUrls.has(item.url)) continue;
      if (item.url) seenUrls.add(item.url);
      dedupedNews.push(item);
    }

    // 6. Classify by instrument (both instruments possible for same article)
    const classified: ClassifiedNews[] = [];
    for (const item of dedupedNews) {
      const searchText = `${item.title} ${item.summary}`;
      const isUS500   = matchesKeywords(searchText, US500_KW);
      const isXAUUSD  = matchesKeywords(searchText, XAUUSD_KW);
      if (isUS500)  classified.push({ ...item, instrumentId: US500_ID,  instrumentSymbol: 'US500'  });
      if (isXAUUSD) classified.push({ ...item, instrumentId: XAUUSD_ID, instrumentSymbol: 'XAUUSD' });
    }

    const batchToAnalyze = classified.slice(0, MAX_ANALYZE);

    // 7. OpenAI Analysis
    let analyzed: AnalyzedNews[];

    if (batchToAnalyze.length > 0 && process.env.OPENAI_API_KEY) {
      try {
        const aiController = new AbortController();
        const aiTimeout    = setTimeout(() => aiController.abort(), 20_000);

        const aiRes = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            Authorization:  `Bearer ${process.env.OPENAI_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model:           'gpt-4o-mini',
            temperature:     0.1,
            response_format: { type: 'json_object' },
            messages: [
              {
                role: 'system',
                content: `You are a financial news analyst for a prop trader who trades US500 (S&P 500) and XAUUSD (Gold). Analyze each news item and rate its trading relevance. Return a JSON object with an "items" array. Each item must have: "index" (number, matching input order), "relevancy_score" (integer 0-100, where 0=noise 100=must-trade-now), "impact_label" ("High" or "Medium" or "Low"), "sentiment" ("Bullish" or "Bearish" or "Neutral"). High impact = directly moves price of the instrument. Medium = context that affects multi-day outlook. Low = general background noise. Be strict: most financial news is Low (score 10-30). Only truly market-moving events like FOMC decisions, major earnings surprises, geopolitical shocks, or significant economic data releases deserve High (score 70+).`,
              },
              {
                role: 'user',
                content: JSON.stringify(
                  batchToAnalyze.map((n, i) => ({
                    index:       i,
                    instrument:  n.instrumentSymbol,
                    title:       n.title,
                    summary:     n.summary?.slice(0, 200),
                    source:      n.source,
                    av_sentiment: n.av_sentiment_label ?? null,
                  }))
                ),
              },
            ],
          }),
          signal: aiController.signal,
        }).finally(() => clearTimeout(aiTimeout));

        if (!aiRes.ok) throw new Error(`OpenAI HTTP ${aiRes.status}`);

        const aiJson     = await aiRes.json();
        const rawContent = aiJson.choices?.[0]?.message?.content;
        if (!rawContent) throw new Error('Empty OpenAI response');

        const parsedAI = OAIResponseSchema.safeParse(JSON.parse(rawContent));
        if (!parsedAI.success) throw new Error('OpenAI schema mismatch');

        analyzed = batchToAnalyze.map((item, i) => {
          const aiItem = parsedAI.data.items.find((a) => a.index === i);
          return {
            ...item,
            relevancy_score: aiItem?.relevancy_score ?? 50,
            impact_label:    aiItem?.impact_label    ?? 'Medium',
          };
        });
      } catch (e) {
        console.error('[news-fetch] OpenAI error, using defaults:', e);
        analyzed = batchToAnalyze.map((item) => ({
          ...item, relevancy_score: 50, impact_label: 'Medium',
        }));
      }
    } else {
      analyzed = batchToAnalyze.map((item) => ({
        ...item, relevancy_score: 50, impact_label: 'Medium',
      }));
    }

    // 8. Insert where relevancy_score >= 30
    let inserted       = 0;
    let firstHighImpact: AnalyzedNews | null = null;

    for (const item of analyzed) {
      if (item.relevancy_score < 30) continue;

      const { error } = await supabase.from('terminal_news').insert({
        user_id:         USER_ID,
        instrument_id:   item.instrumentId,
        title:           item.title.slice(0, 500),
        url:             item.url,
        source:          item.source,
        relevancy_score: item.relevancy_score,
        impact_label:    item.impact_label,
        timestamp_utc:   item.published_at,
      });

      if (error) {
        console.error('[news-fetch] Insert error:', error.message);
      } else {
        inserted++;
        if (!firstHighImpact && item.impact_label === 'High' && item.relevancy_score >= 70) {
          firstHighImpact = item;
        }
      }
    }

    // Log result to app_logs
    await supabase.from('app_logs').insert({
      user_id: USER_ID,
      level:   'info',
      area:    'news_pipeline',
      message: `News pipeline complete: inserted ${inserted}/${analyzed.length} analyzed, ${classified.length} classified`,
      meta: {
        fetched_finnhub_general: fetchedFinnhubGeneral,
        fetched_finnhub_forex:   fetchedFinnhubForex,
        fetched_alphavantage:    fetchedAlphavantage,
        after_dedup:             dedupedNews.length,
        after_instrument_match:  classified.length,
        analyzed:                analyzed.length,
        inserted,
      },
    });

    // 9. Push notification for first High Impact item
    let highImpactPush = false;
    if (firstHighImpact) {
      try {
        const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://alphalog.io';
        const pushRes = await fetch(`${appUrl}/api/push/notify-user`, {
          method: 'POST',
          headers: {
            Authorization:  `Bearer ${process.env.INTERNAL_API_SECRET}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            userId: USER_ID,
            title:  `⚡ High Impact: ${firstHighImpact.instrumentSymbol}`,
            body:   firstHighImpact.title,
          }),
        });
        highImpactPush = pushRes.ok;
      } catch (e) {
        console.error('[news-fetch] Push notification error:', e);
      }
    }

    // 10. Return summary
    return NextResponse.json({
      ok: true,
      fetched: {
        finnhub_general: fetchedFinnhubGeneral,
        finnhub_forex:   fetchedFinnhubForex,
        alphavantage:    fetchedAlphavantage,
      },
      after_dedup:            dedupedNews.length,
      after_instrument_match: classified.length,
      analyzed:               analyzed.length,
      inserted,
      high_impact_push:       highImpactPush,
    });
  } catch (error) {
    console.error('[news-fetch] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: String(error) },
      { status: 500 }
    );
  }
}
