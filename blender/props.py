# Окружение READ&PRACTICE — генерируется в Blender 5.2 (bpy) → public/models/props.glb
# Каждый объект — отдельный узел с точкой опоры в центре основания; «лицевая» сторона смотрит в −Y
# (в Three.js это +Z). Материалы с именами Paint/Wall/Leaves/Wood и т.п. можно перекрасить в игре.
import sys, os, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bpy
from common import reset, material, hexc

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'public', 'models', 'props.glb')
reset()
C = bpy.context

M = {
    'Bark': material('Bark', hexc('#8d5524'), 0.9),
    'Leaves': material('Leaves', hexc('#3cb371'), 0.8),
    'Pine': material('Pine', hexc('#1e8449'), 0.8),
    'Wood': material('Wood', hexc('#c0763b'), 0.7),
    'Metal': material('Metal', hexc('#4a4a4a'), 0.4, 0.6),
    'Steel': material('Steel', hexc('#b2bec3'), 0.35, 0.5),
    'Bulb': material('Bulb', hexc('#fff7d6'), 0.3, emit=hexc('#ffe9a8')),
    'Paint': material('Paint', hexc('#ff6b6b'), 0.35, 0.2),
    'Glass': material('Glass', hexc('#bfe9ff'), 0.1),
    'Tire': material('Tire', hexc('#2d3436'), 0.9),
    'Hub': material('Hub', hexc('#dfe6e9'), 0.3, 0.5),
    'Head': material('Head', hexc('#fffbd0'), 0.2, emit=hexc('#fff3a0')),
    'Tail': material('Tail', hexc('#ff3b30'), 0.3, emit=hexc('#aa0000')),
    'Plate': material('Plate', hexc('#ffffff'), 0.5),
    'Top': material('Top', hexc('#e8c18f'), 0.6),
    'Seat': material('Seat', hexc('#3498db'), 0.6),
    'Fabric': material('Fabric', hexc('#6c5ce7'), 0.9),
    'Cushion': material('Cushion', hexc('#5f4dd6'), 0.9),
    'Sheet': material('Sheet', hexc('#ffffff'), 0.9),
    'Blanket': material('Blanket', hexc('#6c5ce7'), 0.9),
    'White': material('White', hexc('#f5f6fa'), 0.4),
    'Screen': material('Screen', hexc('#0984e3'), 0.2, emit=hexc('#05427a')),
    'Stone': material('Stone', hexc('#b2bec3'), 0.8),
    'Water': material('Water', hexc('#74b9ff'), 0.1, emit=hexc('#1d5e9a')),
    'Wall': material('Wall', hexc('#ff9f8f'), 0.85),
    'Trim': material('Trim', hexc('#ffffff'), 0.6),
    'Window': material('Window', hexc('#9ad8ff'), 0.15, emit=hexc('#2a5f80')),
    'Lit': material('Lit', hexc('#fff3b0'), 0.3, emit=hexc('#c9b75a')),
    'Roof': material('Roof', hexc('#c0392b'), 0.8),
    'Door': material('Door', hexc('#a0522d'), 0.6),
    'Base': material('Base', hexc('#7f8c8d'), 0.9),
}

def prim(objs, kind, size, loc, mat, rot=(0, 0, 0), bevel=0.0, smooth=False, segs=10, rings=6, r2=0.0):
    if kind == 'cube': bpy.ops.mesh.primitive_cube_add(size=1, location=loc, rotation=rot)
    elif kind == 'cyl': bpy.ops.mesh.primitive_cylinder_add(vertices=segs, radius=1, depth=1, location=loc, rotation=rot)
    elif kind == 'cone': bpy.ops.mesh.primitive_cone_add(vertices=segs, radius1=1, radius2=r2, depth=1, location=loc, rotation=rot)
    elif kind == 'ico': bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1, radius=1, location=loc, rotation=rot)
    elif kind == 'sphere': bpy.ops.mesh.primitive_uv_sphere_add(segments=segs, ring_count=rings, radius=1, location=loc, rotation=rot)
    elif kind == 'torus': bpy.ops.mesh.primitive_torus_add(major_radius=1, minor_radius=r2 or 0.1, major_segments=segs, minor_segments=6, location=loc, rotation=rot)
    o = C.active_object
    o.scale = size
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    if bevel:
        mod = o.modifiers.new('bev', 'BEVEL'); mod.width = bevel; mod.segments = 2
        bpy.ops.object.modifier_apply(modifier='bev')
    o.data.materials.append(mat)
    for p in o.data.polygons: p.use_smooth = smooth
    objs.append(o)
    return o

