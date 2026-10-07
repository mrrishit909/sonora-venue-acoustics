"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { BANDS, HALL, MATERIALS, SCENARIOS, SURFACE_KEYS, ZONES, clone, makeContext, midRt, presetVenue, receive, renderIR, rt60, rtTable, scenario, simulate, spread, zoneSummaries, type Reading } from "@sonora/domain";
import type { SurfaceKey, Venue } from "@sonora/schemas";
import { MATERIAL_COLOR, rangeOf, ramp, type Data } from "../data";
import { play, stop, waveform, SAMPLES, audioAvailable, type SampleKind } from "../audio";
import { edit, live, persist, scheduleField, set, state, useStore, VIEWS, type Cam, type Metric, type View } from "../store";

const go = (v: View) => { if (v !== state.view) { set({ view: v }); history.replaceState(null, "", `#${v}`); } };
const f1 = (x: number) => (Math.round(x * 10) / 10).toString(), f2 = (x: number) => (Math.round(x * 100) / 100).toFixed(2);
const WALL: Record<SurfaceKey, string> = { left: "Left wall", right: "Right wall", stage: "Stage wall", rear: "Rear wall", floor: "Floor", ceiling: "Ceiling" };
const MATS = MATERIALS.filter((m) => !m.id.startsWith("seat-"));
const wavePath = (() => { let d = "M0 8"; for (let x = 0; x <= 240; x += 3) d += ` L${x} ${(8 + 7 * Math.sin(x / 5.5) * Math.exp(-x / 120)).toFixed(2)}`; return d; })();
const Wave = () => <svg className="wave" viewBox="0 0 240 16" preserveAspectRatio="none" aria-hidden><path d={wavePath} /></svg>;
const METRIC_LABEL: Record<Metric, string> = { spl: "Level (dB SPL)", c80: "Clarity C80 (dB)", d50: "Definition D50" };
const Disclaimer = () => <p className="fine">Simplified design-support prediction on synthetic data. Not certified acoustic engineering.</p>;

