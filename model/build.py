"""SONORA: an original modular concert hall kit. Deterministic. Run: Blender -b -P model/build.py
Shell, stage, seating blocks, balcony, 20 wall panels, 6 ceiling reflectors, line-array speaker units, 6 stage lights, a conductor, and Proxy_Hall (analysis volume).
Blender is Z-up; the GLB is Y-up (glTF z = -Blender y), so the stage (Blender y = +18) lands at glTF z = -18. Also writes exports/analysis.json (measured bounds in glTF axes) for the browser's acoustics."""
import bpy, bmesh, math, os, json
from mathutils import Vector
HERE = os.path.dirname(os.path.abspath(__file__)); P = json.load(open(os.path.join(HERE, "parts.json")))
os.makedirs(os.path.join(HERE, "exports"), exist_ok=True); os.makedirs(os.path.join(HERE, "renders"), exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True); scene = bpy.context.scene
def mat(name, color, rough=0.5, metal=0.0, emit=None):
    m = bpy.data.materials.new(name); m.use_nodes = True; b = m.node_tree.nodes["Principled BSDF"]; b.inputs["Base Color"].default_value = (*color, 1); b.inputs["Roughness"].default_value = rough; b.inputs["Metallic"].default_value = metal
    if emit: b.inputs["Emission Color"].default_value = (*emit, 1); b.inputs["Emission Strength"].default_value = 3.0
    return m
M = {"plaster": mat("Plaster", (0.55, 0.5, 0.45), 0.8), "wood": mat("Wood", (0.42, 0.24, 0.12), 0.45), "velvet": mat("Velvet", (0.41, 0.12, 0.2), 0.95), "brass": mat("Brass", (0.77, 0.6, 0.29), 0.3, 1.0), "black": mat("Black", (0.03, 0.03, 0.035), 0.6), "floor": mat("StageFloor", (0.3, 0.17, 0.09), 0.35), "skin": mat("Silhouette", (0.02, 0.02, 0.025), 0.8), "lamp": mat("Lamp", (0.95, 0.64, 0.25), 0.3, 0.0, (0.95, 0.64, 0.25))}
root = bpy.data.objects.new("Hall", None); scene.collection.objects.link(root)
def box_bm(bm, c, s):
    """Add an axis-aligned box (centre c, size s) to a bmesh."""
    x, y, z = c; sx, sy, sz = (v / 2 for v in s)
    v = [bm.verts.new((x + a * sx, y + b * sy, z + d * sz)) for a in (-1, 1) for b in (-1, 1) for d in (-1, 1)]
    for f in ((0, 1, 3, 2), (4, 6, 7, 5), (0, 4, 5, 1), (2, 3, 7, 6), (0, 2, 6, 4), (1, 5, 7, 3)): bm.faces.new([v[i] for i in f])
def obj(name, bm, material, parent=root, loc=(0, 0, 0)):
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:]); me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free(); me.materials.append(material)
    o = bpy.data.objects.new(name, me); scene.collection.objects.link(o); o.parent = parent; o.location = loc; return o
def box(name, c, s, material, parent=root, pivot=None):
    """A box whose object origin is `pivot` (default its centre); geometry stays where c says."""
    pv = Vector(pivot) if pivot is not None else Vector(c); bm = bmesh.new(); box_bm(bm, (c[0] - pv.x, c[1] - pv.y, c[2] - pv.z), s); return obj(name, bm, material, parent, tuple(pv))
def empty(name, loc, parent=root):
    e = bpy.data.objects.new(name, None); scene.collection.objects.link(e); e.parent = parent; e.location = loc; return e
