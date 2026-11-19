"use client";

import { AlertTriangle, CheckCircle2, CircleSlash, Clock, Heart, MessageCircle, Search, Send, Zap } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { MediaThumb } from "@/components/app/media-thumb";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/form";
import { Alert, Avatar, Badge, Card } from "@/components/ui/primitives";
import { toast } from "@/components/ui/toast";
import { INSTAGRAM_RULES, validateForInstagram } from "@/lib/domain/media-rules";
import type { Campaign, CaptionTemplate, MediaAsset, PublishFormat, SocialAccount } from "@/lib/domain/types";
import type { ScheduleResult } from "@/lib/services/publishing";
import { cn, formatDateTime } from "@/lib/utils";
import { schedulePublicationAction } from "../_actions/publishing";

const FORMATS: { id: PublishFormat; label: string; hint: string }[] = [
  { id: "FEED", label: "Feed", hint: "1 imagem JPEG (4:5 a 1.91:1)" },
  { id: "REELS", label: "Reels", hint: "1 vídeo, 3 s a 15 min, 9:16 recomendado" },
  { id: "STORIES", label: "Story", hint: "1 imagem ou vídeo até 60 s" },
  { id: "CAROUSEL", label: "Carrossel", hint: "2 a 10 itens" },
];

function defaultWhen(): string {
  const d = new Date(Date.now() + 60 * 60_000);
  d.setMinutes(0, 0, 0);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function Step({ n, title, children, aside }: { n: number; title: string; children: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <Card className="p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2.5 text-sm font-semibold">
          <span className="grid size-6 place-items-center rounded-md bg-brand/15 font-mono text-xs text-brand">{n}</span>
          {title}
        </h2>
        {aside}
      </div>
      {children}
    </Card>
  );
}

export function Studio({
  accounts,
  media,
  urls,
  captions,
  campaigns,
}: {
  accounts: SocialAccount[];
  media: MediaAsset[];
  urls: Record<string, string>;
  captions: CaptionTemplate[];
  campaigns: Campaign[];
}) {
  const router = useRouter();
  const [format, setFormat] = useState<PublishFormat>("FEED");
  const [mediaIds, setMediaIds] = useState<string[]>([]);
  const [caption, setCaption] = useState("");
  const [accountIds, setAccountIds] = useState<Set<string>>(new Set());
  const [accountQuery, setAccountQuery] = useState("");
  const [groupFilter, setGroupFilter] = useState("");
  const [when, setWhen] = useState(defaultWhen);
  const [publishNow, setPublishNow] = useState(false);
  const [campaignId, setCampaignId] = useState("");
  const [mediaKind, setMediaKind] = useState<"" | "image" | "video">("");
  // Chave de idempotência por "rascunho": reenvios (duplo clique, retry de rede) não duplicam publicações.
  const [idempotencyKey, setIdempotencyKey] = useState(() => crypto.randomUUID());
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<ScheduleResult | null>(null);

  const selectedMedia = mediaIds.map((id) => media.find((m) => m.id === id)).filter((m): m is MediaAsset => !!m);
  const issues = useMemo(() => validateForInstagram(format, selectedMedia, caption), [format, selectedMedia, caption]);
  const errors = issues.filter((i) => i.level === "error");
  const warnings = issues.filter((i) => i.level === "warning");
  const unlicensed = selectedMedia.filter((m) => !m.rightsConfirmed);
  const hashtags = (caption.match(/(^|\s)#[\p{L}\p{N}_]+/gu) ?? []).length;

  const groups = Array.from(new Set(accounts.map((a) => a.group).filter(Boolean))) as string[];
  const visibleAccounts = accounts.filter((a) => {
    const s = accountQuery.toLowerCase().replace(/^@/, "");
    return (!s || a.username.toLowerCase().includes(s)) && (!groupFilter || a.group === groupFilter);
  });
  const eligible = (a: SocialAccount) => a.status === "active";
  const selectedAccounts = accounts.filter((a) => accountIds.has(a.id));

  const multi = format === "CAROUSEL";
  function toggleMedia(id: string) {
    setMediaIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : multi ? [...prev, id].slice(0, INSTAGRAM_RULES.carouselMax) : [id]));
  }

  const whenDate = new Date(when);
  const whenInvalid = !publishNow && (Number.isNaN(whenDate.getTime()) || whenDate.getTime() < new Date().getTime());
  const canSubmit = !submitting && selectedMedia.length > 0 && accountIds.size > 0 && errors.length === 0 && unlicensed.length === 0 && !whenInvalid;

  async function submit() {
    setSubmitting(true);
    setResult(null);
    const payload = {
      idempotencyKey,
      mediaIds,
      caption,
      accountIds: Array.from(accountIds),
      format,
      scheduledAt: publishNow ? new Date().toISOString() : whenDate.toISOString(),
      campaignId: campaignId || null,
      publishNow,
    };
    try {
      const r = await schedulePublicationAction(payload);
      setResult(r);
      if (r.ok) {
        toast.success(r.duplicate ? "Esta publicação já havia sido registrada." : "Publicação programada.");
        router.refresh();
      } else {
        toast.error(r.error);
      }
    } catch {
      // Falha de rede: mantemos a mesma chave para que o reenvio seja idempotente.
      toast.error("Falha de conexão. Tente novamente — não haverá duplicidade.");
    } finally {
      setSubmitting(false);
    }
  }

  function reset() {
    setIdempotencyKey(crypto.randomUUID());
    setResult(null);
    setMediaIds([]);
    setCaption("");
    setAccountIds(new Set());
  }

  if (result?.ok) {
    const scheduled = result.perAccount.filter((p) => p.status === "scheduled");
    const skipped = result.perAccount.filter((p) => p.status === "skipped");
    return (
      <Card className="mx-auto max-w-2xl p-6 animate-rise">
        <div className="flex items-center gap-3">
          <CheckCircle2 className="size-6 text-success" aria-hidden />
          <div>
            <h2 className="font-semibold">{scheduled.length} publicação(ões) programada(s)</h2>
            <p className="text-sm text-fg-muted">
              {publishNow ? "Entram na fila imediatamente." : `Para ${formatDateTime(whenDate.toISOString())}.`} O worker executará cada conta de forma independente.
            </p>
          </div>
        </div>
        <ul className="mt-5 divide-y divide-border rounded-xl border border-border">
          {result.perAccount.map((p) => (
            <li key={p.accountId} className="flex items-center justify-between px-4 py-2.5 text-sm">
              <span>@{p.username}</span>
              {p.status === "scheduled" ? (
                <Badge tone="info"><Clock className="size-3" /> Agendado</Badge>
              ) : (
                <span className="flex items-center gap-1.5 text-xs text-warning">
                  <CircleSlash className="size-3.5" /> {p.reason}
                </span>
              )}
            </li>
          ))}
        </ul>
        {skipped.length > 0 && <Alert tone="warning" className="mt-4">{skipped.length} conta(s) foram ignoradas. Veja o motivo acima.</Alert>}
        <div className="mt-6 flex flex-wrap gap-2">
          <Button onClick={reset}>Nova publicação</Button>
          <Button asChild variant="secondary"><Link href="/app/calendar">Ver no calendário</Link></Button>
          <Button asChild variant="ghost"><Link href="/app/history">Acompanhar execução</Link></Button>
        </div>
      </Card>
    );
  }

  const filteredMedia = media.filter((m) => !mediaKind || m.kind === mediaKind);
  const firstUrl = selectedMedia[0] ? urls[selectedMedia[0].id] : undefined;
  const previewAccount = selectedAccounts[0];

  return (
    <div className="grid grid-cols-1 gap-6 pb-20 xl:grid-cols-[1fr_360px] xl:pb-0">
      <div className="grid grid-cols-1 gap-4">
        <Step n={1} title="Formato">
          <div role="radiogroup" aria-label="Formato da publicação" className="grid grid-cols-2 gap-2 md:grid-cols-4">
            {FORMATS.map((f) => (
              <button
                key={f.id}
                role="radio"
                aria-checked={format === f.id}
                onClick={() => {
                  setFormat(f.id);
                  if (f.id !== "CAROUSEL") setMediaIds((m) => m.slice(0, 1));
                }}
                className={cn(
                  "rounded-xl border p-3 text-left transition-colors",
                  format === f.id ? "border-brand bg-brand/5" : "border-border hover:border-border-strong",
                )}
              >
                <p className="text-sm font-medium">{f.label}</p>
                <p className="mt-0.5 text-[11px] text-fg-subtle">{f.hint}</p>
              </button>
            ))}
          </div>
        </Step>

        <Step
          n={2}
          title={multi ? `Conteúdo (${mediaIds.length}/10, na ordem de seleção)` : "Conteúdo"}
          aside={
            <Select value={mediaKind} onChange={(e) => setMediaKind(e.target.value as typeof mediaKind)} className="h-8 w-32 text-xs" aria-label="Filtrar tipo de mídia">
              <option value="">Todos</option>
              <option value="image">Imagens</option>
              <option value="video">Vídeos</option>
            </Select>
          }
        >
          {media.length === 0 ? (
            <p className="text-sm text-fg-muted">
              Biblioteca vazia. <Link href="/app/library" className="text-fg underline">Envie mídias</Link> para continuar.
            </p>
          ) : (
            <ul className="grid max-h-72 grid-cols-4 gap-2 overflow-y-auto pr-1 sm:grid-cols-6 lg:grid-cols-8">
              {filteredMedia.map((m) => {
                const idx = mediaIds.indexOf(m.id);
                return (
                  <li key={m.id}>
                    <button
                      onClick={() => toggleMedia(m.id)}
                      aria-pressed={idx >= 0}
                      aria-label={`${idx >= 0 ? "Remover" : "Selecionar"} ${m.fileName}`}
                      className={cn("relative block aspect-square w-full overflow-hidden rounded-lg border-2 transition-colors", idx >= 0 ? "border-brand" : "border-transparent hover:border-border-strong")}
                    >
                      <MediaThumb media={m} url={urls[m.id]} className="size-full" />
                      {idx >= 0 && <span className="absolute right-1 top-1 grid size-5 place-items-center rounded-full bg-brand text-[10px] font-semibold text-white">{multi ? idx + 1 : "✓"}</span>}
                      {!m.rightsConfirmed && <span className="absolute bottom-1 left-1 rounded bg-warning px-1 text-[9px] font-semibold text-black">DIREITOS</span>}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
          {unlicensed.length > 0 && (
            <Alert tone="warning" className="mt-3">
              Confirme os direitos de uso de {unlicensed.length} mídia(s) na <Link href="/app/library" className="underline">Biblioteca</Link> antes de publicar.
            </Alert>
          )}
        </Step>

        <Step
          n={3}
          title="Legenda"
          aside={
            captions.length > 0 ? (
              <Select
                className="h-8 w-44 text-xs"
                value=""
                onChange={(e) => {
                  const c = captions.find((x) => x.id === e.target.value);
                  if (c) setCaption((prev) => (prev ? `${prev}\n\n${c.body}` : c.body));
                }}
                aria-label="Inserir legenda salva"
              >
                <option value="">Inserir legenda salva…</option>
                {captions.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
              </Select>
            ) : undefined
          }
        >
          <Textarea value={caption} onChange={(e) => setCaption(e.target.value)} className="min-h-36" maxLength={INSTAGRAM_RULES.captionMaxChars} aria-label="Legenda" placeholder="Escreva a legenda…" disabled={format === "STORIES"} />
          <div className="mt-2 flex justify-between text-xs text-fg-subtle">
            <span>{format === "STORIES" ? "Stories não exibem legenda pela API." : `${hashtags}/${INSTAGRAM_RULES.maxHashtags} hashtags`}</span>
            <span className={cn(caption.length > 2000 && "text-warning")}>{caption.length}/{INSTAGRAM_RULES.captionMaxChars}</span>
          </div>
        </Step>

        <Step
          n={4}
          title={`Contas (${accountIds.size} selecionada${accountIds.size === 1 ? "" : "s"})`}
          aside={
            <div className="flex gap-1">
              <Button size="sm" variant="ghost" onClick={() => setAccountIds(new Set([...accountIds, ...visibleAccounts.filter(eligible).map((a) => a.id)]))}>
                Selecionar visíveis
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setAccountIds(new Set())}>Limpar</Button>
            </div>
          }
        >
          <div className="mb-3 grid gap-2 sm:grid-cols-[1fr_180px]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-fg-subtle" aria-hidden />
              <Input placeholder="Buscar conta" value={accountQuery} onChange={(e) => setAccountQuery(e.target.value)} className="pl-9" aria-label="Buscar conta" />
            </div>
            <Select value={groupFilter} onChange={(e) => setGroupFilter(e.target.value)} aria-label="Filtrar grupo">
              <option value="">Todos os grupos</option>
              {groups.map((g) => <option key={g}>{g}</option>)}
            </Select>
          </div>
          <ul className="grid max-h-72 gap-1.5 overflow-y-auto pr-1 sm:grid-cols-2">
            {visibleAccounts.map((a) => {
              const ok = eligible(a);
              return (
                <li key={a.id}>
                  <label className={cn("flex items-center gap-3 rounded-lg border px-3 py-2 text-sm transition-colors", !ok ? "cursor-not-allowed border-border opacity-50" : accountIds.has(a.id) ? "cursor-pointer border-brand/50 bg-brand/5" : "cursor-pointer border-border hover:border-border-strong")}>
                    <Checkbox
                      disabled={!ok}
                      checked={accountIds.has(a.id)}
                      onChange={() =>
                        setAccountIds((prev) => {
                          const n = new Set(prev);
                          if (n.has(a.id)) n.delete(a.id);
                          else n.add(a.id);
                          return n;
                        })
                      }
                    />
                    <Avatar src={a.avatarUrl} name={a.username} size={26} />
                    <span className="min-w-0 flex-1 truncate">@{a.username}</span>
                    {a.isDemo && <Badge tone="warning">Demo</Badge>}
                    {!ok && <Badge tone="danger">Reconectar</Badge>}
                  </label>
                </li>
              );
            })}
          </ul>
        </Step>

        <Step n={5} title="Data e horário">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Agendar para" htmlFor="when" error={whenInvalid ? "Escolha um horário no futuro." : undefined} hint="Horário local do seu navegador.">
              <Input id="when" type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} disabled={publishNow} aria-invalid={whenInvalid} />
            </Field>
            <Field label="Campanha (opcional)" htmlFor="campaign">
              <Select id="campaign" value={campaignId} onChange={(e) => setCampaignId(e.target.value)}>
                <option value="">Sem campanha</option>
                {campaigns.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </Select>
            </Field>
          </div>
          <label className="mt-4 flex items-center gap-2 text-sm">
            <Checkbox checked={publishNow} onChange={(e) => setPublishNow(e.target.checked)} />
            <Zap className="size-4 text-brand" aria-hidden /> Publicar assim que possível (próxima rodada do worker)
          </label>
        </Step>
      </div>

      <aside className="xl:sticky xl:top-6 xl:h-fit">
        <Card className="overflow-hidden">
          <div className="border-b border-border px-5 py-3">
            <h2 className="text-sm font-semibold">Prévia</h2>
            <p className="text-xs text-fg-subtle">Aproximação visual; o resultado final depende da plataforma.</p>
          </div>
          <div className="p-5">
            <div className="mx-auto w-full max-w-[280px] overflow-hidden rounded-[28px] border-4 border-surface-3 bg-black">
              <div className="flex items-center gap-2 px-3 py-2.5">
                <Avatar src={previewAccount?.avatarUrl ?? null} name={previewAccount?.username ?? "conta"} size={24} />
                <span className="text-xs font-semibold text-white">{previewAccount ? previewAccount.username : "sua_conta"}</span>
                {selectedAccounts.length > 1 && <span className="text-[10px] text-white/60">+{selectedAccounts.length - 1}</span>}
              </div>
              <div className={cn("relative bg-surface-2", format === "REELS" || format === "STORIES" ? "aspect-[9/16]" : "aspect-[4/5]")}>
                {selectedMedia[0] ? <MediaThumb media={selectedMedia[0]} url={firstUrl} className="absolute inset-0 size-full" /> : <p className="absolute inset-0 grid place-items-center text-xs text-fg-subtle">Selecione uma mídia</p>}
                {multi && selectedMedia.length > 1 && <span className="absolute right-2 top-2 rounded-full bg-black/70 px-2 py-0.5 text-[10px] text-white">1/{selectedMedia.length}</span>}
              </div>
              {format !== "STORIES" && (
                <div className="space-y-1.5 px-3 py-2.5 text-white">
                  <div className="flex gap-3" aria-hidden>
                    <Heart className="size-4" />
                    <MessageCircle className="size-4" />
                    <Send className="size-4" />
                  </div>
                  <p className="line-clamp-3 whitespace-pre-line text-[11px] leading-snug">
                    <span className="font-semibold">{previewAccount?.username ?? "sua_conta"}</span> {caption || <span className="text-white/50">Sua legenda aparece aqui</span>}
                  </p>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-3 border-t border-border p-5">
            <dl className="grid grid-cols-2 gap-y-1.5 text-xs">
              <dt className="text-fg-subtle">Formato</dt><dd className="text-right">{FORMATS.find((f) => f.id === format)?.label}</dd>
              <dt className="text-fg-subtle">Mídias</dt><dd className="text-right">{selectedMedia.length}</dd>
              <dt className="text-fg-subtle">Contas</dt><dd className="text-right font-semibold text-fg">{accountIds.size}</dd>
              <dt className="text-fg-subtle">Quando</dt><dd className="text-right">{publishNow ? "Agora" : whenInvalid ? "—" : formatDateTime(whenDate.toISOString())}</dd>
            </dl>
            {errors.length > 0 && selectedMedia.length > 0 && (
              <ul className="space-y-1 text-xs text-danger" role="alert">
                {errors.map((e, i) => <li key={i} className="flex gap-1.5"><AlertTriangle className="mt-px size-3.5 shrink-0" />{e.message}</li>)}
              </ul>
            )}
            {warnings.length > 0 && (
              <ul className="space-y-1 text-xs text-warning">
                {warnings.map((e, i) => <li key={i} className="flex gap-1.5"><AlertTriangle className="mt-px size-3.5 shrink-0" />{e.message}</li>)}
              </ul>
            )}
            {result && !result.ok && <Alert tone="danger">{result.error}{result.issues?.map((i) => <span key={i.message} className="block">• {i.message}</span>)}</Alert>}
            {selectedAccounts.some((a) => a.isDemo) && (
              <p className="text-[11px] text-warning">Contas Demo: a publicação será apenas simulada.</p>
            )}
            <Button className="w-full" size="lg" disabled={!canSubmit} loading={submitting} onClick={submit}>
              {publishNow ? "Publicar" : "Agendar"} em {accountIds.size || "…"} conta{accountIds.size === 1 ? "" : "s"}
            </Button>
          </div>
        </Card>
      </aside>

      {/* Celular: resumo + ação sempre visíveis acima da navegação inferior */}
      <div className="pb-safe fixed inset-x-0 bottom-16 z-30 border-t border-border bg-surface/95 px-4 py-3 backdrop-blur-lg lg:bottom-0 xl:hidden">
        <div className="mx-auto flex max-w-3xl items-center gap-3">
          <div className="min-w-0 flex-1 text-xs">
            <p className="font-medium text-fg">
              {selectedMedia.length} mídia{selectedMedia.length === 1 ? "" : "s"} · {accountIds.size} conta{accountIds.size === 1 ? "" : "s"}
            </p>
            <p className={cn("truncate", errors.length && selectedMedia.length ? "text-danger" : "text-fg-subtle")}>
              {errors.length && selectedMedia.length
                ? errors[0]!.message
                : unlicensed.length
                  ? "Confirme os direitos de uso na Biblioteca"
                  : publishNow
                    ? "Publicar agora"
                    : whenInvalid
                      ? "Escolha um horário futuro"
                      : formatDateTime(whenDate.toISOString())}
            </p>
          </div>
          <Button disabled={!canSubmit} loading={submitting} onClick={submit}>
            {publishNow ? "Publicar" : "Agendar"}
          </Button>
        </div>
      </div>
    </div>
  );
}
