"use client";
import { Canvas, useFrame, useLoader, useThree } from "@react-three/fiber";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import * as THREE from "three";
import { useEffect, useMemo, useRef } from "react";
import { traceRays, type Reading } from "@sonora/domain";
import type { SurfaceKey, Venue } from "@sonora/schemas";
import { base, MATERIAL_COLOR, ramp, rangeOf } from "../data";
import { pump } from "../audio";
import { live, set, state, useStore } from "../store";

const SURF: Record<string, SurfaceKey> = { Wall_Left: "left", Wall_Right: "right", Wall_Rear: "rear", Wall_Stage: "stage", Hall_Floor: "floor", Hall_Ceiling: "ceiling" };
const UNIT: Record<string, string> = { SpeakerArray_L: "arrayL", SpeakerArray_R: "arrayR", Speaker_Fill_L: "fillL", Speaker_Fill_R: "fillR" };
const AMBER = new THREE.Color("#F1A341"), BLUE = new THREE.Color("#3A80BF"), deg = Math.PI / 180;
/** Shared uniforms for the intro: the sound's wavefront from the source and from its six first-order wall images reveals the hall where it touches. */
const REV = { uSrc: { value: Array.from({ length: 7 }, () => new THREE.Vector3()) }, uR: { value: 0 }, uOn: { value: 1 } };
function reveal(m: THREE.MeshStandardMaterial) {
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uSrc = REV.uSrc; sh.uniforms.uR = REV.uR; sh.uniforms.uOn = REV.uOn;
    sh.vertexShader = "varying vec3 vWp;\n" + sh.vertexShader.replace("#include <begin_vertex>", "#include <begin_vertex>\nvWp = (modelMatrix * vec4(transformed, 1.0)).xyz;");
    sh.fragmentShader = "uniform vec3 uSrc[7]; uniform float uR; uniform float uOn; varying vec3 vWp;\n" + sh.fragmentShader.replace("#include <opaque_fragment>", `
      float vis = 0.0, ring = 0.0, ringR = 0.0;
      for (int i = 0; i < 7; i++) { float d = distance(vWp, uSrc[i]); vis = max(vis, smoothstep(-0.8, 0.8, uR - d)); float rg = exp(-pow((uR - d) / 0.5, 2.0)); if (i == 0) ring = max(ring, rg); else ringR = max(ringR, rg * 0.7); }
      outgoingLight = mix(outgoingLight, outgoingLight * vis + diffuseColor.rgb * 0.34 * vis + vec3(0.945, 0.64, 0.255) * ring * 1.5 + vec3(0.227, 0.5, 0.75) * ringR * 1.2, uOn);
      #include <opaque_fragment>`);
  };
  m.customProgramCacheKey = () => "sonora-reveal"; return m;
}
const std = (color: string, rough = 0.7, metal = 0) => reveal(new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal }));
const mixColor = (a: string, b: string, k: number) => new THREE.Color(a).lerp(new THREE.Color(b), k);
const POSE = { audience: { p: [0, 3.7, 5.5], l: [0, 4.2, -12], f: 62, up: [0, 1, 0] }, stage: { p: [0, 3.3, -9.4], l: [0, 4.2, 10], f: 58, up: [0, 1, 0] }, ceiling: { p: [0, 27, 4], l: [0, 0, 2], f: 38, up: [0, 0, -1] }, orbit: { p: [10, 9.5, 16.5], l: [-2, 2.5, -9], f: 56, up: [0, 1, 0] }, intro: { p: [0, 3.4, 3], l: [0, 2.7, -14], f: 48, up: [0, 1, 0] } } as const;
const AUTO = { venue: "orbit", speakers: "ceiling", field: "audience", seats: "orbit", compare: "orbit", listen: "stage" } as const;

