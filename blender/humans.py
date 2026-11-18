# Люди READ&PRACTICE — генерируются в Blender 5.2 (bpy).
# Запуск: python blender/humans.py [имя ...]
#   character  — базовый герой (перекрашивается под скины магазина: Skin/Body/Pants/Shoes/Hair)
#   hero_web   — «Паутинник», герой в костюме со стрелялками паутины
#   wanderer   — «Бродяга Михалыч» с посохом
#   folk_girl  — «Маруся» в сарафане и платке, со сковородкой
#   bear       — «Михайло Потапыч», медведь с бревном
#   grin_cat   — «Улыбчивый кот», мультяшный кот-великан с молотом
#   jack       — Джек Потрошитель (монстр хоррор-режима, анимации монстров)
# Реалистичные пропорции (~6,5 голов), гладкие тела без швов (lathe + плавные веса костей),
# лицо с глазами, веками, бровями, носом, губами и зубами, кисти с пальцами, одежда с UV для ткани.
# Смотрят в −Y (в Three.js это +Z).
import sys, os, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bpy, bmesh
from mathutils import Vector
from common import reset, material, hexc, part, join, armature, bind, new_action, key, export, lathe, blend, bake_ao

OUTDIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'public', 'models')

# ---------------------------------------------------------------- скелет (общий для всех людей)
HIP, SPN, CHS, NCK, HD = 0.86, 0.98, 1.15, 1.36, 1.43
HC = 1.535  # центр головы
SH = (0.165, 1.33); EL = (0.19, 1.06); WR = (0.205, 0.83)
LX = 0.085; KN = 0.47; AN = 0.08


def rig():
    bones = [
        ('hips', (0, 0, HIP), (0, 0, SPN), None),
        ('spine', (0, 0, SPN), (0, 0, CHS), 'hips'),
        ('chest', (0, 0, CHS), (0, 0, NCK), 'spine'),
        ('neck', (0, 0, NCK), (0, 0, HD), 'chest'),
        ('head', (0, 0, HD), (0, 0, 1.68), 'neck'),
    ]
    for s, x in (('L', 1), ('R', -1)):
        bones += [
            (f'upperarm.{s}', (SH[0] * x, 0, SH[1]), (EL[0] * x, 0, EL[1]), 'chest'),
            (f'forearm.{s}', (EL[0] * x, 0, EL[1]), (WR[0] * x, 0, WR[1]), f'upperarm.{s}'),
            (f'hand.{s}', (WR[0] * x, 0, WR[1]), (WR[0] * x, 0, 0.67), f'forearm.{s}'),
            (f'thigh.{s}', (LX * x, 0, HIP), (LX * x, 0, KN), 'hips'),
            (f'shin.{s}', (LX * x, 0, KN), (LX * x, 0, AN), f'thigh.{s}'),
            (f'foot.{s}', (LX * x, 0, AN), (LX * x, -0.15, 0.02), f'shin.{s}'),
        ]
    return armature('Rig', bones)


def torso_w(z):
    if z < 0.95: return {'hips': 1.0}
    if z < 1.08: return blend('hips', 'spine', (z - 0.95) / 0.13)
    if z < 1.2: return blend('spine', 'chest', (z - 1.08) / 0.12)
    if z < 1.35: return {'chest': 1.0}
    return blend('chest', 'neck', (z - 1.35) / 0.04)


def arm_w(z, s):
    ua, fa = f'upperarm.{s}', f'forearm.{s}'
    if z > 1.3: return blend('chest', ua, 0.55 + (1.36 - z) / 0.13)
    if z > 1.1: return {ua: 1.0}
    if z > 1.0: return blend(ua, fa, (1.1 - z) / 0.1)
    if z > 0.85: return {fa: 1.0}
    return blend(fa, f'hand.{s}', (0.85 - z) / 0.03)


def leg_w(z, s):
    th, sh = f'thigh.{s}', f'shin.{s}'
    if z > 0.82: return blend('hips', th, (0.9 - z) / 0.08)
    if z > 0.52: return {th: 1.0}
    if z > 0.42: return blend(th, sh, (0.52 - z) / 0.1)
    if z > 0.1: return {sh: 1.0}
    return blend(sh, f'foot.{s}', (0.1 - z) / 0.04)


def arm_pt(z, x):
    """точка на оси руки на высоте z"""
    if z >= EL[1]:
        t = (SH[1] - z) / (SH[1] - EL[1])
        return (x * (SH[0] + (EL[0] - SH[0]) * t), 0, z)
    t = (EL[1] - z) / (EL[1] - WR[1])
    return (x * (EL[0] + (WR[0] - EL[0]) * t), 0, z)


def dense(zs, vals, step=0.025):
    """уплотняет кольца: линейная интерполяция значений между заданными высотами"""
    oz, ov = [zs[0]], [vals[0]]
    for k in range(len(zs) - 1):
        n = max(1, int(abs(zs[k + 1] - zs[k]) / step))
        for j in range(1, n + 1):
            t = j / n
            oz.append(zs[k] + (zs[k + 1] - zs[k]) * t)
            a, b = vals[k], vals[k + 1]
            ov.append(tuple(a[q] + (b[q] - a[q]) * t for q in range(len(a))) if isinstance(a, tuple) else a + (b - a) * t)
    return oz, ov


# ---------------------------------------------------------------- рельеф: мышцы и складки
# Угол кольца lathe: 90° — спина (+Y), 270° — грудь/перед (−Y), 0°/180° — бока.
FRONT, BACK = math.radians(270), math.radians(90)
def bump(z, z0, w): return math.exp(-((z - z0) / w) ** 2)
def side(a, d, p=1.5): return max(0.0, math.cos(a - d)) ** p
def wrinkle(z, z0, w, amp, a, n=4):
    """поперечные складки ткани у сгиба (локоть, колено, пояс)"""
    return amp * bump(z, z0, w) * (math.sin(a * n + z * 22) * 0.75 + math.sin(a * (n + 2) - z * 14) * 0.25)
def drape(z, top, hem, amp, a, n=9):
    """вертикальные складки, растущие к подолу (юбка, пальто, плащ)"""
    t = max(0.0, min(1.0, (top - z) / max(0.01, top - hem)))
    return amp * t * (math.sin(a * n) * 0.6 + math.sin(a * n * 1.63 + 1.1) * 0.4)
def arm_shape(x, cloth=False):
    out = 0.0 if x > 0 else math.pi  # наружная сторона руки
    def f(i, a, c):
        z = c.z
        m = 1.0
        m += 0.11 * bump(z, 1.2, 0.06) * side(a, FRONT)       # бицепс
        m += 0.07 * bump(z, 1.17, 0.07) * side(a, BACK)       # трицепс
        m += 0.08 * bump(z, 1.3, 0.05) * side(a, out, 1.0)    # дельта
        m += 0.07 * bump(z, 0.99, 0.05) * side(a, FRONT + (0.6 if x > 0 else -0.6))  # предплечье
        if cloth: m += wrinkle(z, 1.07, 0.05, 0.05, a) + wrinkle(z, 0.9, 0.04, 0.03, a, 5)
        return m
    return f
def leg_shape(cloth=False):
    def f(i, a, c):
        z = c.z
        m = 1.0
        m += 0.06 * bump(z, 0.7, 0.1) * side(a, FRONT)        # квадрицепс
        m += 0.12 * bump(z, 0.33, 0.07) * side(a, BACK)       # икра
        m -= 0.04 * bump(z, 0.47, 0.03) * side(a, FRONT)      # колено
        if cloth: m += wrinkle(z, 0.47, 0.05, 0.06, a) + wrinkle(z, 0.14, 0.05, 0.05, a, 5) + wrinkle(z, 0.83, 0.04, 0.03, a, 6)
        return m
    return f
def torso_shape(chest=0.05, folds=0.025):
    def f(i, a, c):
        z = c.z
        m = 1.0
        m += chest * bump(z, 1.22, 0.06) * (side(a, FRONT + 0.45, 2) + side(a, FRONT - 0.45, 2))  # грудные
        m += 0.03 * bump(z, 1.22, 0.08) * side(a, BACK, 1)    # лопатки
        m += abs(wrinkle(z, 0.97, 0.05, folds, a, 6)) + abs(drape(z, 1.0, 0.83, folds * 0.8, a, 7))
        return m
    return f


