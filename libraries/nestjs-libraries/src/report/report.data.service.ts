import { Injectable, Logger } from '@nestjs/common';
import { Integration, Organization } from '@prisma/client';
import dayjs from 'dayjs';
import { IntegrationService } from '@gitroom/nestjs-libraries/database/prisma/integrations/integration.service';
import { RefreshIntegrationService } from '@gitroom/nestjs-libraries/integrations/refresh.integration.service';
import {
  fetchFacebookPage,
  fetchInstagramAccount,
  MetaTokenError,
} from '@gitroom/nestjs-libraries/report/meta.report.fetcher';
import {
  ReportChannelRaw,
  ReportData,
  ReportPlatform,
} from '@gitroom/nestjs-libraries/report/report.types';

const SUPPORTED = ['facebook', 'instagram', 'instagram-standalone'];

const rate = (interactions: number, reach: number) =>
  reach > 0 ? Math.round((interactions / reach) * 1000) / 10 : null;

@Injectable()
export class ReportDataService {
  constructor(
    private _integrationService: IntegrationService,
    private _refreshIntegrationService: RefreshIntegrationService
  ) {}

  async build(org: Organization, days: number): Promise<ReportData> {
    const until = dayjs();
    const since = until.subtract(days, 'day').startOf('day');

    const integrations = (
      await this._integrationService.getIntegrationsList(org.id)
    ).filter((i) => i.type === 'social' && !i.deletedAt);

    const excluded = integrations
      .filter((i) => !SUPPORTED.includes(i.providerIdentifier) || i.disabled || i.refreshNeeded)
      .map((i) => ({
        provider: i.providerIdentifier,
        name: i.name,
        reason: !SUPPORTED.includes(i.providerIdentifier)
          ? 'piattaforma non ancora inclusa nel report'
          : i.disabled
          ? 'canale disattivato'
          : 'canale da ricollegare',
      }));

    const usable = integrations.filter(
      (i) => SUPPORTED.includes(i.providerIdentifier) && !i.disabled && !i.refreshNeeded
    );

    if (!usable.length && process.env.REPORT_MOCK_DATA === 'true') {
      return this.mock(org, days, since, until);
    }

    const raws: ReportChannelRaw[] = [];
    const warnings: string[] = [];
    for (const integration of usable) {
      try {
        raws.push(await this.fetchChannel(integration, since.unix(), until.unix()));
      } catch (e) {
        Logger.warn(`Report ${org.id} ${integration.id}: ${(e as Error).message}`);
        warnings.push(`"${integration.name}": dati non letti (${(e as Error).message}).`);
      }
    }

    return this.aggregate(org.name, days, since, until, raws, excluded, warnings);
  }

  private async fetchChannel(integration: Integration, since: number, until: number, retried = false): Promise<ReportChannelRaw> {
    let token = integration.token;
    if (dayjs(integration.tokenExpiration).isBefore(dayjs()) || retried) {
      const refreshed = await this._refreshIntegrationService.refresh(integration);
      if (!refreshed || !refreshed.accessToken) {
        throw new Error('token non rinnovabile, ricollegare il canale');
      }
      token = refreshed.accessToken;
    }
    try {
      if (integration.providerIdentifier === 'facebook') {
        return await fetchFacebookPage(integration.internalId, token, integration.name, since, until);
      }
      return await fetchInstagramAccount(
        integration.internalId,
        token,
        integration.name,
        since,
        until,
        integration.providerIdentifier === 'instagram-standalone' ? 'graph.instagram.com' : 'graph.facebook.com'
      );
    } catch (e) {
      if (e instanceof MetaTokenError && !retried) {
        return this.fetchChannel(integration, since, until, true);
      }
      throw e;
    }
  }

