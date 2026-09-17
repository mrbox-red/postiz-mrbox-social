import { Injectable, Logger } from '@nestjs/common';
import { Organization } from '@prisma/client';
import { randomUUID } from 'crypto';
import { ioRedis } from '@gitroom/nestjs-libraries/redis/redis.service';
import { ReportDataService } from '@gitroom/nestjs-libraries/report/report.data.service';
import {
  ReportData,
  ReportNarrative,
} from '@gitroom/nestjs-libraries/report/report.types';

// Viral Starz: il testo del report lo scrive Claude Code (Opus 5) sull'host, tramite
// il ponte `viralstarz-report-bridge`. Il container non ha il token Claude.

const SYSTEM = `Sei l'analista social di Viral Starz. Scrivi report di performance in italiano per un brand, con il tono di un report professionale: frasi chiare, dirette, niente enfasi da marketing, niente emoji.

Regole ferree:
- Usa SOLO i numeri presenti nei dati JSON che ricevi. Non inventare, non stimare, non arrotondare in modo diverso, non calcolare numeri nuovi.
- Formato italiano: punto per le migliaia (18.817.368), virgola per i decimali (2,9%).
- Se un dato è null o mancante, dillo in modo semplice ("dato non disponibile") senza ipotesi.
- Se "mock" è true, i dati sono di prova: scrivilo nella prima frase del primo paragrafo.
- Se ci sono "warnings" o "excludedChannels", citali brevemente dove pertinente.
- Metti in **grassetto** i numeri chiave e i nomi dei canali o dei post più importanti.
- Engagement rate = interazioni / reach, già calcolato nei dati.`;

const FIRST_PROMPT = (data: ReportData) => `Dati del report (JSON):
${JSON.stringify(data)}

Scrivi i testi del report. Rispondi SOLO con un oggetto JSON valido, senza blocchi di codice, con queste chiavi:
- "numeri": 2-4 frasi "Cosa è successo in numeri": post pubblicati, persone raggiunte (reach), interazioni, engagement rate medio, canale più attivo con il numero di pubblicazioni.
- "contenuti": 2-4 frasi "Cosa ha funzionato": quanti formati distinti, formato più frequente e quante pubblicazioni, il post con più interazioni (titolo tra virgolette, piattaforma, interazioni).
- "pubblico": 2-3 frasi "Come è cresciuto il pubblico": follower guadagnati complessivi e percentuale rispetto all'inizio del periodo, piattaforma con la crescita percentuale più alta.
- "sintesi": 2-3 frasi finali operative: cosa suggeriscono questi numeri per le prossime settimane, basandoti solo su formati, top post e crescita presenti nei dati.

Dopo questo messaggio potrei farti domande di approfondimento sugli stessi dati: in quel caso rispondi in testo semplice (non JSON), breve, sempre solo con i numeri dei dati.`;

type Job =
  | { orgId: string; status: 'running' }
  | { orgId: string; status: 'error'; error: string }
  | { orgId: string; status: 'done'; result: any };

@Injectable()
export class ReportAiService {
  constructor(private _reportDataService: ReportDataService) {}

  private async callBridge(prompt: string, resume?: string) {
    const url = process.env.REPORT_BRIDGE_URL;
    const token = process.env.REPORT_BRIDGE_TOKEN;
    if (!url || !token) {
      throw new Error('Servizio AI non configurato');
    }
    const res = await fetch(`${url}/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Bridge-Token': token },
      body: JSON.stringify({ system: SYSTEM, prompt, resume }),
      signal: AbortSignal.timeout(11 * 60 * 1000),
    });
    const json: any = await res.json().catch(() => ({}));
    if (!res.ok || !json.ok) {
      throw new Error(`AI non disponibile (${json.error || res.status})`);
    }
    return json as { text: string; sessionId: string };
  }

  private parseNarrative(text: string): ReportNarrative {
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    try {
      const obj = JSON.parse(text.slice(start, end + 1));
      return {
        numeri: String(obj.numeri || ''),
        contenuti: String(obj.contenuti || ''),
        pubblico: String(obj.pubblico || ''),
        sintesi: String(obj.sintesi || ''),
      };
    } catch {
      return { numeri: text, contenuti: '', pubblico: '', sintesi: '' };
    }
  }

  private async saveJob(id: string, job: Job) {
    await ioRedis.set(`report-job:${id}`, JSON.stringify(job), 'EX', 3600);
  }

  private start(org: Organization, work: () => Promise<any>) {
    const id = randomUUID();
    this.saveJob(id, { orgId: org.id, status: 'running' });
    work()
      .then((result) => this.saveJob(id, { orgId: org.id, status: 'done', result }))
      .catch((e) => {
        Logger.warn(`Report job ${id}: ${(e as Error).message}`);
        return this.saveJob(id, { orgId: org.id, status: 'error', error: (e as Error).message });
      });
    return { jobId: id };
  }

  generate(org: Organization, days: number) {
    return this.start(org, async () => {
      const data = await this._reportDataService.build(org, days);
      if (!data.channels.length) {
        return { data, narrative: null, sessionId: null };
      }
      const ai = await this.callBridge(FIRST_PROMPT(data));
      await this.bindSession(org.id, ai.sessionId);
      return { data, narrative: this.parseNarrative(ai.text), sessionId: ai.sessionId };
    });
  }

  async ask(org: Organization, sessionId: string, question: string) {
    // la sessione Claude deve appartenere a un report di questa organizzazione
    const owner = await ioRedis.get(`report-session:${sessionId}`);
    if (owner !== org.id) {
      throw new Error('Sessione non valida');
    }
    return this.start(org, async () => {
      const ai = await this.callBridge(question, sessionId);
      return { text: ai.text };
    });
  }

  private async bindSession(orgId: string, sessionId: string) {
    await ioRedis.set(`report-session:${sessionId}`, orgId, 'EX', 7 * 86400);
  }

  async job(org: Organization, id: string) {
    const raw = await ioRedis.get(`report-job:${id}`);
    if (!raw) return null;
    const job = JSON.parse(raw) as Job;
    return job.orgId === org.id ? job : null;
  }
}
