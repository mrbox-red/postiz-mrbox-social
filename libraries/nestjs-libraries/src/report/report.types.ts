// Viral Starz: dati del report di un subaccount. I numeri li calcola il codice;
// Claude scrive solo il testo a partire da questi dati.

export type ReportPlatform = 'facebook' | 'instagram';

export interface ReportPost {
  platform: ReportPlatform;
  channel: string;
  title: string;
  format: string;
  date: string;
  permalink: string;
  reach: number;
  interactions: number;
}

export interface ReportChannelFollowers {
  platform: ReportPlatform;
  channel: string;
  current: number | null;
  // follow nuovi meno smessi di seguire nel periodo; null se Meta non lo fornisce
  net: number | null;
  pct: number | null;
}

export interface ReportChannelRaw {
  platform: ReportPlatform;
  channel: string;
  posts: ReportPost[];
  followers: ReportChannelFollowers;
  warnings: string[];
}

export interface ReportData {
  brand: string;
  periodDays: number;
  since: string;
  until: string;
  generatedAt: string;
  channels: { platform: ReportPlatform; name: string }[];
  excludedChannels: { provider: string; name: string; reason: string }[];
  totals: {
    posts: number;
    reach: number;
    interactions: number;
    engagementRate: number | null;
  };
  byPlatform: {
    platform: ReportPlatform;
    posts: number;
    reach: number;
    interactions: number;
    engagementRate: number | null;
  }[];
  mostActivePlatform: { platform: ReportPlatform; posts: number } | null;
  formats: { format: string; posts: number }[];
  // dettaglio per piattaforma e formato, per le domande di approfondimento
  formatsByPlatform: {
    platform: ReportPlatform;
    format: string;
    posts: number;
    reach: number;
    interactions: number;
    engagementRate: number | null;
  }[];
  topPosts: ReportPost[];
  followers: ReportChannelFollowers[];
  followersTotal: { net: number | null; pct: number | null };
  warnings: string[];
  mock?: boolean;
}

export interface ReportNarrative {
  numeri: string;
  contenuti: string;
  pubblico: string;
  sintesi: string;
}
