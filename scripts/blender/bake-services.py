"""UV unwrap and bake the isolated services scene without changing its source.

Example (run only after the authoring pass is saved):
  blender -b Docs/CreativeProduction/3d/services/mandegar-services.blend \
    --python scripts/blender/bake-services.py -- --device GPU --samples 512

Produces six display-lit JPEG atlases, five transparent deck-shadow PNGs,
the baked sibling .blend, and the runtime GLB. UV0 is shared by each kit's
core/details; each bake sees only that kit and the shared platform.

References: https://docs.blender.org/manual/en/5.0/render/cycles/baking.html
https://docs.blender.org/manual/en/5.0/addons/import_export/scene_gltf2.html
https://developer.blender.org/docs/release_notes/3.0/cycles/
https://developer.blender.org/docs/release_notes/3.1/cycles/
"""

import argparse
from array import array
import json
import math
import os
from pathlib import Path
import shutil
import struct
import sys
import time

import bmesh
import bpy
from mathutils import Vector


ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / "Docs/CreativeProduction/3d/services"
RUNTIME = ROOT / "public/models/services/mandegar-services.glb"
PREFIX = "__bake__"
SCENE_NAME = "Mandegar Services"
DECK = .24
KIT_NAMES = ["ServicesEvent", "ServicesExhibition", "ServicesDigital", "ServicesContent", "ServicesAdvertising"]
SLUGS = ["events", "exhibitions", "web-apps", "content", "advertising"]


def args():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--samples", type=int, default=512)
    parser.add_argument("--atlas-size", type=int, default=1024)
    parser.add_argument("--shadow-size", type=int, default=512)
    parser.add_argument("--jpeg-quality", type=int, default=90)
    parser.add_argument("--device", choices=["CPU", "GPU"], default="CPU")
    parser.add_argument("--texture-budget", type=int, default=2_000_000)
    parser.add_argument("--source", type=Path)
    parser.add_argument("--quality", choices=["original", "studio"], default="studio")
    parser.add_argument("--preview-service", choices=SLUGS)
    parser.add_argument("--render-posters-only", action="store_true")
    parser.add_argument("--smooth-shadows-only", action="store_true")
    parser.add_argument("--verify-only", action="store_true")
    return parser.parse_args(sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else [])


def supported_call(operator, **kwargs):
    keys = operator.get_rna_type().properties.keys()
    return operator(**{key: value for key, value in kwargs.items() if key in keys})


def clone_scene():
    original = bpy.data.scenes.get(SCENE_NAME)
    if not original:
        raise RuntimeError(f"Missing isolated scene {SCENE_NAME!r}; save the authored source first.")
    scene = bpy.data.scenes.new(SCENE_NAME + " Baked")
    scene.world = original.world.copy() if original.world else None
    for key in ["view_transform", "look", "exposure", "gamma"]:
        setattr(scene.view_settings, key, getattr(original.view_settings, key))
    scene.display_settings.display_device = original.display_settings.display_device
    required = []
    for name in ["ServicesPlatform"] + KIT_NAMES:
        root = original.objects.get(name)
        if root is None:
            raise RuntimeError(f"Required model node {name!r} is absent.")
        required.extend([root] + list(root.children_recursive))
    required.extend(obj for obj in original.objects if obj.type in {"LIGHT", "CAMERA"})
    copies = {}
    for obj in dict.fromkeys(required):
        clone = obj.copy()
        clone.name = PREFIX + obj.name
        if obj.data:
            clone.data = obj.data.copy()
        scene.collection.objects.link(clone)
        clone.hide_render = False
        clone.hide_viewport = False
        copies[obj] = clone
    for source, clone in copies.items():
        clone.parent = copies.get(source.parent)
        clone.matrix_parent_inverse = source.matrix_parent_inverse.copy()
    scene.camera = copies.get(original.camera)
    bpy.context.window.scene = scene
    return scene, {source.name: clone for source, clone in copies.items()}


