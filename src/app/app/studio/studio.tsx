"use client";

import { AlertTriangle, Check, CheckCircle2, CircleSlash, Clock, Heart, History, MessageCircle, Search, Send, X, Zap } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useSyncExternalStore, type KeyboardEvent, type ReactNode } from "react";
import { MediaThumb } from "@/components/app/media-thumb";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/form";
import { Alert, Avatar, Badge, Card } from "@/components/ui/primitives";
import { toast } from "@/components/ui/toast";
import { INSTAGRAM_RULES, validateForInstagram } from "@/lib/domain/media-rules";
import type { Campaign, CaptionTemplate, MediaAsset, PublishFormat, SocialAccount } from "@/lib/domain/types";
import type { ScheduleResult } from "@/lib/services/publishing";
import { cn, formatDateTime, formatRelative } from "@/lib/utils";
import { schedulePublicationAction } from "../_actions/publishing";

const FORMATS: { id: PublishFormat; label: string; hint: string }[] = [
  { id: "FEED", label: "Feed", hint: "1 imagem JPEG (4:5 a 1.91:1)" },
  { id: "REELS", label: "Reels", hint: "1 vídeo, 3 s a 15 min, 9:16 recomendado" },
  { id: "STORIES", label: "Story", hint: "1 imagem ou vídeo até 60 s" },
  { id: "CAROUSEL", label: "Carrossel", hint: "2 a 10 itens" },
];
const STEP_LABELS = ["Formato", "Conteúdo", "Legenda", "Contas", "Data e horário"];

