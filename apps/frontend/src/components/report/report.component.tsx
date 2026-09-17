'use client';

// Viral Starz: report AI del subaccount corrente, in forma di chat.
// I numeri arrivano già calcolati dal backend; Claude scrive solo i testi.

import React, { FC, Fragment, useCallback, useEffect, useRef, useState } from 'react';
import clsx from 'clsx';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { Button } from '@gitroom/react/form/button';
import { useToaster } from '@gitroom/react/toaster/toaster';

type Platform = 'facebook' | 'instagram';
interface Post { platform: Platform; channel: string; title: string; format: string; date: string; permalink: string; reach: number; interactions: number }
interface Followers { platform: Platform; channel: string; current: number | null; net: number | null; pct: number | null }
interface ReportData {
  brand: string; periodDays: number; since: string; until: string; generatedAt: string;
  channels: { platform: Platform; name: string }[];
  excludedChannels: { provider: string; name: string; reason: string }[];
  totals: { posts: number; reach: number; interactions: number; engagementRate: number | null };
  mostActivePlatform: { platform: Platform; posts: number } | null;
  formats: { format: string; posts: number }[];
  topPosts: Post[];
  followers: Followers[];
  followersTotal: { net: number | null; pct: number | null };
  warnings: string[];
  mock?: boolean;
}
interface Narrative { numeri: string; contenuti: string; pubblico: string; sintesi: string }

type Message =
  | { kind: 'report'; data: ReportData; narrative: Narrative | null }
  | { kind: 'question'; text: string }
  | { kind: 'answer'; text: string }
  | { kind: 'pending'; text: string }
  | { kind: 'error'; text: string };