def configure_cycles(scene, settings):
    scene.render.engine = "CYCLES"
    scene.cycles.samples = settings.samples
    scene.cycles.seed = 37
    scene.cycles.max_bounces = 6
    scene.cycles.diffuse_bounces = 3
    scene.cycles.glossy_bounces = 3
    scene.cycles.device = "CPU"
    if settings.device == "GPU":
        addon = bpy.context.preferences.addons.get("cycles")
        if addon:
            prefs = addon.preferences
            for backend in ["OPTIX", "CUDA", "HIP", "ONEAPI", "METAL"]:
                try:
                    prefs.compute_device_type = backend
                    prefs.get_devices()
                    available = [device for device in prefs.devices if device.type != "CPU"]
                    if available:
                        for device in prefs.devices:
                            device.use = device in available
                        scene.cycles.device = "GPU"
                        print(f"SERVICES_BAKE_DEVICE {backend}", flush=True)
                        break
                except (TypeError, RuntimeError):
                    continue
        if scene.cycles.device != "GPU":
            print("SERVICES_BAKE_DEVICE CPU (no supported GPU available)", flush=True)
    scene.render.bake.use_selected_to_active = False
    scene.render.bake.margin = 12
    scene.render.bake.margin_type = "ADJACENT_FACES"
    scene.render.image_settings.color_depth = "8"
    scene.render.image_settings.compression = 90
    if settings.quality == "studio":
        # Cycles supports denoising/adaptive sampling when baking. Pin these
        # settings rather than inheriting whichever defaults the source saved.
        scene.cycles.use_denoising = True
        scene.cycles.denoiser = "OPENIMAGEDENOISE"
        scene.cycles.denoising_input_passes = "RGB_ALBEDO_NORMAL"
        scene.cycles.denoising_prefilter = "ACCURATE"
        scene.cycles.denoising_quality = "HIGH"
        scene.cycles.use_adaptive_sampling = True
        scene.cycles.adaptive_threshold = .003
        scene.cycles.adaptive_min_samples = min(64, settings.samples)
        scene.cycles.max_bounces = 4
        scene.cycles.diffuse_bounces = 2
        scene.cycles.glossy_bounces = 2
        scene.cycles.sample_clamp_direct = 0
        scene.cycles.sample_clamp_indirect = 3
        scene.cycles.blur_glossy = 1
        scene.cycles.caustics_reflective = False
        scene.cycles.caustics_refractive = False


def configure_studio(scene):
    """A neutral key/fill arrangement on copied lights, never the authored rig."""
    background = next(node for node in scene.world.node_tree.nodes if node.type == "BACKGROUND")
    background.inputs["Color"].default_value = (1, 1, 1, 1)
    background.inputs["Strength"].default_value = .5
    settings = [
        ("Key", (-3, -4, 8), 1000, 5, True),
        ("Fill", (5, -2, 5), 450, 6, False),
        ("Rim", (0, 5, 6), 600, 5, False),
    ]
    for name, position, power, size, shadow in settings:
        obj = scene.objects.get(PREFIX + "Services " + name)
        if obj is None:
            raise RuntimeError(f"The studio bake requires its authored {name} light.")
        obj.location = position
        obj.rotation_euler = (Vector((0, 0, .7)) - obj.location).to_track_quat("-Z", "Y").to_euler()
        obj.data.color = (1, 1, 1)
        obj.data.energy = power
        obj.data.size = size
        obj.data.use_shadow = shadow


def shadow_lighting(scene, direct_only):
    if not direct_only:
        return None
    background = next(node for node in scene.world.node_tree.nodes if node.type == "BACKGROUND")
    snapshot = (background.inputs["Strength"].default_value, scene.cycles.max_bounces, [(obj.data, obj.data.energy) for obj in scene.objects if obj.type == "LIGHT"])
    # The card captures one studio key's geometric shadow. Indirect light and
    # the environment cannot add colored occlusion or overlapping floor masks.
    background.inputs["Strength"].default_value = 0
    scene.cycles.max_bounces = 0
    for data, _ in snapshot[2]:
        if not data.name.startswith("Services Key"):
            data.energy = 0
    return snapshot


def restore_shadow_lighting(scene, snapshot):
    if snapshot is None:
        return
    background = next(node for node in scene.world.node_tree.nodes if node.type == "BACKGROUND")
    background.inputs["Strength"].default_value, scene.cycles.max_bounces = snapshot[:2]
    for data, energy in snapshot[2]:
        data.energy = energy


def meshes(root):
    return [obj for obj in [root] + list(root.children_recursive) if obj.type == "MESH"]


def validate_closed_winding(objects):
    """Reject inward closed shells before lighting rays can bake black surfaces.

    Open graphics intentionally have a chosen facing direction. Leave their
    winding and authored weighted normals unchanged rather than applying a
    blanket normal recalculation to the entire joined mesh.
    """
    checked = 0
    for obj in objects:
        data = bmesh.new()
        data.from_mesh(obj.data)
        remaining = set(data.faces)
        try:
            while remaining:
                seed = remaining.pop()
                faces, pending = {seed}, [seed]
                while pending:
                    face = pending.pop()
                    for edge in face.edges:
                        for neighbor in edge.link_faces:
                            if neighbor in remaining:
                                remaining.remove(neighbor)
                                faces.add(neighbor)
                                pending.append(neighbor)
                if any(len(edge.link_faces) != 2 for face in faces for edge in face.edges):
                    continue
                terms = []
                for face in faces:
                    vertices = [tuple(vertex.co) for vertex in face.verts]
                    ax, ay, az = vertices[0]
                    for index in range(1, len(vertices) - 1):
                        bx, by, bz = vertices[index]
                        cx, cy, cz = vertices[index + 1]
                        terms.append((ax * (by * cz - bz * cy) + ay * (bz * cx - bx * cz) + az * (bx * cy - by * cx)) / 6)
                volume = math.fsum(terms)
                if volume < -1e-8:
                    raise RuntimeError(f"Inward closed component in {obj.name}: signed volume {volume:.9g}. Repair author winding and recompute weighted normals before baking.")
                checked += 1
        finally:
            data.free()
    print(f"SERVICES_WINDING_VALIDATED {checked} closed components", flush=True)
    return checked


