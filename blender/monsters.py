# Монстры хоррор-режима READ&PRACTICE — генерируются в Blender 5.2 (bpy).
# Запуск: python blender/monsters.py  → public/models/teacher.glb, shadow.glb, headmaster.glb
# Каждый монстр — свой скелет, свои пропорции, свои материалы и анимации:
#   Idle, Walk, Chase, Attack, Scream, Appear, Search
# Монстр смотрит в −Y (в glTF/Three.js это +Z).
import sys, os, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bpy
from mathutils import Vector
from common import reset, material, hexc, part, join, armature, bind, new_action, key, export

OUTDIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'public', 'models')
os.makedirs(OUTDIR, exist_ok=True)


def limb(objs, name, a, b, r1, r2, mat, bone, segs=8):
    """Конус/цилиндр от точки a до точки b (сустав → сустав)."""
    a, b = Vector(a), Vector(b)
    d = b - a
    bpy.ops.mesh.primitive_cone_add(vertices=segs, radius1=r1, radius2=r2, depth=d.length, location=(a + b) / 2)
    o = bpy.context.active_object
    o.rotation_mode = 'QUATERNION'
    o.rotation_quaternion = d.normalized().to_track_quat('Z', 'Y')
    o.name = name
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    o.data.materials.append(mat)
    for p in o.data.polygons: p.use_smooth = True
    vg = o.vertex_groups.new(name=bone)
    vg.add(list(range(len(o.data.vertices))), 1.0, 'REPLACE')
    objs.append(o)
    return o


def rig(S):
    """S — пропорции. Возвращает (arm, точки суставов)."""
    P = {}
    P['hip'] = S['hip']
    P['chest'] = S['hip'] + S['spine']
    P['neck'] = P['chest'] + S['chest']
    P['head'] = P['neck'] + S['neck']
    sx = S['shoulder']
    P['sh'] = P['neck'] - 0.04
    P['el'] = P['sh'] - S['uarm']
    P['wr'] = P['el'] - S['farm']
    P['kn'] = S['hip'] - S['thigh']
    hx = S['hipw']
    bones = [
        ('hips', (0, 0, P['hip']), (0, 0, P['hip'] + S['spine'] * 0.45), None),
        ('spine', (0, 0, P['hip'] + S['spine'] * 0.45), (0, 0, P['chest']), 'hips'),
        ('chest', (0, 0, P['chest']), (0, 0, P['neck']), 'spine'),
        ('neck', (0, 0, P['neck']), (0, 0, P['head']), 'chest'),
        ('head', (0, 0, P['head']), (0, 0, P['head'] + S['headR'] * 2), 'neck'),
    ]
    for s, x in (('L', 1), ('R', -1)):
        bones += [
            (f'upperarm.{s}', (sx * x, 0, P['sh']), (sx * x * 1.04, 0, P['el']), 'chest'),
            (f'forearm.{s}', (sx * x * 1.04, 0, P['el']), (sx * x * 1.06, 0, P['wr']), f'upperarm.{s}'),
            (f'hand.{s}', (sx * x * 1.06, 0, P['wr']), (sx * x * 1.06, 0, P['wr'] - S['hand']), f'forearm.{s}'),
            (f'thigh.{s}', (hx * x, 0, P['hip']), (hx * x, 0, P['kn']), 'hips'),
            (f'shin.{s}', (hx * x, 0, P['kn']), (hx * x, 0, 0.08), f'thigh.{s}'),
            (f'foot.{s}', (hx * x, 0, 0.08), (hx * x, -0.16, 0.03), f'shin.{s}'),
        ]
    return armature('Rig', bones), P


