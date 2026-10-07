"use client";
import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { tone } from "../audio";
import { live, set, state, useStore } from "../store";

const REACH = 46;   // metres the wavefront travels before the whole hall is lit
// Steps (blueprint section 3): 0 darkness, 1 a tone becomes a wavefront and reflections reveal the walls, 2 stage lights power up one by one, 3 a conductor raises a hand, 4 the line, 6 the first beat moves the camera into the editor and the interface arrives.
export default function Intro() {
  const s = useStore(), tl = useRef<gsap.core.Timeline | null>(null), [cap, setCap] = useState(""), [line, setLine] = useState(false), [sound, setSound] = useState(false); const root = document.documentElement;
  const finish = () => { tl.current?.kill(); Object.assign(live, { wave: REACH, revealOn: 0, lights: [1, 1, 1, 1, 1, 1], house: 1, arm: 0, beat: 0 }); root.style.setProperty("--ui", "1"); set({ introFx: false, introStep: 99, ...(state.introDone ? {} : { introDone: true }) }); setLine(false); setCap(""); }; // never overwrite what the visitor did while the last fade ran
  useEffect(() => {
    if (state.reduced) return; gsap.ticker.lagSmoothing(0);
    Object.assign(live, { wave: 0, revealOn: 1, lights: [0, 0, 0, 0, 0, 0], house: 0, arm: 0, beat: 0 }); root.style.setProperty("--ui", "0");
    const t = gsap.timeline({ defaults: { ease: "power1.inOut" }, onComplete: finish }); tl.current = t; const step = (n: number, c = "") => () => { set({ introStep: n }); setCap(c); };
    t.call(step(0, ""), [], 0).call(step(1, "A single tone."), [], 1.4).to(live, { wave: REACH, duration: 8.2, ease: "power1.out" }, 1.6)
      .call(step(2, "Where sound touches, the hall appears."), [], 5.2)
      .call(step(2, "The stage lights power up."), [], 8.4);
    live.lights.forEach((_, i) => t.to(live.lights, { [i]: 1, duration: 0.6 }, 8.5 + i * 0.45));
    t.call(step(3, "A conductor raises a hand."), [], 11.4).to(live, { arm: 1, duration: 1.7, ease: "power2.out" }, 11.6)
      .call(() => { set({ introStep: 4 }); setCap(""); setLine(true); }, [], 12.6).call(() => setLine(false), [], 14.6)
      .to(live, { arm: 0, duration: 0.22, ease: "power3.in" }, 14.7).to(live, { beat: 1, duration: 0.08 }, 14.8).to(live, { beat: 0, duration: 0.9, ease: "power2.out" }, 14.9)
      .call(() => { set({ introStep: 6 }); }, [], 14.9).to(live, { house: 1, duration: 2.4 }, 14.9).to(live, { revealOn: 0, duration: 1.4 }, 14.9)
      .to({ v: 0 }, { v: 1, duration: 2.6, ease: "power2.inOut", onUpdate() { root.style.setProperty("--ui", String(this.targets()[0].v)); } }, 15.2)
      .call(() => { set({ introDone: true, introFx: true, introStep: 99 }); }, [], 17.9);
    return () => { if (!state.introDone) t.kill(); }; // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const skip = () => { const tt = tl.current; if (tt && tt.time() < 14.5) { live.wave = REACH; tt.seek(14.5); } else finish(); };
  if (s.introDone && !s.introFx) return null;
  if (s.reduced) { const fr = [["Silence", "A single violin tone in the dark."], ["The hall appears", "The sound travels, reflects off the walls and shows where they are."], ["Lights up", "Stage lights come on and a conductor raises a hand."], ["Every seat hears a different hall", "The first beat opens the planner."]];
    return (<div className="intro intro-static" role="dialog" aria-label="Opening story" data-testid="intro"><ol>{fr.map(([a, b], i) => <li key={i}><b>{a}</b> {b}</li>)}</ol><button className="btn primary" onClick={finish} data-testid="skip-intro">Enter the planner</button></div>); }
  return (<div className={`intro ${s.introDone ? "fx" : ""}`} data-testid="intro" data-step={s.introStep}>
    {line && <h1 className="statement" data-testid="statement">Every seat hears a different hall.</h1>}<p className="caption" role="status">{cap}</p>
    {!s.introDone && <div className="intro-btns"><button className="btn ghost" aria-pressed={sound} onClick={async () => { const ok = await tone(); setSound(ok); }} data-testid="intro-sound">{sound ? "Sound is on" : "Play the tone"}</button><button className="btn skip" onClick={skip} data-testid="skip-intro" autoFocus>Skip intro</button></div>}</div>);
}
