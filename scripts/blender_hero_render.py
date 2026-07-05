# AETHER hero render - Neptun resort night scene from real OSM footprints.
import bpy, bmesh, json, math, random
from mathutils import Vector

ANCHOR = (28.59612, 43.86944)
FLOOR = 3.1

def local(lng, lat):
    kx = 111320 * math.cos(math.radians(ANCHOR[1])); ky = 110540
    return ((lng - ANCHOR[0]) * kx, (lat - ANCHOR[1]) * ky)

def h_for(props, fid):
    try:
        if props.get("height"): return float(str(props["height"]).split()[0])
    except Exception: pass
    try:
        if props.get("levels"): return int(props["levels"]) * FLOOR + 1.5
    except Exception: pass
    name = (props.get("name") or "").lower(); kind = (props.get("building") or "").lower()
    rnd = random.Random(fid).random()
    if "hotel" in name or kind == "hotel": return (7 + round(rnd * 4)) * FLOOR
    if "biseric" in name: return 11
    if "teatr" in name: return 9
    if kind == "apartments": return 5 * FLOOR
    return (2 + round(rnd * 2)) * FLOOR

bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene

def mat_body(name, col, emit_win=True, win_col=(1.0, 0.82, 0.55), lit=0.35, strength=3.0):
    m = bpy.data.materials.new(name); m.use_nodes = True
    nt = m.node_tree; nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    bsdf = nt.nodes.new("ShaderNodeBsdfPrincipled")
    bsdf.inputs["Base Color"].default_value = (col[0], col[1], col[2], 1)
    bsdf.inputs["Roughness"].default_value = 0.85
    if not emit_win:
        nt.links.new(bsdf.outputs[0], out.inputs[0]); return m
    geo = nt.nodes.new("ShaderNodeNewGeometry")
    sep = nt.nodes.new("ShaderNodeSeparateXYZ"); nt.links.new(geo.outputs["Position"], sep.inputs[0])
    def banding(input_socket, period, duty_lo, duty_hi):
        div = nt.nodes.new("ShaderNodeMath"); div.operation = "DIVIDE"; div.inputs[1].default_value = period
        nt.links.new(input_socket, div.inputs[0])
        frac = nt.nodes.new("ShaderNodeMath"); frac.operation = "FRACT"; nt.links.new(div.outputs[0], frac.inputs[0])
        gt = nt.nodes.new("ShaderNodeMath"); gt.operation = "GREATER_THAN"; gt.inputs[1].default_value = duty_lo
        nt.links.new(frac.outputs[0], gt.inputs[0])
        lt = nt.nodes.new("ShaderNodeMath"); lt.operation = "LESS_THAN"; lt.inputs[1].default_value = duty_hi
        nt.links.new(frac.outputs[0], lt.inputs[0])
        mul = nt.nodes.new("ShaderNodeMath"); mul.operation = "MULTIPLY"
        nt.links.new(gt.outputs[0], mul.inputs[0]); nt.links.new(lt.outputs[0], mul.inputs[1])
        return mul.outputs[0]
    zb = banding(sep.outputs["Z"], FLOOR, 0.32, 0.68)
    xb = banding(sep.outputs["X"], 2.4, 0.28, 0.75)
    yb = banding(sep.outputs["Y"], 2.4, 0.28, 0.75)
    xy = nt.nodes.new("ShaderNodeMath"); xy.operation = "MAXIMUM"
    nt.links.new(xb, xy.inputs[0]); nt.links.new(yb, xy.inputs[1])
    grid = nt.nodes.new("ShaderNodeMath"); grid.operation = "MULTIPLY"
    nt.links.new(zb, grid.inputs[0]); nt.links.new(xy.outputs[0], grid.inputs[1])
    noise = nt.nodes.new("ShaderNodeTexWhiteNoise"); noise.noise_dimensions = "3D"
    snap = nt.nodes.new("ShaderNodeVectorMath"); snap.operation = "SNAP"
    snap.inputs[1].default_value = (2.4, 2.4, FLOOR)
    nt.links.new(geo.outputs["Position"], snap.inputs[0])
    nt.links.new(snap.outputs[0], noise.inputs["Vector"])
    litgate = nt.nodes.new("ShaderNodeMath"); litgate.operation = "GREATER_THAN"; litgate.inputs[1].default_value = 1.0 - lit
    nt.links.new(noise.outputs["Value"], litgate.inputs[0])
    fac = nt.nodes.new("ShaderNodeMath"); fac.operation = "MULTIPLY"
    nt.links.new(grid.outputs[0], fac.inputs[0]); nt.links.new(litgate.outputs[0], fac.inputs[1])
    nsep = nt.nodes.new("ShaderNodeSeparateXYZ"); nt.links.new(geo.outputs["True Normal"], nsep.inputs[0])
    nabs = nt.nodes.new("ShaderNodeMath"); nabs.operation = "ABSOLUTE"; nt.links.new(nsep.outputs["Z"], nabs.inputs[0])
    wall = nt.nodes.new("ShaderNodeMath"); wall.operation = "SUBTRACT"; wall.inputs[0].default_value = 1.0
    nt.links.new(nabs.outputs[0], wall.inputs[1])
    fac2 = nt.nodes.new("ShaderNodeMath"); fac2.operation = "MULTIPLY"
    nt.links.new(fac.outputs[0], fac2.inputs[0]); nt.links.new(wall.outputs[0], fac2.inputs[1])
    emit = nt.nodes.new("ShaderNodeEmission")
    emit.inputs["Color"].default_value = (win_col[0], win_col[1], win_col[2], 1)
    emit.inputs["Strength"].default_value = strength
    mix = nt.nodes.new("ShaderNodeMixShader")
    nt.links.new(fac2.outputs[0], mix.inputs["Fac"])
    nt.links.new(bsdf.outputs[0], mix.inputs[1]); nt.links.new(emit.outputs[0], mix.inputs[2])
    nt.links.new(mix.outputs[0], out.inputs[0])
    return m

