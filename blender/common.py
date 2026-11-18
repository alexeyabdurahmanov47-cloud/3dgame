# Общие функции для генерации моделей в Blender 5.2 (bpy).
import bpy, bmesh, math
from mathutils import Vector, Matrix

def reset():
    _mats.clear()
    bpy.ops.wm.read_factory_settings(use_empty=True)
    sc = bpy.context.scene
    sc.render.fps = 30
    return sc

_mats = {}
def material(name, color, rough=0.75, metal=0.0, emit=None):
    if name in _mats: return _mats[name]
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes.get('Principled BSDF')
    b.inputs['Base Color'].default_value = (*color, 1)
    b.inputs['Roughness'].default_value = rough
    b.inputs['Metallic'].default_value = metal
    if emit:
        b.inputs['Emission Color'].default_value = (*emit, 1)
        b.inputs['Emission Strength'].default_value = 1.0
    _mats[name] = m
    return m

def hexc(h):
    h = h.lstrip('#')
    # sRGB → linear (Blender хранит линейные цвета)
    def lin(c):
        c = c / 255
        return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4
    return tuple(lin(int(h[i:i + 2], 16)) for i in (0, 2, 4))

def part(objs, kind, name, size, loc, mat, bone, rot=(0, 0, 0), smooth=False, segs=10, rings=6, bevel=0.0):
    """Создаёт примитив, назначает материал и вершинную группу кости."""
    if kind == 'cube':
        bpy.ops.mesh.primitive_cube_add(size=1, location=loc, rotation=rot)
        o = bpy.context.active_object
        o.scale = size
    elif kind == 'cyl':
        bpy.ops.mesh.primitive_cylinder_add(vertices=segs, radius=1, depth=1, location=loc, rotation=rot)
        o = bpy.context.active_object
        o.scale = size
    elif kind == 'sphere':
        bpy.ops.mesh.primitive_uv_sphere_add(segments=segs, ring_count=rings, radius=1, location=loc, rotation=rot)
        o = bpy.context.active_object
        o.scale = size
    elif kind == 'ico':
        bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2, radius=1, location=loc, rotation=rot)
        o = bpy.context.active_object
        o.scale = size
    elif kind == 'cone':
        bpy.ops.mesh.primitive_cone_add(vertices=segs, radius1=1, radius2=0, depth=1, location=loc, rotation=rot)
        o = bpy.context.active_object
        o.scale = size
    o.name = name
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    if bevel:
        mod = o.modifiers.new('bev', 'BEVEL'); mod.width = bevel; mod.segments = 2
        bpy.ops.object.modifier_apply(modifier='bev')
    o.data.materials.append(mat)
    for p in o.data.polygons: p.use_smooth = smooth
    if smooth and kind in ('cyl', 'cone', 'cube'):
        es = o.modifiers.new('es', 'EDGE_SPLIT'); es.split_angle = math.radians(48)
        bpy.context.view_layer.objects.active = o
        bpy.ops.object.modifier_apply(modifier='es')
    vg = o.vertex_groups.new(name=bone)
    vg.add(list(range(len(o.data.vertices))), 1.0, 'REPLACE')
    objs.append(o)
    return o

def join(objs, name):
    bpy.ops.object.select_all(action='DESELECT')
    for o in objs: o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    bpy.ops.object.join()
    o = bpy.context.active_object
    o.name = name
    o.data.name = name
    return o

def armature(name, bones):
    """bones: [(name, head, tail, parent)]"""
    bpy.ops.object.armature_add(enter_editmode=True, location=(0, 0, 0))
    arm = bpy.context.active_object
    arm.name = name
    eb = arm.data.edit_bones
    eb.remove(eb[0])
    for n, hd, tl, par in bones:
        b = eb.new(n)
        b.head = hd; b.tail = tl; b.roll = 0
        if par: b.parent = eb[par]; b.use_connect = False
    bpy.ops.object.mode_set(mode='OBJECT')
    return arm