function Hall({ venue }: { venue: Venue }) {
  const gltf = useLoader(GLTFLoader, `${base}/models/hall.glb`), model = useMemo(() => gltf.scene.clone(true), [gltf]);
  const set_ = useMemo(() => {
    const M = { seat: std("#691E33", 0.9), wood: std("#7a4a28", 0.5), brass: std("#C59A49", 0.3, 1), black: std("#0b0b0d", 0.6), stage: std("#4a2c18", 0.4), lamp: new THREE.MeshStandardMaterial({ color: "#F1A341", emissive: "#F1A341", emissiveIntensity: 0, roughness: 0.4 }), skin: new THREE.MeshBasicMaterial({ color: "#030304" }) };
    const shell: Record<string, THREE.MeshStandardMaterial> = {}, panels: Record<string, THREE.MeshStandardMaterial> = {}, groups = { balcony: [] as THREE.Object3D[], reflectors: [] as THREE.Object3D[], units: {} as Record<string, THREE.Object3D>, lights: [] as THREE.Mesh[], arm: null as THREE.Object3D | null, proxy: null as THREE.Object3D | null };
    model.traverse((o) => { const m = o as THREE.Mesh, n = o.name; if (n.startsWith("Light_") && m.isMesh) groups.lights.push(m); if (n === "Proxy_Hall") groups.proxy = o; if (n === "Conductor_Arm") groups.arm = o; if (n in UNIT) groups.units[UNIT[n]] = o; if (n.startsWith("Reflector_")) groups.reflectors.push(o); if (n.startsWith("Balcony_") || n === "Seats_Balcony") groups.balcony.push(o);
      if (!m.isMesh) return; if (n in SURF) { shell[n] = std("#8a817a", 0.85); m.material = shell[n]; } else if (n.startsWith("Panel_")) { panels[n] = std("#7a4a28", 0.5); m.material = panels[n]; } else if (n.startsWith("Seats_")) m.material = M.seat; else if (n.startsWith("Light_")) m.material = M.lamp; else if (n.startsWith("Conductor_Body") || n === "Conductor_Arm") m.material = reveal(new THREE.MeshStandardMaterial({ color: "#050506", roughness: 0.9 })); else if (n.startsWith("Stage_") || n === "Hall_Floor") { if (!(n in SURF)) m.material = M.stage; } else if (n.startsWith("Balcony_Front") || n.startsWith("Truss") ) m.material = n.startsWith("Balcony_Front") ? M.brass : M.black; else if (n.startsWith("Speaker")) m.material = M.black; else if (n.startsWith("Reflector_")) m.material = M.wood; else if (n.startsWith("Conductor_Podium")) m.material = M.wood; else m.material = M.black; });
    if (groups.proxy) groups.proxy.visible = false; return { M, shell, panels, groups };
  }, [model]);
  useEffect(() => {
    const { shell, panels, groups } = set_; const v = venue;
    for (const [n, k] of Object.entries(SURF)) { const s = v.surfaces[k]; shell[n]?.color.copy(mixColor(MATERIAL_COLOR[s.base], s.treat ? MATERIAL_COLOR[s.treat] : MATERIAL_COLOR[s.base], s.cover * 0.55)); }
    for (const [n, m] of Object.entries(panels)) { const side = n.startsWith("Panel_L_") ? "left" : n.startsWith("Panel_R_") ? "right" : "rear", s = v.surfaces[side], i = Number(n.slice(-2)), treated = !!s.treat && s.cover > 0 && (s.cover >= 1 || Math.floor((i + 1) * s.cover) > Math.floor(i * s.cover));
      m.color.copy(treated ? new THREE.Color(MATERIAL_COLOR[s.treat!]) : mixColor(MATERIAL_COLOR[s.base], "#c8b9a0", 0.18)); }
    groups.balcony.forEach((o) => (o.visible = v.balcony)); groups.reflectors.forEach((o) => (o.position.y = v.reflectors.y - 9 + (o.userData.y0 ??= o.position.y), o.visible = v.reflectors.on));
    for (const u of v.speakers) { const o = groups.units[u.id]; if (!o) continue; o.visible = u.on; o.position.set(u.x, u.y, u.z); o.rotation.y = u.yawDeg * deg; o.children.forEach((c, i) => { c.rotation.x = (u.tiltDeg + i * u.splayDeg) * deg; }); }
  }, [venue, set_]);
  const { camera } = useThree(), ceil = useMemo(() => model.getObjectByName("Hall_Ceiling"), [model]);
  useFrame(() => { if (ceil) ceil.visible = camera.position.y < 13.2; const g = set_.groups; g.lights.forEach((l, i) => { (l.material as THREE.MeshStandardMaterial).emissiveIntensity = live.lights[i] * (2 + live.level * 2); }); if (g.arm) g.arm.rotation.z = -live.arm * 1.7; });
  return <primitive object={model} onPointerDown={(e: { object: THREE.Object3D; stopPropagation: () => void }) => { if (!state.introDone || state.view !== "speakers") return; let o: THREE.Object3D | null = e.object; while (o && !(o.name in UNIT)) o = o.parent; if (o) { e.stopPropagation(); set({ selSpeaker: UNIT[o.name] }); } }} />;
}
function Lights() {
  const spots = useRef<(THREE.SpotLight | null)[]>([]), house = useRef<THREE.AmbientLight>(null), pts = useRef<(THREE.PointLight | null)[]>([]), targets = useMemo(() => Array.from({ length: 6 }, (_, i) => { const o = new THREE.Object3D(); o.position.set((-7.5 + i * 3) * 0.3, 1.2, -14); return o; }), []);
  useEffect(() => { spots.current.forEach((sp, i) => { if (sp) sp.target = targets[i]; }); }, [targets]);   // a spot light only aims at a target that is in the scene
  useFrame(() => { spots.current.forEach((s, i) => s && (s.intensity = live.lights[i] * 260 * (1 + live.level * 0.5 + live.beat * 0.6))); if (house.current) house.current.intensity = 0.05 + live.house * 0.26; pts.current.forEach((p) => p && (p.intensity = live.house * 300)); });
  return <>
    <ambientLight ref={house} color="#F5E8D2" intensity={0.05} />
    {targets.map((t, i) => <primitive key={`t${i}`} object={t} />)}
    {Array.from({ length: 6 }, (_, i) => <spotLight key={i} ref={(r) => { spots.current[i] = r; }} position={[-7.5 + i * 3, 9, -10.2]} angle={0.5} penumbra={0.8} intensity={0} color="#F1A341" distance={40} decay={1.4} />)}
    {[-8, 2, 12].map((z, i) => <pointLight key={z} ref={(r) => { pts.current[i] = r; }} position={[0, 11.5, z]} intensity={0} color="#F5E8D2" distance={34} decay={1.6} />)}
  </>;
}
function Heat() {
  const s = useStore(), [stalls, balc] = useMemo(() => { const mk = (w: number, h: number) => { const c = document.createElement("canvas"); c.width = w; c.height = h; const t = new THREE.CanvasTexture(c); t.minFilter = t.magFilter = THREE.LinearFilter; return { c, t }; }; return [mk(15, 15), mk(13, 6)]; }, []);
  useEffect(() => { const [lo, hi] = rangeOf(s.field.readings as (Reading | undefined)[], s.metric, s.band); for (const L of [stalls, balc]) { const g = L.c.getContext("2d")!; g.clearRect(0, 0, L.c.width, L.c.height); }
    s.field.recv.forEach((r, i) => { const d = s.field.readings[i] as Reading | undefined; if (!d) return; const L = r.id[0] === "b" ? balc : stalls, [zi, xi] = r.id.slice(1).split("-").map(Number), v = d[s.metric][s.band], [R, G, B] = ramp((v - lo) / (hi - lo)); const g = L.c.getContext("2d")!; g.fillStyle = `rgb(${R},${G},${B})`; g.fillRect(xi, zi, 1, 1); }); stalls.t.needsUpdate = true; balc.t.needsUpdate = true; }, [s.field, s.metric, s.band, stalls, balc]);
  if (!state.introDone || (s.view !== "field" && s.view !== "speakers")) return null;
  const click = (e: { point: THREE.Vector3; stopPropagation: () => void }, y: number) => { e.stopPropagation(); set({ listener: { x: Math.round(e.point.x * 2) / 2, z: Math.round(e.point.z * 2) / 2, y } }); };
  return <>
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 1.3, 5]} onClick={(e) => click(e, 1.2)}><planeGeometry args={[22.5, 22.5]} /><meshBasicMaterial map={stalls.t} transparent opacity={0.72} depthWrite={false} /></mesh>
    {s.venue.balcony && <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 6.6, 11.75]} onClick={(e) => click(e, 6.5)}><planeGeometry args={[19.5, 9]} /><meshBasicMaterial map={balc.t} transparent opacity={0.72} depthWrite={false} /></mesh>}
  </>;
}
function Rays() {
  const s = useStore(), line = useRef<THREE.LineSegments>(null), rays = useMemo(() => traceRays(s.venue, [s.venue.source.x, s.venue.source.y, s.venue.source.z], 40, 5), [s.venue]);
  const geo = useMemo(() => { const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(40 * 6 * 6), 3)); g.setAttribute("color", new THREE.BufferAttribute(new Float32Array(40 * 6 * 6), 3)); return g; }, []);
  useFrame((_, dt) => { if (!line.current || !state.introDone) return; if (!state.pauseMotion) live.raysT = (live.raysT + dt * 0.045) % 0.4; const T = live.raysT, pos = geo.attributes.position as THREE.BufferAttribute, col = geo.attributes.color as THREE.BufferAttribute; let k = 0;
    for (const r of rays) for (let i = 1; i < r.points.length; i++) { if (r.t[i - 1] > T) break; const a = r.points[i - 1], b = r.points[i], f = Math.min(1, (T - r.t[i - 1]) / (r.t[i] - r.t[i - 1])), e = r.e[i - 1], c = AMBER.clone().lerp(BLUE, 1 - e).multiplyScalar(0.25 + 0.75 * e); pos.setXYZ(k, a[0], a[1], a[2]); pos.setXYZ(k + 1, a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f); col.setXYZ(k, c.r, c.g, c.b); col.setXYZ(k + 1, c.r, c.g, c.b); k += 2; }
    geo.setDrawRange(0, k); pos.needsUpdate = true; col.needsUpdate = true; });
  if (s.view !== "field" || !state.introDone) return null;
  return <lineSegments ref={line} geometry={geo}><lineBasicMaterial vertexColors transparent opacity={0.9} blending={THREE.AdditiveBlending} depthWrite={false} /></lineSegments>;
}
function Markers() {
  const s = useStore(), ring = useRef<THREE.Mesh>(null), ripple = useRef<THREE.Mesh>(null); const sp = s.venue.speakers.find((u) => u.id === s.selSpeaker);
  useFrame(({ clock }) => { if (ring.current) ring.current.scale.setScalar(1 + 0.12 * Math.sin(clock.elapsedTime * 3) * (state.pauseMotion ? 0 : 1)); if (ripple.current) { const k = 1 + live.level * 5; ripple.current.scale.set(k, k, 1); (ripple.current.material as THREE.MeshBasicMaterial).opacity = Math.min(0.8, live.level * 1.4); } });
  if (!state.introDone) return null;
  return <>
    <mesh position={[s.venue.source.x, s.venue.source.y, s.venue.source.z]}><sphereGeometry args={[0.22, 16, 12]} /><meshBasicMaterial color="#F1A341" /></mesh>
    <mesh ref={ripple} position={[s.venue.source.x, 1.3, s.venue.source.z]} rotation={[-Math.PI / 2, 0, 0]}><ringGeometry args={[0.9, 1.0, 48]} /><meshBasicMaterial color="#F1A341" transparent opacity={0} depthWrite={false} /></mesh>
    {(s.view === "field" || s.view === "seats" || s.view === "listen") && <mesh ref={ring} position={[s.listener.x, s.listener.y + 0.1, s.listener.z]} rotation={[-Math.PI / 2, 0, 0]}><ringGeometry args={[0.45, 0.62, 32]} /><meshBasicMaterial color="#3A80BF" depthTest={false} transparent opacity={0.95} /></mesh>}
    {s.view === "speakers" && sp && <><mesh position={[sp.x, sp.y / 2, sp.z]}><cylinderGeometry args={[0.03, 0.03, sp.y, 6]} /><meshBasicMaterial color="#C59A49" /></mesh><mesh position={[sp.x, 0.08, sp.z]} rotation={[-Math.PI / 2, 0, 0]}><ringGeometry args={[0.5, 0.7, 32]} /><meshBasicMaterial color="#C59A49" /></mesh></>}
  </>;
}
function Rig() {
  const { camera, size } = useThree(), cam = camera as THREE.PerspectiveCamera, cur = useRef({ p: new THREE.Vector3(...POSE.intro.p), l: new THREE.Vector3(...POSE.intro.l), f: POSE.intro.f, up: new THREE.Vector3(0, 1, 0) });
  useFrame((st, dt) => {
    const s = state, key = !s.introDone && s.introStep < 6 ? "intro" : s.cam === "auto" ? AUTO[s.view] : s.cam, g = POSE[key], k = s.reduced ? 1 : 1 - Math.exp(-dt * (s.introDone ? 2.2 : 1.1)), c = cur.current;
    c.p.lerp(new THREE.Vector3(...g.p), k); c.l.lerp(new THREE.Vector3(...g.l), k); c.f += (g.f - c.f) * k; c.up.lerp(new THREE.Vector3(...g.up), k).normalize();
    const sway = s.introDone || s.pauseMotion || s.reduced ? 0 : Math.sin(st.clock.elapsedTime * 0.25) * 0.5;
    cam.position.copy(c.p).add(new THREE.Vector3(sway, 0, 0)); cam.up.copy(c.up); cam.lookAt(c.l); cam.fov = c.f; cam.near = 0.1; cam.far = 120;
    if (size.width > 900) cam.setViewOffset(size.width, size.height, size.width * 0.1, 0, size.width, size.height); else cam.clearViewOffset(); cam.updateProjectionMatrix();
    const v = s.venue.source, d = (o: [number, number, number]) => REV.uSrc.value[0].set(...o); d([v.x, v.y, v.z]); const img = [[24 - v.x, v.y, v.z], [-24 - v.x, v.y, v.z], [v.x, -v.y, v.z], [v.x, 26 - v.y, v.z], [v.x, v.y, -36 - v.z], [v.x, v.y, 36 - v.z]] as const; img.forEach((q, i) => REV.uSrc.value[i + 1].set(q[0], q[1], q[2]));
    REV.uR.value = live.wave; REV.uOn.value = live.revealOn; pump();
  });
  return null;
}
function Lifecycle() {
  const { setFrameloop, gl } = useThree();
  useEffect(() => { const vis = () => setFrameloop(document.hidden ? "never" : "always"), lost = (e: Event) => { e.preventDefault(); set({ gfx: "poster" }); };
    document.addEventListener("visibilitychange", vis); gl.domElement.addEventListener("webglcontextlost", lost); (window as unknown as { __sonoraStats: () => unknown }).__sonoraStats = () => ({ calls: gl.info.render.calls, triangles: gl.info.render.triangles, geometries: gl.info.memory.geometries, textures: gl.info.memory.textures });
    return () => { document.removeEventListener("visibilitychange", vis); gl.domElement.removeEventListener("webglcontextlost", lost); }; }, [setFrameloop, gl]);
  return null;
}
export default function Scene() {
  const s = useStore();
  useEffect(() => { (window as unknown as { __sLive: typeof live }).__sLive = live; }, []);
  return (
    <Canvas className="stage" data-testid="stage" dpr={[1, 1.5]} camera={{ fov: 58, position: POSE.intro.p as unknown as [number, number, number] }} gl={{ antialias: true, powerPreference: "high-performance" }} onCreated={({ gl, scene }) => { gl.setClearColor("#070708"); gl.toneMapping = THREE.ACESFilmicToneMapping; scene.fog = new THREE.FogExp2("#070708", 0.012); }}>
      <Lights /><Rig /><Hall venue={s.venue} /><Heat /><Rays /><Markers /><Lifecycle />
    </Canvas>
  );
}
