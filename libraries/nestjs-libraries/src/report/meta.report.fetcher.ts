import dayjs from 'dayjs';
import { META_GRAPH_API_VERSION } from '@gitroom/nestjs-libraries/integrations/social/facebook.provider';
import {
  ReportChannelRaw,
  ReportPost,
} from '@gitroom/nestjs-libraries/report/report.types';

// Viral Starz: lettura diretta da Meta di TUTTI i post del periodo (anche quelli
// pubblicati fuori da Postiz) e della crescita follower, per il report.

export class MetaTokenError extends Error {}

const MAX_PAGES = 30;

async function graph(url: string): Promise<any> {
  const res = await fetch(url);
  const json: any = await res.json().catch(() => ({}));
  if (json?.error) {
    // 190 = token scaduto o revocato
    if (json.error.code === 190) {
      throw new MetaTokenError(json.error.message);
    }
    throw new Error(`Meta ${json.error.code}: ${json.error.message}`);
  }
  return json;
}

function windows(since: number, until: number, maxDays: number) {
  const out: [number, number][] = [];
  let start = since;
  while (start < until) {
    const end = Math.min(start + maxDays * 86400, until);
    out.push([start, end]);
    start = end;
  }
  return out;
}

function titleOf(text?: string) {
  const line = (text || '').split('\n').map((l) => l.trim()).find(Boolean);
  if (!line) return '(senza testo)';
  return line.length > 90 ? line.slice(0, 87) + '…' : line;
}

async function mapLimit<T, R>(items: T[], limit: number, fn: (t: T) => Promise<R>) {
  const out: R[] = new Array(items.length);
  let i = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (i < items.length) {
        const idx = i++;
        out[idx] = await fn(items[idx]);
      }
    })
  );
  return out;
}

function pct(net: number | null, current: number | null) {
  if (net === null || current === null) return null;
  const start = current - net;
  return start > 0 ? (net / start) * 100 : null;
}

export async function fetchFacebookPage(
  pageId: string,
  token: string,
  channel: string,
  since: number,
  until: number
): Promise<ReportChannelRaw> {
  const base = `https://graph.facebook.com/${META_GRAPH_API_VERSION}`;
  const warnings: string[] = [];

  const page = await graph(`${base}/${pageId}?fields=followers_count&access_token=${token}`);

  const fields = [
    'message',
    'created_time',
    'permalink_url',
    'attachments{media_type}',
    'shares',
    'reactions.summary(total_count).limit(0)',
    'comments.summary(total_count).limit(0)',
    'insights.metric(post_total_media_view_unique)',
  ].join(',');

  const posts: ReportPost[] = [];
  let url: string | undefined = `${base}/${pageId}/published_posts?fields=${encodeURIComponent(fields)}&limit=100&access_token=${token}`;
  let pages = 0;
  let reachedStart = false;
  while (url && pages < MAX_PAGES && !reachedStart) {
    const json = await graph(url);
    pages++;
    for (const p of json.data || []) {
      const created = dayjs(p.created_time).unix();
      if (created > until) continue;
      if (created < since) {
        reachedStart = true;
        break;
      }
      const mediaType = p.attachments?.data?.[0]?.media_type;
      posts.push({
        platform: 'facebook',
        channel,
        title: titleOf(p.message),
        format:
          mediaType === 'video' ? 'Video'
          : mediaType === 'photo' ? 'Foto'
          : mediaType === 'album' ? 'Album foto'
          : mediaType === 'link' ? 'Link'
          : mediaType ? mediaType
          : 'Solo testo',
        date: dayjs(p.created_time).format('YYYY-MM-DD'),
        permalink: p.permalink_url || '',
        reach: Number(p.insights?.data?.[0]?.values?.[0]?.value) || 0,
        interactions:
          (Number(p.reactions?.summary?.total_count) || 0) +
          (Number(p.comments?.summary?.total_count) || 0) +
          (Number(p.shares?.count) || 0),
      });
    }
    url = json.paging?.next;
  }
  if (!reachedStart && url) {
    warnings.push(`Facebook "${channel}": troppi post nel periodo, conteggio parziale.`);
  }

  // Crescita: follow unici meno unfollow unici giorno per giorno (stime Meta), finestre da 90 giorni.
  let net: number | null = 0;
  try {
    for (const [s, u] of windows(since, until, 90)) {
      const json = await graph(
        `${base}/${pageId}/insights?metric=page_daily_follows_unique,page_daily_unfollows_unique&period=day&since=${s}&until=${u}&access_token=${token}`
      );
      for (const m of json.data || []) {
        const sum = (m.values || []).reduce((a: number, v: any) => a + (Number(v.value) || 0), 0);
        net += m.name === 'page_daily_unfollows_unique' ? -sum : sum;
      }
    }
  } catch (e) {
    if (e instanceof MetaTokenError) throw e;
    net = null;
    warnings.push(`Facebook "${channel}": crescita follower non disponibile (${(e as Error).message}).`);
  }

  const current = page.followers_count ?? null;
  return {
    platform: 'facebook',
    channel,
    posts,
    followers: { platform: 'facebook', channel, current, net, pct: pct(net, current) },
    warnings,
  };
}