def body_parts(objs, S, P, M, torso='Cloth', legs='Cloth', skin='Skin', shoes='Shoes'):
    sx, hx = S['shoulder'], S['hipw']
    # таз и туловище
    part(objs, 'cyl', 'pelvis', (hx * 1.7, S['depth'] * 0.9, 0.12), (0, 0, P['hip'] + 0.02), M[legs], 'hips', segs=10, smooth=True)
    limb(objs, 'belly', (0, 0, P['hip'] + 0.05), (0, 0, P['chest']), S['waist'], S['chestR'] * 0.9, M[torso], 'spine', segs=10)
    limb(objs, 'ribs', (0, 0, P['chest']), (0, 0, P['neck'] - 0.02), S['chestR'] * 0.95, S['chestR'] * 0.8, M[torso], 'chest', segs=10)
    part(objs, 'sphere', 'shoulders', (sx * 1.05, S['depth'] * 0.85, 0.08), (0, 0, P['sh'] + 0.01), M[torso], 'chest', segs=12, rings=6, smooth=True)
    limb(objs, 'neckm', (0, 0, P['neck'] - 0.03), (0, 0, P['head'] + 0.04), S['neckR'], S['neckR'] * 0.9, M[skin], 'neck', segs=8)
    for s, x in (('L', 1), ('R', -1)):
        limb(objs, f'uarm.{s}', (sx * x, 0, P['sh']), (sx * x * 1.04, 0, P['el']), S['armR'], S['armR'] * 0.85, M[torso], f'upperarm.{s}')
        limb(objs, f'farm.{s}', (sx * x * 1.04, 0, P['el']), (sx * x * 1.06, 0, P['wr']), S['armR'] * 0.85, S['armR'] * 0.6, M[S.get('farmMat', torso)], f'forearm.{s}')
        limb(objs, f'thigh.{s}', (hx * x, 0, P['hip']), (hx * x, 0, P['kn']), S['legR'], S['legR'] * 0.8, M[legs], f'thigh.{s}')
        limb(objs, f'shin.{s}', (hx * x, 0, P['kn']), (hx * x, 0, 0.1), S['legR'] * 0.8, S['legR'] * 0.6, M[legs], f'shin.{s}')
        part(objs, 'cube', f'shoe.{s}', (S['legR'] * 1.7, 0.3, 0.1), (hx * x, -0.06, 0.05), M[shoes], f'foot.{s}', bevel=0.03)


def claws(objs, S, P, M, mat, n=4, length=0.16, r=0.012):
    """Длинные пальцы-когти."""
    for s, x in (('L', 1), ('R', -1)):
        wx = S['shoulder'] * x * 1.06
        part(objs, 'sphere', f'palm.{s}', (0.05, 0.035, 0.07), (wx, 0, P['wr'] - 0.05), M[S.get('handMat', 'Skin')], f'hand.{s}', segs=8, rings=5, smooth=True)
        for i in range(n):
            off = (i - (n - 1) / 2) * 0.026
            a = (wx + x * 0.005, off, P['wr'] - 0.09)
            b = (wx + x * 0.02, off - 0.03, P['wr'] - 0.09 - length)
            limb(objs, f'claw{i}.{s}', a, b, r, 0.002, mat, f'hand.{s}', segs=5)


def R(x=0, y=0, z=0): return {'r': (x, y, z)}