def finish(objs, name):
    bpy.ops.object.select_all(action='DESELECT')
    for o in objs: o.select_set(True)
    C.view_layer.objects.active = objs[0]
    bpy.ops.object.join()
    o = C.active_object
    C.scene.cursor.location = (0, 0, 0)
    bpy.ops.object.origin_set(type='ORIGIN_CURSOR')
    o.name = name; o.data.name = name
    return o

# ---------- природа ----------
p = []
prim(p, 'cone', (0.2, 0.2, 1.5), (0, 0, 0.75), M['Bark'], segs=7, r2=0.12)
for (x, y, z, r) in [(0, 0, 2.15, 0.95), (0.45, 0.2, 1.75, 0.65), (-0.4, -0.25, 1.8, 0.6), (0.1, -0.35, 2.55, 0.55)]:
    prim(p, 'ico', (r, r, r * 0.92), (x, y, z), M['Leaves'], rot=(x, y, z))
finish(p, 'tree_round')

p = []
prim(p, 'cyl', (0.14, 0.14, 0.9), (0, 0, 0.45), M['Bark'], segs=7)
for i in range(4):
    prim(p, 'cone', (1.35 - i * 0.28, 1.35 - i * 0.28, 1.1), (0, 0, 1.25 + i * 0.62), M['Pine'], segs=8)
finish(p, 'tree_pine')

p = []
for (x, y, z, r) in [(0, 0, 0.35, 0.55), (0.4, 0.1, 0.28, 0.4), (-0.35, -0.15, 0.3, 0.42), (0.05, -0.3, 0.25, 0.35)]:
    prim(p, 'ico', (r, r, r * 0.8), (x, y, z), M['Leaves'], rot=(y, x, z))
finish(p, 'bush')

# ---------- улица ----------
p = []
for i in range(3):
    prim(p, 'cube', (1.8, 0.14, 0.05), (0, -0.16 + i * 0.16, 0.45), M['Wood'], bevel=0.015)
for i in range(2):
    prim(p, 'cube', (1.8, 0.05, 0.12), (0, 0.27, 0.62 + i * 0.16), M['Wood'], rot=(0.2, 0, 0), bevel=0.015)
for x in (-0.75, 0.75):
    prim(p, 'cube', (0.06, 0.5, 0.06), (x, 0.02, 0.4), M['Metal'])
    prim(p, 'cube', (0.06, 0.06, 0.42), (x, -0.2, 0.21), M['Metal'])
    prim(p, 'cube', (0.06, 0.06, 0.82), (x, 0.24, 0.41), M['Metal'], rot=(0.2, 0, 0))
finish(p, 'bench')

p = []
prim(p, 'cyl', (0.12, 0.12, 0.3), (0, 0, 0.15), M['Metal'], segs=8)
prim(p, 'cyl', (0.06, 0.06, 3.4), (0, 0, 1.85), M['Metal'], segs=8)
prim(p, 'torus', (0.1, 0.1, 0.1), (0, 0, 3.5), M['Metal'], segs=10, r2=0.25)
prim(p, 'cyl', (0.17, 0.17, 0.08), (0, 0, 3.62), M['Metal'], segs=8)
prim(p, 'sphere', (0.2, 0.2, 0.22), (0, 0, 3.42), M['Bulb'], segs=10, rings=6, smooth=True)
prim(p, 'cone', (0.3, 0.3, 0.18), (0, 0, 3.72), M['Metal'], segs=8)
finish(p, 'lamp')

