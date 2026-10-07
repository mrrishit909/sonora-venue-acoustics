"""Fresh-scene re-import of exports/hall.glb checked against parts.json and analysis.json. Exit 1 on failure."""
import bpy, os, sys, json
HERE = os.path.dirname(os.path.abspath(__file__)); P = json.load(open(os.path.join(HERE, "parts.json"))); A = json.load(open(os.path.join(HERE, "exports", "analysis.json")))
bpy.ops.wm.read_factory_settings(use_empty=True); path = os.path.join(HERE, "exports", "hall.glb"); bpy.ops.import_scene.gltf(filepath=path)
objs = {o.name.split(".")[0]: o for o in bpy.data.objects}; tris = lambda o: sum(len(p.vertices) - 2 for p in o.data.polygons)
G = P["groups"]; need = list(G["shell"]) + list(G["stage"]) + list(G["seating"]) + [f"{G['panels']['prefix']}{i:02d}" for i in range(G["panels"]["count"])]
for a in G["panels"]["also"]: need += [f"{a['prefix']}{i:02d}" for i in range(a["count"])]
need += [f"{G['reflectors']['prefix']}{i:02d}" for i in range(G["reflectors"]["count"])] + [f"{G['lights']['prefix']}{i:02d}" for i in range(G["lights"]["count"])] + G["proxy"]
for u in G["speakers"]: need += [u["unit"]] + [f"{u['unit']}_{k:02d}" for k in range(u["elements"])]
missing = [n for n in need if n not in objs]; bad = []
def world_bounds(o):
    ws = [o.matrix_world @ v.co for v in o.data.vertices]; return [min(w[i] for w in ws) for i in range(3)], [max(w[i] for w in ws) for i in range(3)]
# a pivot must sit where the browser will rotate or move it: inside the part for panels, reflectors and lights; the arm at the shoulder; speaker elements below their hang point
for n in need:
    o = objs.get(n)
    if o is None or o.type != "MESH" or n == "Proxy_Hall": continue
    if n.startswith(("Panel_", "Reflector_", "Light_")):
        lo, hi = world_bounds(o); c = o.matrix_world.translation
        if not all(lo[i] - 0.01 <= c[i] <= hi[i] + 0.01 for i in range(3)): bad.append(f"{n}: pivot is outside the part")
    if tuple(round(v, 4) for v in o.scale) != (1.0, 1.0, 1.0): bad.append(f"{n}: unapplied scale {tuple(o.scale)}")
for u in G["speakers"]:
    e = objs.get(u["unit"]); kids = [c for c in (e.children if e else []) if c.type == "MESH"]
    if e and len(kids) != u["elements"]: bad.append(f"{u['unit']}: {len(kids)} elements, contract says {u['elements']}")
    for c in kids:
        if c.matrix_world.translation.z > e.matrix_world.translation.z + 0.01: bad.append(f"{c.name}: sits above its hang point")
arm, body = objs.get("Conductor_Arm"), objs.get("Conductor_Body")
if arm and body and abs(arm.matrix_world.translation.z - (body.matrix_world.translation.z + 1.42)) > 0.15: bad.append("Conductor_Arm pivot is not at the shoulder")
W, L, H = P["hall"]["width"], P["hall"]["length"], P["hall"]["height"]
for n in need:
    o = objs.get(n)
    if o is None or o.type != "MESH" or n in G["shell"] or n == "Proxy_Hall": continue
    lo, hi = world_bounds(o)
    if lo[0] < -W / 2 - 0.01 or hi[0] > W / 2 + 0.01 or lo[1] < -L / 2 - 0.01 or hi[1] > L / 2 + 0.01 or lo[2] < -0.01 or hi[2] > H + 0.01: bad.append(f"{n}: outside the hall envelope")
if (A["hall"]["w"], A["hall"]["l"], A["hall"]["h"]) != (W, L, H): bad.append("analysis.json hall size differs from parts.json")
for k, (lo, hi) in A["blocks"].items():
    if not (-W / 2 <= lo[0] and hi[0] <= W / 2 and -L / 2 <= lo[2] and hi[2] <= L / 2): bad.append(f"seat block {k} leaves the hall")
if sum(A["seats"][k] for k in ("center", "left", "right", "balcony")) != A["seats"]["total"]: bad.append("seat counts do not add up")
orphans = [o.name for o in bpy.data.objects if o.parent is None and o.name.split(".")[0] != "Hall"]
total_tris = sum(tris(o) for o in bpy.data.objects if o.type == "MESH"); size = os.path.getsize(path); fail = list(bad)
if missing: fail.append(f"missing {missing}")
if orphans: fail.append(f"unparented {orphans}")
if total_tris > P["budget"]["tris"]: fail.append(f"{total_tris} tris over budget")
if size > P["budget"]["bytes"]: fail.append(f"{size} bytes over budget")
rep = {"tris": total_tris, "bytes": size, "parts": len(need), "missing": missing, "orphans": orphans, "problems": bad, "seats": A["seats"]["total"]}
json.dump(rep, open(os.path.join(HERE, "exports", "validation.json"), "w"), indent=1); print(json.dumps(rep, indent=1))
if fail: print("VALIDATION FAILED:", fail); sys.exit(1)
print("VALIDATION OK")