def bind(mesh, arm):
    mesh.parent = arm
    m = mesh.modifiers.new('Armature', 'ARMATURE')
    m.object = arm

def new_action(arm, name):
    act = bpy.data.actions.new(name)
    act.use_fake_user = True
    if not arm.animation_data: arm.animation_data_create()
    arm.animation_data.action = act
    for pb in arm.pose.bones:
        pb.rotation_mode = 'XYZ'
        pb.rotation_euler = (0, 0, 0); pb.location = (0, 0, 0); pb.scale = (1, 1, 1)
    return act

def key(arm, frame, pose):
    """pose: {bone: dict(r=(x,y,z), l=(x,y,z), s=(x,y,z))}; ключуются все кости."""
    for pb in arm.pose.bones:
        p = pose.get(pb.name, {})
        pb.rotation_euler = p.get('r', (0, 0, 0))
        pb.location = p.get('l', (0, 0, 0))
        pb.scale = p.get('s', (1, 1, 1))
        pb.keyframe_insert('rotation_euler', frame=frame)
        pb.keyframe_insert('location', frame=frame)
        pb.keyframe_insert('scale', frame=frame)

def export(path):
    bpy.ops.export_scene.gltf(filepath=path, export_format='GLB', export_animations=True, export_vertex_color='ACTIVE',
                              export_animation_mode='ACTIONS', export_apply=True, export_yup=True,
                              export_force_sampling=True, export_frame_step=1)