# ---------------------------------------------------------------- части тела
def torso(objs, M, mat='Body', bulk=1.0, chest_k=1.0, profile=None):
    prof = profile or [(0.83, 0.158, 0.11), (0.9, 0.153, 0.106), (0.97, 0.142, 0.098), (1.05, 0.146, 0.1), (1.13, 0.156, 0.106), (1.2, 0.166 * chest_k, 0.112 * chest_k),
                       (1.27, 0.17, 0.11), (1.31, 0.168, 0.102), (1.34, 0.148, 0.088), (1.36, 0.1, 0.066), (1.375, 0.066, 0.055)]
    dz, dv = dense([p[0] for p in prof], [(p[1], p[2]) for p in prof], 0.02)
    prof = [(z, v[0], v[1]) for z, v in zip(dz, dv)]
    lathe(objs, 'torso', [((0, 0.004, z), rx * bulk, ry * bulk, torso_w(z)) for z, rx, ry in prof], M[mat], segs=40, cap0=False, shape=torso_shape())


def pelvis(objs, M, mat='Pants', bulk=1.0):
    lathe(objs, 'pelvis', [((0, 0.004, z), rx * bulk, ry * bulk, {'hips': 1.0}) for z, rx, ry in [
        (0.79, 0.13, 0.09), (0.82, 0.148, 0.1), (0.89, 0.15, 0.102), (0.95, 0.142, 0.098), (0.99, 0.138, 0.096)]], M[mat], segs=26)


def neck(objs, M, mat='Skin', r=0.042):
    lathe(objs, 'neck', [((0, 0.006, z), r, r * 0.95, w) for z, w in [
        (1.33, {'chest': 1.0}), (1.37, blend('chest', 'neck', 0.5)), (1.41, {'neck': 1.0}), (1.46, blend('neck', 'head', 0.8))]], M[mat], segs=16)


def arms(objs, M, skin='Skin', sleeve='Body', sleeve_to=1.17, bulk=1.0, cuff=None):
    for s, x in (('L', 1), ('R', -1)):
        zs = [1.325, 1.28, 1.2, 1.12, 1.06, 1.0, 0.94, 0.88, 0.845]
        rs = [0.05, 0.05, 0.047, 0.042, 0.038, 0.037, 0.035, 0.031, 0.028]
        zs, rs = dense(zs, rs, 0.022)
        lathe(objs, f'arm.{s}', [(arm_pt(z, x), r * bulk, r * 0.94 * bulk, arm_w(z, s)) for z, r in zip(zs, rs)], M[skin], segs=22, shape=arm_shape(x, cloth=skin not in ('Skin',)))
        if sleeve and sleeve_to < 1.3:
            sz = [z for z in dense([1.335, 0.88], [0, 0], 0.02)[0] if z >= sleeve_to - 0.001]
            if sz[-1] > sleeve_to: sz.append(sleeve_to)
            ring = lambda z: 0.068 - (1.35 - z) * 0.045
            lathe(objs, f'sleeve.{s}', [(arm_pt(z, x), ring(z) * bulk, ring(z) * 0.95 * bulk, arm_w(z, s)) for z in sz], M[sleeve], segs=24, cap1=False, shape=lambda i, a, c: 1 + abs(wrinkle(c.z, sleeve_to + 0.03, 0.04, 0.05, a, 5)) + 0.02 * math.sin(a * 3 + 1))
        if cuff:
            lathe(objs, f'cuff.{s}', [(arm_pt(z, x), 0.032 * bulk, 0.031 * bulk, arm_w(z, s)) for z in (0.885, 0.86, 0.84)], M[cuff], segs=16)


def hands(objs, M, mat='Skin', glove=None, claws=None, k=1.0):
    m = M[glove or mat]
    for s, x in (('L', 1), ('R', -1)):
        hb = f'hand.{s}'
        px = (WR[0] + 0.003) * x
        part(objs, 'sphere', f'palm.{s}', (0.017 * k, 0.034 * k, 0.04 * k), (px, 0, 0.785), m, hb, segs=16, rings=10, smooth=True)
        for i, fy in enumerate((-0.024, -0.008, 0.008, 0.023)):
            ln = (0.05, 0.056, 0.053, 0.044)[i] * k
            a, b = (px, fy * k, 0.755), (px - x * 0.006, fy * k - 0.004, 0.755 - ln)
            mid = ((a[0] + b[0]) / 2 - x * 0.004, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2)
            lathe(objs, f'finger{i}.{s}', [(a, 0.0078 * k, 0.0072 * k, {hb: 1.0}), (mid, 0.0072 * k, 0.0068 * k, {hb: 1.0}), (b, 0.0062 * k, 0.006 * k, {hb: 1.0})], m, segs=10)
            if claws:
                lathe(objs, f'claw{i}.{s}', [(b, 0.005 * k, 0.005 * k, {hb: 1.0}), ((b[0] - x * 0.006, b[1] - 0.01, b[2] - 0.02 * k), 0.0008, 0.0008, {hb: 1.0})], M[claws], segs=6, cap1=False)
        ta, tb = (px - x * 0.006, -0.03 * k, 0.79), (px - x * 0.016, -0.048 * k, 0.755)
        lathe(objs, f'thumb.{s}', [(ta, 0.009 * k, 0.0085 * k, {hb: 1.0}), (tb, 0.0068 * k, 0.0065 * k, {hb: 1.0})], m, segs=10)


def legs(objs, M, mat='Pants', to=0.09, bulk=1.0, skin_below=None):
    for s, x in (('L', 1), ('R', -1)):
        zs = [0.9, 0.82, 0.72, 0.62, 0.53, 0.47, 0.41, 0.32, 0.22, 0.14, 0.09, 0.07]
        rs = [0.07, 0.068, 0.063, 0.057, 0.05, 0.046, 0.045, 0.043, 0.037, 0.033, 0.031, 0.03]
        zs, rs = dense(zs, rs, 0.022)
        pts = [(z, r) for z, r in zip(zs, rs) if z >= to - 0.001]
        lathe(objs, f'leg.{s}', [((LX * x, 0.004, z), r * bulk, r * 0.96 * bulk, leg_w(z, s)) for z, r in pts], M[mat], segs=24, cap0=False, cap1=skin_below is None, shape=leg_shape(cloth=mat != 'Skin'))
        if skin_below:
            sp = [(z, r * 0.9) for z, r in zip(zs, rs) if z <= to + 0.04]
            lathe(objs, f'shin_skin.{s}', [((LX * x, 0.004, z), r, r * 0.96, leg_w(z, s)) for z, r in sp], M[skin_below], segs=16, cap0=False)


def sneakers(objs, M, mat='Shoes', sole='Sole', k=1.0, boots=False):
    for s, x in (('L', 1), ('R', -1)):
        fb = f'foot.{s}'
        part(objs, 'sphere', f'shoe.{s}', (0.048 * k, 0.112 * k, 0.046 * k), (LX * x, -0.038, 0.05), M[mat], fb, segs=22, rings=14, smooth=True)
        part(objs, 'sphere', f'toe.{s}', (0.046 * k, 0.05 * k, 0.036 * k), (LX * x, -0.1 * k, 0.04), M[mat], fb, segs=18, rings=10, smooth=True)
        part(objs, 'sphere', f'sole.{s}', (0.052 * k, 0.122 * k, 0.016), (LX * x, -0.042, 0.014), M[sole], fb, segs=22, rings=8, smooth=True)
        if boots:
            lathe(objs, f'boot.{s}', [((LX * x, 0.004, z), 0.042 * k, 0.04 * k, leg_w(z, s)) for z in (0.06, 0.12, 0.2, 0.26)], M[mat], segs=16, cap0=False, cap1=False)


