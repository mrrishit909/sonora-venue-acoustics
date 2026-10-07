// SONORA API: the blueprint's section 12 contract. Venues are validated, simulations are the same domain functions the browser runs, every mutation is idempotent by key, big results are paged.
import { createServer, type IncomingMessage, type ServerResponse, type Server } from "node:http";
import { MATERIALS, SCENARIOS, clone, presetVenue, rtTable, simulate, spread, validateSpeaker, validateVenue, venueSummary, zoneSummaries } from "../../../packages/domain/src/index.ts";
import type { SpeakerUnit, Venue } from "../../../packages/schemas/src/index.ts";
export const openapi = { openapi: "3.1.0", info: { title: "SONORA API", version: "1.0.0", description: "Simplified acoustic prediction for design support. Not certified acoustic engineering." }, paths: {
  "/v1/venues": { post: { summary: "Create a venue from a preset or a full configuration; Idempotency-Key required" } }, "/v1/venues/{id}": { get: { summary: "A venue and its summary" } },
  "/v1/venues/{id}/simulate": { post: { summary: "Run the prediction; returns zone summaries, the reverberation table and a page of listener readings; Idempotency-Key required" } },
  "/v1/venues/{id}/speakers": { post: { summary: "Replace the speaker units; Idempotency-Key required" } }, "/v1/materials": { get: { summary: "The material library with absorption by octave band" } } } };
const BANDS = [125, 250, 500, 1000, 2000, 4000];
export function build() {
  const venues = new Map<string, Venue>(SCENARIOS.map((s) => [s.venue.id, clone(s.venue)])), seen = new Map<string, unknown>(), runs = new Map<string, unknown>(); let seq = 1, runSeq = 1;
  const send = (res: ServerResponse, code: number, body: unknown) => { res.writeHead(code, { "content-type": "application/json", "access-control-allow-origin": "*", "access-control-allow-headers": "content-type,idempotency-key", "access-control-allow-methods": "GET,POST,OPTIONS" }); res.end(JSON.stringify(body)); };
  const err = (res: ServerResponse, code: number, error: string) => send(res, code, { error });
  async function body(req: IncomingMessage) { let s = ""; for await (const c of req) { s += c; if (s.length > 20_000) throw new RangeError("body too large"); } return s ? JSON.parse(s) : {}; }
  const view = (v: Venue) => ({ ...v, summary: venueSummary(v) });
  const server: Server = createServer(async (req, res) => {
    try {
      const u = new URL(req.url ?? "/", "http://x"), p = u.pathname.replace(/\/+$/, "") || "/", m = req.method ?? "GET"; let g: RegExpMatchArray | null;
      if (m === "OPTIONS") return send(res, 204, {}); if (p === "/openapi.json") return send(res, 200, openapi); if (p === "/healthz") return send(res, 200, { ok: true });
      if (p === "/v1/materials" && m === "GET") return send(res, 200, { bands: BANDS, materials: MATERIALS });
      if (p === "/v1/venues" && m === "GET") return send(res, 200, { items: [...venues.values()].map((v) => ({ id: v.id, name: v.name, scenario: v.scenario })) });
      if (p === "/v1/venues" && m === "POST") {
        const key = req.headers["idempotency-key"]; if (typeof key !== "string" || !key) return err(res, 400, "Idempotency-Key header required"); const k = "create" + key; if (seen.has(k)) return send(res, 200, seen.get(k));
        const b = await body(req), v: Venue = b.preset ? { ...presetVenue(b.preset), ...(b.name ? { name: String(b.name) } : {}) } : (b as Venue); const e = validateVenue(v); if (e) return err(res, 422, e);
        v.id = `v${seq++}`; venues.set(v.id, clone(v)); const out = view(v); seen.set(k, out); return send(res, 201, out);
      }
      if ((g = p.match(/^\/v1\/venues\/([\w-]+)$/)) && m === "GET") { const v = venues.get(g[1]); return v ? send(res, 200, view(v)) : err(res, 404, "no such venue"); }
      if ((g = p.match(/^\/v1\/venues\/([\w-]+)\/(simulate|speakers)$/))) {
        const v = venues.get(g[1]); if (!v) return err(res, 404, "no such venue"); if (m !== "POST") return err(res, 405, "use POST");
        const key = req.headers["idempotency-key"]; if (typeof key !== "string" || !key) return err(res, 400, "Idempotency-Key header required"); const k = v.id + g[2] + key; if (seen.has(k)) return send(res, 200, seen.get(k));
        const b = await body(req);
        if (g[2] === "speakers") { if (!Array.isArray(b.speakers) || b.speakers.length > 8) return err(res, 422, "speakers must be a list of up to 8 units"); for (const s of b.speakers as SpeakerUnit[]) { const e = validateSpeaker(s); if (e) return err(res, 422, e); } v.speakers = clone(b.speakers); const out = view(v); seen.set(k, out); return send(res, 201, out); }
        const band = b.band === undefined ? 3 : BANDS.indexOf(b.band); if (band < 0) return err(res, 422, `band must be one of ${BANDS.join(", ")}`); const limit = b.limit === undefined ? 100 : b.limit, cursor = b.cursor === undefined ? 0 : b.cursor;
        if (!Number.isInteger(limit) || limit < 1 || limit > 400 || !Number.isInteger(cursor) || cursor < 0) return err(res, 400, "limit 1-400 and cursor must be whole numbers");
        const f = simulate(v), items = f.receivers.slice(cursor, cursor + limit).map((r, i) => { const d = f.readings[cursor + i]; return { id: r.id, x: r.x, z: r.z, zone: r.zone, splDb: Math.round(d.spl[band] * 10) / 10, c80Db: Math.round(d.c80[band] * 10) / 10, d50: Math.round(d.d50[band] * 100) / 100 }; });
        const out = { runId: `run${runSeq++}`, venueId: v.id, band: BANDS[band], disclaimer: "Simplified design-support prediction, not certified acoustic engineering.", rt60: rtTable(v).map((r) => ({ hz: r.hz, eyringS: Math.round(r.eyring * 100) / 100, sabineS: Math.round(r.sabine * 100) / 100 })), zones: zoneSummaries(f).map((z) => ({ ...z, spl: Math.round(z.spl * 10) / 10, c80: Math.round(z.c80 * 10) / 10, d50: Math.round(z.d50 * 100) / 100, splMin: Math.round(z.splMin * 10) / 10, splMax: Math.round(z.splMax * 10) / 10 })), splSpreadDb: Math.round(spread(f, band) * 10) / 10, listeners: f.receivers.length, items, nextCursor: cursor + limit < f.receivers.length ? cursor + limit : null };
        runs.set(out.runId, out); seen.set(k, out); return send(res, 201, out);
      }
      return err(res, 404, "not found");
    } catch (e) { return err(res, e instanceof SyntaxError || e instanceof RangeError ? 400 : 500, e instanceof Error ? e.message : "error"); }
  });
  return { server, listen: (port = 8690) => new Promise<number>((r) => server.listen(port, () => r((server.address() as { port: number }).port))), close: () => new Promise<void>((r) => { server.closeAllConnections(); server.close(() => r()); }) };
}
if (import.meta.url === `file://${process.argv[1]}`) build().listen().then((p) => console.log(`SONORA API on :${p}`));
