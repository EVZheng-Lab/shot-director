# 生成 LAYOUT 小人资产库：LAYOUT小人.blend
#   有手脚：desk-break 木头人偶(MIT) 换成纯色材质 + 正面撞色色块(头一条、胸一块，跟骨骼走)
#   无手脚：圆球头 + 圆锥身体 + 正面撞色色块，三根骨头(root/body/head)
# 运行：blender -b --factory-startup --python build_layout_figures.py
import bpy, bmesh, math, os
from mathutils import Vector, Matrix

HERE = os.path.dirname(os.path.abspath(__file__))
MANNEQUIN = os.path.join(HERE, '..', 'desk-break', 'library', 'mannequin.blend')
OUT = os.path.join(HERE, 'LAYOUT小人.blend')

BODY_RGB = (0.80, 0.80, 0.80)    # 身体：浅灰
JOINT_RGB = (0.55, 0.55, 0.55)   # 关节：深一档灰，读得出关节
FRONT_RGB = (1.00, 0.42, 0.05)   # 正面色块：橙，跟灰身体撞色

for ob in list(bpy.data.objects):
    bpy.data.objects.remove(ob)
for c in list(bpy.data.collections):
    bpy.data.collections.remove(c)
sc = bpy.context.scene


def flat_mat(name, rgb):
    m = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    m.diffuse_color = (*rgb, 1.0)
    m.use_nodes = True
    bsdf = next(n for n in m.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
    bsdf.inputs['Base Color'].default_value = (*rgb, 1.0)
    bsdf.inputs['Roughness'].default_value = 0.8
    return m


M_BODY = flat_mat('LAYOUT_身体', BODY_RGB)
M_JOINT = flat_mat('LAYOUT_关节', JOINT_RGB)
M_FRONT = flat_mat('LAYOUT_正面', FRONT_RGB)


def new_coll(name):
    c = bpy.data.collections.new(name)
    sc.collection.children.link(c)
    return c


def box(name, coll, size, mat):
    me = bpy.data.meshes.new(name)
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    bmesh.ops.scale(bm, vec=Vector(size), verts=bm.verts)
    bm.to_mesh(me)
    bm.free()
    me.materials.append(mat)
    ob = bpy.data.objects.new(name, me)
    coll.objects.link(ob)
    return ob


def parent_to_bone(ob, rig, bone, world):
    ob.parent = rig
    ob.parent_type = 'BONE'
    ob.parent_bone = bone
    bpy.context.view_layer.update()
    ob.matrix_world = world


def smooth(ob):
    for p in ob.data.polygons:
        p.use_smooth = True


# ================= 有手脚 =================
C1 = new_coll('LAYOUT_小人_有手脚')
with bpy.data.libraries.load(MANNEQUIN, link=False) as (src, dst):
    dst.objects = [n for n in src.objects if n in ('rig', 'mannequin')]
rig1, body1 = None, None
for ob in dst.objects:
    C1.objects.link(ob)
    if ob.type == 'ARMATURE':
        rig1 = ob
    else:
        body1 = ob
rig1.name, body1.name = 'LAYOUT_有手脚_rig', 'LAYOUT_有手脚_身体'
rig1.data.name = 'LAYOUT_有手脚_rig'
# 换掉木纹贴图(原来引用 wood.png，路径一挪就丢)
for i, slot in enumerate(body1.material_slots):
    slot.material = M_JOINT if 'joint' in (slot.material.name if slot.material else '') else M_BODY
for m in list(bpy.data.materials):
    if m.users == 0 and not m.name.startswith('LAYOUT_'):
        bpy.data.materials.remove(m)
for im in list(bpy.data.images):
    if im.users == 0:
        bpy.data.images.remove(im)

# 用顶点组找头和胸的前表面(人偶面朝 -Y)
me = body1.data
gi = {g.name: g.index for g in body1.vertex_groups}


def verts_of(group, zmin=-9, zmax=9):
    out = []
    for v in me.vertices:
        for g in v.groups:
            if g.group == gi[group] and g.weight > 0.5 and zmin <= v.co.z <= zmax:
                out.append(v.co)
    return out


head = verts_of('neck', zmin=1.5)
hz = (min(v.z for v in head) + max(v.z for v in head)) / 2
head_front = min(v.y for v in head if abs(v.z - hz) < 0.03)
chest = verts_of('spine', zmin=1.22, zmax=1.34)
chest_front = min(v.y for v in chest)
print('head z', hz, 'head front y', head_front, 'chest front y', chest_front)

f1 = box('LAYOUT_有手脚_正面_头', C1, (0.11, 0.04, 0.035), M_FRONT)
parent_to_bone(f1, rig1, 'neck', Matrix.Translation((0, head_front + 0.012, hz + 0.01)))
f2 = box('LAYOUT_有手脚_正面_胸', C1, (0.13, 0.04, 0.06), M_FRONT)
parent_to_bone(f2, rig1, 'spine', Matrix.Translation((0, chest_front + 0.012, 1.28)))

# ================= 无手脚 =================
C2 = new_coll('LAYOUT_小人_无手脚')
OX = 1.0  # 库文件里并排放，实例偏移会抵消
CONE_H, CONE_R0, CONE_R1 = 1.38, 0.25, 0.06
HEAD_R, HEAD_Z = 0.15, 1.58

arm = bpy.data.armatures.new('LAYOUT_无手脚_rig')
rig2 = bpy.data.objects.new('LAYOUT_无手脚_rig', arm)
C2.objects.link(rig2)
rig2.location = (OX, 0, 0)
bpy.context.view_layer.objects.active = rig2
bpy.ops.object.mode_set(mode='EDIT')
eb = arm.edit_bones
b_root = eb.new('root'); b_root.head, b_root.tail = (0, 0, 0), (0, 0.3, 0)
b_body = eb.new('body'); b_body.head, b_body.tail = (0, 0, 0.02), (0, 0, 0.9); b_body.parent = b_root
b_head = eb.new('head'); b_head.head, b_head.tail = (0, 0, 1.40), (0, 0, 1.75); b_head.parent = b_body
bpy.ops.object.mode_set(mode='OBJECT')
arm.display_type = 'STICK'

me = bpy.data.meshes.new('LAYOUT_无手脚_身体')
bm = bmesh.new()
bmesh.ops.create_cone(bm, cap_ends=True, segments=32, radius1=CONE_R0, radius2=CONE_R1, depth=CONE_H)
bmesh.ops.translate(bm, vec=(0, 0, CONE_H / 2), verts=bm.verts)
bm.to_mesh(me); bm.free()
me.materials.append(M_BODY)
cone = bpy.data.objects.new('LAYOUT_无手脚_身体', me)
C2.objects.link(cone)
smooth(cone)
parent_to_bone(cone, rig2, 'body', Matrix.Translation((OX, 0, 0)))

me = bpy.data.meshes.new('LAYOUT_无手脚_头')
bm = bmesh.new()
bmesh.ops.create_uvsphere(bm, u_segments=32, v_segments=16, radius=HEAD_R)
bm.to_mesh(me); bm.free()
me.materials.append(M_BODY)
hd = bpy.data.objects.new('LAYOUT_无手脚_头', me)
C2.objects.link(hd)
smooth(hd)
parent_to_bone(hd, rig2, 'head', Matrix.Translation((OX, 0, HEAD_Z)))

f3 = box('LAYOUT_无手脚_正面_头', C2, (0.17, 0.05, 0.05), M_FRONT)
parent_to_bone(f3, rig2, 'head', Matrix.Translation((OX, -HEAD_R + 0.018, HEAD_Z + 0.02)))
cz = 0.85
r_at = CONE_R0 + (CONE_R1 - CONE_R0) * cz / CONE_H
slope = math.atan((CONE_R0 - CONE_R1) / CONE_H)
f4 = box('LAYOUT_无手脚_正面_胸', C2, (0.15, 0.05, 0.08), M_FRONT)
parent_to_bone(f4, rig2, 'body',
               Matrix.Translation((OX, -r_at + 0.012, cz)) @ Matrix.Rotation(-slope, 4, 'X'))

C2.instance_offset = (OX, 0, 0)

# ================= 标记为资产 =================
# 视口实体模式常用「物体颜色」显示，物体颜色跟材质色同步
for ob in bpy.data.objects:
    if ob.type == 'MESH' and ob.data.materials:
        ob.color = tuple(ob.data.materials[0].diffuse_color)
C1.asset_mark()
C1.asset_data.description = '有手脚 LAYOUT 小人：desk-break 人偶(MIT)，15 骨，面朝 -Y；橙色块=正面'
C2.asset_mark()
C2.asset_data.description = '无手脚 LAYOUT 小人：圆球头+圆锥身体，骨头 root/body/head，面朝 -Y；橙色块=正面'
for c in (C1, C2):
    c.asset_data.tags.new('LAYOUT')

bpy.ops.wm.save_as_mainfile(filepath=OUT)
print('saved', OUT)