def select(objects):
    if bpy.context.object and bpy.context.object.mode != "OBJECT":
        bpy.ops.object.mode_set(mode="OBJECT")
    bpy.ops.object.select_all(action="DESELECT")
    for obj in objects:
        obj.hide_set(False)
        obj.select_set(True)
    bpy.context.view_layer.objects.active = objects[0]


def unwrap(objects, resolution):
    for obj in objects:
        while obj.data.uv_layers:
            obj.data.uv_layers.remove(obj.data.uv_layers[0])
        uv = obj.data.uv_layers.new(name="UV0")
        uv.active_render = True
    select(objects)
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    supported_call(
        bpy.ops.uv.smart_project,
        angle_limit=math.radians(66),
        island_margin=16 / resolution,
        margin_method="FRACTION",
        area_weight=0,
        correct_aspect=True,
        scale_to_bounds=False,
    )
    bpy.ops.object.mode_set(mode="OBJECT")
    for obj in objects:
        for loop in obj.data.uv_layers.active.data:
            if not all(-.0001 <= value <= 1.0001 for value in loop.uv):
                raise RuntimeError(f"UV0 is outside the atlas: {obj.name}")


def image(name, size, white=False):
    result = bpy.data.images.new(name, width=size, height=size, alpha=True, float_buffer=True)
    result.generated_color = (1, 1, 1, 1) if white else (0, 0, 0, 1)
    if white:
        result.pixels.foreach_set(array("f", [1]) * (size * size * 4))
    return result


def prepare_targets(objects, target):
    for obj in objects:
        for index, original in enumerate(list(obj.data.materials)):
            if original is None:
                raise RuntimeError(f"Unassigned material: {obj.name}")
            material = original.copy()
            material.name = PREFIX + target.name + "_" + str(index)
            obj.data.materials[index] = material
            material.use_nodes = True
            texture = material.node_tree.nodes.new("ShaderNodeTexImage")
            texture.name = "ServicesBakeTarget"
            texture.image = target
            material.node_tree.nodes.active = texture
            texture.select = True


def set_target(obj, target):
    for material in obj.data.materials:
        node = material.node_tree.nodes.get("ServicesBakeTarget")
        node.image = target
        material.node_tree.nodes.active = node


def bake(objects, kind="COMBINED", margin=12, passes=None):
    if passes is None:
        passes = {"DIRECT", "INDIRECT", "COLOR", "DIFFUSE", "GLOSSY", "EMIT"} if kind == "COMBINED" else {"DIRECT", "INDIRECT", "COLOR"}
    available = {item.identifier for item in bpy.ops.object.bake.get_rna_type().properties["pass_filter"].enum_items}
    for obj in objects:
        select([obj])
        bpy.ops.object.bake(type=kind, pass_filter=passes & available, use_clear=False, margin=margin, margin_type="ADJACENT_FACES", uv_layer="UV0")


def kit_visibility(roots, index):
    for current, root in enumerate(roots):
        for obj in meshes(root):
            obj.hide_render = current != index or obj.name.endswith("_GroundShadow")


def save_display_atlas(target, path, scene, quality):
    scene.render.image_settings.file_format = "JPEG"
    scene.render.image_settings.color_mode = "RGB"
    scene.render.image_settings.quality = quality
    # save_render applies the authored AgX/view transform exactly once. The loaded
    # sRGB JPEG is subsequently exported as unlit base color, without another light.
    target.save_render(str(path), scene=scene)
    loaded = bpy.data.images.load(str(path), check_existing=False)
    loaded.colorspace_settings.name = "sRGB"
    return loaded