def animations(arm, A):
    """A — характер движений монстра (насколько он сутулится, дёргается и т.д.)."""
    hunch, tilt, jitter = A['hunch'], A['tilt'], A['jitter']

    def loop(name, frames, fn, step=2):
        new_action(arm, name)
        for f in range(0, frames + 1, step):
            key(arm, f + 1, fn(f / frames))

    def tw(t, k=1.0):  # резкие подёргивания
        return jitter * k * (math.sin(t * 2 * math.pi * 7) * math.sin(t * 2 * math.pi * 3) > 0.55)

    def gait(t, run):
        s = math.sin(t * 2 * math.pi)
        c = math.cos(t * 2 * math.pi)
        k = 0.9 if run else 0.5
        lean = (0.55 if run else 0.18) + hunch
        knee = lambda ph: max(0.0, math.sin(ph)) * (1.4 if run else 0.7)
        limp = A['limp'] * max(0, s)
        reach = A['reach'] if run else 0.0
        return {
            'hips': {'r': (0, 0, s * 0.1), 'l': (0, abs(c) * (0.06 if run else 0.025) - limp * 0.05, 0)},
            'spine': R(lean * 0.6, 0, -s * 0.12),
            'chest': R(lean * 0.4, 0, -s * 0.08),
            'neck': R(-lean * 0.3, 0, tilt * 0.5),
            'head': R(-lean * 0.4 + tw(t, 0.4), s * 0.08, tilt + tw(t, 0.3)),
            'thigh.L': R(-s * k), 'thigh.R': R(s * k * (1 - A['limp'] * 0.5)),
            'shin.L': R(knee(t * 2 * math.pi + 0.3)), 'shin.R': R(knee(t * 2 * math.pi + math.pi + 0.3)),
            'foot.L': R(s * 0.2), 'foot.R': R(-s * 0.2),
            'upperarm.L': R(-reach + s * (0.25 if run else 0.12), 0, -0.12 - (0.2 if run else 0)),
            'upperarm.R': R(-reach - s * (0.25 if run else 0.12), 0, 0.12 + (0.2 if run else 0)),
            'forearm.L': R(-0.2 - (0.3 * max(0, -s) if run else 0)), 'forearm.R': R(-0.2 - (0.3 * max(0, s) if run else 0)),
            'hand.L': R(0.3 * math.sin(t * 2 * math.pi * 3) if run else 0), 'hand.R': R(-0.3 * math.sin(t * 2 * math.pi * 3) if run else 0),
        }

    loop('Idle', 72, lambda t: {
        'spine': R(hunch * 0.6 + 0.03 * math.sin(t * 2 * math.pi)),
        'chest': {'r': (hunch * 0.3, 0, 0), 's': (1 + 0.03 * math.sin(t * 2 * math.pi), 1, 1 + 0.03 * math.sin(t * 2 * math.pi))},
        'neck': R(-hunch * 0.3, 0, tilt * 0.5),
        'head': R(-hunch * 0.3 + tw(t, 0.5), tw(t, 0.6) - tw(t + 0.3, 0.6), tilt + tw(t + 0.1, 0.5)),
        'upperarm.L': R(0.05, 0, -0.08), 'upperarm.R': R(0.05, 0, 0.08),
        'forearm.L': R(-0.1), 'forearm.R': R(-0.1 - tw(t, 0.6)),
        'hand.R': R(0, 0, tw(t + 0.5, 0.8)),
    }, step=2)
    loop('Walk', 40, lambda t: gait(t, False), step=1)
    loop('Chase', 22, lambda t: gait(t, True), step=1)
    loop('Search', 90, lambda t: {
        'spine': R(hunch * 0.7 + 0.1), 'chest': R(0.05, 0.35 * math.sin(t * 2 * math.pi), 0),
        'neck': R(0, 0.3 * math.sin(t * 2 * math.pi), tilt * 0.5),
        'head': R(0.1, 0.55 * math.sin(t * 2 * math.pi + 0.4) + tw(t, 0.4), tilt),
        'upperarm.L': R(-0.3, 0, -0.15), 'upperarm.R': R(-0.3, 0, 0.15),
        'forearm.L': R(-0.6), 'forearm.R': R(-0.6),
        'thigh.L': R(-0.15), 'thigh.R': R(-0.15), 'shin.L': R(0.3), 'shin.R': R(0.3),
    }, step=3)

    def attack(t):
        # замах → бросок вперёд → возврат
        p = math.sin(min(1, t / 0.35) * math.pi / 2) if t < 0.35 else max(0.0, 1 - (t - 0.35) / 0.65)
        w = max(0.0, 1 - t / 0.25)  # замах
        return {
            'spine': R(hunch * 0.6 + 0.55 * p - 0.25 * w), 'chest': R(0.2 * p),
            'neck': R(-0.3 * p), 'head': R(-0.3 * p, 0, tilt * (1 - p)),
            'upperarm.L': R(-1.9 * p + 0.6 * w, 0, -0.35 * w), 'upperarm.R': R(-1.9 * p + 0.6 * w, 0, 0.35 * w),
            'forearm.L': R(-0.2 * (1 - p)), 'forearm.R': R(-0.2 * (1 - p)),
            'hand.L': R(-0.5 * p), 'hand.R': R(-0.5 * p),
            'thigh.L': R(-0.7 * p), 'shin.L': R(0.4 * p), 'thigh.R': R(0.5 * p), 'shin.R': R(0.2 * p),
            'hips': {'r': (0, 0, 0), 'l': (0, -0.08 * p, 0)},
        }
    loop('Attack', 24, attack, step=1)

    loop('Scream', 40, lambda t: (lambda p: {
        'spine': R(-0.25 * p), 'chest': R(-0.2 * p, 0, 0.05 * math.sin(t * 2 * math.pi * 6) * p),
        'neck': R(-0.3 * p), 'head': R(-0.55 * p + 0.06 * math.sin(t * 2 * math.pi * 9) * p, 0, 0.1 * math.sin(t * 2 * math.pi * 5) * p),
        'upperarm.L': R(-0.4 * p, 0, -1.7 * p), 'upperarm.R': R(-0.4 * p, 0, 1.7 * p),
        'forearm.L': R(-0.5 * p), 'forearm.R': R(-0.5 * p),
        'hand.L': R(0, 0, 0.3 * math.sin(t * 2 * math.pi * 8) * p), 'hand.R': R(0, 0, -0.3 * math.sin(t * 2 * math.pi * 8) * p),
    })(min(1.0, t * 3) * (1 if t < 0.85 else (1 - t) / 0.15)), step=1)

    # Появление: выползает из пола, распрямляется рывками
    def appear(t):
        q = 1 - t
        jerk = 0.08 * math.sin(t * 2 * math.pi * 6) * q
        return {
            'hips': {'r': (0, 0, 0), 'l': (0, -A['height'] * 0.55 * q * q, 0)},
            'spine': R(1.3 * q + jerk), 'chest': R(0.4 * q),
            'neck': R(-0.9 * q), 'head': R(-0.6 * q + jerk * 2, 0, (tilt + 0.6) * q),
            'thigh.L': R(-1.6 * q), 'thigh.R': R(-1.4 * q), 'shin.L': R(2.2 * q), 'shin.R': R(2.0 * q),
            'foot.L': R(-0.6 * q), 'foot.R': R(-0.6 * q),
            'upperarm.L': R(-1.6 * q, 0, -0.3 * q), 'upperarm.R': R(-1.4 * q, 0, 0.3 * q),
            'forearm.L': R(-0.3 * q), 'forearm.R': R(-0.5 * q),
        }
    loop('Appear', 45, appear, step=1)


