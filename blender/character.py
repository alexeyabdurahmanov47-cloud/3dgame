# Персонаж READ&PRACTICE — генерируется в Blender 5.2 (bpy) и экспортируется в public/models/character.glb
# Запуск: python blender/character.py   (нужен pip-пакет bpy==5.2.*)
# Персонаж смотрит в −Y (в glTF/Three.js это +Z). Части меша жёстко привязаны к костям.
# Материалы Skin/Body/Pants/Shoes/Hair перекрашиваются в игре под скин из магазина.
import sys, os, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bpy
from common import reset, material, hexc, part, join, armature, bind, new_action, key, export, lathe, blend, soften

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'public', 'models', 'character.glb')
reset()

M = {
    'Skin': material('Skin', hexc('#ffd3b0'), 0.6),
    'Body': material('Body', hexc('#3557c9'), 0.7),
    'Pants': material('Pants', hexc('#2b2f4a'), 0.8),
    'Shoes': material('Shoes', hexc('#222222'), 0.5),
    'Hair': material('Hair', hexc('#5b3a1e'), 0.55),
    'Eye': material('Eye', hexc('#1e1e2e'), 0.2),
    'EyeHL': material('EyeHL', hexc('#ffffff'), 0.2, emit=hexc('#ffffff')),
    'Mouth': material('Mouth', hexc('#c0392b'), 0.5),
    'Cheek': material('Cheek', hexc('#ff9a9e'), 0.7),
}

# ---------- скелет ----------
HIP = 0.58
bones = [
    ('hips', (0, 0, HIP), (0, 0, 0.72), None),
    ('spine', (0, 0, 0.72), (0, 0, 0.90), 'hips'),
    ('chest', (0, 0, 0.90), (0, 0, 1.12), 'spine'),
    ('neck', (0, 0, 1.12), (0, 0, 1.20), 'chest'),
    ('head', (0, 0, 1.20), (0, 0, 1.78), 'neck'),
]
for s, x in (('L', 1), ('R', -1)):
    bones += [
        (f'upperarm.{s}', (0.30 * x, 0, 1.08), (0.32 * x, 0, 0.86), 'chest'),
        (f'forearm.{s}', (0.32 * x, 0, 0.86), (0.33 * x, 0, 0.66), f'upperarm.{s}'),
        (f'hand.{s}', (0.33 * x, 0, 0.66), (0.33 * x, 0, 0.56), f'forearm.{s}'),
        (f'thigh.{s}', (0.11 * x, 0, HIP), (0.11 * x, 0, 0.32), 'hips'),
        (f'shin.{s}', (0.11 * x, 0, 0.32), (0.11 * x, 0, 0.07), f'thigh.{s}'),
        (f'foot.{s}', (0.11 * x, 0, 0.07), (0.11 * x, -0.13, 0.03), f'shin.{s}'),
    ]
arm = armature('Rig', bones)

# ---------- тело ----------
# Торс, руки и ноги — сплошные гладкие поверхности (lathe) с плавным смешиванием весов костей:
# никаких стыков, вмятин и «ямочек» на талии, плечах, локтях и коленях.
body = []
def torso_w(z):
    if z < 0.72: return {'hips': 1.0}
    if z < 0.9: return blend('hips', 'spine', (z - 0.72) / 0.18)
    if z < 1.02: return blend('spine', 'chest', (z - 0.9) / 0.12)
    if z < 1.13: return {'chest': 1.0}
    return blend('chest', 'neck', (z - 1.13) / 0.05)
# брюки (таз)
lathe(body, 'pelvis', [((0, 0.01, z), rx, ry, {'hips': 1.0}) for z, rx, ry in [
    (0.5, 0.12, 0.1), (0.54, 0.18, 0.135), (0.6, 0.198, 0.15), (0.67, 0.2, 0.155), (0.72, 0.195, 0.152)]], M['Pants'], segs=22)
# рубашка/кофта: от пояса до шеи
lathe(body, 'torso', [((0, 0, z), rx, ry, torso_w(z)) for z, rx, ry in [
    (0.64, 0.205, 0.16), (0.7, 0.212, 0.165), (0.78, 0.218, 0.168), (0.88, 0.228, 0.172), (0.97, 0.245, 0.18),
    (1.04, 0.258, 0.184), (1.09, 0.25, 0.178), (1.125, 0.2, 0.15), (1.15, 0.12, 0.095), (1.165, 0.075, 0.065)]], M['Body'], segs=24, cap0=False)