def receiver(name, width, depth, parent, scene, size):
    radius = .48
    vertices = []
    for (x, y), start in [((width / 2 - radius, depth / 2 - radius), 0), ((-width / 2 + radius, depth / 2 - radius), 90), ((-width / 2 + radius, -depth / 2 + radius), 180), ((width / 2 - radius, -depth / 2 + radius), 270)]:
        for step in range(9):
            angle = math.radians(start + step * 90 / 8)
            vertices.append((x + radius * math.cos(angle), y + radius * math.sin(angle), DECK + .002))
    data = bpy.data.meshes.new(PREFIX + name)
    data.from_pydata(vertices, [], [tuple(range(len(vertices)))])
    data.update()
    obj = bpy.data.objects.new(PREFIX + name, data)
    scene.collection.objects.link(obj)
    obj.parent = parent
    uv = data.uv_layers.new(name="UV0")
    uv.active_render = True
    for loop in data.loops:
        x, y, _ = data.vertices[loop.vertex_index].co
        uv.data[loop.index].uv = (x / width + .5, y / depth + .5)
    material = bpy.data.materials.new(PREFIX + name + "_receiver")
    material.use_nodes = True
    shader = next(node for node in material.node_tree.nodes if node.type == "BSDF_PRINCIPLED")
    shader.inputs["Base Color"].default_value = (1, 1, 1, 1)
    shader.inputs["Roughness"].default_value = 1
    material.node_tree.nodes.active = material.node_tree.nodes.new("ShaderNodeTexImage")
    material.node_tree.nodes.active.name = "ServicesBakeTarget"
    data.materials.append(material)
    return obj


def smooth_alpha(values, size, radius=3, sigma=1):
    """Remove Monte Carlo grain without spreading shadows beyond the deck mask."""
    kernel = [math.exp(-(offset * offset) / (2 * sigma * sigma)) for offset in range(-radius, radius + 1)]
    total = sum(kernel)
    kernel = [weight / total for weight in kernel]
    horizontal = array("f", [0]) * len(values)
    result = array("f", [0]) * len(values)
    for y in range(size):
        row = y * size
        for x in range(size):
            horizontal[row + x] = sum(values[row + min(size - 1, max(0, x + offset))] * weight for offset, weight in zip(range(-radius, radius + 1), kernel))
    for y in range(size):
        for x in range(size):
            result[y * size + x] = sum(horizontal[min(size - 1, max(0, y + offset)) * size + x] * weight for offset, weight in zip(range(-radius, radius + 1), kernel))
    return result


def deck_edge(x, y, size, width, depth):
    px, py = ((x + .5) / size - .5) * width, ((y + .5) / size - .5) * depth
    qx, qy = abs(px) - (width / 2 - .48), abs(py) - (depth / 2 - .48)
    distance = math.hypot(max(qx, 0), max(qy, 0)) + min(max(qx, qy), 0) - .48
    return max(0, min(1, -distance / .025))


def mask_shadow(values, size, width, depth):
    pixels = array("f", [0]) * (size * size * 4)
    for y in range(size):
        for x in range(size):
            pixels[(y * size + x) * 4 + 3] = values[y * size + x] * deck_edge(x, y, size, width, depth)
    return pixels


def shadow_alpha(reference, shaded, size, width, depth, studio=False):
    values = array("f", [0]) * (size * size)
    for y in range(size):
        for x in range(size):
            offset = (y * size + x) * 4
            baseline = sum(reference[offset + channel] * weight for channel, weight in enumerate([.2126, .7152, .0722]))
            lit = sum(shaded[offset + channel] * weight for channel, weight in enumerate([.2126, .7152, .0722]))
            occlusion = max(0, 1 - lit / max(.0001, baseline))
            if studio:
                amount = max(0, min(1, (occlusion - .04) / .96))
                values[y * size + x] = .26 * amount * amount * (3 - 2 * amount)
            else:
                alpha = min(.72, occlusion)
                values[y * size + x] = alpha if alpha > .02 else 0
    return mask_shadow(smooth_alpha(values, size), size, width, depth)


def save_shadow(target, path, scene):
    previous = scene.view_settings.view_transform
    scene.view_settings.view_transform = "Standard"
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"
    scene.render.image_settings.color_depth = "8"
    target.alpha_mode = "STRAIGHT"
    target.save_render(str(path), scene=scene)
    scene.view_settings.view_transform = previous
    return bpy.data.images.load(str(path), check_existing=False)