def build_teacher():
    reset()
    M = {
        'Skin': material('Skin', hexc('#8f9a8a'), 0.7),
        'Cloth': material('Cloth', hexc('#2b2626'), 0.9),
        'Skirt': material('Skirt', hexc('#3a2f2c'), 0.9),
        'Shoes': material('Shoes', hexc('#151212'), 0.6),
        'Hair': material('Hair', hexc('#2a2622'), 0.8),
        'Socket': material('Socket', hexc('#050404'), 0.95),
        'Pupil': material('Pupil', hexc('#f2f0e6'), 0.3, emit=hexc('#f2f0e6')),
        'Mouth': material('Mouth', hexc('#120607'), 0.95),
        'Teeth': material('Teeth', hexc('#c9c2a8'), 0.5),
        'Blood': material('Blood', hexc('#4a0606'), 0.35),
        'Glass': material('Glass', hexc('#9fb0b0'), 0.1, 0.6),
        'Wood': material('Wood', hexc('#5a3d24'), 0.7),
        'Nail': material('Nail', hexc('#2a2420'), 0.4),
    }
    S = dict(hip=1.12, spine=0.42, chest=0.36, neck=0.2, headR=0.17, shoulder=0.24, uarm=0.5, farm=0.5, hand=0.14,
             thigh=0.54, hipw=0.1, depth=0.16, waist=0.11, chestR=0.15, neckR=0.045, armR=0.04, legR=0.06, farm_mat=None)
    arm, P = rig(S)
    body = []
    body_parts(body, S, P, M, torso='Cloth', legs='Cloth')
    # длинная юбка-лохмотья
    limb(body, 'skirt', (0, 0, P['hip'] + 0.08), (0, 0, P['kn'] - 0.1), 0.15, 0.24, M['Skirt'], 'hips', segs=9)
    # кровавые пятна на одежде и руках
    part(body, 'sphere', 'stain1', (0.09, 0.03, 0.12), (0.05, -0.15, P['chest'] - 0.05), M['Blood'], 'spine', segs=8, rings=5, smooth=True)
    part(body, 'sphere', 'stain2', (0.06, 0.02, 0.08), (-0.08, -0.16, P['hip'] + 0.08), M['Blood'], 'hips', segs=8, rings=5, smooth=True)
    for s, x in (('L', 1), ('R', -1)):
        limb(body, f'bloodcuff.{s}', (S['shoulder'] * x * 1.05, 0, P['wr'] + 0.12), (S['shoulder'] * x * 1.06, 0, P['wr']), S['armR'] * 0.68, S['armR'] * 0.62, M['Blood'], f'forearm.{s}')
    claws(body, S, P, M, M['Nail'], n=4, length=0.17)
    # указка в правой руке
    limb(body, 'pointer', (-S['shoulder'] * 1.06, -0.03, P['wr'] - 0.06), (-S['shoulder'] * 1.06, -0.1, P['wr'] - 0.75), 0.012, 0.008, M['Wood'], 'hand.R', segs=6)
    bodyM = join(body, 'Body')

    head = []
    HC = P['head'] + S['headR']
    part(head, 'sphere', 'skull', (0.15, 0.16, 0.2), (0, 0, HC), M['Skin'], 'head', segs=16, rings=10, smooth=True)
    part(head, 'sphere', 'jaw', (0.11, 0.12, 0.08), (0, -0.03, HC - 0.13), M['Skin'], 'head', segs=12, rings=8, smooth=True)
    for x in (1, -1):
        part(head, 'sphere', 'socket', (0.045, 0.03, 0.04), (0.06 * x, -0.135, HC + 0.03), M['Socket'], 'head', segs=10, rings=6, smooth=True)
        part(head, 'sphere', 'pupil', (0.011, 0.008, 0.011), (0.06 * x, -0.16, HC + 0.03), M['Pupil'], 'head', segs=6, rings=4, smooth=True)
        # треснувшие очки
        part(head, 'cyl', 'lens', (0.05, 0.05, 0.006), (0.065 * x, -0.165, HC + 0.03), M['Glass'], 'head', rot=(math.pi / 2, 0, 0), segs=12)
    part(head, 'cube', 'bridge', (0.04, 0.008, 0.008), (0, -0.17, HC + 0.04), M['Glass'], 'head')
    # растянутый рот с зубами
    part(head, 'cube', 'mouth', (0.13, 0.02, 0.05), (0, -0.14, HC - 0.1), M['Mouth'], 'head', bevel=0.01)
    for i in range(7):
        part(head, 'cone', f'tooth{i}', (0.008, 0.008, 0.02), (-0.054 + i * 0.018, -0.152, HC - 0.083), M['Teeth'], 'head', rot=(math.pi, 0, 0), segs=4)
    part(head, 'sphere', 'drip', (0.012, 0.01, 0.04), (0.03, -0.15, HC - 0.15), M['Blood'], 'head', segs=6, rings=4, smooth=True)
    # растрёпанный пучок
    part(head, 'sphere', 'hair', (0.16, 0.17, 0.13), (0, 0.02, HC + 0.08), M['Hair'], 'head', segs=14, rings=8, smooth=True)
    part(head, 'sphere', 'bun', (0.08, 0.08, 0.07), (0, 0.1, HC + 0.17), M['Hair'], 'head', segs=10, rings=6, smooth=True)
    for i, (x, z) in enumerate([(0.13, -0.05), (-0.12, -0.1), (0.1, -0.16)]):
        limb(head, f'strand{i}', (x, -0.02, HC + 0.06), (x * 1.2, -0.06, HC + z), 0.015, 0.004, M['Hair'], 'head', segs=4)
    headM = join(head, 'Head')
    for m in (bodyM, headM): bind(m, arm)
    animations(arm, dict(hunch=0.25, tilt=0.35, jitter=0.25, limp=0.4, reach=1.25, height=P['head']))
    arm.animation_data.action = bpy.data.actions['Idle']
    export(os.path.join(OUTDIR, 'teacher.glb'))


