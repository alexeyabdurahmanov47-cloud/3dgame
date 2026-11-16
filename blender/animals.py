# Собака и кот — генерируются в Blender 5.2 (bpy) → public/models/dog.glb, cat.glb
import sys, os, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bpy
from common import reset, material, hexc, part, join, armature, bind, new_action, key, export

DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'public', 'models')
os.makedirs(DIR, exist_ok=True)
R = lambda x=0, y=0, z=0: {'r': (x, y, z)}

def quadruped(name, fur, dark, size, ears_up):
    reset()
    F = material('Fur', hexc(fur), 0.8)
    D = material('Dark', hexc(dark), 0.8)
    E = material('Eye', hexc('#111111'), 0.2)
    N = material('Nose', hexc('#2d2d2d'), 0.3)
    W = material('White', hexc('#ffffff'), 0.6)
    s = size
    H = 0.36 * s  # высота спины
    bones = [
        ('body', (0, 0.18 * s, H), (0, -0.18 * s, H), None),
        ('head', (0, -0.22 * s, H + 0.08 * s), (0, -0.4 * s, H + 0.22 * s), 'body'),
        ('tail', (0, 0.26 * s, H + 0.04 * s), (0, 0.5 * s, H + 0.2 * s), 'body'),
    ]
    legs = {'FL': (0.1, -0.15), 'FR': (-0.1, -0.15), 'BL': (0.1, 0.17), 'BR': (-0.1, 0.17)}
    for k, (x, y) in legs.items():
        bones.append((f'leg.{k}', (x * s, y * s, H - 0.05 * s), (x * s, y * s, 0.02), 'body'))
    arm = armature(name, bones)
    p = []
    part(p, 'sphere', 'torso', (0.17 * s, 0.3 * s, 0.15 * s), (0, 0, H), F, 'body', segs=14, rings=8, smooth=True)
    part(p, 'sphere', 'belly', (0.13 * s, 0.22 * s, 0.1 * s), (0, -0.02 * s, H - 0.06 * s), W if name == 'Dog' else F, 'body', segs=12, rings=6, smooth=True)
    part(p, 'sphere', 'skull', (0.14 * s, 0.13 * s, 0.13 * s), (0, -0.33 * s, H + 0.17 * s), F, 'head', segs=14, rings=8, smooth=True)
    if name == 'Dog':
        part(p, 'cube', 'snout', (0.12 * s, 0.13 * s, 0.09 * s), (0, -0.46 * s, H + 0.13 * s), D, 'head', bevel=0.02 * s)
        part(p, 'sphere', 'nose', (0.03 * s, 0.025 * s, 0.025 * s), (0, -0.53 * s, H + 0.17 * s), N, 'head', segs=8, rings=4, smooth=True)
        part(p, 'cube', 'tongue', (0.04 * s, 0.05 * s, 0.01 * s), (0, -0.5 * s, H + 0.08 * s), material('Tongue', hexc('#ff7675')), 'head')
        for x in (1, -1):
            part(p, 'cube', 'ear', (0.05 * s, 0.03 * s, 0.13 * s), (0.11 * x * s, -0.3 * s, H + 0.21 * s), D, 'head', rot=(0, 0.35 * x, 0), bevel=0.01 * s)
    else:
        part(p, 'sphere', 'muzzle', (0.07 * s, 0.05 * s, 0.05 * s), (0, -0.44 * s, H + 0.14 * s), W, 'head', segs=10, rings=6, smooth=True)
        part(p, 'sphere', 'nose', (0.02 * s, 0.015 * s, 0.015 * s), (0, -0.49 * s, H + 0.17 * s), material('PinkNose', hexc('#ff8fab')), 'head', segs=6, rings=4, smooth=True)
        for x in (1, -1):
            part(p, 'cone', 'ear', (0.05 * s, 0.03 * s, 0.09 * s), (0.08 * x * s, -0.31 * s, H + 0.3 * s), F, 'head', segs=4, rot=(0, -0.25 * x, 0))
            part(p, 'cube', 'whisker', (0.12 * s, 0.003, 0.003), (0.1 * x * s, -0.47 * s, H + 0.13 * s), W, 'head')
    for x in (1, -1):
        part(p, 'sphere', 'eye', (0.025 * s, 0.015 * s, 0.03 * s), (0.06 * x * s, -0.44 * s, H + 0.22 * s), E, 'head', segs=8, rings=6, smooth=True)
    part(p, 'cyl', 'tailmesh', (0.035 * s, 0.035 * s, 0.3 * s), (0, 0.38 * s, H + 0.12 * s), F, 'tail', rot=(-0.7, 0, 0), segs=8, smooth=True)
    for k, (x, y) in legs.items():
        part(p, 'cyl', f'leg{k}', (0.045 * s, 0.045 * s, H - 0.03 * s), (x * s, y * s, (H - 0.03 * s) / 2 + 0.02), F, f'leg.{k}', segs=8, smooth=True)
        part(p, 'sphere', f'paw{k}', (0.05 * s, 0.065 * s, 0.03 * s), (x * s, y * s - 0.02 * s, 0.03), D if name == 'Dog' else W, f'leg.{k}', segs=8, rings=4, smooth=True)
    bind(join(p, name + 'Mesh'), arm)

    def loop(an, frames, fn, step=2):
        new_action(arm, an)
        for f in range(0, frames + 1, step):
            key(arm, f + 1, fn(f / frames))
    TAU = 2 * math.pi
    loop('Idle', 60, lambda t: {
        'body': {'r': (0, 0, 0), 's': (1 + 0.03 * math.sin(t * TAU), 1, 1 + 0.03 * math.sin(t * TAU))},
        'head': R(0.08 * math.sin(t * TAU), 0, 0.1 * math.sin(t * TAU * 0.5)),
        'tail': R(0, 0, 0.35 * math.sin(t * TAU * 2)),
    }, step=3)
    loop('Walk', 20, lambda t: {
        'body': {'r': (0, 0, 0), 'l': (0, 0, 0.015 * abs(math.cos(t * TAU)) * s)},
        'head': R(0.06 * math.sin(t * TAU * 2)),
        'tail': R(0, 0, 0.4 * math.sin(t * TAU * 2)),
        'leg.FL': R(0.5 * math.sin(t * TAU)), 'leg.BR': R(0.5 * math.sin(t * TAU)),
        'leg.FR': R(-0.5 * math.sin(t * TAU)), 'leg.BL': R(-0.5 * math.sin(t * TAU)),
    }, step=1)
    loop('Happy', 16, lambda t: {
        'body': {'r': (0, 0, 0), 'l': (0, 0, 0.08 * abs(math.sin(t * TAU)) * s)},
        'head': R(-0.25, 0, 0.15 * math.sin(t * TAU)),
        'tail': R(0, 0, 0.8 * math.sin(t * TAU * 3)),
        'leg.FL': R(-0.4 * abs(math.sin(t * TAU))), 'leg.FR': R(-0.4 * abs(math.sin(t * TAU))),
    }, step=1)
    arm.animation_data.action = bpy.data.actions['Idle']
    out = os.path.join(DIR, name.lower() + '.glb')
    export(out)
    print('EXPORTED', out)

quadruped('Dog', '#c68642', '#8d5524', 1.6, False)
quadruped('Cat', '#f39c12', '#e67e22', 1.1, True)