def head(objs, M, skin='Skin', iris='#5a3a22', mouth_open=True, nose_k=1.0, ears=True, lips='Lip', brow='Hair', jaw=0.22, lashes=False):
    """Голова: яйцевидный череп с сужением к подбородку, глаза с радужкой и бликом, веки, брови, нос, улыбка."""
    o = part(objs, 'sphere', 'skull', (0.1, 0.108, 0.126), (0, 0.004, HC), M[skin], 'head', segs=40, rings=26, smooth=True)
    for v in o.data.vertices:
        z = v.co.z  # локальные координаты: центр черепа = 0
        if z < 0:
            t = -z / 0.126
            v.co.x *= 1 - jaw * t ** 1.6
            if v.co.y < 0: v.co.y *= 1 - 0.08 * t
            else: v.co.y *= 1 - 0.2 * t
        if v.co.y > 0.02 and z > 0: v.co.y *= 1.04
    Ir = material('Iris', hexc(iris), 0.25)
    for x in (1, -1):
        ex, ey, ez = 0.037 * x, -0.088, HC + 0.006
        part(objs, 'sphere', 'sclera', (0.019, 0.013, 0.0175), (ex, ey, ez), M['Eye'], 'head', segs=20, rings=12, smooth=True)
        part(objs, 'sphere', 'iris', (0.0115, 0.004, 0.0122), (ex, ey - 0.0105, ez), Ir, 'head', segs=18, rings=10, smooth=True)
        part(objs, 'sphere', 'pupil', (0.0058, 0.002, 0.0062), (ex, ey - 0.0136, ez), M['Pupil'], 'head', segs=12, rings=8, smooth=True)
        part(objs, 'sphere', 'eyehl', (0.0028, 0.0015, 0.0028), (ex + 0.004 * x, ey - 0.0146, ez + 0.0045), M['EyeHL'], 'head', segs=8, rings=6, smooth=True)
        # тонкая линия верхнего века (подводка) — выразительный открытый взгляд
        lathe(objs, 'liner', [((ex - 0.019 * x, ey - 0.006, ez + 0.002), 0.0016, 0.0016, {'head': 1.0}), ((ex - 0.008 * x, ey - 0.0125, ez + 0.0145), 0.0021, 0.0021, {'head': 1.0}),
                              ((ex + 0.008 * x, ey - 0.012, ez + 0.0155), 0.0021, 0.0021, {'head': 1.0}), ((ex + 0.02 * x, ey - 0.005, ez + 0.006), 0.0016, 0.0016, {'head': 1.0})], M['Pupil'], segs=6)
        if lashes:
            lathe(objs, 'lash', [((ex - 0.018 * x, ey - 0.008, ez + 0.012), 0.0018, 0.0018, {'head': 1.0}), ((ex, ey - 0.014, ez + 0.019), 0.0022, 0.0022, {'head': 1.0}),
                                 ((ex + 0.02 * x, ey - 0.008, ez + 0.016), 0.0016, 0.0016, {'head': 1.0})], M['Pupil'], segs=6)
        # бровь — изогнутая
        lathe(objs, 'brow', [((0.017 * x, -0.1, HC + 0.04), 0.0038, 0.0028, {'head': 1.0}), ((0.036 * x, -0.1015, HC + 0.047), 0.0048, 0.0034, {'head': 1.0}),
                             ((0.056 * x, -0.092, HC + 0.041), 0.0032, 0.0024, {'head': 1.0})], M[brow], segs=8)
        if ears:
            part(objs, 'sphere', 'ear', (0.011, 0.02, 0.029), (0.098 * x, 0.006, HC - 0.004), M[skin], 'head', segs=16, rings=10, smooth=True)
            part(objs, 'sphere', 'earin', (0.004, 0.012, 0.018), (0.106 * x, 0.004, HC - 0.004), M['Lip'], 'head', segs=10, rings=6, smooth=True)
    # нос
    part(objs, 'sphere', 'nose', (0.011 * nose_k, 0.016 * nose_k, 0.022 * nose_k), (0, -0.104, HC - 0.018), M[skin], 'head', segs=16, rings=10, smooth=True)
    part(objs, 'sphere', 'nosetip', (0.0125 * nose_k, 0.011 * nose_k, 0.0105 * nose_k), (0, -0.115, HC - 0.033), M[skin], 'head', segs=16, rings=10, smooth=True)
    # рот
    if mouth_open:
        part(objs, 'sphere', 'mouth', (0.021, 0.008, 0.008), (0, -0.099, HC - 0.062), M['Mouth'], 'head', segs=18, rings=10, smooth=True)
        part(objs, 'sphere', 'teeth', (0.017, 0.005, 0.0034), (0, -0.103, HC - 0.0585), M['Teeth'], 'head', segs=16, rings=8, smooth=True)
    pts = [(-0.026, -0.096, HC - 0.058), (-0.013, -0.103, HC - 0.068), (0, -0.105, HC - 0.07), (0.013, -0.103, HC - 0.068), (0.026, -0.096, HC - 0.058)]
    lathe(objs, 'lowerlip', [(p, 0.004, 0.0038, {'head': 1.0}) for p in pts], M[lips], segs=8)
    up = [(-0.025, -0.097, HC - 0.057), (-0.01, -0.104, HC - 0.0535), (0.01, -0.104, HC - 0.0535), (0.025, -0.097, HC - 0.057)]
    lathe(objs, 'upperlip', [(p, 0.0028, 0.0026, {'head': 1.0}) for p in up], M[lips], segs=8)


def hair_shell(objs, M, mat='Hair', scale=(0.109, 0.119, 0.132), off=(0, 0.008, 0.012), cut=lambda x, y, z: False, name='hair'):
    o = part(objs, 'sphere', name, scale, (off[0], off[1], HC + off[2]), M[mat], 'head', segs=40, rings=26, smooth=True)
    bm = bmesh.new(); bm.from_mesh(o.data)
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if cut(v.co.x + off[0], v.co.y + off[1], v.co.z + off[2])], context='VERTS')
    bm.to_mesh(o.data); bm.free()
    return o


HEAD_R = (0.1, 0.108, 0.126)


def scalp(th, ph, k=1.0):
    """точка на поверхности головы: th — от макушки (0) вниз, ph — вокруг (0 — перед)"""
    return Vector((math.sin(th) * math.sin(ph) * HEAD_R[0] * k, 0.004 - math.sin(th) * math.cos(ph) * HEAD_R[1] * k, HC + math.cos(th) * HEAD_R[2] * k))


def hair_strands(objs, M, mat='Hair', n=110, seed=3, fringe=True, length=0.55, lift=1.06, width=0.011, nape=1.9):
    """Пряди: тонкие изогнутые сужающиеся «ленты» от макушки — по форме головы, чёлка вперёд."""
    import random
    rnd = random.Random(seed)
    gold = math.pi * (3 - math.sqrt(5))
    for i in range(n):
        # равномерно по «шапочке» (спираль Фибоначчи)
        t = (i + 0.5) / n
        th0 = math.acos(1 - t * (1 - math.cos(1.15))) * 0.9
        ph = i * gold + rnd.uniform(-0.15, 0.15)
        front = math.cos(ph) > 0.55
        pts = []
        for k in range(6):
            u = k / 5
            if fringe and front:
                # чёлка: вперёд и вниз на лоб, чуть вбок
                th = th0 + u * (1.0 - th0) * 0.95
                p2 = ph + u * 0.25 * math.sin(ph * 3)
            else:
                th = min(nape, th0 + u * length * (1.2 if math.cos(ph) < -0.3 else 1.0))
                p2 = ph + u * 0.18 * math.sin(i)
            lf = lift + 0.035 * math.sin(u * math.pi) + rnd.uniform(-0.01, 0.01)
            pts.append(scalp(th, p2, lf))
        w = width * rnd.uniform(0.8, 1.25)
        rings = [(tuple(p), w * (1 - 0.75 * (k / 5)), w * 0.45 * (1 - 0.6 * (k / 5)), {'head': 1.0}) for k, p in enumerate(pts)]
        lathe(objs, f'strand{i}', rings, M[mat], segs=6)


def hair_short(objs, M):
    hair_shell(objs, M, cut=lambda x, y, z: (z < 0.045 and y < -0.04) or (z < -0.015 and y < 0.035) or z < -0.085 or (z < 0.0 and abs(x) > 0.085 and y < 0.06))
    # объёмные пряди поверх шапочки
    hair_strands(objs, M, n=130, length=0.6, nape=1.75)