def build_shadow():
    reset()
    M = {
        'Skin': material('Void', hexc('#050507'), 1.0),
        'Cloth': material('Void', hexc('#050507'), 1.0),
        'Shoes': material('Void', hexc('#050507'), 1.0),
        'Eye': material('Eye', hexc('#ffffff'), 0.2, emit=hexc('#e8f0ff')),
        'Wisp': material('Wisp', hexc('#0a0a10'), 1.0),
    }
    S = dict(hip=1.08, spine=0.46, chest=0.36, neck=0.18, headR=0.15, shoulder=0.2, uarm=0.52, farm=0.56, hand=0.18,
             thigh=0.52, hipw=0.08, depth=0.12, waist=0.08, chestR=0.13, neckR=0.035, armR=0.03, legR=0.045)
    arm, P = rig(S)
    body = []
    body_parts(body, S, P, M)
    claws(body, S, P, M, M['Wisp'], n=3, length=0.24, r=0.01)
    # рваные «дымные» лоскуты снизу
    for i in range(9):
        a = i / 9 * math.pi * 2
        x, y = math.cos(a) * 0.12, math.sin(a) * 0.12
        limb(body, f'wisp{i}', (x, y, P['hip'] + 0.05), (x * 2.2, y * 2.2, 0.15 + (i % 3) * 0.12), 0.06, 0.004, M['Wisp'], 'hips', segs=5)
    bodyM = join(body, 'Body')
    head = []
    HC = P['head'] + S['headR']
    part(head, 'sphere', 'skull', (0.13, 0.15, 0.2), (0, 0, HC), M['Skin'], 'head', segs=14, rings=10, smooth=True)
    for x in (1, -1):
        part(head, 'sphere', 'eye', (0.02, 0.008, 0.012), (0.05 * x, -0.142, HC + 0.03), M['Eye'], 'head', segs=8, rings=4, smooth=True)
    headM = join(head, 'Head')
    for m in (bodyM, headM): bind(m, arm)
    animations(arm, dict(hunch=0.1, tilt=0.15, jitter=0.4, limp=0.0, reach=1.5, height=P['head']))
    arm.animation_data.action = bpy.data.actions['Idle']
    export(os.path.join(OUTDIR, 'shadow.glb'))


