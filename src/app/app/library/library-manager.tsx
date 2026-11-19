"use client";

import { CheckCircle2, FolderInput, ImagePlus, Images, Search, ShieldCheck, Tag, Trash2, Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState, useTransition } from "react";
import { MediaThumb } from "@/components/app/media-thumb";
import { uploadFile } from "@/components/app/uploader";
import { Button } from "@/components/ui/button";
import { ConfirmButton, Dialog } from "@/components/ui/dialog";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/form";
import { Alert, Badge, Card, EmptyState } from "@/components/ui/primitives";
import { toast } from "@/components/ui/toast";
import { formatBytes, UPLOAD_RULES } from "@/lib/domain/media-rules";
import { parseTags } from "@/lib/domain/schemas";
import type { CaptionTemplate, MediaAsset } from "@/lib/domain/types";
import { cn, formatDate } from "@/lib/utils";
import { createCaptionAction, deleteCaptionAction, deleteMediaAction, updateMediaAction } from "../_actions/library";

const ACCEPT = [...UPLOAD_RULES.image.mimeTypes, ...UPLOAD_RULES.video.mimeTypes].join(",");

type Upload = { name: string; status: "uploading" | "done" | "error"; error?: string };

export function LibraryManager({
  media,
  urls,
  captions,
  canEdit,
}: {
  media: MediaAsset[];
  urls: Record<string, string>;
  captions: CaptionTemplate[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [tab, setTab] = useState<"media" | "captions">("media");
  const [pending, startTransition] = useTransition();
  const [uploads, setUploads] = useState<Upload[]>([]);
  const [dragging, setDragging] = useState(false);
  const [q, setQ] = useState("");
  const [kind, setKind] = useState("");
  const [folder, setFolder] = useState("");
  const [tag, setTag] = useState("");
  const [rights, setRights] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [preview, setPreview] = useState<MediaAsset | null>(null);
  const [bulk, setBulk] = useState<"folder" | "tags" | null>(null);
  const [bulkValue, setBulkValue] = useState("");

  const folders = useMemo(() => Array.from(new Set(media.map((m) => m.folder).filter(Boolean))).sort() as string[], [media]);
  const tags = useMemo(() => Array.from(new Set(media.flatMap((m) => m.tags))).sort(), [media]);
  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return media.filter(
      (m) =>
        (!s || m.fileName.toLowerCase().includes(s) || m.tags.some((t) => t.includes(s))) &&
        (!kind || m.kind === kind) &&
        (!folder || m.folder === folder) &&
        (!tag || m.tags.includes(tag)) &&
        (!rights || (rights === "ok" ? m.rightsConfirmed : !m.rightsConfirmed)),
    );
  }, [media, q, kind, folder, tag, rights]);
  const ids = Array.from(selected);

  async function handleFiles(files: FileList | File[]) {
    const list = Array.from(files);
    if (!list.length) return;
    setUploads(list.map((f) => ({ name: f.name, status: "uploading" })));
    let ok = 0;
    // Uploads em sequência de 3 para não saturar a conexão.
    const queue = [...list.entries()];
    await Promise.all(
      Array.from({ length: Math.min(3, list.length) }, async () => {
        for (let next = queue.shift(); next; next = queue.shift()) {
          const [i, file] = next;
          try {
            await uploadFile(file, folder || null);
            ok++;
            setUploads((u) => u.map((x, j) => (j === i ? { ...x, status: "done" } : x)));
          } catch (e) {
            setUploads((u) => u.map((x, j) => (j === i ? { ...x, status: "error", error: (e as Error).message } : x)));
          }
        }
      }),
    );
    if (ok) toast.success(`${ok} arquivo(s) enviado(s).`);
    router.refresh();
  }

  function act(p: Promise<{ ok: boolean; error?: string }>, msg: string, clear = false) {
    startTransition(async () => {
      const r = await p;
      if (!r.ok) return toast.error(r.error ?? "Falha.");
      toast.success(msg);
      if (clear) setSelected(new Set());
      router.refresh();
    });
  }

  return (
    <>
      <div role="tablist" aria-label="Seções da biblioteca" className="mb-4 flex w-full rounded-lg border border-border bg-surface p-1 sm:inline-flex sm:w-auto">
        {(["media", "captions"] as const).map((t) => (
          <button
            key={t}
            type="button"
            role="tab"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
            className={cn("h-9 flex-1 rounded-md px-3 text-sm font-medium transition-colors pointer-coarse:h-11 sm:flex-none", tab === t ? "bg-surface-3 text-fg shadow-sm" : "text-fg-muted hover:text-fg")}
          >
            {t === "media" ? `Mídias (${media.length})` : <>Legendas<span className="max-sm:hidden"> reutilizáveis</span> ({captions.length})</>}
          </button>
        ))}
      </div>

      {tab === "captions" ? (
        <CaptionsPanel captions={captions} canEdit={canEdit} />
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {canEdit && (
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragging(false);
                void handleFiles(e.dataTransfer.files);
              }}
              className={cn(
                "flex flex-col items-center justify-center gap-2 rounded-[var(--radius-card)] border border-dashed p-6 text-center transition-colors",
                dragging ? "border-brand bg-brand/5" : "border-border-strong bg-surface/50",
              )}
            >
              <Upload className="size-5 text-fg-muted" aria-hidden />
              <p className="text-sm pointer-coarse:hidden">Arraste arquivos para cá ou</p>
              <Button variant="secondary" onClick={() => inputRef.current?.click()}>
                <ImagePlus /> Selecionar arquivos
              </Button>
              <p className="text-xs text-fg-subtle">JPEG, PNG, WebP (até 8 MB) · MP4, MOV (até 300 MB). Para o Instagram, imagens precisam ser JPEG.</p>
              <input ref={inputRef} type="file" multiple accept={ACCEPT} className="hidden" onChange={(e) => e.target.files && handleFiles(e.target.files)} />
              {uploads.length > 0 && (
                <ul className="mt-2 w-full max-w-md space-y-1 text-left text-xs">
                  {uploads.map((u, i) => (
                    <li key={i} className="flex items-center justify-between gap-2 rounded-md bg-surface-2 px-2 py-1">
                      <span className="truncate">{u.name}</span>
                      <span className={cn(u.status === "error" ? "text-danger" : u.status === "done" ? "text-success" : "text-fg-muted")}>
                        {u.status === "uploading" ? "Enviando…" : u.status === "done" ? "Concluído" : u.error}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          <Card>
            <div className="flex flex-col gap-3 border-b border-border p-4 lg:flex-row">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-fg-subtle" aria-hidden />
                <Input placeholder="Buscar por nome ou etiqueta" value={q} onChange={(e) => setQ(e.target.value)} className="pl-9" aria-label="Buscar mídia" />
              </div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:w-[600px]">
                <Select value={kind} onChange={(e) => setKind(e.target.value)} aria-label="Tipo">
                  <option value="">Todos tipos</option>
                  <option value="image">Imagens</option>
                  <option value="video">Vídeos</option>
                </Select>
                <Select value={folder} onChange={(e) => setFolder(e.target.value)} aria-label="Pasta">
                  <option value="">Todas pastas</option>
                  {folders.map((f) => <option key={f}>{f}</option>)}
                </Select>
                <Select value={tag} onChange={(e) => setTag(e.target.value)} aria-label="Etiqueta">
                  <option value="">Todas etiquetas</option>
                  {tags.map((t) => <option key={t}>{t}</option>)}
                </Select>
                <Select value={rights} onChange={(e) => setRights(e.target.value)} aria-label="Direitos de uso">
                  <option value="">Direitos: todos</option>
                  <option value="ok">Confirmados</option>
                  <option value="pending">Pendentes</option>
                </Select>
              </div>
            </div>

            {selected.size > 0 && canEdit && (
              <div
                className="z-20 flex flex-wrap items-center gap-2 border-b border-border bg-surface-2/95 px-4 py-2.5 backdrop-blur animate-fade-in max-md:fixed max-md:inset-x-0 max-md:bottom-[calc(4rem+env(safe-area-inset-bottom))] max-md:border-t max-md:shadow-[0_-12px_30px_-12px_rgb(0_0_0/0.8)] md:sticky md:top-0 md:bg-brand/[0.06]"
                role="region"
                aria-label="Ações em lote"
              >
                <span className="mr-2 text-sm font-medium">{selected.size} selecionada(s)</span>
                <Button size="sm" variant="secondary" disabled={pending} onClick={() => act(updateMediaAction(ids, { rightsConfirmed: true }), "Direitos de uso confirmados.")}>
                  <ShieldCheck /> Confirmar direitos
                </Button>
                <Button size="sm" variant="secondary" onClick={() => { setBulk("folder"); setBulkValue(""); }}>
                  <FolderInput /> Mover para pasta
                </Button>
                <Button size="sm" variant="secondary" onClick={() => { setBulk("tags"); setBulkValue(""); }}>
                  <Tag /> Etiquetas
                </Button>
                <ConfirmButton
                  title={`Excluir ${selected.size} arquivo(s)?`}
                  description="Os arquivos serão apagados permanentemente do armazenamento. Esta ação não pode ser desfeita."
                  confirmLabel="Excluir"
                  onConfirm={async () => {
                    const r = await deleteMediaAction(ids);
                    if (!r.ok) return void toast.error(r.error);
                    toast.success("Arquivos excluídos.");
                    setSelected(new Set());
                    router.refresh();
                  }}
                  trigger={(open) => (
                    <Button size="sm" variant="danger" onClick={open}>
                      <Trash2 /> Excluir
                    </Button>
                  )}
                />
                <Button size="sm" variant="ghost" className="ml-auto" onClick={() => setSelected(new Set())}>
                  Limpar seleção
                </Button>
              </div>
            )}

            {media.length === 0 ? (
              <EmptyState icon={ImagePlus} title="Biblioteca vazia" description="Envie imagens e vídeos para usar no Estúdio de publicação." />
            ) : filtered.length === 0 ? (
              <EmptyState icon={Images} title="Nada encontrado" description="Ajuste a busca ou os filtros." />
            ) : (
              <ul className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6">
                {filtered.map((m) => {
                  const isSel = selected.has(m.id);
                  return (
                    <li key={m.id} className={cn("group relative overflow-hidden rounded-xl border bg-surface-2 transition-colors", isSel ? "border-brand" : "border-border hover:border-border-strong")}>
                      <button type="button" className="block aspect-square w-full" onClick={() => setPreview(m)} aria-label={`Visualizar ${m.fileName}`}>
                        <MediaThumb media={m} url={urls[m.id]} className="size-full" />
                      </button>
                      {/* Em telas de toque não existe hover: a caixa de seleção fica sempre visível e com área ≥44 px. */}
                      <label className={cn("absolute left-1.5 top-1.5 grid cursor-pointer place-items-center rounded-md bg-black/65 p-1.5 transition-opacity pointer-coarse:size-11 pointer-coarse:opacity-100", isSel ? "opacity-100" : "opacity-0 group-hover:opacity-100 focus-within:opacity-100")}>
                        <Checkbox
                          checked={isSel}
                          onChange={() =>
                            setSelected((s) => {
                              const n = new Set(s);
                              if (n.has(m.id)) n.delete(m.id);
                              else n.add(m.id);
                              return n;
                            })
                          }
                          aria-label={`Selecionar ${m.fileName}`}
                        />
                      </label>
                      {m.rightsConfirmed ? (
                        <CheckCircle2 className="absolute right-2 top-2 size-4 text-success drop-shadow" aria-label="Direitos confirmados" />
                      ) : (
                        <Badge tone="warning" className="absolute right-2 top-2" title="Direitos de uso ainda não confirmados">Direitos?</Badge>
                      )}
                      <div className="p-2">
                        <p className="truncate text-xs font-medium">{m.fileName}</p>
                        <p className="truncate text-xs text-fg-subtle">
                          {formatBytes(m.sizeBytes)}
                          {m.width && m.height ? ` · ${m.width}×${m.height}` : ""}
                          {m.durationSec ? ` · ${Math.round(m.durationSec)}s` : ""}
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        </div>
      )}

      <Dialog
        open={bulk !== null}
        onOpenChange={(o) => !o && setBulk(null)}
        title={bulk === "folder" ? "Mover para pasta" : "Adicionar etiquetas"}
        footer={
          <Button
            loading={pending}
            onClick={() => {
              act(updateMediaAction(ids, bulk === "folder" ? { folder: bulkValue.trim() || null } : { tags: parseTags(bulkValue) }), "Mídias atualizadas.");
              setBulk(null);
            }}
          >
            Salvar
          </Button>
        }
      >
        <Field label={bulk === "folder" ? "Pasta (vazio = sem pasta)" : "Etiquetas (separadas por vírgula; substitui as atuais)"} htmlFor="bulk-value">
          <Input id="bulk-value" value={bulkValue} onChange={(e) => setBulkValue(e.target.value)} list="folder-list" autoFocus />
        </Field>
        <datalist id="folder-list">{folders.map((f) => <option key={f} value={f} />)}</datalist>
      </Dialog>

      {preview && (
        <MediaPreview
          media={preview}
          url={urls[preview.id]}
          canEdit={canEdit}
          onClose={() => setPreview(null)}
          onSaved={() => {
            setPreview(null);
            router.refresh();
          }}
        />
      )}
    </>
  );
}

function MediaPreview({ media, url, canEdit, onClose, onSaved }: { media: MediaAsset; url?: string; canEdit: boolean; onClose: () => void; onSaved: () => void }) {
  const [rightsConfirmed, setRightsConfirmed] = useState(media.rightsConfirmed);
  const [rightsNote, setRightsNote] = useState(media.rightsNote ?? "");
  const [tags, setTags] = useState(media.tags.join(", "));
  const [busy, setBusy] = useState(false);
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()} title={media.fileName} className="max-w-3xl">
      <div className="grid gap-5 md:grid-cols-[1fr_260px]">
        <div className="overflow-hidden rounded-xl border border-border bg-black">
          {media.kind === "video" ? (
            <video src={url} controls className="max-h-[60vh] w-full" />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element -- mídia privada
            <img src={url} alt={media.fileName} className="max-h-[60vh] w-full object-contain" />
          )}
        </div>
        <div className="grid content-start gap-3 text-sm">
          <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
            <dt className="text-fg-subtle">Tipo</dt><dd>{media.mimeType}</dd>
            <dt className="text-fg-subtle">Tamanho</dt><dd>{formatBytes(media.sizeBytes)}</dd>
            <dt className="text-fg-subtle">Dimensões</dt><dd>{media.width ? `${media.width}×${media.height}` : "—"}</dd>
            <dt className="text-fg-subtle">Duração</dt><dd>{media.durationSec ? `${media.durationSec}s` : "—"}</dd>
            <dt className="text-fg-subtle">Pasta</dt><dd>{media.folder ?? "—"}</dd>
            <dt className="text-fg-subtle">Enviado</dt><dd>{formatDate(media.createdAt)}</dd>
          </dl>
          {media.kind === "image" && media.mimeType !== "image/jpeg" && (
            <Alert tone="warning">A API do Instagram só aceita JPEG. Converta antes de publicar.</Alert>
          )}
          {canEdit && (
            <>
              <Field label="Etiquetas" htmlFor="pv-tags">
                <Input id="pv-tags" value={tags} onChange={(e) => setTags(e.target.value)} />
              </Field>
              <label className="flex items-start gap-2 rounded-lg border border-border p-3 text-xs">
                <Checkbox checked={rightsConfirmed} onChange={(e) => setRightsConfirmed(e.target.checked)} className="mt-0.5" />
                <span>Confirmo que tenho os direitos de uso deste conteúdo e que ele respeita as diretrizes das plataformas.</span>
              </label>
              <Field label="Origem / licença (opcional)" htmlFor="pv-note">
                <Textarea id="pv-note" value={rightsNote} onChange={(e) => setRightsNote(e.target.value)} className="min-h-16" maxLength={280} />
              </Field>
              <Button
                loading={busy}
                onClick={async () => {
                  setBusy(true);
                  const r = await updateMediaAction([media.id], { rightsConfirmed, rightsNote: rightsNote || null, tags: parseTags(tags) });
                  setBusy(false);
                  if (!r.ok) return toast.error(r.error);
                  toast.success("Mídia atualizada.");
                  onSaved();
                }}
              >
                Salvar
              </Button>
            </>
          )}
        </div>
      </div>
    </Dialog>
  );
}

function CaptionsPanel({ captions, canEdit }: { captions: CaptionTemplate[]; canEdit: boolean }) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[360px_1fr]">
      {canEdit && (
        <Card className="h-fit p-5">
          <h2 className="mb-4 text-sm font-semibold">Nova legenda</h2>
          <form
            className="grid gap-3"
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              const r = await createCaptionAction({ title, body });
              setBusy(false);
              if (!r.ok) return toast.error(r.error);
              setTitle("");
              setBody("");
              toast.success("Legenda salva.");
              router.refresh();
            }}
          >
            <Field label="Título" htmlFor="cap-title">
              <Input id="cap-title" value={title} onChange={(e) => setTitle(e.target.value)} required maxLength={60} />
            </Field>
            <Field label="Texto" htmlFor="cap-body" hint={`${body.length}/2200`}>
              <Textarea id="cap-body" value={body} onChange={(e) => setBody(e.target.value)} required maxLength={2200} className="min-h-40" />
            </Field>
            <Button type="submit" loading={busy}>Salvar legenda</Button>
          </form>
        </Card>
      )}
      <Card>
        {captions.length === 0 ? (
          <EmptyState icon={Tag} title="Nenhuma legenda salva" description="Salve legendas para reutilizar no Estúdio." />
        ) : (
          <ul className="divide-y divide-border">
            {captions.map((c) => (
              <li key={c.id} className="flex gap-4 p-4">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{c.title}</p>
                  <p className="mt-1 line-clamp-3 whitespace-pre-line text-sm text-fg-muted">{c.body}</p>
                </div>
                {canEdit && (
                  <ConfirmButton
                    title="Excluir legenda?"
                    description={`"${c.title}" será removida.`}
                    confirmLabel="Excluir"
                    onConfirm={async () => {
                      const r = await deleteCaptionAction(c.id);
                      if (!r.ok) return void toast.error(r.error);
                      router.refresh();
                    }}
                    trigger={(open) => (
                      <Button variant="ghost" size="icon-sm" onClick={open} aria-label={`Excluir legenda ${c.title}`}>
                        <Trash2 />
                      </Button>
                    )}
                  />
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