# шея
lathe(body, 'neck', [((0, 0, z), 0.062, 0.058, w) for z, w in [
    (1.12, {'chest': 1.0}), (1.17, blend('chest', 'neck', 0.6)), (1.22, {'neck': 1.0}), (1.27, blend('neck', 'head', 0.7))]], M['Skin'], segs=14)
for s, x in (('L', 1), ('R', -1)):
    ua, fa, hd = f'upperarm.{s}', f'forearm.{s}', f'hand.{s}'
    # рукав: плечо → локоть → запястье, локоть сгибается плавно
    lathe(body, f'arm.{s}', [((px * x, 0, pz), r, r * 0.95, w) for px, pz, r, w in [
        (0.27, 1.1, 0.074, {ua: 0.7, 'chest': 0.3}), (0.288, 1.02, 0.07, {ua: 1.0}), (0.302, 0.94, 0.064, {ua: 1.0}),
        (0.314, 0.88, 0.06, blend(ua, fa, 0.35)), (0.32, 0.86, 0.058, blend(ua, fa, 0.6)), (0.324, 0.82, 0.056, {fa: 1.0}),
        (0.33, 0.74, 0.053, {fa: 1.0}), (0.332, 0.675, 0.05, {fa: 1.0})]], M['Body'], segs=16)
    # ладонь и большой палец (гладкие)
    o = part(body, 'sphere', f'hand.{s}', (0.056, 0.048, 0.072), (0.332 * x, 0, 0.61), M['Skin'], hd, segs=14, rings=10, smooth=True)
    o = part(body, 'sphere', f'thumb.{s}', (0.022, 0.022, 0.034), (0.33 * x, -0.042, 0.628), M['Skin'], hd, segs=10, rings=6, smooth=True)
    th, sh = f'thigh.{s}', f'shin.{s}'
    # штанина: бедро → колено → голень
    lathe(body, f'leg.{s}', [((0.11 * x, 0.005, z), r, r * 0.95, w) for z, r, w in [
        (0.66, 0.092, {th: 1.0}), (0.56, 0.09, {th: 1.0}), (0.46, 0.083, {th: 1.0}), (0.37, 0.076, blend(th, sh, 0.25)),
        (0.32, 0.073, blend(th, sh, 0.55)), (0.27, 0.07, blend(th, sh, 0.85)), (0.2, 0.065, {sh: 1.0}), (0.12, 0.06, {sh: 1.0}), (0.085, 0.058, {sh: 1.0})]], M['Pants'], segs=16, cap0=False)
    # ботинок: гладкий, с подошвой
    o = part(body, 'sphere', f'shoe.{s}', (0.075, 0.15, 0.06), (0.11 * x, -0.05, 0.06), M['Shoes'], f'foot.{s}', segs=18, rings=10, smooth=True)
    part(body, 'cube', f'sole.{s}', (0.15, 0.29, 0.03), (0.11 * x, -0.05, 0.015), M['Shoes'], f'foot.{s}', bevel=0.012)
bodyM = join(body, 'Body')

# ---------- голова ----------
HC = 1.49  # центр головы
head = []
part(head, 'sphere', 'skull', (0.3, 0.29, 0.3), (0, 0, HC), M['Skin'], 'head', segs=36, rings=20, smooth=True)
for x in (1, -1):
    part(head, 'sphere', 'ear', (0.05, 0.035, 0.07), (0.295 * x, 0.0, HC), M['Skin'], 'head', segs=14, rings=10, smooth=True)
headM = join(head, 'Head')

face = []
for x in (1, -1):
    part(face, 'sphere', 'eye', (0.042, 0.03, 0.055), (0.1 * x, -0.262, HC + 0.03), M['Eye'], 'head', segs=16, rings=12, smooth=True)
    part(face, 'sphere', 'eyehl', (0.014, 0.01, 0.014), (0.1 * x + 0.014, -0.285, HC + 0.05), M['EyeHL'], 'head', segs=10, rings=6, smooth=True)
    part(face, 'cube', 'brow', (0.07, 0.015, 0.016), (0.1 * x, -0.27, HC + 0.105), M['Hair'], 'head', rot=(0, 0.12 * x, 0))