def lathe(objs, name, rings, mat, segs=18, cap0=True, cap1=True, mats=None, band=None, shape=None):
    """Гладкая «трубка» вдоль цепочки колец — без стыков между частями тела.
    rings: [((x, y, z), rx, ry, {кость: вес, ...}), ...]. Веса плавно смешиваются между костями,
    поэтому локти, колени и талия сгибаются мягко, без вмятин и щелей."""
    import bmesh
    me = bpy.data.meshes.new(name)
    o = bpy.data.objects.new(name, me)
    bpy.context.collection.objects.link(o)
    bm = bmesh.new()
    pts = [Vector(r[0]) for r in rings]
    loops = []
    prev_u = None
    for i, (c, rx, ry, w) in enumerate(rings):
        a = pts[max(0, i - 1)]
        b = pts[min(len(pts) - 1, i + 1)]
        t = (b - a).normalized()
        ref = Vector((0, -1, 0)) if abs(t.y) < 0.9 else Vector((1, 0, 0))
        u = t.cross(ref).normalized()
        if prev_u is not None and u.dot(prev_u) < 0: u = -u
        prev_u = u
        v = t.cross(u).normalized()
        ring = []
        for k in range(segs):
            ang = k / segs * math.pi * 2
            # shape(i, угол, точка) — множитель радиуса: складки ткани, мышцы
            m = shape(i, ang, Vector(c)) if shape else 1.0
            ring.append(bm.verts.new(Vector(c) + u * (math.cos(ang) * rx * m) + v * (math.sin(ang) * ry * m)))
        loops.append(ring)
    for i in range(len(loops) - 1):
        for k in range(segs):
            bm.faces.new((loops[i][k], loops[i][(k + 1) % segs], loops[i + 1][(k + 1) % segs], loops[i + 1][k]))
    caps = []
    if cap0:
        p0 = pts[0] - (pts[1] - pts[0]).normalized() * min(rings[0][1], rings[0][2]) * 0.6
        pv = bm.verts.new(p0)
        for k in range(segs): bm.faces.new((loops[0][(k + 1) % segs], loops[0][k], pv))
        caps.append((pv, 0))
    if cap1:
        n = len(pts) - 1
        p1 = pts[n] + (pts[n] - pts[n - 1]).normalized() * min(rings[n][1], rings[n][2]) * 0.6
        pv = bm.verts.new(p1)
        for k in range(segs): bm.faces.new((loops[n][k], loops[n][(k + 1) % segs], pv))
        caps.append((pv, n))
    # UV-развёртка (для текстуры ткани) и полосы материалов
    uv = bm.loops.layers.uv.new('UVMap')
    nR = max(1, len(loops) - 1)
    for f in bm.faces:
        for l in f.loops:
            idx = l.vert.index if hasattr(l.vert, 'index') else 0
    bm.verts.index_update()
    for f in bm.faces:
        for l in f.loops:
            vi = l.vert.index
            if vi < len(loops) * segs:
                i, k = divmod(vi, segs)
                l[uv].uv = (k / segs * 2, i / nR * 2)
            else:
                l[uv].uv = (0.5, 0.0 if vi == len(loops) * segs else 1.0)
        if band:
            ring_i = min(l.vert.index // segs for l in f.loops if l.vert.index < len(loops) * segs) if any(l.vert.index < len(loops) * segs for l in f.loops) else 0
            f.material_index = band(ring_i)
    bm.normal_update()
    bm.to_mesh(me)
    bm.free()
    me.materials.append(mat)
    for extra in (mats or []): me.materials.append(extra)
    for p in me.polygons: p.use_smooth = True
    # нормали наружу
    bpy.context.view_layer.objects.active = o
    for ob in bpy.context.selected_objects: ob.select_set(False)
    o.select_set(True)
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.mesh.normals_make_consistent(inside=False)
    bpy.ops.object.mode_set(mode='OBJECT')
    # веса костей
    groups = {}
    def vg(bone):
        if bone not in groups: groups[bone] = o.vertex_groups.new(name=bone)
        return groups[bone]
    for i, ring in enumerate(loops):
        for bone, wt in rings[i][3].items():
            vg(bone).add([ring_v for ring_v in range(i * segs, i * segs + segs)], wt, 'REPLACE')
    base = len(loops) * segs
    for j, (pv, ri) in enumerate(caps):
        for bone, wt in rings[ri][3].items(): vg(bone).add([base + j], wt, 'REPLACE')
    objs.append(o)
    return o


def blend(a, b, t):
    """Веса для плавного перехода между костями a → b (t: 0..1)."""
    t = max(0.0, min(1.0, t))
    t = t * t * (3 - 2 * t)
    if t <= 0.001: return {a: 1.0}
    if t >= 0.999: return {b: 1.0}
    return {a: 1 - t, b: t}


def soften(o, levels=1):
    """Подразделение поверхности — убирает гранёность у шаров и цилиндров."""
    m = o.modifiers.new('sub', 'SUBSURF'); m.levels = levels; m.render_levels = levels
    bpy.context.view_layer.objects.active = o
    bpy.ops.object.modifier_apply(modifier='sub')
    for p in o.data.polygons: p.use_smooth = True


def bake_ao(objs, floor=0.5, samples=24):
    """Запекает ambient occlusion в цвета вершин (мягкие тени в глазницах, под носом, у шеи, под волосами).
    floor — насколько светлыми остаются самые тёмные места (0..1)."""
    sc = bpy.context.scene
    sc.render.engine = 'CYCLES'
    sc.cycles.device = 'CPU'
    sc.cycles.samples = samples
    sc.render.bake.target = 'VERTEX_COLORS'
    if not sc.world: sc.world = bpy.data.worlds.new('W')
    sc.world.light_settings.distance = 0.06  # только ближние складки и впадины — без пятен от соседних частей тела
    bpy.ops.object.select_all(action='DESELECT')
    for o in objs:
        if not o.data.color_attributes:
            o.data.color_attributes.new('Col', 'BYTE_COLOR', 'CORNER')
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    bpy.ops.object.bake(type='AO')
    for o in objs:
        for d in o.data.color_attributes[0].data:
            ao = d.color[0]
            k = floor + (1 - floor) * ao
            d.color = (k, k, k, 1.0)