W, L, H = P["hall"]["width"], P["hall"]["length"], P["hall"]["height"]; hw, hl = W / 2, L / 2
# ---- shell: thin slabs just outside the envelope so the inside faces are the room
T = 0.3
box("Hall_Floor", (0, 0, -T / 2), (W + 2 * T, L + 2 * T, T), M["floor"]); box("Hall_Ceiling", (0, 0, H + T / 2), (W + 2 * T, L + 2 * T, T), M["plaster"])
box("Wall_Left", (-hw - T / 2, 0, H / 2), (T, L, H), M["plaster"]); box("Wall_Right", (hw + T / 2, 0, H / 2), (T, L, H), M["plaster"])
box("Wall_Rear", (0, -hl - T / 2, H / 2), (W, T, H), M["plaster"]); box("Wall_Stage", (0, hl + T / 2, H / 2), (W, T, H), M["plaster"])
# ---- stage, truss, podium, conductor
sx0, sx1 = P["stage"]["x"]; top = P["stage"]["top"]; sy1 = hl; sy0 = hl - (P["stage"]["z"][1] - P["stage"]["z"][0])
box("Stage_Platform", ((sx0 + sx1) / 2, (sy0 + sy1) / 2, top / 2), (sx1 - sx0, sy1 - sy0, top), M["floor"])
box("Truss_Stage", (0, sy0 + 2.2, 9.4), (18, 0.35, 0.35), M["black"])
box("Conductor_Podium", (0, sy0 + 3.2, top + 0.15), (1.4, 1.4, 0.3), M["wood"])
cb = bmesh.new(); box_bm(cb, (0, 0, 0.45), (0.3, 0.2, 0.9)); box_bm(cb, (0, 0, 1.15), (0.5, 0.26, 0.6)); box_bm(cb, (0, 0, 1.62), (0.22, 0.22, 0.26)); obj("Conductor_Body", cb, M["skin"], root, (0, sy0 + 3.2, top + 0.3))
box("Conductor_Arm", (0.37, sy0 + 3.2, top + 0.3 + 1.2), (0.14, 0.14, 0.62), M["skin"], root, pivot=(0.3, sy0 + 3.2, top + 0.3 + 1.42))   # pivot at the shoulder
# ---- seating: per-seat cushion + back, merged per block
SEAT_W, ROW = 0.55, 1.05
def seats(name, x0, x1, y_first, rows, z_of_row, material):
    bm = bmesh.new(); n = int((x1 - x0) / SEAT_W); count = 0
    for r in range(rows):
        y = y_first - r * ROW; z = z_of_row(r); box_bm(bm, ((x0 + x1) / 2, y, z + 0.45), (n * SEAT_W, 0.5, 0.12))   # one cushion bar per row
        for k in range(n):
            x = x0 + SEAT_W * (k + 0.5); box_bm(bm, (x, y - 0.27, z + 0.78), (SEAT_W * 0.88, 0.1, 0.55)); count += 1
    return obj(name, bm, material), count
rows_s = 21
sc, n1 = seats("Seats_Center", -3.3, 3.3, 6.0, rows_s, lambda r: 0.0, M["velvet"]); sl, n2 = seats("Seats_Left", -11.0, -4.4, 6.0, rows_s, lambda r: 0.0, M["velvet"]); sr, n3 = seats("Seats_Right", 4.4, 11.0, 6.0, rows_s, lambda r: 0.0, M["velvet"])
# ---- balcony: deck over the rear stalls, front rail, columns, raked seats
by0, by1 = -hl, -hl + 12; bz = P["balcony"]["deckY"]
box("Balcony_Deck", (0, (by0 + by1) / 2, bz - 0.2), (W - 0.4, by1 - by0, 0.4), M["plaster"]); box("Balcony_Front", (0, by1 - 0.1, bz + 0.5), (W - 0.4, 0.2, 1.0), M["brass"])
cbm = bmesh.new()
for x in (-10, -3.3, 3.3, 10): box_bm(cbm, (x, by1 - 0.4, bz / 2), (0.5, 0.5, bz))
obj("Balcony_Columns", cbm, M["plaster"])
rb = P["balcony"]["seatRows"]; sb, n4 = seats("Seats_Balcony", -10.4, 10.4, by1 - 1.4, rb, lambda r: bz + 0.12 * r, M["velvet"])
# ---- 20 wall panels, pivot at the panel centre on the wall surface
PANEL_H, PANEL_Z = 6.0, 3.0
for side, sgn in (("L", -1), ("R", 1)):
    for i in range(8):
        y = -hl + 2.4 + i * 4.5
        box(f"Panel_{side}_{i:02d}", (sgn * (hw - 0.14), y, PANEL_Z + PANEL_H / 2), (0.28, 3.6, PANEL_H), M["wood"])
for i in range(4): box(f"Panel_Rear_{i:02d}", (-9 + i * 6.0, -hl + 0.14, PANEL_Z + PANEL_H / 2), (4.8, 0.28, PANEL_H), M["wood"])
# ---- ceiling reflector cloud: 2 rows x 3, centred on x = 0, over the stage lip and front stalls
for r in range(2):
    for c in range(3):
        i = r * 3 + c; box(f"Reflector_{i:02d}", ((c - 1) * 5.4, 12.8 - r * 6.6, 9.0), (5.2, 6.4, 0.14), M["wood"])
# ---- speaker units: parent pivot at the hang point, children are the elements
def unit(name, x, y, z, n, sz=(0.6, 0.5, 0.34), drop=0.36):
    e = empty(name, (x, y, z))
    for k in range(n): box(f"{name}_{k:02d}", (x, y, z - 0.25 - k * drop), sz, M["black"], e, pivot=(x, y, z - 0.25 - k * drop)).location = (0, 0, -0.25 - k * drop)
    return e
