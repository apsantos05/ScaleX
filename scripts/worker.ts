/**
 * Worker dedicado da ScaleX.
 *   npm run worker            → loop contínuo (a cada 10s)
 *   npm run worker -- --once  → uma rodada e sai
 *
 * Pode rodar em qualquer infraestrutura Node (Railway, Fly.io, Render, VM). Vários workers podem rodar
 * em paralelo: o claim usa lease + FOR UPDATE SKIP LOCKED (Supabase) ou lock de arquivo (demo).
 * Recuperação após reinício: jobs "processing" com lease vencido voltam a ser reivindicados.
 */
import { randomUUID } from "node:crypto";
import { hostname } from "node:os";
import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

const INTERVAL_MS = Number(process.env.WORKER_INTERVAL_MS ?? 10_000);
const workerId = `${hostname()}-${process.pid}-${randomUUID().slice(0, 8)}`;
let stopping = false;

async function main() {
  const { tick } = await import("../src/lib/jobs/runtime");
  const { getDataMode } = await import("../src/lib/env");
  const once = process.argv.includes("--once");
  console.log(JSON.stringify({ svc: "worker", event: "start", workerId, mode: getDataMode(), intervalMs: INTERVAL_MS }));

  process.on("SIGINT", () => (stopping = true));
  process.on("SIGTERM", () => (stopping = true));

  do {
    const started = Date.now();
    try {
      const { promoted, results } = await tick(workerId);
      if (promoted || results.length) {
        console.log(JSON.stringify({ svc: "worker", event: "tick", promoted, results, ms: Date.now() - started }));
      }
    } catch (err) {
      console.error(JSON.stringify({ svc: "worker", event: "tick_error", error: (err as Error).message }));
    }
    if (once) break;
    await new Promise((r) => setTimeout(r, INTERVAL_MS));
  } while (!stopping);
  console.log(JSON.stringify({ svc: "worker", event: "stop", workerId }));
}

void main();
