import { ExternalLink, Info } from "lucide-react";
import { Alert, Avatar, Badge, Card, CardHeader } from "@/components/ui/primitives";
import { canReadInsights } from "@/lib/domain/instagram-scopes";
import { FORMAT_LABEL } from "@/lib/domain/status";
import type { AccountSnapshot, MediaInsightRow, SocialAccount, TargetView } from "@/lib/domain/types";
import { formatDateTime, formatNumber, formatRelative } from "@/lib/utils";

const METRICS = [
  { key: "views", label: "Visualizações", full: true },
  { key: "reach", label: "Alcance", full: true },
  { key: "likes", label: "Curtidas", full: false },
  { key: "comments", label: "Comentários", full: false },
  { key: "saved", label: "Salvamentos", full: true },
  { key: "shares", label: "Compartilhamentos", full: true },
] as const;
type MetricKey = (typeof METRICS)[number]["key"];

const sum = (rows: MediaInsightRow[], k: MetricKey) => {
  const vals = rows.map((r) => r[k]).filter((v): v is number => typeof v === "number");
  return vals.length ? vals.reduce((a, b) => a + b, 0) : null;
};

/**
 * Métricas reais do Instagram no período: totais, publicações de melhor desempenho e seguidores.
 * Os números vêm só da API oficial (coleta a cada hora); o que a API não devolve aparece como "—".
 */