def unlit_material(name, texture, alpha=False):
    material = bpy.data.materials.new(name)
    material.use_nodes = True
    tree = material.node_tree
    tree.nodes.clear()
    output = tree.nodes.new("ShaderNodeOutputMaterial")
    image_node = tree.nodes.new("ShaderNodeTexImage")
    image_node.image = texture
    image_node.interpolation = "Linear"
    emission = tree.nodes.new("ShaderNodeEmission")
    tree.links.new(image_node.outputs["Color"], emission.inputs["Color"])
    transparent = tree.nodes.new("ShaderNodeBsdfTransparent")
    light_path = tree.nodes.new("ShaderNodeLightPath")
    camera_mix = tree.nodes.new("ShaderNodeMixShader")
    tree.links.new(light_path.outputs["Is Camera Ray"], camera_mix.inputs[0])
    tree.links.new(transparent.outputs[0], camera_mix.inputs[1])
    tree.links.new(emission.outputs[0], camera_mix.inputs[2])
    # Blender 5's exporter recognizes this camera-ray/Emission arrangement as
    # KHR_materials_unlit. The transparent branch also prevents baked surfaces
    # from becoming new light emitters when previewed offline.
    if alpha:
        alpha_mix = tree.nodes.new("ShaderNodeMixShader")
        tree.links.new(image_node.outputs["Alpha"], alpha_mix.inputs[0])
        tree.links.new(transparent.outputs[0], alpha_mix.inputs[1])
        tree.links.new(camera_mix.outputs[0], alpha_mix.inputs[2])
        tree.links.new(alpha_mix.outputs[0], output.inputs["Surface"])
        if hasattr(material, "surface_render_method"):
            material.surface_render_method = "BLENDED"
        elif hasattr(material, "blend_method"):
            material.blend_method = "BLEND"
    else:
        tree.links.new(camera_mix.outputs[0], output.inputs["Surface"])
    return material


def replace_materials(objects, material):
    for obj in objects:
        obj.data.materials.clear()
        obj.data.materials.append(material)
        for polygon in obj.data.polygons:
            polygon.material_index = 0