// ---- the top-down plan (stage on the left). Works without the canvas: it is the core interface for speakers and the field.
export function Plan({ mode, hall }: { mode: "speakers" | "field"; hall: Data["hall"] }) {
  const s = useStore(), svg = useRef<SVGSVGElement>(null), drag = useRef<string | null>(null), v = s.venue;
  const toHall = (e: { clientX: number; clientY: number }) => { const el = svg.current!, pt = el.createSVGPoint(); pt.x = e.clientX; pt.y = e.clientY; const p = pt.matrixTransform(el.getScreenCTM()!.inverse()); return { x: p.y, z: p.x }; };
  const move = (id: string, x: number, z: number) => edit((vv) => { const u = vv.speakers.find((q) => q.id === id)!; u.x = Math.round(Math.max(-11.5, Math.min(11.5, x)) * 4) / 4; u.z = Math.round(Math.max(-17.8, Math.min(17.8, z)) * 4) / 4; });
  const [lo, hi] = rangeOf(s.field.readings, s.metric, s.band);
  const cells = s.field.recv.map((r, i) => ({ r, d: s.field.readings[i] as Reading | undefined })).filter((c) => c.d && (s.plane === "balcony" ? c.r.zone === "balcony" : c.r.zone !== "balcony"));
  return (
    <svg ref={svg} className="plan" viewBox="-19 -13 38 26" role="img" aria-label="Top-down plan of the hall with the stage on the left" data-testid="plan"
      onPointerMove={(e) => { if (drag.current) { const p = toHall(e); move(drag.current, p.x, p.z); } }} onPointerUp={() => { drag.current = null; }}>
      <rect x={-18} y={-12} width={36} height={24} className="plan-hall" />
      <rect x={-18} y={hall.stage.x[0]} width={10} height={20} className="plan-stage" />
      {Object.entries(hall.blocks).map(([k, [a, b]]) => <rect key={k} x={a[2]} y={a[0]} width={b[2] - a[2]} height={b[0] - a[0]} className={`plan-seat ${k === "balcony" ? "bal" : ""}`} style={{ display: k === "balcony" && !v.balcony ? "none" : undefined }} />)}
      {cells.map(({ r, d }) => { const val = d![s.metric][s.band], [R, G, B] = ramp((val - lo) / (hi - lo)); return <rect key={r.id} x={r.z - 0.75} y={r.x - 0.75} width={1.5} height={1.5} fill={`rgb(${R},${G},${B})`} className="cell" onClick={() => mode === "field" && set({ listener: { x: r.x, z: r.z, y: r.y } })} />; })}
      {v.reflectors.on && <rect x={-16} y={-8} width={13} height={16} className="plan-refl" />}
      <circle cx={v.source.z} cy={v.source.x} r={0.55} className="plan-src"><title>Acoustic source on stage</title></circle>
      <g className="plan-listener" transform={`translate(${s.listener.z} ${s.listener.x})`}><circle r={0.9} /><circle r={0.25} /></g>
      {v.speakers.map((u) => <g key={u.id} className={`plan-unit ${u.on ? "on" : "off"} ${s.selSpeaker === u.id ? "sel" : ""}`} transform={`translate(${u.z} ${u.x})`} tabIndex={mode === "speakers" ? 0 : -1} role="button" aria-label={`${u.label}, ${u.on ? "on" : "off"}, x ${u.x} z ${u.z}`} data-testid={`plan-unit-${u.id}`}
        onPointerDown={(e) => { if (mode !== "speakers") return; (e.target as Element).setPointerCapture?.(e.pointerId); drag.current = u.id; set({ selSpeaker: u.id }); }} onClick={() => mode === "speakers" && set({ selSpeaker: u.id })}
        onKeyDown={(e) => { const st = e.shiftKey ? 2 : 0.5, dz = e.key === "ArrowRight" ? st : e.key === "ArrowLeft" ? -st : 0, dx = e.key === "ArrowDown" ? st : e.key === "ArrowUp" ? -st : 0; if (dx || dz) { e.preventDefault(); set({ selSpeaker: u.id }); const cur = state.venue.speakers.find((q) => q.id === u.id)!; move(u.id, cur.x + dx, cur.z + dz); } }}>
        <rect x={-0.9} y={-0.6} width={1.8} height={1.2} rx={0.2} /><text y={2.4} textAnchor="middle">{u.label.replace("Front fill", "Fill").replace(" array", "")}</text></g>)}
    </svg>
  );
}
const Legend = () => { const s = useStore(), [lo, hi] = rangeOf(s.field.readings, s.metric, s.band), r = (x: number) => (s.metric === "d50" ? f2(x) : f1(x)); return <div className="legend" data-testid="legend"><span>{r(lo)}</span><i style={{ background: `linear-gradient(90deg, ${[0, 0.25, 0.5, 0.75, 1].map((t) => `rgb(${ramp(t).join(",")})`).join(",")})` }} /><span>{r(hi)}</span></div>; };
const Progress = () => { const s = useStore(); return <p className="status" data-testid="field-status" data-done={s.field.done} role="status">{s.field.done ? `Prediction ready for ${s.field.recv.length} listener positions.` : `Predicting… ${Math.round(s.field.progress * 100)}%`}</p>; };