const PERIODS = [15, 30, 90];
const platformName = (p: string) => (p === 'facebook' ? 'Facebook' : p === 'instagram' ? 'Instagram' : p);
// in italiano Intl non raggruppa i numeri a 4 cifre (1450): si forza il punto delle migliaia
const intFormat = new Intl.NumberFormat('it-IT', { useGrouping: 'always' } as unknown as Intl.NumberFormatOptions);
const num = (n: number | null | undefined) => (n === null || n === undefined ? 'n/d' : intFormat.format(n));
const percent = (n: number | null | undefined, sign = false) =>
  n === null || n === undefined
    ? 'n/d'
    : `${sign && n > 0 ? '+' : ''}${n.toLocaleString('it-IT', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
const itDate = (d: string) => d.split(' ')[0].split('-').reverse().join('/') + (d.includes(' ') ? ' ' + d.split(' ')[1] : '');

// Testo di Claude: paragrafi, elenchi con "- " e **grassetto**. Niente HTML.
const RichText: FC<{ text: string; className?: string }> = ({ text, className }) => {
  const inline = (line: string) =>
    line.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
      part.startsWith('**') && part.endsWith('**') ? (
        <strong key={i} className="font-[600] text-textColor">{part.slice(2, -2)}</strong>
      ) : (
        <Fragment key={i}>{part}</Fragment>
      )
    );
  // righe normali e righe "- " consecutive diventano paragrafi ed elenchi
  const groups: { list: boolean; lines: string[] }[] = [];
  text.trim().split('\n').forEach((raw) => {
    const isItem = /^\s*[-•]\s+/.test(raw);
    const line = raw.replace(/^\s*[-•]\s+/, '');
    const last = groups[groups.length - 1];
    if (!raw.trim()) {
      groups.push({ list: false, lines: [] });
    } else if (last && last.list === isItem && (isItem || last.lines.length)) {
      last.lines.push(line);
    } else {
      groups.push({ list: isItem, lines: [line] });
    }
  });
  return (
    <div className={clsx('flex flex-col gap-[10px] leading-[1.6]', className)}>
      {groups.filter((g) => g.lines.length).map((g, i) =>
        g.list ? (
          <ul key={i} className="list-disc ps-[20px] flex flex-col gap-[4px]">
            {g.lines.map((l, j) => <li key={j}>{inline(l)}</li>)}
          </ul>
        ) : (
          <p key={i}>{g.lines.map((l, j) => <Fragment key={j}>{j > 0 && <br />}{inline(l)}</Fragment>)}</p>
        )
      )}
    </div>
  );
};

const Section: FC<{ kicker: string; index?: string; title: string; children: React.ReactNode }> = ({ kicker, index, title, children }) => (
  <div className="flex flex-col gap-[16px] py-[28px] border-t border-newTableBorder first:border-t-0">
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-[10px] text-[11px] font-[600] tracking-[0.2em] uppercase text-[#6221FF]">
        <span className="w-[22px] h-[2px] bg-[#6221FF]" />
        {kicker}
      </div>
      {index && <div className="text-[11px] tracking-[0.2em] text-customColor18">{index}</div>}
    </div>
    <h3 className="text-[28px] leading-[1.15] font-[700]">{title}</h3>
    {children}
  </div>
);

const Rows: FC<{ rows: { label: React.ReactNode; value: React.ReactNode }[] }> = ({ rows }) => (
  <div className="flex flex-col border-y border-newTableBorder">
    {rows.map((r, i) => (
      <div key={i} className="flex items-center justify-between gap-[16px] py-[12px] border-t border-newTableBorder first:border-t-0">
        <div className="text-[14px] min-w-0">{r.label}</div>
        <div className="text-[15px] font-[700] shrink-0 text-end">{r.value}</div>
      </div>
    ))}
  </div>
);

const ReportCard: FC<{ data: ReportData; narrative: Narrative | null }> = ({ data, narrative }) => {
  const period = `Ultimi ${data.periodDays} giorni`;
  const canali = data.channels.map((c) => platformName(c.platform)).filter((v, i, a) => a.indexOf(v) === i).join(' · ');
  return (
    <div className="bg-newBgColor rounded-[12px] px-[28px] py-[8px] w-full max-w-[860px]">
      {data.mock && (
        <div className="mt-[20px] rounded-[8px] bg-[#6221FF]/10 text-[#6221FF] px-[14px] py-[10px] text-[13px]">
          Dati di prova (solo ambiente locale): non corrispondono a nessun canale reale.
        </div>
      )}
      <div className="py-[28px] flex flex-col gap-[14px]">
        <div className="text-[11px] font-[600] tracking-[0.2em] uppercase text-[#6221FF]">Performance report · {itDate(data.generatedAt)}</div>
        <h2 className="text-[40px] leading-[1.05] font-[800]">Report performance — {data.brand}</h2>
        <div className="flex flex-wrap gap-x-[40px] gap-y-[12px] pt-[16px] border-t border-newTableBorder">
          {[['Periodo', period], ['Canali', canali || 'Nessuno'], ['Generato il', itDate(data.generatedAt)]].map(([k, v]) => (
            <div key={k} className="flex flex-col gap-[4px]">
              <div className="text-[10px] tracking-[0.2em] uppercase text-customColor18">{k}</div>
              <div className="text-[14px] font-[600]">{v}</div>
            </div>
          ))}
        </div>
      </div>

      {!data.channels.length ? (
        <Section kicker="Nessun dato" title="Non ci sono canali da analizzare.">
          <p className="text-[14px]">Collega almeno una pagina Facebook o un account Instagram a questo subaccount, poi genera di nuovo il report.</p>
        </Section>
      ) : (
        <>
          <Section kicker="Performance" index="01 / 03" title="Cosa è successo in numeri.">
            {narrative?.numeri && <RichText text={narrative.numeri} className="text-[15px] max-w-[620px]" />}
            <Rows
              rows={[
                { label: 'Post pubblicati', value: num(data.totals.posts) },
                { label: 'Reach totale', value: num(data.totals.reach) },
                { label: 'Engagement totale', value: num(data.totals.interactions) },
                { label: 'Engagement rate', value: percent(data.totals.engagementRate) },
              ]}
            />
          </Section>

          <Section kicker="Analisi contenuti" index="02 / 03" title="Cosa ha funzionato.">
            {narrative?.contenuti && <RichText text={narrative.contenuti} className="text-[15px] max-w-[620px]" />}
            {data.topPosts.length ? (
              <Rows
                rows={data.topPosts.map((p) => ({
                  label: p.permalink ? (
                    <a href={p.permalink} target="_blank" rel="noreferrer" className="hover:underline">{p.title}</a>
                  ) : (
                    p.title
                  ),
                  value: <span className="text-customColor18">{platformName(p.platform)} · {num(p.interactions)}</span>,
                }))}
              />
            ) : (
              <p className="text-[14px]">Nessun post pubblicato nel periodo.</p>
            )}
          </Section>

          <Section kicker="Crescita follower" index="03 / 03" title="Come è cresciuto il pubblico.">
            {narrative?.pubblico && <RichText text={narrative.pubblico} className="text-[15px] max-w-[620px]" />}
            <Rows
              rows={data.followers.map((f) => ({
                label: `${platformName(f.platform)} · ${f.channel}`,
                value: (
                  <span className="flex items-center gap-[10px] justify-end">
                    <span>{f.net === null ? 'n/d' : `${f.net > 0 ? '+' : ''}${num(f.net)}`}</span>
                    <span
                      className={clsx(
                        'rounded-full px-[10px] py-[3px] text-[12px]',
                        f.pct !== null && f.pct > 0 ? 'bg-[#16a34a]/15 text-[#16a34a]' : 'bg-customColor18/15 text-customColor18'
                      )}
                    >
                      {f.pct !== null && f.pct > 0 ? '↑ ' : '→ '}
                      {percent(f.pct, true)}
                    </span>
                  </span>
                ),
              }))}
            />
          </Section>

          <Section kicker="In sintesi" title="I numeri sono il punto di partenza, non la conclusione.">
            {narrative ? (
              narrative.sintesi && <RichText text={narrative.sintesi} className="text-[15px] max-w-[620px]" />
            ) : (
              <p className="text-[14px]">Testo AI non disponibile: i numeri qui sopra sono comunque completi.</p>
            )}
          </Section>
        </>
      )}

      {(data.warnings.length > 0 || data.excludedChannels.length > 0) && (
        <div className="pb-[24px] text-[12px] text-customColor18 flex flex-col gap-[4px] border-t border-newTableBorder pt-[16px]">
          {data.excludedChannels.map((c, i) => <div key={`e${i}`}>Escluso: {c.name} ({c.provider}) — {c.reason}</div>)}
          {data.warnings.map((w, i) => <div key={`w${i}`}>{w}</div>)}
        </div>
      )}
    </div>
  );
};

export const ReportComponent: FC = () => {
  const fetch = useFetch();
  const toast = useToaster();
  const [days, setDays] = useState(15);
  const [messages, setMessages] = useState<Message[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [question, setQuestion] = useState('');
  const bottom = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages]);

  const waitJob = useCallback(
    async (jobId: string) => {
      // i report possono richiedere qualche minuto: si interroga il job finché non chiude
      for (let i = 0; i < 400; i++) {
        await new Promise((r) => setTimeout(r, 2500));
        const res = await fetch(`/report/job/${jobId}`);
        if (!res.ok) throw new Error('Report non trovato');
        const job = await res.json();
        if (job.status === 'done') return job.result;
        if (job.status === 'error') throw new Error(job.error);
      }
      throw new Error('Tempo scaduto');
    },
    [fetch]
  );

  const run = useCallback(
    async (pendingText: string, start: () => Promise<Response>, onDone: (result: any) => Message) => {
      setBusy(true);
      setMessages((m) => [...m, { kind: 'pending', text: pendingText }]);
      try {
        const res = await start();
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body?.message || 'Richiesta non riuscita');
        }
        const { jobId } = await res.json();
        const result = await waitJob(jobId);
        setMessages((m) => [...m.filter((x) => x.kind !== 'pending'), onDone(result)]);
      } catch (e) {
        setMessages((m) => [...m.filter((x) => x.kind !== 'pending'), { kind: 'error', text: (e as Error).message }]);
        toast.show((e as Error).message, 'warning');
      } finally {
        setBusy(false);
      }
    },
    [waitJob]
  );

  const generate = useCallback(() => {
    run(
      `Sto leggendo i dati degli ultimi ${days} giorni e scrivendo il report…`,
      () => fetch('/report/generate', { method: 'POST', body: JSON.stringify({ days }) }),
      (result) => {
        setSessionId(result.sessionId);
        return { kind: 'report', data: result.data, narrative: result.narrative };
      }
    );
  }, [days, run]);

  const ask = useCallback(() => {
    const text = question.trim();
    if (!text || !sessionId) return;
    setQuestion('');
    setMessages((m) => [...m, { kind: 'question', text }]);
    run(
      'Sto pensando…',
      () => fetch('/report/ask', { method: 'POST', body: JSON.stringify({ sessionId, question: text }) }),
      (result) => ({ kind: 'answer', text: result.text })
    );
  }, [question, sessionId, run]);

  return (
    <div className="bg-newBgColorInner flex flex-col flex-1 min-h-0 h-[calc(100vh-105px)]">
      <div className="flex flex-wrap items-center gap-[12px] px-[24px] py-[16px] border-b border-newTableBorder">
        <div className="flex-1 min-w-[200px] text-[14px] text-customColor18">
          Analisi AI dei canali di questo subaccount
        </div>
        <div className="flex rounded-[8px] overflow-hidden border border-newTableBorder">
          {PERIODS.map((p) => (
            <button
              key={p}
              type="button"
              disabled={busy}
              onClick={() => setDays(p)}
              className={clsx('px-[14px] py-[8px] text-[13px]', days === p ? 'bg-[#6221FF] text-white' : 'hover:bg-newBgColor')}
            >
              {p} giorni
            </button>
          ))}
        </div>
        <Button onClick={generate} disabled={busy} loading={busy}>
          Genera report
        </Button>
      </div>

      <div data-report-scroll className="flex-1 min-h-0 overflow-y-auto px-[24px] py-[24px]">
        <div className="flex flex-col gap-[16px] items-center">
          {!messages.length && (
            <div className="text-center text-customColor18 mt-[80px] max-w-[460px] text-[14px] leading-[1.6]">
              Scegli il periodo e premi <strong className="text-textColor">Genera report</strong>. Dopo il report puoi fare domande sugli stessi dati.
            </div>
          )}
          {messages.map((m, i) =>
            m.kind === 'report' ? (
              <ReportCard key={i} data={m.data} narrative={m.narrative} />
            ) : m.kind === 'question' ? (
              <div key={i} className="w-full max-w-[860px] flex justify-end">
                <div className="bg-[#6221FF] text-white rounded-[12px] px-[16px] py-[10px] max-w-[80%] text-[14px] whitespace-pre-wrap">{m.text}</div>
              </div>
            ) : m.kind === 'answer' ? (
              <div key={i} className="w-full max-w-[860px]">
                <div className="bg-newBgColor rounded-[12px] px-[18px] py-[14px] max-w-[90%] text-[14px]">
                  <RichText text={m.text} />
                </div>
              </div>
            ) : m.kind === 'pending' ? (
              <div key={i} className="w-full max-w-[860px] text-[14px] text-customColor18 animate-pulse">{m.text}</div>
            ) : (
              <div key={i} className="w-full max-w-[860px] text-[14px] text-red-400">Errore: {m.text}</div>
            )
          )}
          <div ref={bottom} />
        </div>
      </div>

      {sessionId && (
        <form
          className="flex gap-[10px] px-[24px] py-[14px] border-t border-newTableBorder"
          onSubmit={(e) => {
            e.preventDefault();
            ask();
          }}
        >
          <input
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            disabled={busy}
            maxLength={2000}
            placeholder="Fai una domanda su questo report…"
            className="flex-1 bg-newBgColor rounded-[8px] px-[14px] py-[10px] text-[14px] outline-none border border-newTableBorder"
          />
          <Button type="submit" disabled={busy || question.trim().length < 2}>
            Invia
          </Button>
        </form>
      )}
    </div>
  );
};