def finalize_glb(path, settings, output):
    data = path.read_bytes()
    json_size, chunk_type = struct.unpack_from("<II", data, 12)
    if chunk_type != 0x4E4F534A:
        raise RuntimeError("Invalid GLB JSON chunk.")
    gltf = json.loads(data[20:20 + json_size])
    for item in gltf.get("nodes", []) + gltf.get("meshes", []):
        if item.get("name", "").startswith(PREFIX):
            item["name"] = item["name"][len(PREFIX):]
    if any("KHR_materials_unlit" not in material.get("extensions", {}) for material in gltf["materials"]):
        raise RuntimeError("The exporter did not produce unlit materials for every baked mesh.")
    primitives = [primitive for mesh in gltf["meshes"] for primitive in mesh["primitives"]]
    if any("TEXCOORD_0" not in primitive["attributes"] for primitive in primitives):
        raise RuntimeError("Exported geometry has no UV0.")
    textures = [{"name": item.get("name"), "mimeType": item.get("mimeType"), "bytes": gltf["bufferViews"][item["bufferView"]]["byteLength"]} for item in gltf["images"]]
    texture_bytes = sum(item["bytes"] for item in textures)
    if texture_bytes > settings.texture_budget:
        raise RuntimeError(f"Textures exceed budget: {texture_bytes:,} > {settings.texture_budget:,}; lower --jpeg-quality or --atlas-size.")
    serialized = json.dumps(gltf, separators=(",", ":"), ensure_ascii=False).encode("utf-8")
    serialized += b" " * ((-len(serialized)) % 4)
    remaining = data[20 + json_size:]
    packed = struct.pack("<III", 0x46546C67, 2, 20 + len(serialized) + len(remaining)) + struct.pack("<II", len(serialized), 0x4E4F534A) + serialized + remaining
    path.write_bytes(packed)
    nodes = {node.get("name"): node for node in gltf["nodes"]}
    def count(node):
        return (len(gltf["meshes"][node["mesh"]]["primitives"]) if "mesh" in node else 0) + sum(count(gltf["nodes"][index]) for index in node.get("children", []))
    output.update({
        "glbBytes": len(packed), "materials": len(gltf["materials"]), "totalDrawCalls": len(primitives),
        "drawCallsPerPose": {name: count(nodes["ServicesPlatform"]) + count(nodes[name]) for name in KIT_NAMES},
        "triangles": sum(gltf["accessors"][primitive["indices"]]["count"] // 3 for primitive in primitives),
        "textureBytes": texture_bytes, "textures": textures, "uv0": True, "unlit": True,
        "groundShadowNodes": [name + "_GroundShadow" for name in KIT_NAMES],
    })


def main():
    settings = args()
    if settings.source:
        bpy.ops.wm.open_mainfile(filepath=str(settings.source.resolve()))
    if settings.render_posters_only:
        render_baked_posters()
        return
    if settings.smooth_shadows_only:
        smooth_baked_shadows(settings)
        return
    if settings.verify_only:
        scene = bpy.data.scenes.get(SCENE_NAME + " Baked")
        if scene is None:
            raise RuntimeError("Open the baked sibling to verify its portability.")
        images = {node.image for obj in scene.objects if obj.type == "MESH" for material in obj.data.materials if material and material.use_nodes for node in material.node_tree.nodes if node.type == "TEX_IMAGE" and node.image}
        packed = all(item.packed_file is not None for item in images)
        if len(images) != 11 or not packed:
            raise RuntimeError(f"Baked source is not portable: {len(images)} images, allPacked={packed}")
        print("SERVICES_PORTABILITY " + json.dumps({"activeImages": len(images), "allPacked": packed, "imageNames": sorted(item.name for item in images), "scenes": [item.name for item in bpy.data.scenes]}), flush=True)
        return
    if settings.samples < 1 or settings.atlas_size < 256 or settings.shadow_size < 128:
        raise ValueError("Use positive samples and atlas/shadow sizes of at least 256/128.")
    started = time.monotonic()
    destination = SOURCE / ("bake-preview/" + settings.preview_service if settings.preview_service else "baked")
    destination.mkdir(parents=True, exist_ok=True)
    scene, objects = clone_scene()
    configure_cycles(scene, settings)
    if settings.quality == "studio":
        configure_studio(scene)
    platform = objects["ServicesPlatform"]
    roots = [objects[name] for name in KIT_NAMES]
    preview_index = SLUGS.index(settings.preview_service) if settings.preview_service else None
    units = [("platform", meshes(platform))] + [(slug, meshes(root)) for index, (slug, root) in enumerate(zip(SLUGS, roots)) if preview_index is None or index == preview_index]
    winding_count = validate_closed_winding([obj for _, unit in units for obj in unit])
    baked = []
    for slug, unit in units:
        index = SLUGS.index(slug) if slug in SLUGS else -1
        platform.rotation_euler.z = max(0, index) * math.pi / 2
        kit_visibility(roots, index)
        unwrap(unit, settings.atlas_size)
        target = image("ServicesBake_" + slug, settings.atlas_size)
        prepare_targets(unit, target)
        print(f"SERVICES_BAKE_ATLAS {slug}", flush=True)
        bake(unit)
        texture = save_display_atlas(target, destination / (slug + ".jpg"), scene, settings.jpeg_quality)
        baked.append((unit, texture, slug))

    shadows = []
    lighting_snapshot = shadow_lighting(scene, settings.quality == "studio")
    for index, (slug, root) in enumerate(zip(SLUGS, roots)):
        if preview_index is not None and index != preview_index:
            continue
        width, depth = (4.79, 3.99) if index % 2 == 0 else (3.99, 4.79)
        platform.rotation_euler.z = index * math.pi / 2
        card = receiver(KIT_NAMES[index] + "_GroundShadow", width, depth, root, scene, settings.shadow_size)
        baseline = image("ServicesShadowEmpty_" + slug, settings.shadow_size, white=True)
        set_target(card, baseline)
        kit_visibility(roots, -1)
        card.hide_render = False
        print(f"SERVICES_BAKE_SHADOW {slug}", flush=True)
        shadow_passes = {"DIRECT"} if settings.quality == "studio" else None
        bake([card], kind="DIFFUSE", margin=0, passes=shadow_passes)
        reference = array("f", [0]) * len(baseline.pixels)
        baseline.pixels.foreach_get(reference)
        shaded = image("ServicesShadowLit_" + slug, settings.shadow_size, white=True)
        set_target(card, shaded)
        kit_visibility(roots, index)
        card.hide_render = False
        bake([card], kind="DIFFUSE", margin=0, passes=shadow_passes)
        illumination = array("f", [0]) * len(shaded.pixels)
        shaded.pixels.foreach_get(illumination)
        alpha = image("ServicesShadowAlpha_" + slug, settings.shadow_size)
        alpha.pixels.foreach_set(shadow_alpha(reference, illumination, settings.shadow_size, width, depth, studio=settings.quality == "studio"))
        texture = save_shadow(alpha, destination / (slug + "-shadow.png"), scene)
        shadows.append((card, texture, slug))
        card.hide_render = True
    restore_shadow_lighting(scene, lighting_snapshot)
    platform.rotation_euler.z = 0

    for unit, texture, slug in baked:
        replace_materials(unit, unlit_material("services_baked_" + slug, texture))
        texture.pack()
    for card, texture, slug in shadows:
        replace_materials([card], unlit_material("services_baked_" + slug + "_shadow", texture, alpha=True))
        texture.pack()
    scene.view_settings.view_transform = "Standard"
    scene.view_settings.exposure = 0
    scene.view_settings.gamma = 1
    if preview_index is not None:
        render_quality_preview(scene, platform, roots, shadows, settings, destination)
        return
    for obj in scene.objects:
        obj.hide_render = False
    export_objects = [obj for obj in scene.objects if obj.type in {"MESH", "EMPTY"}]
    select(export_objects)
    staged = destination / "mandegar-services-baked.glb"
    supported_call(bpy.ops.export_scene.gltf, filepath=str(staged), export_format="GLB", use_selection=True, use_active_scene=True, export_apply=True, export_animations=False, export_cameras=False, export_lights=False, export_image_format="AUTO")
    manifest_path = SOURCE / "asset-manifest.json"
    manifest = json.loads(manifest_path.read_text(encoding="utf-8")) if manifest_path.exists() else {}
    finalize_glb(staged, settings, manifest)
    manifest["bake"] = {"script": "scripts/blender/bake-services.py", "engine": "Cycles", "samples": settings.samples, "device": scene.cycles.device, "atlasSize": settings.atlas_size, "shadowSize": settings.shadow_size, "jpegQuality": settings.jpeg_quality, "isolation": "One kit plus platform per bake; platform is neutral", "displayTransform": "Authored view transform saved into JPEG, then unlit Standard/sRGB output", "closedWindingValidated": winding_count, "shadowMethod": "Isolated receiver diffuse illumination / empty receiver baseline; rounded RGBA mask", "shadowBlurRadius": 3, "shadowBlurSigma": 1, "sourcePreserved": "mandegar-services.blend", "bakedSource": "mandegar-services-baked.blend", "durationSeconds": round(time.monotonic() - started, 2)}
    if settings.quality == "studio":
        manifest["bake"].update({"quality": "studio", "adaptiveThreshold": .003, "adaptiveMinSamples": min(64, settings.samples), "denoiser": "OpenImageDenoise", "denoisingInput": "Color + Albedo + Normal", "denoisingPrefilter": "Accurate", "denoisingQuality": "High", "uvMarginPixels": 12, "uvMarginType": "Adjacent Faces", "maxBounces": 4, "diffuseBounces": 2, "glossyBounces": 2, "indirectClamp": 3, "shadowMethod": "Single key direct-only grayscale illumination ratio; no world/GI; smoothstep threshold .04; rounded RGBA mask", "shadowMaxAlpha": .26, "lighting": "Neutral world .5; key 1000W/5m; fill 450W/6m and rim 600W/5m without shadows", "references": ["https://developer.blender.org/docs/release_notes/3.0/cycles/", "https://developer.blender.org/docs/release_notes/3.1/cycles/", "https://docs.blender.org/manual/en/5.0/render/cycles/render_settings/sampling.html", "https://docs.blender.org/manual/en/5.0/render/lights/light_object.html"]})
    kit_visibility(roots, 0)
    for index, (card, _, _) in enumerate(shadows):
        card.hide_render = index != 0
    bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE / "mandegar-services-baked.blend"))
    # Publish only after unlit/UV/texture-budget validation succeeds.
    RUNTIME.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(staged, RUNTIME)
    manifest_path.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    print("SERVICES_BAKE_COMPLETE " + json.dumps(manifest), flush=True)


