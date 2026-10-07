"use client";
import { useEffect, useState } from "react";
import { loadData, base, type Data } from "./data";
import { live, persist, scheduleField, set, state, STORE_KEY, useStore, VIEWS } from "./store";
import Intro from "./ui/Intro";
import Panels from "./ui/Panels";
import Scene from "./scene/Scene";
import { presetVenue } from "@sonora/domain";
const webglOk = () => { try { const c = document.createElement("canvas"); return !!(c.getContext("webgl2") || c.getContext("webgl")); } catch { return false; } };
export default function App() {
  const s = useStore(); const [data, setData] = useState<Data | null>(null); const [err, setErr] = useState("");
  useEffect(() => {
    const q = new URLSearchParams(location.search), rm = matchMedia("(prefers-reduced-motion: reduce)").matches || q.get("motion") === "reduced", view = VIEWS.find((v) => v.id === (q.get("view") ?? location.hash.slice(1)))?.id, skip = q.get("skip") === "1" || !!view, preset = (["speech", "chamber", "show"] as const).find((p) => p === q.get("scenario"));
    loadData().then((d) => {
      let saved: never[] = []; try { saved = JSON.parse(localStorage.getItem(STORE_KEY) ?? "null")?.saved ?? []; if (!Array.isArray(saved)) saved = []; } catch { /* a corrupted store is ignored */ }
      set({ reduced: rm, pauseMotion: rm, gfx: q.get("gfx") === "off" || !webglOk() ? "poster" : "webgl", saved, ...(preset ? { venue: presetVenue(preset) } : {}), ...(view ? { view } : {}), ...(skip ? { introDone: true, introStep: 99 } : {}) });
      if (skip) { document.documentElement.style.setProperty("--ui", "1"); Object.assign(live, { wave: 46, revealOn: 0, lights: [1, 1, 1, 1, 1, 1], house: 1, arm: 0 }); }
      scheduleField(); setData(d); }).catch((e) => setErr(String(e)));
  }, []);
  useEffect(() => { const f = () => { const v = VIEWS.find((x) => x.id === location.hash.slice(1)); if (v && v.id !== state.view && state.introDone) set({ view: v.id }); }; addEventListener("hashchange", f); return () => removeEventListener("hashchange", f); }, []);
  if (err) return <div className="boot" role="alert">Could not load data: {err}</div>;
  if (!data) return <div className="boot" role="status">Tuning the hall…</div>;
  return (
    <div className="app" data-view={s.view} data-intro={s.introDone ? "done" : "running"} data-gfx={s.gfx}>
      {s.gfx === "webgl" ? <Scene /> : <div className="poster" style={{ backgroundImage: `url(${base}/posters/hall.png)` }} role="img" aria-label="Still of the concert hall seen from the rear seats toward the stage" data-testid="poster" />}
      <div className="vignette" aria-hidden /><Panels data={data} />{(!s.introDone || s.introFx) && <Intro />}
    </div>
  );
}
void persist;