// ---- views
function VenueView({ data }: { data: Data }) {
  const s = useStore(), v = s.venue, sc = scenario(v.scenario), t = midRt(v), ok = t >= sc.rtTarget[0] && t <= sc.rtTarget[1], seats = data.hall.seats, stalls = seats.center + seats.left + seats.right, total = stalls + (v.balcony ? seats.balcony : 0);
  const choose = (id: Venue["scenario"]) => { set({ venue: presetVenue(id), flash: "" }); scheduleField(); };
  return (<section aria-labelledby="h-v"><h2 id="h-v">Venue builder</h2><Wave /><p className="lede">Start from a scenario, then add or remove modules and change the material of every surface. The hall updates as you go.</p>
    <div className="seg" role="group" aria-label="Scenario">{SCENARIOS.map((x) => <button key={x.id} className={v.scenario === x.id ? "on" : ""} aria-pressed={v.scenario === x.id} onClick={() => choose(x.id)} data-testid={`scenario-${x.id}`}>{x.label}</button>)}</div><p className="fine">{sc.blurb}</p>
    <dl className="spec"><div><dt>Mid RT60</dt><dd data-testid="rt-mid">{f2(t)} s</dd></div><div><dt>Target</dt><dd data-testid="rt-chip" data-ok={ok}>{sc.rtTarget[0]} to {sc.rtTarget[1]} s {ok ? "· in range" : "· out of range"}</dd></div><div><dt>Occupied seats</dt><dd data-testid="seat-count">{Math.round(total * v.occupancy)} of {total}</dd></div></dl>
    <div className="row2"><label className="chk"><input type="checkbox" checked={v.balcony} onChange={(e) => edit((x) => { x.balcony = e.target.checked; })} data-testid="balcony" /> Balcony</label><label className="chk"><input type="checkbox" checked={v.reflectors.on} onChange={(e) => edit((x) => { x.reflectors.on = e.target.checked; })} data-testid="reflectors" /> Ceiling reflectors</label></div>
    <label className="rng">Reflector height <output>{f1(v.reflectors.y)} m</output><input type="range" min={6} max={11.5} step={0.5} value={v.reflectors.y} disabled={!v.reflectors.on} onChange={(e) => edit((x) => { x.reflectors.y = Number(e.target.value); })} data-testid="reflector-y" /></label>
    <label className="rng">Audience <output>{Math.round(v.occupancy * 100)}%</output><input type="range" min={0} max={1} step={0.05} value={v.occupancy} onChange={(e) => edit((x) => { x.occupancy = Number(e.target.value); })} data-testid="occupancy" /></label>
    <h3>Surfaces</h3><table className="tbl surf" data-testid="surfaces"><thead><tr><th>Surface</th><th>Material</th><th>Treatment</th><th>Cover</th></tr></thead><tbody>{SURFACE_KEYS.map((k) => { const sp = v.surfaces[k]; return (<tr key={k}><th scope="row">{WALL[k]}</th>
      <td><select aria-label={`${WALL[k]} material`} value={sp.base} onChange={(e) => edit((x) => { x.surfaces[k].base = e.target.value; })} data-testid={`surf-${k}-base`}>{MATS.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}</select></td>
      <td><select aria-label={`${WALL[k]} treatment`} value={sp.treat ?? ""} onChange={(e) => edit((x) => { x.surfaces[k].treat = e.target.value || null; if (e.target.value && x.surfaces[k].cover === 0) x.surfaces[k].cover = 0.5; })} data-testid={`surf-${k}-treat`}><option value="">None</option>{MATS.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}</select></td>
      <td><input type="range" aria-label={`${WALL[k]} cover`} min={0} max={1} step={0.25} value={sp.cover} disabled={!sp.treat} onChange={(e) => edit((x) => { x.surfaces[k].cover = Number(e.target.value); })} data-testid={`surf-${k}-cover`} /></td></tr>); })}</tbody></table>
    <Disclaimer /></section>);
}
function SpeakersView({ data }: { data: Data }) {
  const s = useStore(), u = s.venue.speakers.find((x) => x.id === s.selSpeaker) ?? s.venue.speakers[0], f = s.field, sp = f.done ? spread({ receivers: f.recv, readings: f.readings as Reading[] }, s.band) : null;
  const num = (label: string, key: "x" | "z" | "y" | "elements" | "splayDeg" | "tiltDeg" | "yawDeg" | "levelDb", min: number, max: number, step: number, id: string) => <label>{label}<input type="number" min={min} max={max} step={step} value={u[key]} onChange={(e) => { const n = Number(e.target.value); if (Number.isFinite(n)) edit((x) => { (x.speakers.find((q) => q.id === u.id)![key] as number) = Math.max(min, Math.min(max, n)); }); }} data-testid={id} /></label>;
  return (<section aria-labelledby="h-s"><h2 id="h-s">Speaker array designer</h2><Wave /><p className="lede">Drag a unit on the plan, or select it and use the arrow keys (Shift for bigger steps). The prediction behind it updates progressively.</p>
    <Plan mode="speakers" hall={data.hall} /><Progress />
    <div className="chips" role="group" aria-label="Speaker units">{s.venue.speakers.map((x) => <button key={x.id} className={`chip ${x.id === u.id ? "on" : ""} ${x.on ? "" : "off"}`} onClick={() => set({ selSpeaker: x.id })} data-testid={`unit-${x.id}`} aria-pressed={x.id === u.id}>{x.label}{x.on ? "" : " (off)"}</button>)}</div>
    <div className="form" data-testid="unit-form"><label className="chk"><input type="checkbox" checked={u.on} onChange={(e) => edit((x) => { x.speakers.find((q) => q.id === u.id)!.on = e.target.checked; })} data-testid="unit-on" /> On</label>
      {num("Across hall x (m)", "x", -11.5, 11.5, 0.25, "unit-x")}{num("Along hall z (m)", "z", -17.8, 17.8, 0.25, "unit-z")}{num("Hang height (m)", "y", 1, 12.5, 0.5, "unit-y")}{num("Elements", "elements", 1, 8, 1, "unit-elements")}{num("Splay (deg)", "splayDeg", 0, 15, 1, "unit-splay")}{num("Tilt (deg)", "tiltDeg", -10, 40, 1, "unit-tilt")}{num("Yaw (deg)", "yawDeg", -45, 45, 1, "unit-yaw")}{num("Level (dB)", "levelDb", 60, 130, 1, "unit-level")}</div>
    <dl className="spec"><div><dt>Level spread across the audience</dt><dd data-testid="spread">{sp === null ? "…" : `${f1(sp)} dB`}</dd></div><div><dt>Active units</dt><dd>{s.venue.speakers.filter((x) => x.on).length}</dd></div></dl><Disclaimer /></section>);
}
function FieldView({ data }: { data: Data }) {
  const s = useStore(), d = receive(makeContext(s.venue), s.listener.x, s.listener.y, s.listener.z);
  return (<section aria-labelledby="h-f"><h2 id="h-f">Acoustic field</h2><Wave /><p className="lede">Rays leave the source and reflect off the six surfaces, dimming at each bounce. The map shows the prediction at every listener position; click a cell to listen from there.</p>
    <div className="row2"><label>Quantity<select value={s.metric} onChange={(e) => set({ metric: e.target.value as Metric })} data-testid="metric">{(["spl", "c80", "d50"] as Metric[]).map((m) => <option key={m} value={m}>{METRIC_LABEL[m]}</option>)}</select></label><label>Band<select value={s.band} onChange={(e) => set({ band: Number(e.target.value) })} data-testid="band">{BANDS.map((b, i) => <option key={b} value={i}>{b} Hz</option>)}</select></label>
      {s.venue.balcony && <label>Level<select value={s.plane} onChange={(e) => set({ plane: e.target.value as "stalls" | "balcony" })} data-testid="plane"><option value="stalls">Stalls</option><option value="balcony">Balcony</option></select></label>}</div>
    <Plan mode="field" hall={data.hall} /><Legend /><Progress />
    <dl className="spec" data-testid="reading"><div><dt>SPL here</dt><dd data-testid="reading-spl">{f1(d.spl[s.band])} dB</dd></div><div><dt>C80</dt><dd data-testid="reading-c80">{f1(d.c80[s.band])} dB</dd></div><div><dt>D50</dt><dd data-testid="reading-d50">{f2(d.d50[s.band])}</dd></div><div><dt>Listener</dt><dd>x {f1(s.listener.x)}, z {f1(s.listener.z)}</dd></div></dl><Disclaimer /></section>);
}
const SEATS = { front: { x: 0, y: 1.2, z: -2 }, rear: { x: 0, y: 1.2, z: 12 }, sides: { x: -9, y: 1.2, z: 6 }, balcony: { x: 0, y: 6.5, z: 12 } };
function SeatsView() {
  const s = useStore(), v = s.venue, f = s.field, zones = f.done ? zoneSummaries({ receivers: f.recv, readings: f.readings as Reading[] }) : [], ir = useMemo(() => { const sr = 8000, x = renderIR(v, [s.listener.x, s.listener.y, s.listener.z], sr, 1.6), bins: number[] = []; for (let i = 0; i + 80 <= x.length; i += 80) { let e = 0; for (let k = 0; k < 80; k++) e += x[i + k] ** 2; bins.push(10 * Math.log10(e / 80 + 1e-12)); } const mx = Math.max(...bins); return bins.map((b) => Math.max(-70, b - mx)); }, [v, s.listener]);
  const best = zones.length ? zones.reduce((a, b) => (b.c80 > a.c80 ? b : a)) : null, worst = zones.length ? zones.reduce((a, b) => (b.c80 < a.c80 ? b : a)) : null;
  return (<section aria-labelledby="h-z"><h2 id="h-z">Audience experience</h2><Wave /><p className="lede">The same hall sounds different from different seats. Level, clarity (C80) and definition (D50) are averaged over the 500 Hz and 1 kHz bands.</p><Progress />
    <table className="tbl zones" data-testid="zones"><thead><tr><th>Zone</th><th>Level dB</th><th>C80 dB</th><th>D50</th><th>Range dB</th></tr></thead><tbody>{zones.map((z) => <tr key={z.zone} data-testid={`zone-${z.zone}`}><th scope="row">{z.label}</th><td>{f1(z.spl)}</td><td>{f1(z.c80)}</td><td>{f2(z.d50)}</td><td>{f1(z.splMin)} to {f1(z.splMax)}</td></tr>)}</tbody></table>
    {best && worst && <p className="fine" data-testid="zone-summary">Clearest: <b>{best.label}</b> ({f1(best.c80)} dB). Least clear: <b>{worst.label}</b> ({f1(worst.c80)} dB).</p>}
    <h3>Listen from</h3><div className="chips" role="group" aria-label="Seat zone">{ZONES.filter((z) => z.id !== "balcony" || v.balcony).map((z) => <button key={z.id} className="chip" onClick={() => set({ listener: SEATS[z.id] })} data-testid={`seat-${z.id}`}>{z.label}</button>)}</div>
    <svg className="irchart" viewBox="0 0 200 60" role="img" aria-label="Impulse response energy over time at the selected seat" data-testid="ir-chart"><path d={`M0 60 ${ir.map((b, i) => `L${(i / ir.length) * 200} ${(-b / 70) * 56 + 2}`).join(" ")} L200 60 Z`} /><line x1={(0.08 / 1.6) * 200} x2={(0.08 / 1.6) * 200} y1={0} y2={60} /></svg><p className="fine">Energy decay at the selected seat; the line marks 80 ms after the direct sound.</p><Disclaimer /></section>);
}
function CompareView() {
  const s = useStore(), c = s.compare, mk = (id: string) => { const v: Venue = clone(s.venue); v.surfaces[c.surface] = { base: id, treat: null, cover: 0 }; return v; }, A = useMemo(() => mk(c.a), [s.venue, c.surface, c.a]), B = useMemo(() => mk(c.b), [s.venue, c.surface, c.b]);   // eslint-disable-line react-hooks/exhaustive-deps
  const [sa, sb] = useMemo(() => [zoneSummaries(simulate(A)), zoneSummaries(simulate(B))], [A, B]), ta = rt60(A), tb = rt60(B), sc = scenario(s.venue.scenario), mid = (t: number[]) => (t[2] + t[3]) / 2, W = 220, H = 70, mx = Math.max(...ta, ...tb, 1), pt = (t: number[]) => t.map((x, i) => `${(i / 5) * W},${H - (x / mx) * (H - 6)}`).join(" ");
  const sel = (key: "a" | "b") => <select value={c[key]} onChange={(e) => set({ compare: { ...c, [key]: e.target.value } })} data-testid={`cmp-${key}`} aria-label={`Material ${key.toUpperCase()}`}>{MATS.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}</select>;
  return (<section aria-labelledby="h-c"><h2 id="h-c">Compare two materials</h2><Wave /><p className="lede">Swap one surface between two materials and see what changes everywhere else in the hall stays the same.</p>
    <div className="row2"><label>Surface<select value={c.surface} onChange={(e) => set({ compare: { ...c, surface: e.target.value as SurfaceKey } })} data-testid="cmp-surface">{SURFACE_KEYS.map((k) => <option key={k} value={k}>{WALL[k]}</option>)}</select></label><label>A{sel("a")}</label><label>B{sel("b")}</label></div>
    <svg className="rtchart" viewBox={`-16 0 ${W + 32} ${H + 14}`} role="img" aria-label="Reverberation time by octave band for materials A and B" data-testid="rt-chart"><polyline points={pt(ta)} className="a" /><polyline points={pt(tb)} className="b" />{BANDS.map((b, i) => <text key={b} x={(i / 5) * W} y={H + 11} textAnchor="middle">{b}</text>)}</svg>
    <table className="tbl" data-testid="cmp-table"><thead><tr><th /><th>A {MATERIALS.find((m) => m.id === c.a)!.label}</th><th>B {MATERIALS.find((m) => m.id === c.b)!.label}</th><th>B minus A</th></tr></thead><tbody>
      <tr><th scope="row">Mid RT60 (s)</th><td data-testid="cmp-rt-a">{f2(mid(ta))}</td><td data-testid="cmp-rt-b">{f2(mid(tb))}</td><td data-testid="cmp-delta-rt">{(mid(tb) - mid(ta) >= 0 ? "+" : "") + f2(mid(tb) - mid(ta))}</td></tr>
      {sa.map((z, i) => <tr key={z.zone}><th scope="row">{z.label} C80 (dB)</th><td>{f1(z.c80)}</td><td>{f1(sb[i].c80)}</td><td data-testid={`cmp-delta-${z.zone}`}>{(sb[i].c80 - z.c80 >= 0 ? "+" : "") + f1(sb[i].c80 - z.c80)}</td></tr>)}</tbody></table>
    <p className="fine" data-testid="cmp-verdict">Target for {sc.label.toLowerCase()}: {sc.rtTarget[0]} to {sc.rtTarget[1]} s. A is {mid(ta) >= sc.rtTarget[0] && mid(ta) <= sc.rtTarget[1] ? "in" : "out of"} range, B is {mid(tb) >= sc.rtTarget[0] && mid(tb) <= sc.rtTarget[1] ? "in" : "out of"} range.</p>
    <button className="btn primary" onClick={() => edit((x) => { x.surfaces[c.surface] = { base: c.b, treat: null, cover: 0 }; })} data-testid="apply-b">Use B in the venue</button><Disclaimer /></section>);
}
function ListenView() {
  const s = useStore(), sc = scenario(s.venue.scenario), [name, setName] = useState(""), [bars, setBars] = useState<number[]>(Array(24).fill(0)); const kind: SampleKind = sc.sample === "violin" ? "violin" : sc.sample === "speech" ? "speech" : "band";
  useEffect(() => { const id = setInterval(() => { const w = waveform(); setBars(Array.from({ length: 24 }, (_, i) => (w ? Math.abs(w[Math.floor((i / 24) * w.length)] - 128) / 128 : 0))); }, 70); return () => clearInterval(id); }, []);
  const start = async () => { const ir = s.hearRoom ? renderIR(s.venue, [s.listener.x, s.listener.y, s.listener.z], 22050) : null; set({ audio: "playing" }); const ok = await play(kind, ir, () => set({ audio: "idle" })); if (!ok) set({ audio: "unavailable" }); };
  const save = () => { const n = name.trim() || `${sc.label} ${state.saved.length + 1}`; set({ saved: [...state.saved, { id: `sv${Date.now()}`, name: n.slice(0, 60), at: new Date().toISOString(), venue: clone(state.venue) }], flash: `Saved "${n}".` }); persist(); setName(""); };
  return (<section aria-labelledby="h-l"><h2 id="h-l">Listen and save</h2><Wave /><p className="lede">Play a sample, made in your browser, through the predicted impulse response of the selected seat.</p>
    <div className="meter" role="img" aria-label="Level meter" data-testid="meter" data-level={f2(live.level)}>{bars.map((b, i) => <i key={i} style={{ height: `${6 + b * 90}%` }} />)}</div>
    <div className="row2"><button className="btn primary" onClick={start} disabled={s.audio === "playing"} data-testid="play">Play {kind === "violin" ? "violin phrase" : kind === "speech" ? "speech sample" : "band loop"}</button><button className="btn" onClick={() => { stop(); set({ audio: "idle" }); }} data-testid="stop">Stop</button><label className="chk"><input type="checkbox" checked={s.hearRoom} onChange={(e) => set({ hearRoom: e.target.checked })} data-testid="hear-room" /> Hear the room</label></div>
    <p className="status" role="status" data-testid="audio-state" data-state={s.audio}>{s.audio === "unavailable" ? "Audio is not available in this browser; the picture still shows the prediction." : s.audio === "playing" ? "Playing…" : audioAvailable() ? "Ready." : "Audio is not available in this browser."}</p>
    <p className="fine">Listening at x {f1(s.listener.x)}, z {f1(s.listener.z)}. Choose another seat in Seats or Field.</p>
    <h3>Save this venue scenario</h3><div className="row2"><label>Name<input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} placeholder={`${sc.label} ${state.saved.length + 1}`} data-testid="save-name" /></label><button className="btn primary" onClick={save} data-testid="save">Save scenario</button></div>
    {s.flash && <p className="status" role="status" data-testid="flash">{s.flash}</p>}
    <ul className="saved" data-testid="saved-list" aria-label="Saved scenarios">{s.saved.map((x) => <li key={x.id}><b>{x.name}</b> <small>{x.venue.scenario}, mid RT {f2(midRt(x.venue))} s</small><button className="btn ghost" onClick={() => { set({ venue: clone(x.venue), flash: `Loaded "${x.name}".` }); scheduleField(); }} data-testid={`load-${x.id}`}>Load</button><button className="btn ghost" onClick={() => { set({ saved: state.saved.filter((y) => y.id !== x.id) }); persist(); }} data-testid={`delete-${x.id}`}>Delete</button></li>)}{!s.saved.length && <li className="fine">Nothing saved yet.</li>}</ul><Disclaimer /></section>);
}
const CAMS: [Cam, string][] = [["auto", "Auto"], ["audience", "Audience"], ["stage", "Stage"], ["ceiling", "Ceiling"]];
export default function Panels({ data }: { data: Data }) {
  const s = useStore(), idx = VIEWS.findIndex((v) => v.id === s.view), V = s.view;
  return (
    <div className="ui" data-testid="hud">
      <header className="top"><span className="brand">SONORA</span><Wave /><div className="cams" role="group" aria-label="Camera">{CAMS.map(([k, l]) => <button key={k} className={`btn ghost ${s.cam === k ? "on" : ""}`} aria-pressed={s.cam === k} onClick={() => set({ cam: k })} data-testid={`cam-${k}`}>{l}</button>)}</div><button className="btn ghost" aria-pressed={s.pauseMotion} onClick={() => set({ pauseMotion: !s.pauseMotion })} data-testid="pause-motion">{s.pauseMotion ? "Resume motion" : "Pause motion"}</button></header>
      <nav className="rail" aria-label="Views">{VIEWS.map((v, i) => <button key={v.id} className={i === idx ? "on" : ""} aria-current={i === idx ? "page" : undefined} onClick={() => go(v.id)} data-testid={`nav-${v.id}`}><b>{v.label}</b><small>{v.blurb}</small></button>)}</nav>
      <main className={`panel ${s.reduced ? "" : "wipe"}`} key={V} tabIndex={-1}>{V === "venue" && <VenueView data={data} />}{V === "speakers" && <SpeakersView data={data} />}{V === "field" && <FieldView data={data} />}{V === "seats" && <SeatsView />}{V === "compare" && <CompareView />}{V === "listen" && <ListenView />}</main>
    </div>
  );
}
void SAMPLES; void HALL; void rtTable; void MATERIAL_COLOR;
