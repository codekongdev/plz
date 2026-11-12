"""Legs and toes from a vertex skeleton with the Skin modifier (bird body plan).

The chain (hip joint -> heel -> ankle) uses the spec skeleton points; toes are three points each
(middle, claw base, claw tip) given for the left foot and mirrored. Faces past the claw base of
each toe get the claw material.
"""
import bpy

from .common import P, principled, srgb


def build_legs(oid, cfg, skeleton, parent):
    verts, radii, edges, roots, claws = [], [], [], [], []

    def add(p, r):
        verts.append(p)
        radii.append(r * 0.01)
        return len(verts) - 1

    tr = cfg["toeRadii"]
    for s in (1, -1):
        chain = []
        for name, r in cfg["chain"]:
            x, f, z = skeleton[name + ".L"]
            chain.append(add(P(x * s, f, z), r))
        roots.append(chain[0])
        edges += list(zip(chain, chain[1:]))
        ank = chain[-1]
        for toe in cfg["toes"]:
            (mx, mf, mz), (bx, bf, bz), (cx, cf, cz) = toe["points"]
            a = add(P(mx * s, mf, mz), tr[0])
            b = add(P(bx * s, bf, bz), tr[1])
            c = add(P(cx * s, cf, cz), tr[2])
            edges += [(ank, a), (a, b), (b, c)]
            claws.append((verts[b].copy(), verts[c].copy()))

    me = bpy.data.meshes.new(f"{oid}_legs_skel")
    me.from_pydata([tuple(v) for v in verts], edges, [])
    skel = bpy.data.objects.new(f"{oid}_legs_skel", me)
    bpy.context.scene.collection.objects.link(skel)
    sk = skel.modifiers.new("Skin", 'SKIN')
    sk.use_smooth_shade = True
    sv = me.skin_vertices[0].data
    for i, r in enumerate(radii):
        sv[i].radius = (r, r)
        sv[i].use_root = i in roots
    sub = skel.modifiers.new("Sub", 'SUBSURF')
    sub.levels = cfg["subdiv"]
    dg = bpy.context.evaluated_depsgraph_get()
    legs_me = bpy.data.meshes.new_from_object(skel.evaluated_get(dg))
    bpy.data.objects.remove(skel, do_unlink=True)
    bpy.data.meshes.remove(me)
    legs_me.name = f"{oid}_legs"
    legs = bpy.data.objects.new(f"{oid}_legs", legs_me)
    bpy.context.scene.collection.objects.link(legs)
    legs.parent = parent
    legs_me.materials.append(principled(f"{oid}_leg", srgb(cfg["colour"]), cfg["roughness"]))
    cl = cfg["claw"]
    legs_me.materials.append(principled(f"{oid}_claw", srgb(cl["colour"]), cl["roughness"]))
    for p in legs_me.polygons:
        p.use_smooth = True
        for b, c in claws:
            d = c - b
            L2 = d.length_squared
            t = (p.center - b).dot(d) / L2
            if t > cl["startT"] and (p.center - (b + d * min(t, 1))).length < cl["radiusCm"] * 0.01:
                p.material_index = 1
                break
    return legs