unit("SpeakerArray_L", -9.4, hl - 0.8, 11.0, 6); unit("SpeakerArray_R", 9.4, hl - 0.8, 11.0, 6); unit("Speaker_Fill_L", -5.0, sy0 - 0.3, top + 0.3, 1, (0.5, 0.4, 0.4)); unit("Speaker_Fill_R", 5.0, sy0 - 0.3, top + 0.3, 1, (0.5, 0.4, 0.4))
# ---- stage lights on the truss
for i in range(6):
    x = -7.5 + i * 3.0; lm = bmesh.new(); box_bm(lm, (0, 0, 0), (0.5, 0.5, 0.6)); obj(f"Light_{i:02d}", lm, M["lamp"], root, (x, sy0 + 2.2, 9.0))
# ---- analysis proxy (low poly, never drawn)
px = bmesh.new(); box_bm(px, (0, 0, H / 2), (W, L, H)); pr = obj("Proxy_Hall", px, M["black"])
# ---- measure and write analysis.json in glTF axes
def gl(v): return [round(v[0], 3), round(v[2], 3), round(-v[1], 3)]
def bounds(o): 
    ws = [o.matrix_world @ v.co for v in o.data.vertices]; lo = [min(w[i] for w in ws) for i in range(3)]; hi = [max(w[i] for w in ws) for i in range(3)]; a, b = gl(lo), gl(hi); return [[min(a[i], b[i]) for i in range(3)], [max(a[i], b[i]) for i in range(3)]]
bpy.context.view_layer.update()
A = {"hall": {"w": W, "l": L, "h": H}, "stage": {"x": [sx0, sx1], "z": [-sy1, -sy0], "top": top}, "balcony": {"deckY": bz, "z": [-by1, -by0], "rows": rb},
     "seats": {"center": n1, "left": n2, "right": n3, "balcony": n4, "total": n1 + n2 + n3 + n4, "rowPitch": ROW},
     "blocks": {k: bounds(o) for k, o in (("center", sc), ("left", sl), ("right", sr), ("balcony", sb))},
     "reflectors": {"y": 9.0, "x": [-8.0, 8.0], "z": [-16.0, -3.0]},
     "hang": {"SpeakerArray_L": gl((-9.4, hl - 0.8, 11.0)), "SpeakerArray_R": gl((9.4, hl - 0.8, 11.0)), "Speaker_Fill_L": gl((-5.0, sy0 - 0.3, top + 0.3)), "Speaker_Fill_R": gl((5.0, sy0 - 0.3, top + 0.3))},
     "conductor": gl((0, sy0 + 3.2, top + 0.3))}
json.dump(A, open(os.path.join(HERE, "exports", "analysis.json"), "w"), indent=1)
# ---- poster: from the rear balcony height toward the stage
for o in bpy.data.objects:
    if o.name == "Proxy_Hall": o.hide_render = True
w = bpy.data.worlds.new("W"); scene.world = w; w.use_nodes = True; w.node_tree.nodes["Background"].inputs[0].default_value = (0.01, 0.01, 0.012, 1)
def light(kind, loc, energy, color=(1, 1, 1), size=1.0):
    d = bpy.data.lights.new("L", kind); d.energy = energy; d.color = color
    if kind == "AREA": d.size = size
    o = bpy.data.objects.new("L", d); scene.collection.objects.link(o); o.location = loc; return o
light("AREA", (0, 8, 12.5), 9000, (1.0, 0.72, 0.4), 12); light("AREA", (0, -4, 12.5), 5000, (0.6, 0.75, 1.0), 14)
bpy.ops.object.camera_add(location=(0, -hl + 3, 3.4)); cam = bpy.context.active_object; scene.camera = cam; cam.data.lens = 22
cam.rotation_euler = (Vector((0, hl - 6, 2.6)) - cam.location).to_track_quat("-Z", "Y").to_euler()
scene.render.engine = "BLENDER_EEVEE_NEXT"; scene.render.resolution_x, scene.render.resolution_y = 1280, 720; scene.render.filepath = os.path.join(HERE, "renders", "poster.png")
bpy.ops.object.select_all(action="DESELECT")
for o in bpy.data.objects:
    if o.type in ("MESH", "EMPTY"): o.select_set(True)
for o in bpy.data.objects:
    if o.type == "LIGHT" or o.type == "CAMERA": o.select_set(False)
bpy.context.view_layer.objects.active = root
bpy.ops.export_scene.gltf(filepath=os.path.join(HERE, "exports", "hall.glb"), export_format="GLB", use_selection=True, export_apply=True, export_yup=True, export_cameras=False, export_lights=False)
tris = sum(len(p.vertices) - 2 for o in bpy.data.objects if o.type == "MESH" for p in o.data.polygons)
print("hall.glb", os.path.getsize(os.path.join(HERE, "exports", "hall.glb")), "bytes", tris, "tris", A["seats"])
try: bpy.ops.render.render(write_still=True)
except Exception as e: print("poster failed", e)