def build_headmaster():
    reset()
    M = {
        'Skin': material('Skin', hexc('#b8b0a2'), 0.6),
        'Cloth': material('Suit', hexc('#17181c'), 0.75),
        'Shirt': material('Shirt', hexc('#8c857a'), 0.8),
        'Tie': material('Tie', hexc('#5a0a0a'), 0.5),
        'Shoes': material('Shoes', hexc('#0b0b0b'), 0.3),
        'Mask': material('Mask', hexc('#e6e0d2'), 0.25),
        'Crack': material('Crack', hexc('#141010'), 0.9),
        'Eye': material('Eye', hexc('#ff2a1a'), 0.2, emit=hexc('#ff1a0a')),
        'Blood': material('Blood', hexc('#4a0606'), 0.35),
        'Metal': material('Metal', hexc('#6d6a62'), 0.35, 0.8),
        'Nail': material('Nail', hexc('#1e1a18'), 0.4),
    }
    S = dict(hip=1.3, spine=0.55, chest=0.5, neck=0.16, headR=0.2, shoulder=0.42, uarm=0.6, farm=0.58, hand=0.2,
             thigh=0.62, hipw=0.16, depth=0.3, waist=0.24, chestR=0.3, neckR=0.09, armR=0.085, legR=0.11, handMat='Skin')
    arm, P = rig(S)
    body = []
    body_parts(body, S, P, M, torso='Cloth', legs='Cloth')
    # рубашка, галстук, лацканы
    part(body, 'cube', 'shirt', (0.14, 0.02, S['chest'] * 0.9), (0, -S['chestR'] * 0.86, P['chest'] + S['chest'] * 0.45), M['Shirt'], 'chest')
    part(body, 'cube', 'tie', (0.06, 0.02, S['chest'] * 0.85), (0, -S['chestR'] * 0.9, P['chest'] + S['chest'] * 0.42), M['Tie'], 'chest', bevel=0.01)
    for x in (1, -1):
        part(body, 'cube', 'lapel', (0.07, 0.03, S['chest'] * 0.6), (0.1 * x, -S['chestR'] * 0.85, P['chest'] + S['chest'] * 0.55), M['Cloth'], 'chest', rot=(0, 0.25 * x, 0))
    part(body, 'cube', 'coat', (S['waist'] * 2.1, S['depth'] * 1.1, 0.45), (0, 0, P['hip'] - 0.12), M['Cloth'], 'hips', bevel=0.04)
    part(body, 'sphere', 'stain', (0.1, 0.03, 0.14), (-0.08, -S['chestR'] * 0.9, P['chest'] + 0.1), M['Blood'], 'chest', segs=8, rings=5, smooth=True)
    claws(body, S, P, M, M['Nail'], n=4, length=0.2, r=0.018)
    # огромный ключ от всех кабинетов
    limb(body, 'keyshaft', (-S['shoulder'] * 1.06, -0.04, P['wr'] - 0.08), (-S['shoulder'] * 1.06, -0.1, P['wr'] - 0.95), 0.025, 0.025, M['Metal'], 'hand.R', segs=6)
    part(body, 'cyl', 'keyring', (0.09, 0.09, 0.03), (-S['shoulder'] * 1.06, -0.04, P['wr'] - 0.02), M['Metal'], 'hand.R', rot=(0, math.pi / 2, 0), segs=10)
    part(body, 'cube', 'keybit', (0.04, 0.12, 0.1), (-S['shoulder'] * 1.06, -0.15, P['wr'] - 0.9), M['Metal'], 'hand.R')
    bodyM = join(body, 'Body')
    head = []
    HC = P['head'] + S['headR']
    part(head, 'sphere', 'skull', (0.19, 0.2, 0.23), (0, 0, HC), M['Skin'], 'head', segs=16, rings=10, smooth=True)
    # треснувшая фарфоровая маска
    part(head, 'sphere', 'mask', (0.17, 0.06, 0.21), (0, -0.165, HC - 0.01), M['Mask'], 'head', segs=16, rings=10, smooth=True)
    for x in (1, -1):
        part(head, 'sphere', 'hole', (0.04, 0.02, 0.025), (0.065 * x, -0.215, HC + 0.04), M['Crack'], 'head', segs=8, rings=5, smooth=True)
        part(head, 'sphere', 'eye', (0.018, 0.01, 0.014), (0.065 * x, -0.228, HC + 0.04), M['Eye'], 'head', segs=8, rings=4, smooth=True)
    part(head, 'cube', 'slit', (0.1, 0.02, 0.008), (0, -0.222, HC - 0.1), M['Crack'], 'head')
    for i in range(4):
        part(head, 'cube', f'crack{i}', (0.005, 0.01, 0.07 - i * 0.01), (0.02 + i * 0.02, -0.225, HC + 0.12 - i * 0.04), M['Crack'], 'head', rot=(0, 0.5 - i * 0.4, 0))
    part(head, 'sphere', 'tear', (0.01, 0.008, 0.05), (-0.065, -0.226, HC - 0.02), M['Blood'], 'head', segs=6, rings=4, smooth=True)
    headM = join(head, 'Head')
    for m in (bodyM, headM): bind(m, arm)
    animations(arm, dict(hunch=0.08, tilt=0.12, jitter=0.15, limp=0.0, reach=0.9, height=P['head']))
    arm.animation_data.action = bpy.data.actions['Idle']
    export(os.path.join(OUTDIR, 'headmaster.glb'))


which = sys.argv[1:] or ['teacher', 'shadow', 'headmaster']
for w in which:
    {'teacher': build_teacher, 'shadow': build_shadow, 'headmaster': build_headmaster}[w]()
    print('EXPORTED', w)