def render_quality_preview(scene, platform, roots, shadows, settings, destination):
    index = SLUGS.index(settings.preview_service)
    platform.rotation_euler.z = index * math.pi / 2
    kit_visibility(roots, index)
    shadows[0][0].hide_render = False
    scene.render.engine = "BLENDER_EEVEE"
    scene.render.resolution_x = scene.render.resolution_y = 896
    scene.render.resolution_percentage = 100
    scene.render.film_transparent = True
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"
    scene.render.image_settings.compression = 90
    scene.render.filepath = str(destination / (settings.preview_service + "-studio.png"))
    for item in list(bpy.data.images):
        if item.name.startswith(("ServicesBake_", "ServicesShadowEmpty_", "ServicesShadowLit_", "ServicesShadowAlpha_")):
            bpy.data.images.remove(item)
    bpy.ops.render.render(write_still=True)
    bpy.ops.wm.save_as_mainfile(filepath=str(destination / (settings.preview_service + "-studio.blend")))
    print("SERVICES_QUALITY_PREVIEW " + json.dumps({"image": scene.render.filepath, "samples": settings.samples, "quality": settings.quality, "publishedRuntime": False}), flush=True)


def smooth_baked_shadows(settings):
    """Reprocess existing packed alpha sheets and export without rebaking Cycles."""
    scene = bpy.data.scenes.get(SCENE_NAME + " Baked")
    if scene is None:
        raise RuntimeError("Open the baked sibling to smooth its existing shadow sheets.")
    manifest_path = SOURCE / "asset-manifest.json"
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    if manifest.get("bake", {}).get("shadowBlurRadius"):
        raise RuntimeError("These shadow sheets are already smoothed; avoid repeated filtering.")
    bpy.context.window.scene = scene
    scene.render.image_settings.compression = 90
    for index, slug in enumerate(SLUGS):
        card = scene.objects.get(PREFIX + KIT_NAMES[index] + "_GroundShadow")
        if card is None:
            raise RuntimeError(f"Missing shadow receiver for {slug}.")
        material = card.data.materials[0]
        node = next(node for node in material.node_tree.nodes if node.type == "TEX_IMAGE")
        old = node.image
        size = old.size[0]
        if old.size[1] != size:
            raise RuntimeError("Shadow alpha sheets must be square.")
        source = array("f", [0]) * len(old.pixels)
        old.pixels.foreach_get(source)
        width, depth = (4.79, 3.99) if index % 2 == 0 else (3.99, 4.79)
        # Recover the pre-mask alpha so the rounded fade is applied only once.
        values = array("f", [0]) * (size * size)
        for y in range(size):
            for x in range(size):
                edge = deck_edge(x, y, size, width, depth)
                values[y * size + x] = min(.72, source[(y * size + x) * 4 + 3] / edge) if edge > 0 else 0
        target = image("ServicesShadowAlpha_" + slug, size)
        target.pixels.foreach_set(mask_shadow(smooth_alpha(values, size), size, width, depth))
        texture = save_shadow(target, SOURCE / "baked" / (slug + "-shadow.png"), scene)
        texture.pack()
        node.image = texture
        if old.users == 0:
            bpy.data.images.remove(old)
        print("SERVICES_SHADOW_SMOOTHED " + slug, flush=True)
    hidden = {obj: obj.hide_render for obj in scene.objects}
    for obj in scene.objects:
        obj.hide_render = False
    select([obj for obj in scene.objects if obj.type in {"MESH", "EMPTY"}])
    staged = SOURCE / "baked/mandegar-services-baked.glb"
    supported_call(bpy.ops.export_scene.gltf, filepath=str(staged), export_format="GLB", use_selection=True, use_active_scene=True, export_apply=True, export_animations=False, export_cameras=False, export_lights=False, export_image_format="AUTO")
    finalize_glb(staged, settings, manifest)
    manifest["bake"].update({"shadowBlurRadius": 3, "shadowBlurSigma": 1})
    for obj, value in hidden.items():
        obj.hide_render = value
    for item in list(bpy.data.images):
        if item.name.startswith("ServicesShadowAlpha_"):
            bpy.data.images.remove(item)
    bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE / "mandegar-services-baked.blend"))
    shutil.copyfile(staged, RUNTIME)
    manifest_path.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    print("SERVICES_SHADOW_OPTIMIZATION_COMPLETE " + json.dumps({"glbBytes": manifest["glbBytes"], "textureBytes": manifest["textureBytes"]}), flush=True)