  private aggregate(
    brand: string,
    days: number,
    since: dayjs.Dayjs,
    until: dayjs.Dayjs,
    raws: ReportChannelRaw[],
    excluded: ReportData['excludedChannels'],
    warnings: string[]
  ): ReportData {
    const posts = raws.flatMap((r) => r.posts);
    const sum = (list: typeof posts, k: 'reach' | 'interactions') =>
      list.reduce((a, p) => a + p[k], 0);

    const platforms = [...new Set(raws.map((r) => r.platform))] as ReportPlatform[];
    const byPlatform = platforms.map((platform) => {
      const list = posts.filter((p) => p.platform === platform);
      return {
        platform,
        posts: list.length,
        reach: sum(list, 'reach'),
        interactions: sum(list, 'interactions'),
        engagementRate: rate(sum(list, 'interactions'), sum(list, 'reach')),
      };
    });
    const mostActive = [...byPlatform].sort((a, b) => b.posts - a.posts)[0];

    const formatsByPlatform = platforms.flatMap((platform) => {
      const list = posts.filter((p) => p.platform === platform);
      return [...new Set(list.map((p) => p.format))].map((format) => {
        const f = list.filter((p) => p.format === format);
        return {
          platform,
          format,
          posts: f.length,
          reach: sum(f, 'reach'),
          interactions: sum(f, 'interactions'),
          engagementRate: rate(sum(f, 'interactions'), sum(f, 'reach')),
        };
      });
    });

    const formatCount = new Map<string, number>();
    posts.forEach((p) => formatCount.set(p.format, (formatCount.get(p.format) || 0) + 1));

    const followers = raws.map((r) => r.followers);
    const known = followers.filter((f) => f.net !== null && f.current !== null);
    const netTotal = known.length ? known.reduce((a, f) => a + (f.net as number), 0) : null;
    const startTotal = known.reduce((a, f) => a + ((f.current as number) - (f.net as number)), 0);

    return {
      brand,
      periodDays: days,
      since: since.format('YYYY-MM-DD'),
      until: until.format('YYYY-MM-DD'),
      generatedAt: dayjs().format('YYYY-MM-DD HH:mm'),
      channels: raws.map((r) => ({ platform: r.platform, name: r.channel })),
      excludedChannels: excluded,
      totals: {
        posts: posts.length,
        reach: sum(posts, 'reach'),
        interactions: sum(posts, 'interactions'),
        engagementRate: rate(sum(posts, 'interactions'), sum(posts, 'reach')),
      },
      byPlatform,
      mostActivePlatform: mostActive && mostActive.posts > 0 ? { platform: mostActive.platform, posts: mostActive.posts } : null,
      formats: [...formatCount.entries()]
        .map(([format, n]) => ({ format, posts: n }))
        .sort((a, b) => b.posts - a.posts),
      formatsByPlatform,
      topPosts: [...posts].sort((a, b) => b.interactions - a.interactions).slice(0, 3),
      followers,
      followersTotal: {
        net: netTotal,
        pct: netTotal !== null && startTotal > 0 ? Math.round((netTotal / startTotal) * 1000) / 10 : null,
      },
      warnings: [...warnings, ...raws.flatMap((r) => r.warnings)],
    };
  }

  // Solo sviluppo locale (REPORT_MOCK_DATA=true, variabile che in produzione non esiste)
  // e solo senza canali: serve a provare testo e impaginazione.
  private mock(org: Organization, days: number, since: dayjs.Dayjs, until: dayjs.Dayjs): ReportData {
    const mk = (platform: ReportPlatform, channel: string, n: number, formats: string[], seed: number) =>
      Array.from({ length: n }, (_, i) => {
        const reach = 800 + ((i * 7919 + seed) % 9000);
        return {
          platform,
          channel,
          title: `Post di prova ${platform} n. ${i + 1}`,
          format: formats[i % formats.length],
          date: until.subtract((i * days) / n, 'day').format('YYYY-MM-DD'),
          permalink: '',
          reach,
          interactions: Math.round(reach * (0.01 + ((i * 13 + seed) % 50) / 1000)),
        };
      });
    const raws: ReportChannelRaw[] = [
      {
        platform: 'facebook',
        channel: 'Pagina di prova',
        posts: mk('facebook', 'Pagina di prova', Math.round(days * 0.8), ['Video', 'Foto', 'Link', 'Solo testo'], 11),
        followers: { platform: 'facebook', channel: 'Pagina di prova', current: 4200, net: 310, pct: (310 / 3890) * 100 },
        warnings: [],
      },
      {
        platform: 'instagram',
        channel: 'Instagram di prova',
        posts: mk('instagram', 'Instagram di prova', Math.round(days * 1.1), ['Reel', 'Carosello', 'Foto'], 5),
        followers: { platform: 'instagram', channel: 'Instagram di prova', current: 12800, net: 1450, pct: (1450 / 11350) * 100 },
        warnings: [],
      },
    ];
    return { ...this.aggregate(org.name, days, since, until, raws, [], []), mock: true };
  }
}