p = []
prim(p, 'cyl', (3.2, 3.2, 0.6), (0, 0, 0.3), M['Stone'], segs=16)
prim(p, 'cyl', (2.9, 2.9, 0.05), (0, 0, 0.6), M['Water'], segs=16)
prim(p, 'cyl', (0.35, 0.35, 1.6), (0, 0, 1.2), M['Stone'], segs=10)
prim(p, 'cyl', (1.1, 1.1, 0.2), (0, 0, 2.0), M['Stone'], segs=14)
prim(p, 'cyl', (0.95, 0.95, 0.04), (0, 0, 2.11), M['Water'], segs=14)
prim(p, 'sphere', (0.25, 0.25, 0.25), (0, 0, 2.35), M['Stone'], segs=10, rings=6, smooth=True)
finish(p, 'fountain')

# ---------- машина (длина вдоль X, перед в +X) ----------
p = []
prim(p, 'cube', (4.0, 1.85, 0.62), (0, 0, 0.72), M['Paint'], bevel=0.18)
prim(p, 'cube', (2.2, 1.7, 0.62), (-0.25, 0, 1.3), M['Glass'], bevel=0.14)
prim(p, 'cube', (2.25, 1.74, 0.08), (-0.25, 0, 1.62), M['Paint'], bevel=0.04)
for x in (0.83, -1.33):
    prim(p, 'cube', (0.1, 1.72, 0.6), (x, 0, 1.3), M['Paint'], bevel=0.03)
prim(p, 'cube', (0.06, 1.3, 0.16), (2.0, 0, 0.8), M['Steel'])
for y in (0.6, -0.6):
    prim(p, 'cube', (0.06, 0.32, 0.14), (2.0, y, 0.86), M['Head'], bevel=0.02)
    prim(p, 'cube', (0.06, 0.3, 0.12), (-2.0, y, 0.88), M['Tail'], bevel=0.02)
prim(p, 'cube', (0.08, 1.9, 0.14), (2.02, 0, 0.5), M['Tire'], bevel=0.03)
prim(p, 'cube', (0.08, 1.9, 0.14), (-2.02, 0, 0.5), M['Tire'], bevel=0.03)
prim(p, 'cube', (0.04, 0.4, 0.12), (-2.05, 0, 0.66), M['Plate'])
for x in (1.3, -1.3):
    for y in (0.86, -0.86):
        prim(p, 'cyl', (0.38, 0.38, 0.26), (x, y, 0.38), M['Tire'], rot=(math.pi / 2, 0, 0), segs=14, smooth=True)
        prim(p, 'cyl', (0.2, 0.2, 0.28), (x, y, 0.38), M['Hub'], rot=(math.pi / 2, 0, 0), segs=10)
finish(p, 'car')

# ---------- школьная мебель ----------
p = []
prim(p, 'cube', (1.3, 0.62, 0.05), (0, 0, 0.74), M['Top'], bevel=0.015)
for x in (-0.58, 0.58):
    prim(p, 'cube', (0.05, 0.5, 0.05), (x, 0, 0.04), M['Steel'])
    prim(p, 'cube', (0.05, 0.05, 0.7), (x, 0, 0.37), M['Steel'])
prim(p, 'cube', (1.1, 0.4, 0.03), (0, 0.05, 0.52), M['Steel'])
finish(p, 'desk')

p = []
prim(p, 'cube', (0.44, 0.42, 0.05), (0, 0, 0.44), M['Seat'], bevel=0.02)
prim(p, 'cube', (0.44, 0.04, 0.32), (0, 0.2, 0.68), M['Seat'], bevel=0.015)
for x in (-0.18, 0.18):
    for y in (-0.17, 0.17):
        prim(p, 'cube', (0.03, 0.03, 0.44), (x, y, 0.22), M['Steel'])
    prim(p, 'cube', (0.03, 0.03, 0.3), (x, 0.19, 0.6), M['Steel'])
finish(p, 'chair')