def beard_strands(objs, M, mat, n=120, seed=5):
    import random
    rnd = random.Random(seed)
    for i in range(n):
        ph = rnd.uniform(-1.25, 1.25)
        th = rnd.uniform(1.75, 2.35)
        pts = []
        for k in range(5):
            u = k / 4
            p = scalp(th + u * 0.3, ph * (1 - 0.35 * u), 1.1 + 0.12 * math.sin(u * math.pi * 0.8))
            p.z -= u * 0.06
            pts.append(p)
        w = 0.011 * rnd.uniform(0.8, 1.2)
        lathe(objs, f'beard{i}', [(tuple(p), w * (1 - 0.7 * k / 4), w * 0.6, {'head': 1.0}) for k, p in enumerate(pts)], M[mat], segs=6)


def hair_beard(objs, M, mat='Hair'):
    part(objs, 'sphere', 'beard', (0.07, 0.045, 0.055), (0, -0.065, HC - 0.07), M[mat], 'head', segs=24, rings=14, smooth=True)
    for x in (1, -1):
        part(objs, 'sphere', 'mustache', (0.026, 0.012, 0.01), (0.017 * x, -0.112, HC - 0.046), M[mat], 'head', rot=(0, 0.3 * x, 0), segs=14, rings=8, smooth=True)
        part(objs, 'sphere', 'sideburn', (0.018, 0.04, 0.05), (0.088 * x, -0.02, HC - 0.03), M[mat], 'head', segs=14, rings=8, smooth=True)


# ---------------------------------------------------------------- оружие (в правой руке)
def hand_r(z=0.765):
    return (-(WR[0] + 0.004), -0.002, z)


def weapon(objs, M, kind):
    hx, hy, hz = hand_r()
    hb = 'hand.R'
    if kind == 'staff':
        lathe(objs, 'staff', [((hx, hy - 0.01, hz + 0.42), 0.018, 0.018, {hb: 1.0}), ((hx, hy - 0.02, hz), 0.016, 0.016, {hb: 1.0}), ((hx, hy - 0.03, hz - 0.72), 0.013, 0.013, {hb: 1.0})], M['Wood'], segs=10)
        part(objs, 'sphere', 'knot', (0.032, 0.032, 0.04), (hx, hy - 0.01, hz + 0.45), M['Wood'], hb, segs=14, rings=8, smooth=True)
    elif kind == 'pan':
        lathe(objs, 'panhandle', [((hx, hy + 0.01, hz + 0.04), 0.012, 0.012, {hb: 1.0}), ((hx, hy - 0.02, hz - 0.14), 0.011, 0.011, {hb: 1.0})], M['Wood'], segs=10)
        part(objs, 'cyl', 'pan', (0.11, 0.11, 0.018), (hx - 0.01, hy - 0.05, hz - 0.25), M['Iron'], hb, rot=(math.radians(80), 0, 0), segs=28, smooth=True)
        part(objs, 'cyl', 'panrim', (0.118, 0.118, 0.03), (hx - 0.01, hy - 0.052, hz - 0.25), M['Iron'], hb, rot=(math.radians(80), 0, 0), segs=28, smooth=True)
    elif kind == 'log':
        lathe(objs, 'log', [((hx, hy, hz + 0.05), 0.03, 0.03, {hb: 1.0}), ((hx, hy - 0.04, hz - 0.3), 0.055, 0.052, {hb: 1.0}), ((hx, hy - 0.07, hz - 0.62), 0.07, 0.066, {hb: 1.0})], M['Wood'], segs=14)
        part(objs, 'sphere', 'logknot', (0.02, 0.02, 0.02), (hx - 0.05, hy - 0.05, hz - 0.35), M['Wood'], hb, segs=10, rings=6, smooth=True)
    elif kind == 'mallet':
        lathe(objs, 'mallethandle', [((hx, hy, hz + 0.05), 0.014, 0.014, {hb: 1.0}), ((hx, hy - 0.02, hz - 0.5), 0.014, 0.014, {hb: 1.0})], M['Wood'], segs=10)
        part(objs, 'cyl', 'mallet', (0.085, 0.085, 0.24), (hx, hy - 0.025, hz - 0.56), M['Mallet'], hb, rot=(0, math.radians(90), 0), segs=24, smooth=True)
        for sx in (1, -1):
            part(objs, 'cyl', 'malletband', (0.088, 0.088, 0.025), (hx + sx * 0.1, hy - 0.025, hz - 0.56), M['Wood'], hb, rot=(0, math.radians(90), 0), segs=24, smooth=True)
    elif kind == 'web':
        for s, x in (('L', 1), ('R', -1)):
            p = arm_pt(0.875, x)
            lathe(objs, f'shooter.{s}', [((p[0], 0, 0.9), 0.034, 0.034, {f'forearm.{s}': 1.0}), ((p[0], 0, 0.86), 0.034, 0.034, {f'forearm.{s}': 1.0})], M['Metal'], segs=16)
            part(objs, 'sphere', f'nozzle.{s}', (0.012, 0.012, 0.012), (p[0], -0.03, 0.88), M['Metal'], f'forearm.{s}', segs=10, rings=6, smooth=True)
    elif kind == 'knife':
        lathe(objs, 'knifehandle', [((hx, hy, hz + 0.03), 0.013, 0.013, {hb: 1.0}), ((hx, hy - 0.01, hz - 0.07), 0.012, 0.012, {hb: 1.0})], M['Wood'], segs=10)
        part(objs, 'cube', 'blade', (0.006, 0.03, 0.2), (hx, hy - 0.02, hz - 0.17), M['Metal'], hb, bevel=0.002)


# ---------------------------------------------------------------- анимации людей
def R(x=0, y=0, z=0): return {'r': (x, y, z)}


def walk_pose(t, amp=1.0, run=False):
    s = math.sin(t * 2 * math.pi)
    c = math.cos(t * 2 * math.pi)
    k = 0.62 * amp
    lean = 0.2 if run else 0.04
    knee = lambda ph: max(0.0, math.sin(ph)) * (1.25 if run else 0.75)
    bob = abs(c) * (0.04 if run else 0.022)
    return {
        'hips': {'r': (0, 0, s * 0.08), 'l': (0, bob, 0)},
        'spine': R(lean, 0, -s * 0.08), 'chest': R(0, 0, -s * 0.05), 'head': R(-lean * 0.6, 0, s * 0.04),
        'thigh.L': R(-s * k), 'thigh.R': R(s * k),
        'shin.L': R(knee(t * 2 * math.pi + 0.3)), 'shin.R': R(knee(t * 2 * math.pi + math.pi + 0.3)),
        'foot.L': R(s * 0.2), 'foot.R': R(-s * 0.2),
        'upperarm.L': R(s * k * 0.75, 0, -0.07), 'upperarm.R': R(-s * k * 0.75, 0, 0.07),
        'forearm.L': R(-(0.3 + (1.0 if run else 0.2) * max(0, -s))), 'forearm.R': R(-(0.3 + (1.0 if run else 0.2) * max(0, s))),
    }