export async function fetchInstagramAccount(
  igId: string,
  rawToken: string,
  channel: string,
  since: number,
  until: number,
  host: 'graph.facebook.com' | 'graph.instagram.com'
): Promise<ReportChannelRaw> {
  const [token] = rawToken.split('___');
  const base = `https://${host}/${META_GRAPH_API_VERSION}`;
  const warnings: string[] = [];

  const account = await graph(`${base}/${igId}?fields=followers_count&access_token=${token}`);

  const media: any[] = [];
  let url: string | undefined = `${base}/${igId}/media?fields=id,caption,media_type,media_product_type,timestamp,permalink,like_count,comments_count&since=${since}&until=${until}&limit=100&access_token=${token}`;
  let pages = 0;
  while (url && pages < MAX_PAGES) {
    const json = await graph(url);
    pages++;
    for (const m of json.data || []) {
      const created = dayjs(m.timestamp).unix();
      if (created >= since && created <= until) media.push(m);
    }
    url = json.paging?.next;
  }
  if (url) {
    warnings.push(`Instagram "${channel}": troppi post nel periodo, conteggio parziale.`);
  }

  const posts = await mapLimit(media, 5, async (m): Promise<ReportPost> => {
    let reach = 0;
    let interactions =
      (Number(m.like_count) || 0) + (Number(m.comments_count) || 0);
    try {
      const ins = await graph(
        `${base}/${m.id}/insights?metric=reach,total_interactions&access_token=${token}`
      );
      for (const d of ins.data || []) {
        const v = Number(d.values?.[0]?.value ?? d.total_value?.value) || 0;
        if (d.name === 'reach') reach = v;
        if (d.name === 'total_interactions') interactions = v;
      }
    } catch (e) {
      if (e instanceof MetaTokenError) throw e;
    }
    return {
      platform: 'instagram',
      channel,
      title: titleOf(m.caption),
      format:
        m.media_product_type === 'REELS' ? 'Reel'
        : m.media_type === 'CAROUSEL_ALBUM' ? 'Carosello'
        : m.media_type === 'VIDEO' ? 'Video'
        : 'Foto',
      date: dayjs(m.timestamp).format('YYYY-MM-DD'),
      permalink: m.permalink || '',
      reach,
      interactions,
    };
  });

  // Crescita: follows_and_unfollows (total_value, breakdown follow_type), finestre da 30 giorni.
  // Meta non la restituisce per account sotto i 100 follower.
  let net: number | null = 0;
  let got = false;
  try {
    for (const [s, u] of windows(since, until, 30)) {
      const json = await graph(
        `${base}/${igId}/insights?metric=follows_and_unfollows&metric_type=total_value&period=day&breakdown=follow_type&since=${s}&until=${u}&access_token=${token}`
      );
      const results = json.data?.[0]?.total_value?.breakdowns?.[0]?.results || [];
      for (const r of results) {
        const type = r.dimension_values?.[0];
        const v = Number(r.value) || 0;
        if (type === 'FOLLOWER') { net += v; got = true; }
        if (type === 'NON_FOLLOWER') { net -= v; got = true; }
      }
    }
    if (!got) {
      net = null;
      warnings.push(`Instagram "${channel}": crescita follower non fornita da Meta (sotto i 100 follower o nessun dato).`);
    }
  } catch (e) {
    if (e instanceof MetaTokenError) throw e;
    net = null;
    warnings.push(`Instagram "${channel}": crescita follower non disponibile (${(e as Error).message}).`);
  }

  const current = account.followers_count ?? null;
  return {
    platform: 'instagram',
    channel,
    posts,
    followers: { platform: 'instagram', channel, current, net, pct: pct(net, current) },
    warnings,
  };
}