p = []
prim(p, 'cube', (1.7, 0.8, 0.06), (0, 0, 0.77), M['Wood'], bevel=0.02)
prim(p, 'cube', (0.5, 0.72, 0.72), (0.55, 0, 0.37), M['Wood'], bevel=0.02)
for i in range(3):
    prim(p, 'cube', (0.42, 0.02, 0.16), (0.55, -0.37, 0.15 + i * 0.22), M['Top'])
    prim(p, 'cube', (0.08, 0.03, 0.03), (0.55, -0.39, 0.2 + i * 0.22), M['Steel'])
for x, y in ((-0.78, -0.33), (-0.78, 0.33)):
    prim(p, 'cube', (0.06, 0.06, 0.74), (x, y, 0.37), M['Wood'])
prim(p, 'cube', (0.4, 0.3, 0.05), (-0.4, 0, 0.82), M['Fabric'])
finish(p, 'teacher_desk')

# ---------- домашняя мебель ----------
p = []
prim(p, 'cube', (2.2, 3.2, 0.3), (0, 0, 0.25), M['Wood'], bevel=0.04)
prim(p, 'cube', (2.0, 3.0, 0.25), (0, 0, 0.55), M['Sheet'], bevel=0.06)
prim(p, 'cube', (2.06, 2.0, 0.08), (0, 0.55, 0.7), M['Blanket'], bevel=0.03)
prim(p, 'cube', (1.2, 0.5, 0.18), (0, -1.15, 0.76), M['Sheet'], bevel=0.08)
prim(p, 'cube', (2.2, 0.12, 0.9), (0, -1.6, 0.45), M['Wood'], bevel=0.04)
for x in (-1.0, 1.0):
    for y in (-1.5, 1.5):
        prim(p, 'cube', (0.1, 0.1, 0.12), (x, y, 0.06), M['Wood'])
finish(p, 'bed')

p = []
prim(p, 'cube', (3.0, 1.1, 0.4), (0, 0, 0.3), M['Fabric'], bevel=0.08)
prim(p, 'cube', (3.0, 0.3, 0.7), (0, 0.42, 0.65), M['Cushion'], bevel=0.1)
for x in (-1.4, 1.4):
    prim(p, 'cube', (0.26, 1.1, 0.6), (x, 0, 0.45), M['Cushion'], bevel=0.1)
for x in (-0.68, 0.68):
    prim(p, 'cube', (1.3, 0.85, 0.16), (x, -0.08, 0.55), M['Fabric'], bevel=0.06)
for x in (-1.35, 1.35):
    for y in (-0.45, 0.45):
        prim(p, 'cyl', (0.05, 0.05, 0.1), (x, y, 0.05), M['Wood'], segs=6)
finish(p, 'sofa')

p = []
prim(p, 'cube', (0.9, 2.0, 2.4), (0, 0, 1.2), M['Wood'], bevel=0.03)
prim(p, 'cube', (0.03, 0.02, 2.2), (-0.45, 0, 1.2), M['Bark'])
for y in (0.3, -0.3):
    prim(p, 'cube', (0.04, 0.06, 0.2), (-0.47, y, 1.25), M['Steel'], bevel=0.01)
prim(p, 'cube', (0.95, 2.06, 0.1), (0, 0, 2.45), M['Bark'], bevel=0.02)
finish(p, 'wardrobe')

p = []
prim(p, 'cube', (1.0, 1.0, 2.1), (0, 0, 1.05), M['White'], bevel=0.06)
prim(p, 'cube', (0.02, 0.95, 0.02), (0, -0.505, 1.35), M['Steel'])
for z in (0.9, 1.8):
    prim(p, 'cube', (0.06, 0.06, 0.4), (0.38, -0.53, z), M['Steel'], bevel=0.01)
finish(p, 'fridge')

p = []
prim(p, 'cube', (1.8, 0.1, 1.0), (0, 0, 1.4), M['Tire'], bevel=0.03)
prim(p, 'cube', (1.68, 0.02, 0.9), (0, -0.055, 1.4), M['Screen'])
prim(p, 'cube', (2.0, 0.5, 0.5), (0, 0.05, 0.25), M['Wood'], bevel=0.03)
prim(p, 'cube', (0.4, 0.2, 0.1), (0, 0.02, 0.85), M['Tire'])
prim(p, 'cube', (0.06, 0.06, 0.32), (0, 0.02, 1.0), M['Tire'])
finish(p, 'tv')

