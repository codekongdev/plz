"""Merge closed parts into one watertight surface with signed distance grids (geometry nodes).

Every part (body loft, limb capsules, paws) becomes its own SDF grid, the grids are unioned and the
zero level set is meshed. The concave seams where limbs meet the body are then rounded by smoothing
only the vertices near both surfaces, and the whole surface is lightly smoothed. The result is a single connected shell: no part surface sits inside another, so skinned
limbs can swing far (gallop) without a separate surface poking out at the leg roots.
"""
import bpy


def _node(nt, kind, x, y=0):
    n = nt.nodes.new(kind)
    n.location = (x, y)
    return n


def _sdf(nt, ob, voxel, band, y):
    info = _node(nt, "GeometryNodeObjectInfo", -600, y)
    info.inputs["Object"].default_value = ob
    sdf = _node(nt, "GeometryNodeMeshToSDFGrid", -300, y)
    sdf.inputs["Voxel Size"].default_value = voxel
    sdf.inputs["Band Width"].default_value = band
    nt.links.new(info.outputs["Geometry"], sdf.inputs["Mesh"])
    return sdf.outputs["SDF Grid"]


def _union(nt, grids, x, y):
    boolean = _node(nt, "GeometryNodeSDFGridBoolean", x, y)
    boolean.operation = 'UNION'
    for g in grids:
        nt.links.new(g, boolean.inputs["Grid 2"])
    return boolean.outputs[0]


def union_mesh(name, base, groups, cfg):
    """Return a new mesh: the SDF union of the `base` parts and all `groups` (limbs), with the leg
    roots filleted in mesh space and a light overall smoothing. All parts are objects at identity
    transform; they and their meshes are removed.

    Only steps that repeat bit for bit are used: mesh -> SDF of each part, union, SDF -> mesh at
    level 0, and Blender's Smooth modifier. OpenVDB's SDF Fillet/Laplacian filters and re-distancing
    a voxel mesh (for a closing) change some vertices by ~1e-7 m from run to run."""
    voxel = cfg["voxelCm"] * 0.01
    band = cfg.get("bandVoxels", 3)
    ng = bpy.data.node_groups.new(f"{name}_union", 'GeometryNodeTree')
    ng.interface.new_socket("Geometry", in_out='OUTPUT', socket_type='NodeSocketGeometry')
    limbs = [ob for g in groups for ob in g]
    grids = [_sdf(ng, ob, voxel, band, -i * 200) for i, ob in enumerate(list(base) + limbs)]
    to_mesh = _node(ng, "GeometryNodeGridToMesh", 400)
    to_mesh.inputs["Threshold"].default_value = 0.0
    to_mesh.inputs["Adaptivity"].default_value = 0.0
    ng.links.new(_union(ng, grids, 200, 0), to_mesh.inputs["Grid"])
    out = _node(ng, "NodeGroupOutput", 600)
    ng.links.new(to_mesh.outputs["Mesh"], out.inputs[0])

    holder = bpy.data.objects.new(f"{name}_holder", bpy.data.meshes.new(f"{name}_holder"))
    bpy.context.scene.collection.objects.link(holder)
    mod = holder.modifiers.new("Union", 'NODES')
    mod.node_group = ng
    dg = bpy.context.evaluated_depsgraph_get()
    me = bpy.data.meshes.new_from_object(holder.evaluated_get(dg))
    if not me.polygons:
        raise SystemExit("SDF union produced an empty mesh; check part normals and voxel size")
    me.name = name
    for p in me.polygons:
        p.use_smooth = True
    weights = _junction_weights(me, base, limbs, cfg.get("filletCm", 0.0) * 0.01) if limbs else None
    for ob in list(base) + limbs + [holder]:
        data = ob.data
        bpy.data.objects.remove(ob, do_unlink=True)
        bpy.data.meshes.remove(data)
    bpy.data.node_groups.remove(ng)
    if weights and cfg.get("filletIterations"):
        me = _smooth(me, cfg["filletIterations"], cfg.get("filletFactor", 0.5), weights)
    if cfg.get("smoothIterations"):
        me = _smooth(me, cfg["smoothIterations"], cfg.get("smoothFactor", 0.5))
    return me


def _junction_weights(me, base, limbs, r):
    """Per-vertex weight for the leg-root fillet: 1 on the crease where the body surface and a limb
    surface meet, falling to 0 once the vertex is `r` away from either of them."""
    if r <= 0:
        return None
    from mathutils.bvhtree import BVHTree
    dg = bpy.context.evaluated_depsgraph_get()
    body = [BVHTree.FromObject(ob, dg) for ob in base]
    legs = [BVHTree.FromObject(ob, dg) for ob in limbs]
    out = []
    for v in me.vertices:
        db = min(t.find_nearest(v.co)[3] for t in body)
        dl = min(t.find_nearest(v.co)[3] for t in legs)
        w = max(0.0, 1.0 - max(db, dl) / r)
        out.append(w * w * (3 - 2 * w))
    return out


def _smooth(me, iterations, factor, weights=None):
    """Blender Smooth modifier (optionally limited to a weighted vertex group), applied."""
    ob = bpy.data.objects.new(me.name, me)
    bpy.context.scene.collection.objects.link(ob)
    mod = ob.modifiers.new("Smooth", 'SMOOTH')
    mod.factor, mod.iterations = factor, iterations
    if weights:
        vg = ob.vertex_groups.new(name="fillet")
        for i, w in enumerate(weights):
            if w > 0:
                vg.add([i], w, 'REPLACE')
        mod.vertex_group = vg.name
    dg = bpy.context.evaluated_depsgraph_get()
    out = bpy.data.meshes.new_from_object(ob.evaluated_get(dg))
    name = me.name
    bpy.data.objects.remove(ob, do_unlink=True)
    bpy.data.meshes.remove(me)
    out.name = name
    if weights:                      # the helper group must not reach the rig step
        tmp = bpy.data.objects.new("tmp_clear_groups", out)
        tmp.vertex_groups.clear()
        bpy.data.objects.remove(tmp, do_unlink=True)
    return out