export function InstagramMetrics({
  published,
  insights,
  accounts,
  snapshots,
}: {
  published: TargetView[];
  insights: MediaInsightRow[];
  accounts: SocialAccount[];
  snapshots: AccountSnapshot[];
}) {
  const real = published.filter((t) => !t.simulated);
  const byTarget = new Map(insights.map((i) => [i.targetId, i]));
  const rows = real.map((t) => byTarget.get(t.id)).filter((r): r is MediaInsightRow => !!r);
  const realAccounts = accounts.filter((a) => !a.isDemo);
  const withoutInsights = realAccounts.filter((a) => !canReadInsights(a.scopes));
  const hasFull = rows.some((r) => r.source === "insights");
  const lastFetch = rows.reduce<string | null>((m, r) => (!m || r.fetchedAt > m ? r.fetchedAt : m), null);
  const failing = rows.filter((r) => r.lastError).length;

  const top = real
    .map((t) => ({ t, m: byTarget.get(t.id) }))
    .filter((x) => x.m)
    .sort((a, b) => (b.m!.views ?? b.m!.likes ?? 0) - (a.m!.views ?? a.m!.likes ?? 0))
    .slice(0, 5);

  // Seguidores: último retrato de cada conta e a variação desde o primeiro retrato do período.
  const followers = realAccounts
    .map((a) => {
      const s = snapshots.filter((x) => x.socialAccountId === a.id && x.followersCount != null);
      const first = s[0]?.followersCount ?? null;
      const last = s.at(-1)?.followersCount ?? a.followersCount ?? null;
      return { a, last, delta: first != null && last != null && s.length > 1 ? last - first : null };
    })
    .sort((x, y) => (y.last ?? 0) - (x.last ?? 0));

  return (
    <Card className="mt-6">
      <CardHeader
        title="Desempenho no Instagram"
        description={
          lastFetch
            ? `${rows.length} de ${real.length} publicação(ões) com métricas · atualizado ${formatRelative(lastFetch, undefined, true)}`
            : "Métricas oficiais do Instagram, atualizadas a cada hora"
        }
      />
      <div className="space-y-5 p-5">
        {real.length === 0 ? (
          <Alert tone="info" title="Nenhuma publicação real no período">
            As métricas aparecem aqui até 1 hora depois da primeira publicação feita numa conta real. Publicações em contas Demo
            são simuladas e nunca têm métricas: a ScaleX não exibe números estimados.
          </Alert>
        ) : rows.length === 0 ? (
          <Alert tone="info" title="Coletando as primeiras métricas">
            A coleta roda a cada hora. As publicações do período aparecem aqui na próxima rodada.
          </Alert>
        ) : null}

        {withoutInsights.length > 0 && (
          <Alert tone="warning" title={`${withoutInsights.length} conta(s) sem permissão de métricas completas`}>
            {withoutInsights.map((a) => `@${a.username}`).join(", ")}: só curtidas e comentários. Para ver alcance, visualizações,
            salvamentos e compartilhamentos, a conta precisa ser reconectada com a permissão de insights do Instagram.
          </Alert>
        )}
        {failing > 0 && (
          <p className="flex items-center gap-1.5 text-xs text-warning">
            <Info className="size-3.5" aria-hidden /> {failing} publicação(ões) não puderam ser atualizadas na última rodada (os números anteriores foram mantidos).
          </p>
        )}

        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
          {METRICS.map((m) => {
            const v = sum(rows, m.key);
            const unavailable = m.full && !hasFull;
            return (
              <li key={m.key} className="rounded-lg border border-border p-3">
                <p className="text-xs text-fg-subtle">{m.label}</p>
                <p className="mt-1 text-xl font-semibold tabular-nums">{unavailable || v == null ? "—" : formatNumber(v)}</p>
                {unavailable && <p className="mt-0.5 text-xs text-fg-subtle">requer permissão de insights</p>}
              </li>
            );
          })}
        </ul>

        {top.length > 0 && (
          <div>
            <h3 className="mb-2 text-sm font-semibold">Melhores publicações do período</h3>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm">
                <thead className="text-left text-xs text-fg-subtle">
                  <tr className="border-b border-border">
                    <th className="py-2 pr-3 font-medium">Publicação</th>
                    <th className="py-2 pr-3 font-medium">Visualizações</th>
                    <th className="py-2 pr-3 font-medium">Alcance</th>
                    <th className="py-2 pr-3 font-medium">Curtidas</th>
                    <th className="py-2 pr-3 font-medium">Comentários</th>
                    <th className="py-2 font-medium">Salvos</th>
                  </tr>
                </thead>
                <tbody>
                  {top.map(({ t, m }) => (
                    <tr key={t.id} className="border-b border-border/50 last:border-0">
                      <td className="py-2.5 pr-3">
                        <span className="flex min-w-0 items-center gap-2">
                          <Avatar src={t.accountAvatarUrl} name={t.accountUsername} size={24} />
                          <span className="min-w-0">
                            <span className="block truncate">
                              @{t.accountUsername} <span className="text-fg-subtle">· {FORMAT_LABEL[t.format] ?? t.format}</span>
                            </span>
                            <span className="block text-xs text-fg-subtle">{formatDateTime(t.publishedAt)}</span>
                          </span>
                          {t.permalink && (
                            <a href={t.permalink} target="_blank" rel="noopener noreferrer" className="touch-hit shrink-0 text-fg-subtle hover:text-fg" aria-label="Abrir no Instagram">
                              <ExternalLink className="size-3.5" />
                            </a>
                          )}
                        </span>
                      </td>
                      {(["views", "reach", "likes", "comments", "saved"] as const).map((k) => (
                        <td key={k} className="py-2.5 pr-3 tabular-nums text-fg-muted">
                          {m![k] == null ? "—" : formatNumber(m![k])}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {followers.length > 0 && (
          <div>
            <h3 className="mb-2 text-sm font-semibold">Seguidores por conta</h3>
            <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {followers.map(({ a, last, delta }) => (
                <li key={a.id} className="flex items-center gap-3 rounded-lg border border-border p-3">
                  <Avatar src={a.avatarUrl} name={a.username} size={32} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">@{a.username}</p>
                    <p className="text-xs text-fg-subtle">{canReadInsights(a.scopes) ? "Métricas completas" : "Só curtidas e comentários"}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-semibold tabular-nums">{last == null ? "—" : formatNumber(last)}</p>
                    {delta != null && delta !== 0 && (
                      <Badge tone={delta > 0 ? "success" : "danger"}>
                        {delta > 0 ? "+" : ""}
                        {formatNumber(delta)}
                      </Badge>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </Card>
  );
}