BODY = mat_body("body", (0.028, 0.034, 0.048), True, (1.0, 0.80, 0.52), 0.44, 3.2)
HERO = mat_body("hero", (0.045, 0.06, 0.09), True, (0.55, 0.88, 0.96), 0.55, 4.5)
MUTE = mat_body("mute", (0.03, 0.035, 0.05), False)
gm = bpy.data.materials.new("ground"); gm.use_nodes = True
gm.node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value = (0.012, 0.015, 0.022, 1)
gm.node_tree.nodes["Principled BSDF"].inputs["Roughness"].default_value = 0.95

def pip(x, y, ring):
    inside = False; j = len(ring) - 1
    for i in range(len(ring)):
        xi, yi = ring[i]; xj, yj = ring[j]
        if (yi > y) != (yj > y) and x < (xj - xi) * (y - yi) / (yj - yi) + xi:
            inside = not inside
        j = i
    return inside

fc = json.load(open("neptun-osm.json"))
for f in fc["features"]:
    ring = [local(p[0], p[1]) for p in f["geometry"]["coordinates"][0]]
    if len(ring) > 1 and ring[0] == ring[-1]: ring = ring[:-1]
    if len(ring) < 3: continue
    hero = pip(0, 0, ring)
    props = f["properties"]
    h = h_for(props, f["id"])
    if hero: h = max(h, 9 * FLOOR)
    mesh = bpy.data.meshes.new("b%d" % f["id"]); obj = bpy.data.objects.new("b%d" % f["id"], mesh)
    sc.collection.objects.link(obj)
    bm = bmesh.new()
    verts = [bm.verts.new((x, y, 0)) for x, y in ring]
    try:
        face = bm.faces.new(verts)
    except ValueError:
        bm.free(); continue
    res = bmesh.ops.extrude_face_region(bm, geom=[face])
    up = [v for v in res["geom"] if isinstance(v, bmesh.types.BMVert)]
    bmesh.ops.translate(bm, vec=Vector((0, 0, h)), verts=up)
    bm.normal_update()
    bm.to_mesh(mesh); bm.free()
    name = (props.get("name") or "").lower(); kind = (props.get("building") or "").lower()
    is_hotel = hero or ("hotel" in name) or (kind == "hotel")
    obj.data.materials.append(HERO if hero else (BODY if is_hotel else MUTE))
    bv = obj.modifiers.new("bevel", "BEVEL"); bv.width = 0.6; bv.segments = 2

bpy.ops.mesh.primitive_plane_add(size=2600, location=(0, 0, -0.05))
bpy.context.object.data.materials.append(gm)

key = bpy.data.objects.new("key", bpy.data.lights.new("key", "SUN"))
key.data.energy = 1.6; key.data.color = (0.72, 0.82, 1.0)
key.rotation_euler = (math.radians(55), 0, math.radians(35))
sc.collection.objects.link(key)
fill = bpy.data.objects.new("fill", bpy.data.lights.new("fill", "SUN"))
fill.data.energy = 0.25; fill.data.color = (1.0, 0.85, 0.65)
fill.rotation_euler = (math.radians(70), 0, math.radians(-120))
sc.collection.objects.link(fill)

w = bpy.data.worlds.new("night"); sc.world = w; w.use_nodes = True
bg = w.node_tree.nodes["Background"]
bg.inputs[0].default_value = (0.004, 0.006, 0.012, 1); bg.inputs[1].default_value = 1.0

cam = bpy.data.objects.new("cam", bpy.data.cameras.new("cam"))
cam.location = (620, -640, 210)
cam.data.lens = 48
target = bpy.data.objects.new("target", None)
target.location = (60, -160, 20)
sc.collection.objects.link(target)
tr = cam.constraints.new("TRACK_TO")
tr.target = target; tr.track_axis = "TRACK_NEGATIVE_Z"; tr.up_axis = "UP_Y"
cam.data.dof.use_dof = True
cam.data.dof.focus_distance = 560
cam.data.dof.aperture_fstop = 2.6
sc.collection.objects.link(cam); sc.camera = cam

try:
    sc.render.engine = "BLENDER_EEVEE_NEXT"
except Exception:
    sc.render.engine = "BLENDER_EEVEE"
sc.render.resolution_x = 1920; sc.render.resolution_y = 1080
sc.render.image_settings.file_format = "JPEG"
sc.render.image_settings.quality = 88
sc.render.filepath = r"C:/Users/user/AppData/Local/Temp/claude/C--Users-user--claude/efbb2bda-178a-4d52-b577-18e2acbc6e98/scratchpad/neptun-hero.jpg"
bpy.ops.render.render(write_still=True)
print("RENDER_DONE")