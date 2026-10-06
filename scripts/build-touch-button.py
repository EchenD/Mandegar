"""Run in Blender. Build a separate, reusable Touch control; never alter hero assets."""
import bpy
import math
from pathlib import Path
from mathutils import Vector

project = Path("D:/Projects/Navid/Mandegar")
scene = bpy.data.scenes.new("Mandegar Touch Controls")
bpy.context.window.scene = scene
scene.render.fps = 30
scene.frame_start = 1
scene.frame_end = 18

material = bpy.data.materials.new("touch_button_vertex_finish")
material.use_nodes = True
shader = next(node for node in material.node_tree.nodes if node.type == "BSDF_PRINCIPLED")
shader.inputs["Base Color"].default_value = (1, 1, 1, 1)
shader.inputs["Roughness"].default_value = 0.65
colors = material.node_tree.nodes.new("ShaderNodeVertexColor")
colors.layer_name = "Color"
material.node_tree.links.new(colors.outputs["Color"], shader.inputs["Base Color"])

def linear(value):
    return value / 12.92 if value <= 0.04045 else ((value + 0.055) / 1.055) ** 2.4

def lathe(name, profile, color):
    segments = 64
    vertices = [(r * math.cos(i * math.tau / segments),
                 r * math.sin(i * math.tau / segments), z)
                for r, z in profile for i in range(segments)]
    faces = [(row * segments + i, row * segments + (i + 1) % segments,
              (row + 1) * segments + (i + 1) % segments, (row + 1) * segments + i)
             for row in range(len(profile) - 1) for i in range(segments)]
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    scene.collection.objects.link(obj)
    mesh.materials.append(material)
    attribute = mesh.color_attributes.new(name="Color", type="FLOAT_COLOR", domain="CORNER")
    light = Vector((-0.45, -0.6, 0.65)).normalized()
    for face in mesh.polygons:
        amount = 0.64 + max(0, face.normal.dot(light)) * 0.36
        for loop in face.loop_indices:
            attribute.data[loop].color = (*[linear(c * amount) for c in color], 1)
        face.use_smooth = True
    return obj

base = lathe("touch_button_base", [(0, 0), (.079, 0), (.080, .002),
    (.080, .012), (.077, .014), (.069, .014), (.069, .004), (0, .004)],
    (.15, .16, .17))
collar = lathe("touch_button_collar", [(.069, .010), (.079, .010),
    (.079, .012), (.077, .017), (.073, .019), (.070, .018), (.069, .010)],
    (.58, .42, .29))
ring = lathe("touch_button_ring", [(.068, .016), (.072, .016),
    (.072, .0175), (.068, .0175), (.068, .016)], (.2, .55, .63))
cap = lathe("touch_button_cap", [(0, .012), (.063, .012), (.068, .014),
    (.069, .017), (.067, .021), (.055, .023), (0, .023)],
    (.18, .20, .22))

# Five millimetres of mechanical travel, followed by an eased spring return.
for frame, z in [(1, 0), (5, -.005), (8, -.005), (18, 0)]:
    cap.location.z = z
    cap.keyframe_insert(data_path="location", frame=frame)
cap.animation_data.action.name = "touch_button_press"
scene.frame_set(1)

for obj in scene.objects:
    obj.select_set(True)
bpy.context.view_layer.objects.active = cap
export = bpy.ops.export_scene.gltf
options = export.get_rna_type().properties
# Read enum identifiers from this Blender version.
materials = next(i.identifier for i in options["export_materials"].enum_items if i.name == "Export")
vertex_colors = next(i.identifier for i in options["export_vertex_color"].enum_items if i.name == "Active")
actions = next(i.identifier for i in options["export_animation_mode"].enum_items if i.name == "Actions")
target = project / "public/models/mandegar/mandegar_touch_button.glb"
export(filepath=str(target), use_active_scene=True, use_selection=True,
       export_cameras=False, export_lights=False, export_materials=materials,
       export_vertex_color=vertex_colors, export_yup=True,
       export_animations=True, export_animation_mode=actions,
       export_force_sampling=True)
blend = project / "Docs/hero-flow-review/touch-polish/touch-button.blend"
# Save a copy so the user's original unsaved file is not replaced.
bpy.ops.wm.save_as_mainfile(filepath=str(blend), copy=True)
print("Button exported:", target)
print("Outer diameter 160 mm; height 23 mm; cap travel 5 mm.")