def human_anims(arm):
    def loop(name, frames, fn, step=2):
        new_action(arm, name)
        for f in range(0, frames + 1, step):
            key(arm, f + 1, fn(f / frames))
    S = lambda t, k=1: math.sin(t * 2 * math.pi * k)
    loop('Idle', 72, lambda t: {
        'spine': R(0.015 * S(t)), 'chest': {'r': (0.012 * S(t), 0, 0), 's': (1 + 0.012 * S(t), 1, 1 + 0.012 * S(t))},
        'head': R(-0.02 * S(t, 1) , 0.05 * S(t), 0), 'hips': {'r': (0, 0, 0.02 * S(t)), 'l': (0, 0, 0)},
        'upperarm.L': R(0.03 * S(t), 0, -0.08), 'upperarm.R': R(-0.03 * S(t), 0, 0.08), 'forearm.L': R(-0.18), 'forearm.R': R(-0.18),
        'thigh.L': R(0, 0, 0.02), 'thigh.R': R(0, 0, -0.02),
    }, step=3)
    loop('Walk', 30, lambda t: walk_pose(t), step=1)
    loop('Run', 20, lambda t: walk_pose(t, 1.3, True), step=1)
    loop('Jump', 20, lambda t: {
        'spine': R(-0.08), 'head': R(0.08), 'thigh.L': R(-0.9), 'shin.L': R(1.3), 'thigh.R': R(0.2), 'shin.R': R(0.5),
        'upperarm.L': R(0, 0, -2.3 - 0.1 * S(t)), 'upperarm.R': R(0, 0, 2.3 + 0.1 * S(t)), 'forearm.L': R(-0.3), 'forearm.R': R(-0.3),
    }, step=5)
    # сидя: таз опускается на сиденье (~0.47 м)
    loop('Sit', 60, lambda t: {
        'hips': {'r': (0, 0, 0), 'l': (0, -0.36, 0)}, 'spine': R(-0.06 + 0.02 * S(t)),
        'head': R(0.1 + 0.03 * S(t), 0.05 * S(t)), 'thigh.L': R(-1.55), 'thigh.R': R(-1.55), 'shin.L': R(1.55), 'shin.R': R(1.55),
        'upperarm.L': R(-0.6, 0, -0.1), 'upperarm.R': R(-0.6, 0, 0.1), 'forearm.L': R(-1.0), 'forearm.R': R(-1.0 - 0.15 * S(t, 2)),
    }, step=5)
    loop('Wave', 30, lambda t: {
        'spine': R(0, 0, 0.04), 'head': R(0, -0.1, 0.07), 'upperarm.R': R(0, 0, 2.65),
        'forearm.R': R(0, 0.45 * S(t), 0.3 * S(t)), 'hand.R': R(0, 0, 0.3 * S(t + 0.08)), 'upperarm.L': R(0, 0, -0.08), 'forearm.L': R(-0.2),
    }, step=2)
    loop('Cheer', 24, lambda t: {
        'hips': {'r': (0, 0, 0), 'l': (0, 0.06 * abs(S(t)), 0)}, 'spine': R(-0.07), 'head': R(-0.14),
        'upperarm.L': R(0, 0, -2.55 - 0.22 * S(t, 2)), 'upperarm.R': R(0, 0, 2.55 + 0.22 * S(t, 2)), 'forearm.L': R(-0.25), 'forearm.R': R(-0.25),
        'thigh.L': R(-0.12 * abs(S(t))), 'thigh.R': R(-0.12 * abs(S(t))), 'shin.L': R(0.25 * abs(S(t))), 'shin.R': R(0.25 * abs(S(t))),
    }, step=2)
    loop('Push', 24, lambda t: (lambda p: {
        'spine': R(0.22 * p), 'chest': R(0.08 * p), 'upperarm.L': R(-1.35 * p, 0, -0.1), 'upperarm.R': R(-1.35 * p, 0, 0.1),
        'forearm.L': R(-0.5 * (1 - p)), 'forearm.R': R(-0.5 * (1 - p)), 'thigh.L': R(-0.35 * p), 'shin.L': R(0.2 * p), 'thigh.R': R(0.25 * p),
    })(math.sin(min(1, t * 2) * math.pi / 2) if t < 0.5 else math.cos((t - 0.5) * math.pi)), step=2)
    # удар оружием: замах над плечом → рубящий удар вниз
    def attack(t):
        w = math.sin(min(1, t / 0.3) * math.pi / 2) if t < 0.3 else 1.0
        hit = 0.0 if t < 0.3 else math.sin(min(1, (t - 0.3) / 0.25) * math.pi / 2)
        back = 0.0 if t < 0.65 else (t - 0.65) / 0.35
        k = (1 - back)
        return {
            'spine': R(-0.1 * w * k + 0.25 * hit * k, -0.35 * w * k + 0.45 * hit * k, 0), 'chest': R(0, -0.2 * w * k + 0.25 * hit * k, 0),
            'upperarm.R': R((-2.4 * w + 1.5 * hit) * k, 0, (0.4 * w - 0.2 * hit) * k), 'forearm.R': R((-1.1 * w + 0.9 * hit) * k),
            'upperarm.L': R(-0.4 * k, 0, -0.25 * k), 'forearm.L': R(-0.6 * k),
            'thigh.L': R(-0.35 * hit * k), 'shin.L': R(0.25 * hit * k), 'thigh.R': R(0.2 * hit * k),
        }
    loop('Attack', 22, attack, step=1)
    # выстрел: рука вперёд, отдача
    loop('Shoot', 20, lambda t: (lambda p: {
        'spine': R(0, -0.25 * p, 0), 'upperarm.R': R(-1.55 * p, 0, 0.05), 'forearm.R': R(-0.05 * p), 'hand.R': R(0, 0, 0.25 * p if t < 0.4 else 0.15 * p),
        'upperarm.L': R(-0.3 * p, 0, -0.15), 'forearm.L': R(-0.5 * p), 'head': R(0, -0.15 * p, 0),
    })(min(1, t * 4) * (1 if t < 0.7 else (1 - t) / 0.3)), step=1)


# ---------------------------------------------------------------- материалы
def mats(extra=None):
    M = {
        'Skin': material('Skin', hexc('#f2c6a4'), 0.55),
        'Body': material('Body', hexc('#3557c9'), 0.85),
        'Pants': material('Pants', hexc('#2b3a5a'), 0.9),
        'Shoes': material('Shoes', hexc('#2a2a2e'), 0.5),
        'Sole': material('Sole', hexc('#f1efe9'), 0.6),
        'Hair': material('Hair', hexc('#5b3a1e'), 0.5),
        'Eye': material('Eye', hexc('#f8f6f2'), 0.15),
        'Pupil': material('Pupil', hexc('#0d0b0b'), 0.1),
        'EyeHL': material('EyeHL', hexc('#ffffff'), 0.1, emit=hexc('#ffffff')),
        'Mouth': material('Mouth', hexc('#5a1f22'), 0.6),
        'Teeth': material('Teeth', hexc('#fbf8f0'), 0.25),
        'Lip': material('Lip', hexc('#c9786e'), 0.45),
        'Wood': material('Wood', hexc('#7a5230'), 0.75),
        'Metal': material('Metal', hexc('#b8bec4'), 0.3, 0.8),
        'Iron': material('Iron', hexc('#2b2b2e'), 0.35, 0.7),
    }
    for k, v in (extra or {}).items():
        M[k] = material(k, hexc(v[0]), v[1] if len(v) > 1 else 0.7, v[2] if len(v) > 2 else 0.0, emit=hexc(v[3]) if len(v) > 3 else None)
    return M


def finish(arm, groups, out, anim='human', monster_args=None):
    joined = [join(objs, name) for name, objs in groups.items() if objs]
    # мягкие тени: запекаем ambient occlusion в цвета вершин (глазницы, под носом, у шеи, под волосами, складки)
    bake_ao(joined, floor=0.5, samples=96)
    for o in joined: bind(o, arm)
    if anim == 'human': human_anims(arm)
    else:
        from monsters import animations
        animations(arm, monster_args)
    arm.animation_data.action = bpy.data.actions['Idle']
    export(os.path.join(OUTDIR, out + '.glb'))
    print('EXPORTED', out)


# ---------------------------------------------------------------- персонажи
def build_character():
    """Базовый герой: футболка, джинсы, кроссовки, короткая стрижка."""
    reset(); M = mats(); arm = rig()
    body, headp, face, hair = [], [], [], []
    torso(body, M); pelvis(body, M); neck(body, M); arms(body, M, sleeve_to=1.17); hands(body, M); legs(body, M); sneakers(body, M)
    lathe(body, 'collar', [((0, 0.006, z), r, r * 0.92, {'chest': 1.0}) for z, r in ((1.345, 0.072), (1.36, 0.066))], M['Body'], segs=20, cap0=False, cap1=False)
    head(headp, M)
    hair_short(hair, M)
    # голова отдельным мешем Head (для робота её прячут), лицо — Face
    finish(arm, {'Body': body, 'Head': headp[:1] + headp[1:], 'Hair': hair}, 'character')


