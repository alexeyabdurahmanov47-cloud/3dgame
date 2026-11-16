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
    bpy.ops.export_scene.gltf(filepath=path, export_format='GLB', export_animations=True,
                              export_animation_mode='ACTIONS', export_apply=True, export_yup=True,
                              export_force_sampling=True, export_frame_step=1)