part(face, 'cube', 'mouth', (0.085, 0.02, 0.022), (0, -0.282, HC - 0.1), M['Mouth'], 'head', bevel=0.008)
part(face, 'sphere', 'nose', (0.03, 0.025, 0.025), (0, -0.295, HC - 0.03), M['Skin'], 'head', segs=14, rings=8, smooth=True)
faceM = join(face, 'Face')

hair = []
o = part(hair, 'sphere', 'cap', (0.335, 0.335, 0.33), (0, 0.012, HC + 0.035), M['Hair'], 'head', segs=36, rings=20, smooth=True)
# срезаем переднюю нижнюю часть шапки волос — открываем лицо
import bmesh
bm = bmesh.new(); bm.from_mesh(o.data)
W = lambda v: o.matrix_world @ v.co  # мировые координаты вершины
bmesh.ops.delete(bm, geom=[v for v in bm.verts if (W(v).z < HC + 0.1 and W(v).y < -0.16) or (W(v).z < HC - 0.06 and W(v).y < 0.0) or (W(v).z < HC - 0.16 and W(v).y < 0.14)], context='VERTS')
bm.to_mesh(o.data); bm.free()
for i, x in enumerate((-0.17, -0.06, 0.06, 0.17)):
    part(hair, 'sphere', f'tuft{i}', (0.085, 0.07, 0.07), (x, -0.255 + abs(x) * 0.25, HC + 0.17 - abs(x) * 0.15), M['Hair'], 'head', segs=16, rings=10, smooth=True)
part(hair, 'sphere', 'back', (0.31, 0.2, 0.26), (0, 0.13, HC - 0.04), M['Hair'], 'head', segs=24, rings=14, smooth=True)
hairM = join(hair, 'Hair')

for m in (bodyM, headM, faceM, hairM):
    bind(m, arm)

# ---------- анимации ----------
def R(x=0, y=0, z=0): return {'r': (x, y, z)}

def walk_pose(t, amp=1.0, run=False):
    """t: фаза 0..1 шага"""
    s = math.sin(t * 2 * math.pi)
    c = math.cos(t * 2 * math.pi)
    k = 0.75 * amp
    lean = 0.22 if run else 0.04
    knee = lambda ph: max(0.0, math.sin(ph)) * (1.3 if run else 0.8)
    bob = abs(c) * (0.05 if run else 0.03)
    return {
        'hips': {'r': (0, 0, s * 0.08), 'l': (0, bob, 0)},
        'spine': R(lean, 0, -s * 0.1),
        'chest': R(0, 0, -s * 0.06),
        'head': R(-lean * 0.6, 0, s * 0.05),
        'thigh.L': R(-s * k), 'thigh.R': R(s * k),
        'shin.L': R(knee(t * 2 * math.pi + 0.3)), 'shin.R': R(knee(t * 2 * math.pi + math.pi + 0.3)),
        'foot.L': R(s * 0.2), 'foot.R': R(-s * 0.2),
        'upperarm.L': R(s * k * 0.8, 0, -0.08), 'upperarm.R': R(-s * k * 0.8, 0, 0.08),
        'forearm.L': R(-(0.35 + (1.0 if run else 0.2) * max(0, -s))), 'forearm.R': R(-(0.35 + (1.0 if run else 0.2) * max(0, s))),
    }

def loop(name, frames, fn, step=2):
    new_action(arm, name)
    for f in range(0, frames + 1, step):
        key(arm, f + 1, fn(f / frames))