def build_hero_web():
    """«Паутинник»: облегающий костюм, маска с большими белыми линзами, серебряные нити, стрелялки паутины."""
    reset()
    M = mats({'Suit': ('#2a1745', 0.45), 'Suit2': ('#101014', 0.45), 'Lens': ('#f4f7ff', 0.1, 0.0, '#c8d4ff'), 'Web': ('#c9ccd6', 0.3, 0.6), 'Emblem': ('#d8f25a', 0.4, 0.0, '#5a6a10')})
    arm = rig()
    body, hd = [], []
    torso(body, M, 'Suit'); pelvis(body, M, 'Suit2'); neck(body, M, 'Suit')
    arms(body, M, skin='Suit', sleeve=None); hands(body, M, glove='Suit2'); legs(body, M, 'Suit2'); sneakers(body, M, 'Suit2', 'Suit', boots=True)
    weapon(body, M, 'web')
    # эмблема паука на груди (своя) и паутинные полосы
    part(body, 'sphere', 'emb', (0.025, 0.012, 0.035), (0, -0.112, 1.2), M['Emblem'], 'chest', segs=14, rings=8, smooth=True)
    for i in range(4):
        for x in (1, -1):
            a = (i - 1.5) * 0.35
            lathe(body, f'emblegs{i}{x}', [((0.01 * x, -0.114, 1.2 + a * 0.05), 0.003, 0.003, {'chest': 1.0}), ((0.05 * x, -0.108, 1.21 + a * 0.12), 0.0025, 0.0025, {'chest': 1.0})], M['Emblem'], segs=6)
    for z in (0.98, 1.06, 1.14, 1.24):
        lathe(body, f'webline{z}', [((0.155 * math.cos(a) * (1 + (z - 1) * 0.15), -0.105 * math.sin(a) - 0.002, z + 0.01 * math.sin(a * 3)), 0.0025, 0.0025, torso_w(z)) for a in [math.radians(d) for d in range(200, 341, 20)]], M['Web'], segs=6)
    head(hd, M, skin='Suit', mouth_open=False, ears=False, lips='Suit', brow='Suit', nose_k=0.7)
    for x in (1, -1):
        part(hd, 'sphere', 'lensrim', (0.05, 0.018, 0.036), (0.043 * x, -0.088, HC + 0.014), M['Suit2'], 'head', rot=(0, 0, -0.45 * x), segs=24, rings=12, smooth=True)
        part(hd, 'sphere', 'lens', (0.043, 0.016, 0.029), (0.043 * x, -0.095, HC + 0.014), M['Lens'], 'head', rot=(0, 0, -0.45 * x), segs=24, rings=12, smooth=True)
    finish(arm, {'Body': body, 'Head': hd}, 'hero_web')


def build_wanderer():
    """«Бродяга Михалыч»: длинное пальто с заплатами, вязаная шапка, шарф, борода, посох."""
    reset()
    M = mats({'Coat': ('#5a4632', 0.9), 'Patch': ('#7a5a3a', 0.9), 'Scarf': ('#8a2a2a', 0.9), 'Beanie': ('#3d5a4a', 0.95), 'Beard': ('#b8b0a4', 0.8)})
    M['Skin'] = material('SkinW', hexc('#e8b896'), 0.6)
    M['Lip'] = material('LipW', hexc('#b0645a'), 0.5)
    M['Hair'] = M['Beard']
    arm = rig()
    body, hd = [], []
    torso(body, M, 'Coat', bulk=1.08); pelvis(body, M, 'Pants', bulk=1.05); neck(body, M)
    arms(body, M, skin='Coat', sleeve=None, bulk=1.15); hands(body, M); legs(body, M, 'Pants', bulk=1.05); sneakers(body, M, 'Shoes', 'Shoes', boots=True)
    # полы пальто до колен
    lathe(body, 'coatskirt', [((0, 0.004, z), rx, ry, blend('hips', 'spine', 0.0) if z > 0.85 else {'hips': 0.6, 'thigh.L': 0.2, 'thigh.R': 0.2}) for z, rx, ry in
                              [(0.98, 0.16, 0.112), (0.92, 0.168, 0.118), (0.86, 0.175, 0.125), (0.78, 0.188, 0.132), (0.7, 0.2, 0.14), (0.61, 0.21, 0.148), (0.52, 0.22, 0.155)]], M['Coat'], segs=40, cap0=False, cap1=False,
                              shape=lambda i, a, c: 1 + drape(c.z, 0.95, 0.52, 0.06, a, 8))
    part(body, 'sphere', 'patch', (0.04, 0.01, 0.04), (0.08, -0.13, 0.75), M['Patch'], 'hips', segs=12, rings=6, smooth=True)
    lathe(body, 'scarf', [((0, 0.004, z), r, r * 0.9, {'chest': 0.5, 'neck': 0.5}) for z, r in ((1.33, 0.085), (1.37, 0.075), (1.4, 0.06))], M['Scarf'], segs=20)
    lathe(body, 'scarfend', [((0.04, -0.07, 1.36), 0.02, 0.012, {'chest': 1.0}), ((0.06, -0.12, 1.2), 0.025, 0.01, {'chest': 1.0})], M['Scarf'], segs=8)
    weapon(body, M, 'staff')
    head(hd, M, mouth_open=False, nose_k=1.35, brow='Beard')
    part(hd, 'sphere', 'rednose', (0.013, 0.012, 0.012), (0, -0.124, HC - 0.032), material('RedNose', hexc('#d07a6a'), 0.5), 'head', segs=12, rings=8, smooth=True)
    hair_beard(hd, M, 'Beard')
    beard_strands(hd, M, 'Beard')
    hair_strands(hd, M, 'Beard', n=40, seed=8, fringe=False, length=0.35, nape=2.0, width=0.009)
    lathe(hd, 'beanie', [((0, 0.006, HC + z), r, r * 1.05, {'head': 1.0}) for z, r in ((0.03, 0.114), (0.07, 0.113), (0.105, 0.102), (0.13, 0.082), (0.145, 0.055))], M['Beanie'], segs=32, cap0=False,
          shape=lambda i, a, c: 1 + 0.025 * abs(math.sin(a * 14)))
    lathe(hd, 'beaniecuff', [((0, 0.006, HC + z), 0.12, 0.126, {'head': 1.0}) for z in (0.02, 0.05)], M['Beanie'], segs=28, cap0=False, cap1=False)
    finish(arm, {'Body': body, 'Head': hd}, 'wanderer')