function defaultWhen(): string {
  const d = new Date(Date.now() + 60 * 60_000);
  d.setMinutes(0, 0, 0);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Rascunho local do Estúdio: o trabalho não se perde ao trocar de página, recarregar ou fechar a aba. */
const DRAFT_KEY = "sx-studio-draft-v1";
type Draft = {
  format: PublishFormat;
  mediaIds: string[];
  caption: string;
  accountIds: string[];
  when: string;
  publishNow: boolean;
  campaignId: string;
  idempotencyKey: string;
  savedAt: number;
};
const subscribeStorage = (cb: () => void) => {
  window.addEventListener("storage", cb);
  return () => window.removeEventListener("storage", cb);
};
const readDraft = () => window.localStorage.getItem(DRAFT_KEY);

function Step({ n, title, done, children, aside }: { n: number; title: string; done?: boolean; children: ReactNode; aside?: ReactNode }) {
  return (
    <Card className="p-4 sm:p-5">
      <section aria-labelledby={`step-${n}`}>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 id={`step-${n}`} className="flex scroll-mt-24 items-center gap-2.5 text-sm font-semibold">
            <span
              className={cn("grid size-6 place-items-center rounded-md font-mono text-xs transition-colors", done ? "bg-success/15 text-success" : "bg-brand/15 text-brand")}
              aria-hidden
            >
              {done ? <Check className="size-3.5" /> : n}
            </span>
            {title}
            {done && <span className="sr-only">(concluído)</span>}
          </h2>
          {aside}
        </div>
        {children}
      </section>
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
  const [onlySelected, setOnlySelected] = useState(false);
  const [when, setWhen] = useState(defaultWhen);
  const [publishNow, setPublishNow] = useState(false);
  const [campaignId, setCampaignId] = useState("");
  const [mediaKind, setMediaKind] = useState<"" | "image" | "video">("");
  // Chave de idempotência por "rascunho": reenvios (duplo clique, retry de rede) não duplicam publicações.
  const [idempotencyKey, setIdempotencyKey] = useState(() => crypto.randomUUID());
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<ScheduleResult | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [draftDismissed, setDraftDismissed] = useState(false);

  // Rascunho salvo (lido via store externo: no servidor não há rascunho, sem divergência de hidratação).
  const storedDraft = useSyncExternalStore(subscribeStorage, readDraft, () => null);
  const draft = useMemo<Draft | null>(() => {
    if (!storedDraft) return null;
    try {
      const d = JSON.parse(storedDraft) as Draft;
      return d.mediaIds.length || d.caption.trim() || d.accountIds.length ? d : null;
    } catch {
      return null;
    }
  }, [storedDraft]);
  const hasWork = mediaIds.length > 0 || caption.trim().length > 0 || accountIds.size > 0;
  // Some assim que a pessoa começa um trabalho novo (que passa a ser o rascunho salvo) ou decide restaurar/descartar.
  const showDraftBanner = !!draft && !draftDismissed && !hasWork;

  function restoreDraft(d: Draft) {
    // Só IDs que ainda existem e estão aptos neste workspace (mídias excluídas/contas removidas são descartadas).
    setFormat(d.format);
    setMediaIds(d.mediaIds.filter((id) => media.some((m) => m.id === id)));
    setCaption(d.caption);
    setAccountIds(new Set(d.accountIds.filter((id) => accounts.some((a) => a.id === id && a.status === "active"))));
    setWhen(d.when);
    setPublishNow(d.publishNow);
    setCampaignId(campaigns.some((c) => c.id === d.campaignId) ? d.campaignId : "");
    setIdempotencyKey(d.idempotencyKey);
    setDraftDismissed(true);
    toast.info("Rascunho restaurado.");
  }
  function discardDraft() {
    window.localStorage.removeItem(DRAFT_KEY);
    setDraftDismissed(true);
  }

  // Salva o rascunho a cada alteração (escrita externa apenas).
  useEffect(() => {
    if (!hasWork) return;
    const d: Draft = { format, mediaIds, caption, accountIds: Array.from(accountIds), when, publishNow, campaignId, idempotencyKey, savedAt: Date.now() };
    window.localStorage.setItem(DRAFT_KEY, JSON.stringify(d));
  }, [hasWork, format, mediaIds, caption, accountIds, when, publishNow, campaignId, idempotencyKey]);

  // Aviso do navegador ao fechar/recarregar com trabalho não enviado.
  useEffect(() => {
    if (!hasWork || result?.ok) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [hasWork, result]);

  const selectedMedia = mediaIds.map((id) => media.find((m) => m.id === id)).filter((m): m is MediaAsset => !!m);
  const issues = useMemo(() => validateForInstagram(format, selectedMedia, caption), [format, selectedMedia, caption]);
  const errors = issues.filter((i) => i.level === "error");
  const warnings = issues.filter((i) => i.level === "warning");
  const unlicensed = selectedMedia.filter((m) => !m.rightsConfirmed);
  const hashtags = (caption.match(/(^|\s)#[\p{L}\p{N}_]+/gu) ?? []).length;

  const groups = Array.from(new Set(accounts.map((a) => a.group).filter(Boolean))) as string[];
  const visibleAccounts = accounts.filter((a) => {
    const s = accountQuery.toLowerCase().replace(/^@/, "");
    return (!s || a.username.toLowerCase().includes(s)) && (!groupFilter || a.group === groupFilter) && (!onlySelected || accountIds.has(a.id));
  });
  const eligible = (a: SocialAccount) => a.status === "active";
  const visibleEligible = visibleAccounts.filter(eligible);
  const selectedAccounts = accounts.filter((a) => accountIds.has(a.id));

  const multi = format === "CAROUSEL";
  function toggleMedia(id: string) {
    setMediaIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : multi ? [...prev, id].slice(0, INSTAGRAM_RULES.carouselMax) : [id]));
  }
  function chooseFormat(id: PublishFormat) {
    setFormat(id);
    if (id !== "CAROUSEL") setMediaIds((m) => m.slice(0, 1));
  }
  // Setas trocam o formato (padrão ARIA de radiogroup com foco itinerante).
  function onFormatKey(e: KeyboardEvent<HTMLButtonElement>, i: number) {
    const delta = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
    if (!delta) return;
    e.preventDefault();
    const next = FORMATS[(i + delta + FORMATS.length) % FORMATS.length]!;
    chooseFormat(next.id);
    e.currentTarget.parentElement?.querySelector<HTMLElement>(`[data-format="${next.id}"]`)?.focus();
  }

  const whenDate = new Date(when);
  const whenInvalid = !publishNow && (Number.isNaN(whenDate.getTime()) || whenDate.getTime() < new Date().getTime());
  const canSubmit = !submitting && selectedMedia.length > 0 && accountIds.size > 0 && errors.length === 0 && unlicensed.length === 0 && !whenInvalid;
  const stepsDone = [
    true,
    selectedMedia.length > 0 && errors.length === 0 && unlicensed.length === 0,
    format === "STORIES" || caption.trim().length > 0,
    accountIds.size > 0,
    !whenInvalid,
  ];
  // A legenda é opcional: não bloqueia o envio, apenas aparece como etapa pendente.
  const blocking = [1, 3, 4].find((i) => !stepsDone[i]);
  const statusLine =
    errors.length && selectedMedia.length
      ? errors[0]!.message
      : unlicensed.length
        ? "Confirme os direitos de uso na Biblioteca"
        : blocking !== undefined
          ? `Falta: ${STEP_LABELS[blocking]}`
          : publishNow
            ? "Publicar assim que possível"
            : formatDateTime(whenDate.toISOString());

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
      setConfirming(false);
      if (r.ok) {
        window.localStorage.removeItem(DRAFT_KEY);
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
    window.localStorage.removeItem(DRAFT_KEY);
  }

  if (result?.ok) {
    const scheduled = result.perAccount.filter((p) => p.status === "scheduled");
    const skipped = result.perAccount.filter((p) => p.status === "skipped");
    return (
      <Card className="mx-auto max-w-2xl p-5 animate-rise sm:p-6">
        <div className="flex items-start gap-3">
          <CheckCircle2 className="mt-0.5 size-6 shrink-0 text-success" aria-hidden />
          <div>
            <h2 className="font-semibold" role="status">
              {scheduled.length} publicação(ões) programada(s)
            </h2>
            <p className="text-sm text-fg-muted">
              {publishNow ? "Entram na fila imediatamente." : `Para ${formatDateTime(whenDate.toISOString())}.`} O worker executará cada conta de forma independente.
            </p>
          </div>
        </div>
        <ul className="mt-5 max-h-80 divide-y divide-border overflow-y-auto rounded-xl border border-border">
          {result.perAccount.map((p) => (
            <li key={p.accountId} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
              <span className="truncate">@{p.username}</span>
              {p.status === "scheduled" ? (
                <Badge tone="info">
                  <Clock className="size-3" /> Agendado
                </Badge>
              ) : (
                <span className="flex items-center gap-1.5 text-right text-xs text-warning">
                  <CircleSlash className="size-3.5 shrink-0" /> {p.reason}
                </span>
              )}
            </li>
          ))}
        </ul>
        {skipped.length > 0 && (
          <Alert tone="warning" className="mt-4">
            {skipped.length} conta(s) foram ignoradas. Veja o motivo acima.
          </Alert>
        )}
        <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          <Button onClick={reset}>Nova publicação</Button>
          <Button asChild variant="secondary">
            <Link href="/app/calendar">Ver no calendário</Link>
          </Button>
          <Button asChild variant="ghost">
            <Link href="/app/history">Acompanhar execução</Link>
          </Button>
        </div>
      </Card>
    );
  }

  const filteredMedia = media.filter((m) => !mediaKind || m.kind === mediaKind);
  const firstUrl = selectedMedia[0] ? urls[selectedMedia[0].id] : undefined;
  const previewAccount = selectedAccounts[0];
  const demoCount = selectedAccounts.filter((a) => a.isDemo).length;
  const actionLabel = `${publishNow ? "Publicar" : "Agendar"} em ${accountIds.size || "…"} conta${accountIds.size === 1 ? "" : "s"}`;

  return (
    <div className="grid grid-cols-1 gap-6 pb-24 xl:grid-cols-[minmax(0,1fr)_360px] xl:pb-0">
      <div className="grid min-w-0 grid-cols-1 gap-4">
        {showDraftBanner && draft && (
          <div className="flex flex-col gap-3 rounded-[var(--radius-card)] border border-info/30 bg-info/[0.06] p-4 sm:flex-row sm:items-center" role="status">
            <History className="size-5 shrink-0 text-info" aria-hidden />
            <div className="min-w-0 flex-1 text-sm">
              <p className="font-medium">Você tem um rascunho não enviado</p>
              <p className="text-fg-muted">
                {draft.mediaIds.length} mídia(s) · {draft.accountIds.length} conta(s) · salvo {formatRelative(new Date(draft.savedAt).toISOString())}
              </p>
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={() => restoreDraft(draft)}>
                Restaurar
              </Button>
              <Button size="sm" variant="ghost" onClick={discardDraft}>
                <X /> Descartar
              </Button>
            </div>
          </div>
        )}

        {/* Progresso: onde estou e o que falta (as etapas continuam todas visíveis e editáveis). */}
        <ol className="flex gap-1.5 overflow-x-auto scrollbar-none" aria-label="Progresso da publicação">
          {STEP_LABELS.map((l, i) => (
            <li key={l} className="min-w-0 flex-1">
              <a
                href={`#step-${i + 1}`}
                className={cn(
                  "flex min-h-9 items-center justify-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs transition-colors pointer-coarse:min-h-11 sm:justify-start",
                  stepsDone[i] ? "border-success/25 bg-success/[0.05] text-fg-muted" : "border-border text-fg-subtle hover:text-fg",
                )}
              >
                <span className={cn("grid size-4 shrink-0 place-items-center rounded-full text-[11px] font-semibold", stepsDone[i] ? "bg-success/20 text-success" : "bg-surface-3 text-fg-muted")} aria-hidden>
                  {stepsDone[i] ? <Check className="size-3" /> : i + 1}
                </span>
                <span className="truncate max-sm:sr-only">{l}</span>
                <span className="sr-only">{stepsDone[i] ? " (concluído)" : " (pendente)"}</span>
              </a>
            </li>
          ))}
        </ol>

        <Step n={1} title="Formato" done>
          <div role="radiogroup" aria-label="Formato da publicação" className="grid grid-cols-2 gap-2 md:grid-cols-4">
            {FORMATS.map((f, i) => (
              <button
                key={f.id}
                type="button"
                role="radio"
                data-format={f.id}
                aria-checked={format === f.id}
                tabIndex={format === f.id ? 0 : -1}
                onKeyDown={(e) => onFormatKey(e, i)}
                onClick={() => chooseFormat(f.id)}
                className={cn(
                  "min-h-16 rounded-xl border p-3 text-left transition-colors",
                  format === f.id ? "border-brand bg-brand/[0.06] shadow-[inset_0_0_0_1px_var(--brand)]" : "border-border hover:border-border-strong hover:bg-surface-2/50",
                )}
              >
                <p className="text-sm font-medium">{f.label}</p>
                <p className="mt-0.5 text-xs leading-snug text-fg-subtle">{f.hint}</p>
              </button>
            ))}
          </div>
        </Step>

        <Step
          n={2}
          done={stepsDone[1]}
          title={multi ? `Conteúdo (${mediaIds.length}/10, na ordem de seleção)` : "Conteúdo"}
          aside={
            <Select value={mediaKind} onChange={(e) => setMediaKind(e.target.value as typeof mediaKind)} className="h-8 w-32 text-xs pointer-coarse:h-11" aria-label="Filtrar tipo de mídia">
              <option value="">Todos</option>
              <option value="image">Imagens</option>
              <option value="video">Vídeos</option>
            </Select>
          }
        >
          {media.length === 0 ? (
            <p className="text-sm text-fg-muted">
              Biblioteca vazia.{" "}
              <Link href="/app/library" className="font-medium text-fg underline underline-offset-2">
                Envie mídias
              </Link>{" "}
              para continuar.
            </p>
          ) : (
            <ul className="grid max-h-72 grid-cols-3 gap-2 overflow-y-auto pr-1 min-[400px]:grid-cols-4 sm:grid-cols-6 lg:grid-cols-8">
              {filteredMedia.map((m) => {
                const idx = mediaIds.indexOf(m.id);
                return (
                  <li key={m.id}>
                    <button
                      type="button"
                      onClick={() => toggleMedia(m.id)}
                      aria-pressed={idx >= 0}
                      aria-label={`${idx >= 0 ? "Remover" : "Selecionar"} ${m.fileName}${m.rightsConfirmed ? "" : " (direitos não confirmados)"}`}
                      className={cn("relative block aspect-square w-full overflow-hidden rounded-lg border-2 transition-colors", idx >= 0 ? "border-brand" : "border-transparent hover:border-border-strong")}
                    >
                      <MediaThumb media={m} url={urls[m.id]} className="size-full" />
                      {idx >= 0 && (
                        <span className="absolute right-1 top-1 grid size-5 place-items-center rounded-full bg-brand-solid text-xs font-semibold text-white">{multi ? idx + 1 : "✓"}</span>
                      )}
                      {!m.rightsConfirmed && (
                        <span className="absolute inset-x-1 bottom-1 truncate rounded bg-warning px-1 text-center text-[11px] font-semibold leading-4 text-black">Direitos</span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
          {unlicensed.length > 0 && (
            <Alert tone="warning" className="mt-3">
              Confirme os direitos de uso de {unlicensed.length} mídia(s) na{" "}
              <Link href="/app/library" className="font-medium text-fg underline underline-offset-2">
                Biblioteca
              </Link>{" "}
              antes de publicar.
            </Alert>
          )}
          {errors.length > 0 && selectedMedia.length > 0 && (
            <ul className="mt-3 space-y-1 text-xs text-danger" role="alert">
              {errors.map((e, i) => (
                <li key={i} className="flex gap-1.5">
                  <AlertTriangle className="mt-px size-3.5 shrink-0" aria-hidden />
                  {e.message}
                </li>
              ))}
            </ul>
          )}
        </Step>

        <Step
          n={3}
          done={stepsDone[2]}
          title="Legenda"
          aside={
            captions.length > 0 ? (
              <Select
                className="h-8 w-44 text-xs pointer-coarse:h-11"
                value=""
                onChange={(e) => {
                  const c = captions.find((x) => x.id === e.target.value);
                  if (c) setCaption((prev) => (prev ? `${prev}\n\n${c.body}` : c.body));
                }}
                aria-label="Inserir legenda salva"
              >
                <option value="">Inserir legenda salva…</option>
                {captions.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title}
                  </option>
                ))}
              </Select>
            ) : undefined
          }
        >
          <Textarea
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            className="min-h-36"
            maxLength={INSTAGRAM_RULES.captionMaxChars}
            aria-label="Legenda"
            aria-describedby="caption-meta"
            placeholder="Escreva a legenda…"
            disabled={format === "STORIES"}
          />
          <div id="caption-meta" className="mt-2 flex justify-between gap-3 text-xs text-fg-subtle">
            <span className={cn(hashtags > INSTAGRAM_RULES.maxHashtags && "text-danger")}>
              {format === "STORIES" ? "Stories não exibem legenda pela API." : `${hashtags}/${INSTAGRAM_RULES.maxHashtags} hashtags`}
            </span>
            <span className={cn("tabular-nums", caption.length > 2000 && "text-warning")}>
              {caption.length}/{INSTAGRAM_RULES.captionMaxChars}
            </span>
          </div>
        </Step>

        <Step
          n={4}
          done={stepsDone[3]}
          title={`Contas (${accountIds.size} selecionada${accountIds.size === 1 ? "" : "s"})`}
          aside={
            <div className="flex flex-wrap gap-1">
              <Button size="sm" variant="ghost" disabled={visibleEligible.length === 0} onClick={() => setAccountIds(new Set([...accountIds, ...visibleEligible.map((a) => a.id)]))}>
                Selecionar aptas ({visibleEligible.length})
              </Button>
              <Button size="sm" variant="ghost" disabled={accountIds.size === 0} onClick={() => setAccountIds(new Set())}>
                Limpar
              </Button>
            </div>
          }
        >
          <div className="mb-3 grid gap-2 sm:grid-cols-[1fr_180px_auto]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-fg-subtle" aria-hidden />
              <Input placeholder="Buscar conta" value={accountQuery} onChange={(e) => setAccountQuery(e.target.value)} className="pl-9" aria-label="Buscar conta" />
            </div>
            <Select value={groupFilter} onChange={(e) => setGroupFilter(e.target.value)} aria-label="Filtrar grupo">
              <option value="">Todos os grupos</option>
              {groups.map((g) => (
                <option key={g}>{g}</option>
              ))}
            </Select>
            <label className="flex min-h-10 cursor-pointer items-center gap-2 rounded-lg border border-border px-3 text-sm text-fg-muted pointer-coarse:min-h-11">
              <Checkbox checked={onlySelected} onChange={(e) => setOnlySelected(e.target.checked)} />
              Só selecionadas
            </label>
          </div>
          {visibleAccounts.length === 0 ? (
            <p className="rounded-lg border border-dashed border-border p-4 text-center text-sm text-fg-muted">Nenhuma conta corresponde à busca.</p>
          ) : (
            <ul className="grid max-h-80 gap-1.5 overflow-y-auto pr-1 sm:grid-cols-2">
              {visibleAccounts.map((a) => {
                const ok = eligible(a);
                return (
                  <li key={a.id}>
                    <label
                      className={cn(
                        "flex min-h-11 items-center gap-3 rounded-lg border px-3 py-2 text-sm transition-colors",
                        !ok ? "cursor-not-allowed border-border opacity-55" : accountIds.has(a.id) ? "cursor-pointer border-brand/50 bg-brand/[0.06]" : "cursor-pointer border-border hover:border-border-strong",
                      )}
                    >
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
          )}
        </Step>

        <Step n={5} title="Data e horário" done={stepsDone[4]}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Agendar para" htmlFor="when" error={whenInvalid ? "Escolha um horário no futuro." : undefined} hint="Horário local do seu navegador.">
              <Input id="when" type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} disabled={publishNow} aria-invalid={whenInvalid} />
            </Field>
            <Field label="Campanha (opcional)" htmlFor="campaign">
              <Select id="campaign" value={campaignId} onChange={(e) => setCampaignId(e.target.value)}>
                <option value="">Sem campanha</option>
                {campaigns.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <label className="mt-4 flex min-h-11 cursor-pointer items-center gap-2 text-sm">
            <Checkbox checked={publishNow} onChange={(e) => setPublishNow(e.target.checked)} />
            <Zap className="size-4 text-brand" aria-hidden /> Publicar assim que possível (próxima rodada do worker)
          </label>
        </Step>
      </div>

      <aside className="xl:sticky xl:top-6 xl:h-fit" aria-label="Prévia e resumo">
        <Card className="overflow-hidden">
          <div className="border-b border-border px-5 py-3">
            <h2 className="text-sm font-semibold">Prévia</h2>
            <p className="text-xs text-fg-subtle">Aproximação visual; o resultado final depende da plataforma.</p>
          </div>
          <div className="p-5">
            <div className="mx-auto w-full max-w-[280px] overflow-hidden rounded-[28px] border-4 border-surface-3 bg-black">
              <div className="flex items-center gap-2 px-3 py-2.5">
                <Avatar src={previewAccount?.avatarUrl ?? null} name={previewAccount?.username ?? "conta"} size={24} />
                <span className="truncate text-xs font-semibold text-white">{previewAccount ? previewAccount.username : "sua_conta"}</span>
                {selectedAccounts.length > 1 && <span className="shrink-0 text-xs text-white/60">+{selectedAccounts.length - 1}</span>}
              </div>
              <div className={cn("relative bg-surface-2", format === "REELS" || format === "STORIES" ? "aspect-[9/16]" : "aspect-[4/5]")}>
                {selectedMedia[0] ? (
                  <MediaThumb media={selectedMedia[0]} url={firstUrl} className="absolute inset-0 size-full" />
                ) : (
                  <p className="absolute inset-0 grid place-items-center text-xs text-fg-subtle">Selecione uma mídia</p>
                )}
                {multi && selectedMedia.length > 1 && <span className="absolute right-2 top-2 rounded-full bg-black/70 px-2 py-0.5 text-xs text-white">1/{selectedMedia.length}</span>}
              </div>
              {format !== "STORIES" && (
                <div className="space-y-1.5 px-3 py-2.5 text-white">
                  <div className="flex gap-3" aria-hidden>
                    <Heart className="size-4" />
                    <MessageCircle className="size-4" />
                    <Send className="size-4" />
                  </div>
                  <p className="line-clamp-3 whitespace-pre-line text-xs leading-snug">
                    <span className="font-semibold">{previewAccount?.username ?? "sua_conta"}</span> {caption || <span className="text-white/50">Sua legenda aparece aqui</span>}
                  </p>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-3 border-t border-border p-5">
            <dl className="grid grid-cols-2 gap-y-1.5 text-xs">
              <dt className="text-fg-subtle">Formato</dt>
              <dd className="text-right">{FORMATS.find((f) => f.id === format)?.label}</dd>
              <dt className="text-fg-subtle">Mídias</dt>
              <dd className="text-right">{selectedMedia.length}</dd>
              <dt className="text-fg-subtle">Contas</dt>
              <dd className="text-right font-semibold text-fg">{accountIds.size}</dd>
              <dt className="text-fg-subtle">Quando</dt>
              <dd className="text-right">{publishNow ? "Agora" : whenInvalid ? "—" : formatDateTime(whenDate.toISOString())}</dd>
            </dl>
            {warnings.length > 0 && (
              <ul className="space-y-1 text-xs text-warning">
                {warnings.map((e, i) => (
                  <li key={i} className="flex gap-1.5">
                    <AlertTriangle className="mt-px size-3.5 shrink-0" aria-hidden />
                    {e.message}
                  </li>
                ))}
              </ul>
            )}
            {result && !result.ok && (
              <Alert tone="danger">
                {result.error}
                {result.issues?.map((i) => (
                  <span key={i.message} className="block">
                    • {i.message}
                  </span>
                ))}
              </Alert>
            )}
            {demoCount > 0 && <p className="text-xs text-warning">Contas Demo: a publicação será apenas simulada.</p>}
            <Button className="w-full" size="lg" disabled={!canSubmit} loading={submitting} onClick={() => setConfirming(true)}>
              {actionLabel}
            </Button>
            {!canSubmit && !submitting && <p className="text-center text-xs text-fg-subtle">{statusLine}</p>}
          </div>
        </Card>
      </aside>

      {/* Celular/tablet: resumo + ação sempre visíveis acima da navegação inferior. */}
      <div className="fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-30 border-t border-border bg-surface/95 px-4 py-3 shadow-[0_-12px_30px_-12px_rgb(0_0_0/0.8)] backdrop-blur-lg lg:bottom-0 lg:pb-[max(0.75rem,env(safe-area-inset-bottom))] xl:hidden">
        <div className="mx-auto flex max-w-3xl items-center gap-3">
          <div className="min-w-0 flex-1 text-xs">
            <p className="font-medium text-fg">
              {selectedMedia.length} mídia{selectedMedia.length === 1 ? "" : "s"} · {accountIds.size} conta{accountIds.size === 1 ? "" : "s"}
            </p>
            <p className={cn("truncate", errors.length && selectedMedia.length ? "text-danger" : "text-fg-subtle")}>{statusLine}</p>
          </div>
          <Button size="lg" disabled={!canSubmit} loading={submitting} onClick={() => setConfirming(true)}>
            {publishNow ? "Publicar" : "Agendar"}
          </Button>
        </div>
      </div>

      {/* Confirmação precisa antes de agendar (o envio só acontece aqui). */}
      <Dialog
        open={confirming}
        onOpenChange={(o) => !submitting && setConfirming(o)}
        title={publishNow ? "Confirmar publicação" : "Confirmar agendamento"}
        description="Revise antes de enviar. Cada conta é executada de forma independente."
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirming(false)} disabled={submitting}>
              Voltar e editar
            </Button>
            <Button loading={submitting} onClick={submit}>
              <Send /> {actionLabel}
            </Button>
          </>
        }
      >
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 rounded-xl border border-border bg-surface-2/50 p-4 text-sm">
          <dt className="text-fg-subtle">Formato</dt>
          <dd>{FORMATS.find((f) => f.id === format)?.label}</dd>
          <dt className="text-fg-subtle">Mídias</dt>
          <dd>{selectedMedia.map((m) => m.fileName).join(", ")}</dd>
          <dt className="text-fg-subtle">Quando</dt>
          <dd>{publishNow ? "Assim que possível" : formatDateTime(whenDate.toISOString())}</dd>
          {campaignId && (
            <>
              <dt className="text-fg-subtle">Campanha</dt>
              <dd>{campaigns.find((c) => c.id === campaignId)?.name}</dd>
            </>
          )}
          <dt className="text-fg-subtle">Legenda</dt>
          <dd className="line-clamp-2 text-fg-muted">{format === "STORIES" ? "—" : caption || "Sem legenda"}</dd>
        </dl>
        <p className="mb-2 mt-4 text-xs font-medium text-fg-muted">{accountIds.size} conta(s)</p>
        <ul className="flex max-h-40 flex-wrap gap-1.5 overflow-y-auto">
          {selectedAccounts.map((a) => (
            <li key={a.id}>
              <Badge tone={a.isDemo ? "warning" : "neutral"}>@{a.username}</Badge>
            </li>
          ))}
        </ul>
        {demoCount > 0 && (
          <Alert tone="warning" className="mt-4">
            {demoCount} conta(s) Demo: a publicação será apenas simulada, nada é enviado ao Instagram.
          </Alert>
        )}
      </Dialog>
    </div>
  );
}