def render_baked_posters():
    scene = bpy.data.scenes.get(SCENE_NAME + " Baked")
    if scene is None:
        raise RuntimeError("Open mandegar-services-baked.blend to render matching posters.")
    bpy.context.window.scene = scene
    platform = scene.objects.get(PREFIX + "ServicesPlatform")
    roots = [scene.objects.get(PREFIX + name) for name in KIT_NAMES]
    if platform is None or any(root is None for root in roots):
        raise RuntimeError("The baked scene is missing its model hierarchy.")
    # The active materials reference packed JPEG/PNG images. Disconnected float
    # bake buffers are intermediates, not part of the portable preview source.
    for item in list(bpy.data.images):
        if item.name.startswith(("ServicesBake_", "ServicesShadowEmpty_", "ServicesShadowLit_", "ServicesShadowAlpha_")):
            bpy.data.images.remove(item)
    scene.render.engine = "BLENDER_EEVEE"
    scene.view_settings.view_transform = "Standard"
    scene.view_settings.exposure = 0
    scene.view_settings.gamma = 1
    scene.render.resolution_x = 896
    scene.render.resolution_y = 896
    scene.render.resolution_percentage = 100
    scene.render.film_transparent = True
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"
    scene.render.image_settings.color_depth = "8"
    scene.render.image_settings.compression = 90
    for index, (slug, root) in enumerate(zip(SLUGS, roots)):
        # At a held runtime pose the kit's counterrotation cancels the parent
        # turn; only the platform's quarter turn remains in world space.
        platform.rotation_euler.z = index * math.pi / 2
        kit_visibility(roots, index)
        root.rotation_euler.z = 0
        card = scene.objects.get(PREFIX + KIT_NAMES[index] + "_GroundShadow")
        if card:
            card.hide_render = False
        scene.render.filepath = str(SOURCE / (slug + ".png"))
        bpy.ops.render.render(write_still=True)
        print("SERVICES_BAKED_POSTER " + slug, flush=True)
    platform.rotation_euler.z = 0
    kit_visibility(roots, 0)
    card = scene.objects.get(PREFIX + KIT_NAMES[0] + "_GroundShadow")
    if card:
        card.hide_render = False
    bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE / "mandegar-services-baked.blend"))
    manifest_path = SOURCE / "asset-manifest.json"
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    manifest["bake"]["postersSource"] = "mandegar-services-baked.blend"
    manifest_path.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