def build_folk_girl():
    """«Маруся»: сарафан с белой каймой, рубашка с пышными рукавами, платок, коса, сковородка."""
    reset()
    M = mats({'Dress': ('#2f7a52', 0.85), 'Trim': ('#f3ead2', 0.8), 'Blouse': ('#f4f1ea', 0.85), 'Scarf': ('#2b4c9a', 0.8), 'Dots': ('#f4f1ea', 0.8), 'Boots': ('#8a2a1e', 0.5)})
    M['Hair'] = material('Blond', hexc('#d9a94e'), 0.5)
    M['Skin'] = material('SkinG', hexc('#f6d2b8'), 0.55)
    arm = rig()
    body, hd = [], []
    torso(body, M, 'Dress', bulk=0.92); neck(body, M, r=0.038)
    arms(body, M, sleeve='Blouse', sleeve_to=0.9, bulk=0.9, cuff='Blouse'); hands(body, M, k=0.9)
    legs(body, M, 'Skin', to=0.09, bulk=0.85); sneakers(body, M, 'Boots', 'Boots', k=0.9, boots=True)
    # сарафан — расширяется книзу
    lathe(body, 'skirt', [((0, 0.004, z), rx, ry, w) for z, rx, ry, w in [
        (1.0, 0.135, 0.095, {'hips': 0.5, 'spine': 0.5}), (0.9, 0.17, 0.12, {'hips': 1.0}), (0.74, 0.21, 0.16, {'hips': 0.7, 'thigh.L': 0.15, 'thigh.R': 0.15}),
        (0.56, 0.245, 0.19, {'hips': 0.5, 'thigh.L': 0.25, 'thigh.R': 0.25}), (0.5, 0.25, 0.195, {'hips': 0.5, 'thigh.L': 0.25, 'thigh.R': 0.25})]],
        M['Dress'], segs=48, cap0=False, cap1=False, mats=[M['Trim']], band=lambda i: 1 if i >= 3 else 0, shape=lambda i, a, c: 1 + drape(c.z, 0.92, 0.5, 0.05, a, 11))
    for z in (1.12, 1.24):
        lathe(body, f'strap{z}', [((x * 0.075, -0.1, z), 0.008, 0.004, torso_w(z)) for x in (-1, 1)], M['Trim'], segs=6)
    head(hd, M, iris='#3a6aa8', lashes=True, jaw=0.26, mouth_open=False)
    # платок: оболочка вокруг головы + узел под подбородком
    hair_shell(hd, M, 'Scarf', scale=(0.114, 0.122, 0.13), off=(0, 0.01, 0.0), cut=lambda x, y, z: (y < -0.055 and z > -0.07 and z < 0.075) or (y < -0.03 and z < -0.07), name='kerchief')
    part(hd, 'sphere', 'knot', (0.03, 0.025, 0.025), (0, -0.07, HC - 0.12), M['Scarf'], 'head', segs=14, rings=8, smooth=True)
    for i in range(26):
        th, ph = 0.35 + (i % 4) * 0.33, i * 2.39
        if math.cos(ph) > 0.4 and th > 0.6: continue
        p = scalp(th, ph, 1.135)
        part(hd, 'sphere', f'dot{i}', (0.007, 0.007, 0.0035), tuple(p), M['Dots'], 'head', rot=(th, 0, -ph), segs=10, rings=6, smooth=True)
    # чёлка из-под платка — пряди
    import random
    rnd = random.Random(4)
    for i in range(18):
        ph = -0.55 + i * (1.1 / 17)
        pts = [scalp(0.62 + u * 0.32, ph + rnd.uniform(-0.04, 0.04), 1.06 + 0.02 * math.sin(u * 3)) for u in (0, 0.33, 0.66, 1.0)]
        lathe(hd, f'bang{i}', [(tuple(p), 0.008 * (1 - 0.6 * k / 3), 0.0035, {'head': 1.0}) for k, p in enumerate(pts)], M['Hair'], segs=6)
    for j in range(3):
        rings = []
        for k in range(25):
            u = k / 24
            z = HC - 0.02 - u * 0.38
            y = 0.1 + u * 0.03
            ph = u * 14 + j * 2.09
            w = {'head': 1.0} if z > HC - 0.1 else {'neck': 1.0} if z > 1.3 else {'chest': 1.0}
            rings.append(((math.cos(ph) * 0.011, y + math.sin(ph) * 0.007, z), 0.013 * (1 - 0.45 * u), 0.011 * (1 - 0.45 * u), w))
        lathe(hd, f'braid{j}', rings, M['Hair'], segs=8)
    part(hd, 'sphere', 'ribbon', (0.03, 0.012, 0.02), (0, 0.13, 1.17), M['Scarf'], 'chest', segs=12, rings=6, smooth=True)
    weapon(body, M, 'pan')
    finish(arm, {'Body': body, 'Head': hd}, 'folk_girl')


def build_bear():
    """«Михайло Потапыч»: медведь на задних лапах — мех, светлое брюхо, морда, когти, бревно."""
    reset()
    M = mats({'Fur': ('#6b4426', 0.95), 'Belly': ('#a8784a', 0.95), 'Snout': ('#c9a074', 0.9), 'Nose': ('#1a1210', 0.2), 'Claw': ('#efe6d4', 0.4)})
    arm = rig()
    body, hd = [], []
    prof = [(0.85, 0.17, 0.14), (0.95, 0.21, 0.18), (1.05, 0.23, 0.2), (1.15, 0.225, 0.19), (1.24, 0.21, 0.17), (1.3, 0.19, 0.14), (1.36, 0.12, 0.1), (1.4, 0.08, 0.07)]
    torso(body, M, 'Fur', profile=prof); neck(body, M, 'Fur', r=0.07)
    part(body, 'sphere', 'belly', (0.16, 0.08, 0.2), (0, -0.115, 1.03), M['Belly'], 'spine', segs=24, rings=14, smooth=True)
    arms(body, M, skin='Fur', sleeve=None, bulk=1.6); hands(body, M, mat='Fur', claws='Claw', k=1.35)
    legs(body, M, 'Fur', bulk=1.45)
    for s, x in (('L', 1), ('R', -1)):
        part(body, 'sphere', f'paw.{s}', (0.065, 0.12, 0.05), (LX * x, -0.045, 0.045), M['Fur'], f'foot.{s}', segs=20, rings=12, smooth=True)
        for i in (-1, 0, 1):
            part(body, 'cone', f'toeclaw{i}.{s}', (0.008, 0.008, 0.025), (LX * x + i * 0.025, -0.16, 0.03), M['Claw'], f'foot.{s}', rot=(math.radians(90), 0, 0), segs=8)
    weapon(body, M, 'log')
    # пучки меха на груди, плечах и загривке
    import random
    rnd = random.Random(11)
    for i in range(70):
        z = rnd.uniform(1.0, 1.38); a = rnd.uniform(0, math.pi * 2)
        r0 = 0.2
        base = Vector((math.cos(a) * r0 * 1.0, math.sin(a) * r0 * 0.85, z))
        tip = base + Vector((math.cos(a) * 0.03, math.sin(a) * 0.03, -0.035))
        lathe(body, f'fur{i}', [(tuple(base), 0.016, 0.01, torso_w(z)), (tuple(tip), 0.003, 0.002, torso_w(z))], M['Fur'], segs=5)
    # голова медведя
    o = part(hd, 'sphere', 'skull', (0.13, 0.13, 0.12), (0, 0.0, HC), M['Fur'], 'head', segs=36, rings=22, smooth=True)
    part(hd, 'sphere', 'snout', (0.065, 0.085, 0.055), (0, -0.115, HC - 0.035), M['Snout'], 'head', segs=24, rings=14, smooth=True)
    part(hd, 'sphere', 'nose', (0.03, 0.02, 0.02), (0, -0.195, HC - 0.012), M['Nose'], 'head', segs=16, rings=10, smooth=True)
    part(hd, 'sphere', 'mouthline', (0.03, 0.008, 0.004), (0, -0.19, HC - 0.06), M['Nose'], 'head', segs=12, rings=6, smooth=True)
    for x in (1, -1):
        part(hd, 'sphere', 'ear', (0.042, 0.022, 0.042), (0.09 * x, 0.02, HC + 0.1), M['Fur'], 'head', segs=18, rings=10, smooth=True)
        part(hd, 'sphere', 'earin', (0.025, 0.01, 0.025), (0.09 * x, 0.002, HC + 0.1), M['Snout'], 'head', segs=14, rings=8, smooth=True)
        part(hd, 'sphere', 'eye', (0.014, 0.01, 0.015), (0.045 * x, -0.115, HC + 0.03), M['Pupil'], 'head', segs=14, rings=8, smooth=True)
        part(hd, 'sphere', 'eyehl', (0.004, 0.002, 0.004), (0.049 * x, -0.125, HC + 0.036), M['EyeHL'], 'head', segs=8, rings=6, smooth=True)
        lathe(hd, 'brow', [((0.025 * x, -0.12, HC + 0.05), 0.006, 0.004, {'head': 1.0}), ((0.06 * x, -0.112, HC + 0.055), 0.005, 0.004, {'head': 1.0})], M['Belly'], segs=6)
    finish(arm, {'Body': body, 'Head': hd}, 'bear')