loop('Idle', 60, lambda t: {
    'spine': R(0.02 * math.sin(t * 2 * math.pi)),
    'chest': {'r': (0.015 * math.sin(t * 2 * math.pi), 0, 0), 's': (1 + 0.015 * math.sin(t * 2 * math.pi), 1, 1 + 0.015 * math.sin(t * 2 * math.pi))},
    'head': R(-0.03 * math.sin(t * 2 * math.pi + 1), 0.06 * math.sin(t * 2 * math.pi), 0),
    'upperarm.L': R(0.03 * math.sin(t * 2 * math.pi), 0, -0.1), 'upperarm.R': R(-0.03 * math.sin(t * 2 * math.pi), 0, 0.1),
    'forearm.L': R(-0.15), 'forearm.R': R(-0.15),
}, step=3)
loop('Walk', 30, lambda t: walk_pose(t), step=1)
loop('Run', 20, lambda t: walk_pose(t, 1.25, True), step=1)
loop('Jump', 20, lambda t: {
    'spine': R(-0.1), 'head': R(0.1),
    'thigh.L': R(-1.0), 'shin.L': R(1.4), 'thigh.R': R(0.2), 'shin.R': R(0.6),
    'upperarm.L': R(0, 0, -2.4 - 0.1 * math.sin(t * 2 * math.pi)), 'upperarm.R': R(0, 0, 2.4 + 0.1 * math.sin(t * 2 * math.pi)),
    'forearm.L': R(-0.3), 'forearm.R': R(-0.3),
}, step=5)
loop('Sit', 60, lambda t: {
    'hips': {'r': (0, 0, 0), 'l': (0, -0.07, 0)},
    'spine': R(-0.08 + 0.02 * math.sin(t * 2 * math.pi)),
    'head': R(0.12 + 0.03 * math.sin(t * 2 * math.pi + 1), 0.05 * math.sin(t * 2 * math.pi)),
    'thigh.L': R(-1.5), 'thigh.R': R(-1.5), 'shin.L': R(1.5), 'shin.R': R(1.5),
    'upperarm.L': R(-0.7, 0, -0.1), 'upperarm.R': R(-0.7, 0, 0.1), 'forearm.L': R(-1.0), 'forearm.R': R(-1.0 - 0.15 * math.sin(t * 4 * math.pi)),
}, step=5)
loop('Wave', 30, lambda t: {
    'spine': R(0, 0, 0.05), 'head': R(0, -0.1, 0.08),
    'upperarm.R': R(0, 0, 2.7), 'forearm.R': R(0, 0.5 * math.sin(t * 2 * math.pi) , 0.35 * math.sin(t * 2 * math.pi)),
    'hand.R': R(0, 0, 0.3 * math.sin(t * 2 * math.pi + 0.5)),
    'upperarm.L': R(0, 0, -0.1), 'forearm.L': R(-0.2),
}, step=2)
loop('Cheer', 24, lambda t: {
    'hips': {'r': (0, 0, 0), 'l': (0, 0.08 * abs(math.sin(t * 2 * math.pi)), 0)},
    'spine': R(-0.08), 'head': R(-0.15),
    'upperarm.L': R(0, 0, -2.6 - 0.25 * math.sin(t * 4 * math.pi)), 'upperarm.R': R(0, 0, 2.6 + 0.25 * math.sin(t * 4 * math.pi)),
    'forearm.L': R(-0.25), 'forearm.R': R(-0.25),
    'thigh.L': R(-0.15 * abs(math.sin(t * 2 * math.pi))), 'thigh.R': R(-0.15 * abs(math.sin(t * 2 * math.pi))),
    'shin.L': R(0.3 * abs(math.sin(t * 2 * math.pi))), 'shin.R': R(0.3 * abs(math.sin(t * 2 * math.pi))),
}, step=2)
loop('Push', 24, lambda t: (lambda p: {
    'spine': R(0.25 * p), 'chest': R(0.1 * p),
    'upperarm.L': R(-1.4 * p, 0, -0.1), 'upperarm.R': R(-1.4 * p, 0, 0.1),
    'forearm.L': R(-0.6 * (1 - p)), 'forearm.R': R(-0.6 * (1 - p)),
    'thigh.L': R(-0.4 * p), 'shin.L': R(0.2 * p), 'thigh.R': R(0.3 * p),
})(math.sin(min(1, t * 2) * math.pi / 2) if t < 0.5 else math.cos((t - 0.5) * math.pi)), step=2)

arm.animation_data.action = bpy.data.actions['Idle']
os.makedirs(os.path.dirname(OUT), exist_ok=True)
export(OUT)
print('EXPORTED', OUT, [a.name for a in bpy.data.actions])