# ---------- здания ----------
def building(name, w, d, h, door=True, roof=True, balconies=True, lit=0.25, seed=1):
    import random
    rnd = random.Random(seed)
    p = []
    prim(p, 'cube', (w + 0.4, d + 0.4, 0.4), (0, 0, 0.2), M['Base'])
    prim(p, 'cube', (w, d, h), (0, 0, h / 2), M['Wall'])
    floors = max(1, int(h // 3))
    cols = max(1, int(w // 3))
    for f in range(floors):
        z = f * (h / floors) + 1.5
        prim(p, 'cube', (w + 0.08, d + 0.08, 0.12), (0, 0, f * (h / floors) + 0.06 if f else 0.42), M['Trim'])
        for c in range(cols):
            x = -w / 2 + (c + 0.5) * (w / cols)
            if door and f == 0 and abs(x) < w / cols * 0.6: continue
            for side in (-1, 1):
                y = side * (d / 2 + 0.02)
                prim(p, 'cube', (1.25, 0.08, 1.45), (x, y, z), M['Trim'])
                prim(p, 'cube', (1.05, 0.1, 1.25), (x, y + side * 0.01, z), M['Lit'] if rnd.random() < lit else M['Window'])
                prim(p, 'cube', (0.06, 0.12, 1.25), (x, y + side * 0.02, z), M['Trim'])
                if balconies and f > 0 and side == -1 and (c + f) % 3 == 0:
                    prim(p, 'cube', (1.6, 0.7, 0.1), (x, y - 0.35, z - 0.72), M['Trim'])
                    prim(p, 'cube', (1.6, 0.05, 0.6), (x, y - 0.7, z - 0.42), M['Steel'])
        rows = max(1, int(d // 3))
        for r in range(rows):
            y = -d / 2 + (r + 0.5) * (d / rows)
            for side in (-1, 1):
                x = side * (w / 2 + 0.02)
                prim(p, 'cube', (0.08, 1.25, 1.45), (x, y, z), M['Trim'])
                prim(p, 'cube', (0.1, 1.05, 1.25), (x + side * 0.01, y, z), M['Window'])
    prim(p, 'cube', (w + 0.3, d + 0.3, 0.3), (0, 0, h + 0.15), M['Trim'])
    if roof:
        prim(p, 'cone', (max(w, d) * 0.72, max(w, d) * 0.72, 2.2), (0, 0, h + 1.4), M['Roof'], rot=(0, 0, math.pi / 4), segs=4)
        o = p[-1]; o.scale = (w / max(w, d), d / max(w, d), 1)
        C.view_layer.objects.active = o
        bpy.ops.object.select_all(action='DESELECT'); o.select_set(True)
        bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    else:
        for (x, y) in ((-w / 4, d / 4), (w / 5, -d / 5)):
            prim(p, 'cube', (2, 2, 1.4), (x, y, h + 0.9), M['Base'])
    if door:
        prim(p, 'cube', (2.0, 0.2, 2.5), (0, -d / 2 - 0.05, 1.45), M['Door'], bevel=0.04)
        prim(p, 'cube', (3.2, 1.6, 0.15), (0, -d / 2 - 0.8, 2.95), M['Roof'], bevel=0.04)
        prim(p, 'cube', (3.0, 1.5, 0.2), (0, -d / 2 - 0.75, 0.1), M['Base'])
    finish(p, name)

building('house_6', 10, 10, 6, door=False, seed=2)
building('house_9', 10, 10, 9, door=False, seed=3)
building('house_12', 10, 10, 12, door=False, seed=4)
building('home_block', 24, 16, 12, door=False, balconies=True, seed=5)
building('school', 44, 28, 34, door=False, roof=False, balconies=False, lit=0.35, seed=6)

export_path = os.path.abspath(OUT)
bpy.ops.export_scene.gltf(filepath=export_path, export_format='GLB', export_apply=True, export_yup=True, export_animations=False)
print('EXPORTED', export_path, [o.name for o in bpy.data.objects])