def build_grin_cat():
    """«Улыбчивый кот»: высокий полосатый кот-великан с огромной улыбкой, хвостом и мультяшным молотом."""
    reset()
    M = mats({'Fur': ('#5b3a8a', 0.8), 'Stripe': ('#2a1a44', 0.8), 'Muzzle': ('#e8dff2', 0.8), 'CatEye': ('#f5d23a', 0.2, 0.0, '#8a7000'), 'Mallet': ('#c23a3a', 0.5), 'Glove': ('#f4f4f0', 0.7)})
    arm = rig()
    body, hd = [], []
    stripes = lambda i: 1 if i % 2 else 0
    prof = [(0.9, 0.13, 0.1), (0.98, 0.115, 0.09), (1.06, 0.118, 0.092), (1.14, 0.13, 0.098), (1.22, 0.14, 0.1), (1.29, 0.145, 0.098), (1.33, 0.12, 0.08), (1.36, 0.06, 0.05)]
    lathe(body, 'torso', [((0, 0.004, z), rx, ry, torso_w(z)) for z, rx, ry in prof], M['Fur'], segs=26, cap0=False, mats=[M['Stripe']], band=stripes)
    pelvis(body, M, 'Fur', bulk=0.85); neck(body, M, 'Fur', r=0.035)
    for s, x in (('L', 1), ('R', -1)):
        zs = [1.345, 1.26, 1.18, 1.1, 1.04, 0.98, 0.92, 0.86, 0.84]
        lathe(body, f'arm.{s}', [(arm_pt(z, x), 0.032, 0.03, arm_w(z, s)) for z in zs], M['Fur'], segs=14, mats=[M['Stripe']], band=stripes)
        zl = [0.9, 0.8, 0.7, 0.6, 0.5, 0.42, 0.34, 0.24, 0.14, 0.08]
        lathe(body, f'leg.{s}', [((LX * x, 0.004, z), 0.045 - (0.9 - z) * 0.025, 0.043 - (0.9 - z) * 0.025, leg_w(z, s)) for z in zl], M['Fur'], segs=14, cap0=False, mats=[M['Stripe']], band=stripes)
        part(body, 'sphere', f'foot.{s}', (0.05, 0.1, 0.04), (LX * x, -0.04, 0.04), M['Glove'], f'foot.{s}', segs=18, rings=10, smooth=True)
    hands(body, M, glove='Glove', k=1.15)
    # хвост
    lathe(body, 'tail', [((0, 0.1 + d * 0.5, 0.85 + math.sin(d * 4) * 0.12 + d * 0.3), 0.025 - d * 0.012, 0.025 - d * 0.012, {'hips': 1.0}) for d in [k / 8 for k in range(9)]], M['Fur'], segs=12, mats=[M['Stripe']], band=stripes)
    weapon(body, M, 'mallet')
    o = part(hd, 'sphere', 'skull', (0.13, 0.115, 0.115), (0, 0.0, HC + 0.01), M['Fur'], 'head', segs=36, rings=22, smooth=True)
    part(hd, 'sphere', 'muzzle', (0.085, 0.05, 0.05), (0, -0.09, HC - 0.04), M['Muzzle'], 'head', segs=24, rings=14, smooth=True)
    # огромная улыбка
    pts = [(math.sin(a) * 0.095, -0.098 - math.cos(a) * 0.035 + 0.035, HC - 0.04 - math.cos(a) * 0.035) for a in [math.radians(d) for d in range(-80, 81, 16)]]
    lathe(hd, 'grin', [(p, 0.012, 0.008, {'head': 1.0}) for p in pts], M['Mouth'], segs=10)
    for i, p in enumerate(pts[1:-1]):
        part(hd, 'cone', f'fang{i}', (0.006, 0.006, 0.012), (p[0], p[1] - 0.008, p[2] + 0.006), M['Teeth'], 'head', rot=(math.pi, 0, 0), segs=6)
    part(hd, 'sphere', 'nose', (0.016, 0.012, 0.01), (0, -0.14, HC - 0.012), M['Lip'], 'head', segs=12, rings=8, smooth=True)
    for x in (1, -1):
        part(hd, 'sphere', 'eye', (0.03, 0.014, 0.036), (0.048 * x, -0.098, HC + 0.035), M['CatEye'], 'head', segs=20, rings=12, smooth=True)
        part(hd, 'sphere', 'slit', (0.006, 0.006, 0.03), (0.048 * x, -0.11, HC + 0.035), M['Pupil'], 'head', segs=10, rings=8, smooth=True)
        part(hd, 'cone', 'ear', (0.05, 0.03, 0.1), (0.075 * x, 0.0, HC + 0.13), M['Fur'], 'head', rot=(0, -0.3 * x, 0), segs=16, smooth=True)
        part(hd, 'cone', 'earin', (0.03, 0.012, 0.06), (0.073 * x, -0.018, HC + 0.12), M['Muzzle'], 'head', rot=(0, -0.3 * x, 0), segs=12, smooth=True)
        for k in (-1, 1):
            lathe(hd, 'whisker', [((0.06 * x, -0.13, HC - 0.03 + k * 0.01), 0.002, 0.002, {'head': 1.0}), ((0.16 * x, -0.12, HC - 0.03 + k * 0.03), 0.001, 0.001, {'head': 1.0})], M['Muzzle'], segs=4)
    finish(arm, {'Body': body, 'Head': hd}, 'grin_cat')


def build_jack():
    """Джек Потрошитель (хоррор): цилиндр, длинное чёрное пальто, плащ, красный шарф, перчатки, нож."""
    reset()
    M = mats({'Coat': ('#121114', 0.7), 'Hat': ('#0b0a0c', 0.4), 'Scarf': ('#5a0a0a', 0.8), 'Glove': ('#1a1616', 0.5), 'PaleSkin': ('#cfc6ba', 0.6), 'Glow': ('#ff3020', 0.2, 0.0, '#ff1a0a')})
    M['Skin'] = M['PaleSkin']
    arm = rig()
    body, hd = [], []
    torso(body, M, 'Coat', bulk=1.05); pelvis(body, M, 'Coat'); neck(body, M)
    arms(body, M, skin='Coat', sleeve=None, bulk=1.1); hands(body, M, glove='Glove'); legs(body, M, 'Coat', bulk=0.95); sneakers(body, M, 'Hat', 'Hat', boots=True)
    lathe(body, 'cloak', [((0, 0.02 + (1.34 - z) * 0.05, z), rx, ry, {'chest': 0.7, 'spine': 0.3} if z > 1.0 else {'hips': 0.6, 'thigh.L': 0.2, 'thigh.R': 0.2}) for z, rx, ry in
                          [(1.34, 0.2, 0.14), (1.2, 0.23, 0.17), (1.0, 0.25, 0.19), (0.75, 0.27, 0.21), (0.45, 0.29, 0.23)]], M['Coat'], segs=44, cap0=False, cap1=False,
                          shape=lambda i, a, c: 1 + drape(c.z, 1.2, 0.45, 0.07, a, 9))
    lathe(body, 'scarf', [((0, 0.004, z), r, r * 0.92, {'chest': 0.5, 'neck': 0.5}) for z, r in ((1.33, 0.08), (1.37, 0.072), (1.41, 0.058))], M['Scarf'], segs=20)
    weapon(body, M, 'knife')
    head(hd, M, mouth_open=False, iris='#2a0a0a', jaw=0.3, brow='Hat')
    for x in (1, -1):
        part(hd, 'sphere', 'glow', (0.006, 0.003, 0.006), (0.037 * x, -0.1022, HC + 0.006), M['Glow'], 'head', segs=10, rings=6, smooth=True)
    part(hd, 'sphere', 'mustache', (0.04, 0.012, 0.009), (0, -0.11, HC - 0.046), M['Hat'], 'head', segs=14, rings=8, smooth=True)
    lathe(hd, 'hat', [((0, 0.004, HC + z), r, r, {'head': 1.0}) for z, r in ((0.08, 0.098), (0.16, 0.096), (0.24, 0.1), (0.27, 0.1))], M['Hat'], segs=30, cap0=False)
    part(hd, 'cyl', 'brim', (0.17, 0.17, 0.008), (0, 0.004, HC + 0.08), M['Hat'], 'head', segs=36, smooth=True)
    part(hd, 'cyl', 'band', (0.1, 0.1, 0.02), (0, 0.004, HC + 0.095), M['Scarf'], 'head', segs=30, smooth=True)
    finish(arm, {'Body': body, 'Head': hd}, 'jack', anim='monster', monster_args=dict(hunch=0.18, tilt=0.18, jitter=0.12, limp=0.0, reach=0.6, height=HC))


BUILDERS = {'character': build_character, 'hero_web': build_hero_web, 'wanderer': build_wanderer, 'folk_girl': build_folk_girl,
            'bear': build_bear, 'grin_cat': build_grin_cat, 'jack': build_jack}

if __name__ == '__main__':
    for n in (sys.argv[1:] or list(BUILDERS)):
        BUILDERS[n]()
