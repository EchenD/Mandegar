"""Author Mandegar's isolated services model; run in Blender, not system Python.

The live MCP workflow calls setup(), individual build_* functions, then finish().
Background Blender can use --render-existing to render the saved five poses.
"""

import bpy
import json
import math
import os
import struct
import sys
from mathutils import Vector

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SOURCE = os.path.join(ROOT, "Docs", "CreativeProduction", "3d", "services")
PUBLIC = os.path.join(ROOT, "public", "models", "services")
SCENE_NAME = "Mandegar Services"
DECK = 0.24
KIT_NAMES = ["ServicesEvent", "ServicesExhibition", "ServicesDigital", "ServicesContent", "ServicesAdvertising"]
POSTER_NAMES = ["events", "exhibitions", "web-apps", "content", "advertising"]


def linear(value):
    return value / 12.92 if value <= 0.04045 else ((value + 0.055) / 1.055) ** 2.4


def material(name, color, roughness=0.65, metallic=0):
    mat = bpy.data.materials.new("services_" + name)
    rgba = tuple(linear(channel) for channel in color) + (1,)
    mat.diffuse_color = rgba
    shader = next(node for node in mat.node_tree.nodes if node.type == "BSDF_PRINCIPLED")
    shader.inputs["Base Color"].default_value = rgba
    shader.inputs["Roughness"].default_value = roughness
    shader.inputs["Metallic"].default_value = metallic
    return mat


def materials():
    return {key: bpy.data.materials["services_" + key] for key in ["ivory", "silver", "charcoal", "blue", "paper"]}


def collection(name):
    group = bpy.data.collections.new(name)
    bpy.context.scene.collection.children.link(group)
    return group


def empty(name, group):
    obj = bpy.data.objects.new(name, None)
    group.objects.link(obj)
    obj.empty_display_size = 0.25
    return obj


def mesh(name, vertices, faces, mat, group, parent=None):
    data = bpy.data.meshes.new(name)
    data.from_pydata(vertices, [], faces)
    data.update()
    obj = bpy.data.objects.new(name, data)
    group.objects.link(obj)
    obj.data.materials.append(mat)
    obj.parent = parent
    return obj


def bevel(obj, radius=0.04, segments=3):
    if radius:
        modifier = obj.modifiers.new("Soft edges", "BEVEL")
        modifier.width = radius
        modifier.segments = segments
    normal = obj.modifiers.new("Weighted normals", "WEIGHTED_NORMAL")
    normal.keep_sharp = True
    return obj


def box(name, dimensions, position, mat, group, parent=None, radius=0.035):
    x, y, z = (dimension / 2 for dimension in dimensions)
    vertices = [(-x,-y,-z), (x,-y,-z), (x,y,-z), (-x,y,-z), (-x,-y,z), (x,-y,z), (x,y,z), (-x,y,z)]
    faces = [(0,3,2,1), (4,5,6,7), (0,1,5,4), (1,2,6,5), (2,3,7,6), (3,0,4,7)]
    obj = mesh(name, vertices, faces, mat, group, parent)
    obj.location = position
    return bevel(obj, min(radius, min(dimensions) * 0.42))


def cylinder(name, radius, height, position, mat, group, parent=None, count=24):
    vertices = [(math.cos(i * math.tau/count)*radius, math.sin(i * math.tau/count)*radius, z) for z in [-height/2,height/2] for i in range(count)]
    faces = [tuple(reversed(range(count))), tuple(range(count, count*2))]
    faces += [(i, (i+1)%count, (i+1)%count+count, i+count) for i in range(count)]
    obj = mesh(name, vertices, faces, mat, group, parent)
    obj.location = position
    for polygon in obj.data.polygons[2:]:
        polygon.use_smooth = True
    return bevel(obj, min(0.018, height * 0.08), 2)


def rod(name, start, end, radius, mat, group, parent):
    delta = Vector(end) - Vector(start)
    obj = cylinder(name, radius, delta.length, (Vector(start)+Vector(end))/2, mat, group, parent, 12)
    obj.rotation_euler = delta.to_track_quat("Z", "Y").to_euler()
    return obj


def rounded_slab(name, width, depth, height, z, radius, mat, group, parent):
    points = []
    for center, start in [((width/2-radius, depth/2-radius),0), ((-width/2+radius,depth/2-radius),90), ((-width/2+radius,-depth/2+radius),180), ((width/2-radius,-depth/2+radius),270)]:
        for i in range(9):
            angle = math.radians(start + i * 90/8)
            points.append((center[0] + radius*math.cos(angle), center[1]+radius*math.sin(angle)))
    count = len(points)
    vertices = [(x,y,level) for level in [z-height/2, z+height/2] for x,y in points]
    faces = [tuple(reversed(range(count))), tuple(range(count,count*2))]
    faces += [(i,(i+1)%count,(i+1)%count+count,i+count) for i in range(count)]
    return bevel(mesh(name, vertices, faces, mat, group, parent),0.025,3)


def curve_panel(name, width, height, y, bottom, bend, thickness, mat, group, parent):
    # A broad, shallow curved display with real thickness, facing the viewer (-Y).
    count = 24
    vertices = []
    for offset in [-thickness/2, thickness/2]:
        for z in [bottom, bottom+height]:
            for i in range(count+1):
                x = (i/count-0.5)*width
                vertices.append((x, y+bend*(x/(width/2))**2+offset, z))
    row = count+1
    faces = []
    for i in range(count):
        faces += [(i,i+1,i+1+row,i+row), (i+row*2,i+row*3,i+1+row*3,i+1+row*2), (i,i+row*2,i+1+row*2,i+1), (i+row,i+1+row,i+1+row*3,i+row*3)]
    faces += [(0,row,row*3,row*2),(count,count+row*2,count+row*3,count+row)]
    return bevel(mesh(name, vertices, faces, mat, group,parent),0.014,2)


def arch(name, width, height, wall, depth, x, y, bottom, mat, group, parent):
    radius = width/2
    spring = height-radius
    outer = [(-radius,0),(-radius,spring)]
    outer += [(radius*math.cos(math.pi-i*math.pi/24),spring+radius*math.sin(math.pi-i*math.pi/24)) for i in range(1,25)]
    outer += [(radius,0)]
    inner_radius = radius-wall
    inner = [(-inner_radius,0),(-inner_radius,spring)]
    inner += [(inner_radius*math.cos(math.pi-i*math.pi/24),spring+inner_radius*math.sin(math.pi-i*math.pi/24)) for i in range(1,25)]
    inner += [(inner_radius,0)]
    count=len(outer)
    vertices=[(px+x,y+dy,pz+bottom) for dy in [-depth/2,depth/2] for path in [outer,inner] for px,pz in path]
    faces=[]
    for i in range(count-1):
        faces += [(i,i+1,i+1+count,i+count),(i+count*2,i+count*3,i+1+count*3,i+1+count*2),(i,i+count*2,i+1+count*2,i+1),(i+count,i+1+count,i+1+count*3,i+count*3)]
    faces += [(0,count,count*3,count*2),(count-1,count*3-1,count*4-1,count*2-1)]
    return bevel(mesh(name,vertices,[tuple(reversed(face)) for face in faces],mat,group,parent),0.025,2)


def poster_graphic(name, width, height, x, y, bottom, mat, group, parent, bend=0):
    # The same restrained disc/quarter-circle graphic across the physical media.
    def graphic(suffix, points):
        # Subdivide the graphic so its interior also follows the curved display.
        count=len(points);rings=8 if bend else 1
        cx=sum(px for px,z in points)/count;cz=sum(z for px,z in points)/count
        vertices=[(cx,y+bend*((cx-x)/(width/2))**2,cz)]
        for ring in range(1,rings+1):
            for px,z in points:
                px=cx+(px-cx)*ring/rings;z=cz+(z-cz)*ring/rings
                vertices.append((px,y+bend*((px-x)/(width/2))**2,z))
        faces=[(0,1+i,1+(i+1)%count) for i in range(count)]
        for ring in range(1,rings):
            first=1+(ring-1)*count;second=first+count
            faces += [(first+i,second+i,second+(i+1)%count,first+(i+1)%count) for i in range(count)]
        return mesh(name+suffix,vertices,faces,mat,group,parent)
    radius=min(height*.72,width*.95)
    center=(x+width/2,bottom)
    points=[center]+[(center[0]+radius*math.cos(math.pi/2+i*math.pi/48), bottom+radius*math.sin(math.pi/2+i*math.pi/48)) for i in range(25)]
    graphic(" quarter circle",points)
    radius=min(height*.16,width*.19)
    cx=x-width*.3;cz=bottom+height*.7
    graphic(" disc",[(cx+radius*math.cos(i*math.tau/32),cz+radius*math.sin(i*math.tau/32)) for i in range(32)])


def sculpture(name, position, mat, group, parent):
    profile=[(0,.09,0),(.025,.13,0),(.08,.16,-.01),(.14,.15,-.015),(.2,.11,.01),(.25,.085,.035),(.3,.1,.045),(.35,.12,.04),(.4,.095,.025),(.43,.045,.02),(.44,.003,.02)]
    count=20
    vertices=[(position[0]+offset+radius*math.cos(i*math.tau/count),position[1]+radius*math.sin(i*math.tau/count),position[2]+z) for z,radius,offset in profile for i in range(count)]
    faces=[tuple(reversed(range(count)))]
    for row in range(len(profile)-1):
        for i in range(count):
            faces.append((row*count+i,row*count+(i+1)%count,(row+1)*count+(i+1)%count,(row+1)*count+i))
    faces.append(tuple(range((len(profile)-1)*count,len(profile)*count)))
    obj=mesh(name,vertices,faces,mat,group,parent)
    for polygon in obj.data.polygons:
        polygon.use_smooth=True
    return obj


def kit(name):
    group=collection(name+" collection")
    return group, empty(name,group)


def merge_objects(objects, parent, name):
    if not objects:
        return
    for obj in bpy.context.selected_objects:
        obj.select_set(False)
    for obj in objects:
        obj.select_set(True)
        bpy.context.view_layer.objects.active=obj
        for modifier in list(obj.modifiers):
            bpy.ops.object.modifier_apply(modifier=modifier.name)
    bpy.context.view_layer.objects.active=objects[0]
    bpy.ops.object.join()
    obj=objects[0]
    obj.name=name
    # Join keeps the first object's origin; apply location to keep kit bounds simple.
    bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
    obj.parent=parent
    obj.select_set(False)


def merge_kit(group, parent):
    # Keep equipment separate from architecture for a short assembly stagger.
    prefixes={
        "ServicesEvent": ("Event seating", "Light tower", "Event lighting"),
        "ServicesExhibition": ("Product pedestal", "Abstract", "Display lamp"),
        "ServicesDigital": ("Phone", "Keyboard", "Mouse"),
        "ServicesContent": ("Camera", "Softbox", "Studio subject", "Reflector"),
        "ServicesAdvertising": ("Lightbox", "Dimensional"),
    }.get(parent.name, ())
    objects=[obj for obj in group.objects if obj.type=="MESH"]
    details=[obj for obj in objects if obj.name.startswith(prefixes)]
    core=[obj for obj in objects if obj not in details]
    merge_objects(core,parent,parent.name+"_Mesh")
    merge_objects(details,parent,parent.name+"_Details")


def setup():
    if bpy.data.scenes.get(SCENE_NAME):
        raise RuntimeError("Mandegar Services scene already exists; inspect before rebuilding.")
    scene=bpy.data.scenes.new(SCENE_NAME)
    bpy.context.window.scene=scene
    scene.unit_settings.system="METRIC"
    for name,color,roughness,metallic in [
        ("ivory",(.91,.905,.875),.64,0),
        ("silver",(.73,.76,.78),.48,.25),
        ("charcoal",(.17,.19,.22),.7,.05),
        ("blue",(.133,.36,1),.45,0),
        ("paper",(.97,.965,.94),.78,0),
    ]:
        material(name,color,roughness,metallic)
    scene.world=bpy.data.worlds.new("Services studio ambient")
    scene.world.use_nodes=True
    background=next(node for node in scene.world.node_tree.nodes if node.type=="BACKGROUND")
    background.inputs["Color"].default_value=(.78,.82,.9,1)
    background.inputs["Strength"].default_value=.65
    print("Created isolated scene:",scene.name)


def build_platform():
    mats=materials();group,parent=kit("ServicesPlatform")
    rounded_slab("Platform silver edge",4.8,4,.22,.11,.48,mats["silver"],group,parent)
    rounded_slab("Platform ivory deck",4.79,3.99,.055,.2125,.48,mats["ivory"],group,parent)
    box("Single blue rim marker",(.22,.013,.047),(0,-2.007,.128),mats["blue"],group,parent,.008)
    merge_kit(group,parent)


def build_events():
    mats=materials();group,parent=kit("ServicesEvent")
    first=rounded_slab("Event lower stage",3.4,1.6,.16,DECK+.08,.52,mats["ivory"],group,parent)
    first.location.y=.35
    second=rounded_slab("Event upper stage",2.85,1.18,.12,DECK+.22,.46,mats["paper"],group,parent)
    second.location.y=.5
    curve_panel("Event screen shell",3.12,1.52,.78,DECK+.31,.17,.12,mats["charcoal"],group,parent)
    curve_panel("Event screen surface",2.99,1.39,.71,DECK+.375,.17,.015,mats["paper"],group,parent)
    poster_graphic("Event LED graphic",2.95,1.35,0,.663,DECK+.395,mats["blue"],group,parent,.17)
    for x in [-1.87,1.87]:
        box("Light tower foot",(.29,.3,.12),(x,.33,DECK+.06),mats["charcoal"],group,parent)
        rod("Light tower",(x,.33,DECK+.12),(x,.33,DECK+2.08),.035,mats["silver"],group,parent)
        for z in [DECK+1.66,DECK+1.95]:
            light=cylinder("Event lighting head",.115,.18,(x,.25,z),mats["charcoal"],group,parent)
            light.rotation_euler.x=math.pi/2
            lens=cylinder("Event lighting lens",.084,.018,(x,.15,z),mats["paper"],group,parent)
            lens.rotation_euler.x=math.pi/2
    for x in [-1.05,-.35,.35,1.05]:
        seat=rounded_slab("Event seating shell",.47,.43,.065,DECK+.42,.14,mats["paper"],group,parent)
        seat.location=(x,-1.25,0)
        back=curve_panel("Event seating curved back",.47,.32,-1.46,DECK+.44,.085,.055,mats["paper"],group,parent)
        back.location.x=x
        for dx in [-1,1]:
            for dy in [-1,1]:
                rod("Event seating slender leg",(x+dx*.165,-1.25+dy*.13,DECK+.397),(x+dx*.21,-1.25+dy*.175,DECK+.022),.018,mats["silver"],group,parent)
    merge_kit(group,parent)


def build_exhibitions():
    mats=materials();group,parent=kit("ServicesExhibition")
    curve_panel("Exhibition curved partition",3.55,2.22,1.05,DECK,.28,.14,mats["ivory"],group,parent)
    arch("Exhibition portal",1.12,1.96,.18,.42,-1.19,.22,DECK,mats["paper"],group,parent)
    box("Exhibition display panel",(1.23,.055,.91),(.31,.992,DECK+1.3),mats["paper"],group,parent,.025)
    poster_graphic("Exhibition display graphic",1.18,.86,.31,.956,DECK+.87,mats["blue"],group,parent)
    for x,y,h in [(-.55,-.48,.76),(.21,-.63,.56)]:
        cylinder("Product pedestal footing",.28,.07,(x,y,DECK+.035),mats["silver"],group,parent,count=32)
        cylinder("Product pedestal",.27,h-.07,(x,y,DECK+.07+(h-.07)/2),mats["paper"],group,parent,count=32)
        if x<0:
            sculpture("Abstract blue sculpture",(x,y,DECK+h),mats["blue"],group,parent)
        else:
            cylinder("Abstract product cylinder",.11,.25,(x,y,DECK+h+.125),mats["silver"],group,parent)
    for name,z,height,mat in [("Exhibition counter footing",DECK+.035,.07,mats["silver"]),("Exhibition reception counter",DECK+.41,.68,mats["ivory"]),("Exhibition counter top",DECK+.78,.06,mats["paper"])]:
        counter=rounded_slab(name,1.2,.42,height,z,.2,mat,group,parent)
        counter.location=(1.05,-1.02,0)
    rod("Display lamp track",(-1.3,1.03,DECK+2.1),(.65,1.03,DECK+2.1),.019,mats["charcoal"],group,parent)
    for x in [-1.25,-.4,.45]:
        rod("Display lamp support",(x,1.03,DECK+2.05),(x,.78,DECK+2.05),.016,mats["charcoal"],group,parent)
        cylinder("Display lamp",.053,.12,(x,.78,DECK+1.99),mats["charcoal"],group,parent,count=16)
    merge_kit(group,parent)


def interface(name,x,y,z,width,height,mats,group,parent):
    box(name+" page",(width,.018,height),(x,y,z),mats["paper"],group,parent,.025)
    for index in range(3):
        disk=cylinder(name+" toolbar dot",.024,.014,(x-width*.4+index*.092,y-.018,z+height*.415),mats["silver"],group,parent,16)
        disk.rotation_euler.x=math.pi/2
    box(name+" blue visual",(width*.63,.024,height*.34),(x-width*.135,y-.028,z+height*.16),mats["blue"],group,parent,.035)
    for index in range(3):
        box(name+" editorial line",(width*.2,.018,.031),(x+width*.32,y-.025,z+height*.23-index*.12),mats["silver"],group,parent,.01)
    for column in range(3):
        cx=x-width*.345+column*width*.215
        box(name+" responsive card",(width*.185,.021,height*.26),(cx,y-.028,z-height*.235),mats["ivory"],group,parent,.025)
        dot=cylinder(name+" card visual",height*.035,.012,(cx,y-.049,z-height*.2),mats["blue"],group,parent,16)
        dot.rotation_euler.x=math.pi/2
        box(name+" card line",(width*.115,.012,.024),(cx,y-.049,z-height*.29),mats["silver"],group,parent,.008)
    box(name+" action",(width*.2,.024,height*.11),(x+width*.32,y-.028,z-height*.11),mats["blue"],group,parent,.025)


def build_digital():
    mats=materials();group,parent=kit("ServicesDigital")
    box("Browser foot",(1.16,.64,.09),(-.47,.45,DECK+.045),mats["silver"],group,parent,.04)
    box("Browser stem",(.19,.16,.42),(-.47,.45,DECK+.3),mats["silver"],group,parent,.025)
    box("Browser display",(2.68,.19,1.85),(-.47,.4,DECK+1.35),mats["ivory"],group,parent,.075)
    box("Browser inner bezel",(2.57,.022,1.73),(-.47,.296,DECK+1.35),mats["charcoal"],group,parent,.065)
    interface("Browser",-.47,.273,DECK+1.35,2.49,1.66,mats,group,parent)
    box("Phone foot",(.61,.44,.06),(1.23,-.67,DECK+.03),mats["silver"],group,parent,.04)
    box("Phone case",(.78,.19,1.55),(1.23,-.67,DECK+.835),mats["charcoal"],group,parent,.085)
    box("Phone interface",(.67,.018,1.39),(1.23,-.78,DECK+.835),mats["paper"],group,parent,.06)
    box("Phone blue image",(.51,.022,.55),(1.23,-.798,DECK+.94),mats["blue"],group,parent,.045)
    for index in range(3):
        box("Phone layout line",(.44 if index<2 else .29,.02,.036),(1.23,-.798,DECK+.49-index*.095),mats["silver"],group,parent,.014)
    box("Phone earpiece",(.2,.02,.025),(1.23,-.802,DECK+1.48),mats["charcoal"],group,parent,.012)
    box("Keyboard case",(1.4,.49,.07),(-.57,-.95,DECK+.035),mats["ivory"],group,parent,.035)
    for row in range(3):
        for column in range(7):
            box("Keyboard key",(.13,.09,.018),(-1.13+column*.185,-.81-row*.13,DECK+.078),mats["paper"],group,parent,.006)
    mouse=rounded_slab("Mouse shell",.32,.49,.13,DECK+.065,.14,mats["paper"],group,parent)
    mouse.location=(.56,-1.0,0)
    box("Mouse center seam",(.012,.14,.009),(.56,-.89,DECK+.133),mats["silver"],group,parent,.003)
    merge_kit(group,parent)


def build_content():
    mats=materials();group,parent=kit("ServicesContent")
    cross=[(-.05,DECK),(.55,DECK)]
    cross += [(.55+.5*math.sin(index*math.pi/32),DECK+.5*(1-math.cos(index*math.pi/32))) for index in range(1,17)]
    cross += [(1.05,DECK+2.3)]
    vertices=[(x,y,z) for x in [-1.4,1.4] for y,z in cross]
    row=len(cross)
    obj=mesh("Studio cyclorama",vertices,[(i,i+1,i+row+1,i+row) for i in range(row-1)],mats["paper"],group,parent)
    solid=obj.modifiers.new("Backdrop thickness","SOLIDIFY");solid.thickness=.035
    for x in [-1.5,1.5]:
        rod("Backdrop upright",(x,1.07,DECK),(x,1.07,DECK+2.34),.028,mats["silver"],group,parent)
    rod("Backdrop top rail",(-1.52,1.07,DECK+2.34),(1.52,1.07,DECK+2.34),.028,mats["silver"],group,parent)
    for label,x,y,h in [("Camera",.1,-1.05,1.24),("Softbox",-1.55,-.35,1.73)]:
        rod(label+" stand",(x,y,DECK+.18),(x,y,DECK+h),.027,mats["charcoal"],group,parent)
        for angle in [0,2*math.pi/3,4*math.pi/3]:
            rod(label+" tripod",(x,y,DECK+.39),(x+.36*math.cos(angle),y+.36*math.sin(angle),DECK+.018),.018,mats["charcoal"],group,parent)
    camera_center=Vector((.1,-1.05,DECK+1.38))
    camera_direction=Vector((.4,.9165,0)).normalized()
    body=box("Camera body",(.43,.31,.28),camera_center,mats["charcoal"],group,parent,.035)
    body.rotation_euler.z=-.412
    for name,radius,depth,offset,mat in [("Camera lens mount",.135,.055,.18,mats["silver"]),("Camera lens",.12,.21,.29,mats["charcoal"]),("Camera lens rim",.125,.021,.403,mats["silver"]),("Camera lens glass",.104,.012,.418,mats["blue"])]:
        lens=cylinder(name,radius,depth,camera_center+camera_direction*offset,mat,group,parent)
        lens.rotation_euler=camera_direction.to_track_quat("Z","Y").to_euler()
    box("Camera rear display",(.28,.019,.17),(.08,-1.205,DECK+1.39),mats["silver"],group,parent,.018)
    box("Camera finder",(.17,.16,.08),(.1,-1.02,DECK+1.56),mats["charcoal"],group,parent,.015)
    softbox_center=Vector((-1.55,-.35,DECK+1.86))
    softbox_direction=(Vector((.62,.3,DECK+.67))-softbox_center).normalized()
    light=cylinder("Softbox octagonal shell",.44,.21,softbox_center,mats["charcoal"],group,parent,8)
    light.rotation_euler=softbox_direction.to_track_quat("Z","Y").to_euler()
    face=cylinder("Softbox diffusion",.42,.018,softbox_center+softbox_direction*.116,mats["paper"],group,parent,8)
    face.rotation_euler=softbox_direction.to_track_quat("Z","Y").to_euler()
    box("Studio subject pedestal",(.46,.46,.44),(.62,.3,DECK+.22),mats["ivory"],group,parent,.04)
    box("Studio subject blue object",(.28,.28,.31),(.62,.3,DECK+.595),mats["blue"],group,parent,.06)
    rod("Reflector stand",(1.6,.03,DECK+.12),(1.6,.03,DECK+1.18),.023,mats["silver"],group,parent)
    for angle in [0,2*math.pi/3,4*math.pi/3]:
        rod("Reflector tripod",(1.6,.03,DECK+.34),(1.6+.24*math.cos(angle),.03+.24*math.sin(angle),DECK+.018),.016,mats["silver"],group,parent)
    box("Reflector frame",(.58,.06,.94),(1.6,.03,DECK+1.24),mats["charcoal"],group,parent,.05)
    box("Reflector white panel",(.51,.012,.87),(1.6,-.008,DECK+1.24),mats["paper"],group,parent,.045)
    merge_kit(group,parent)


def build_advertising():
    mats=materials();group,parent=kit("ServicesAdvertising")
    for x in [-1.34,.54]:
        box("Billboard base",(.55,.57,.1),(x,.65,DECK+.05),mats["silver"],group,parent,.035)
        rod("Billboard structure",(x,.65,DECK+.1),(x,.65,DECK+2.38),.054,mats["silver"],group,parent)
        box("Billboard rear anchor",(.28,.29,.07),(x,1.37,DECK+.035),mats["silver"],group,parent,.018)
        rod("Billboard diagonal brace",(x,.65,DECK+1.2),(x,1.37,DECK+.07),.025,mats["silver"],group,parent)
    box("Billboard frame",(2.78,.18,1.32),(-.4,.63,DECK+1.63),mats["charcoal"],group,parent,.035)
    box("Billboard poster face",(2.61,.018,1.16),(-.4,.524,DECK+1.63),mats["paper"],group,parent,.014)
    poster_graphic("Billboard poster graphic",2.58,1.13,-.4,.510,DECK+1.065,mats["blue"],group,parent)
    for x in [-1.35,-.4,.55]:
        rod("Billboard light arm",(x,.65,DECK+2.3),(x,.38,DECK+2.3),.017,mats["silver"],group,parent)
        cylinder("Billboard light",.06,.045,(x,.38,DECK+2.28),mats["charcoal"],group,parent,count=16)
    box("Lightbox footing",(.58,.6,.08),(1.47,-.14,DECK+.04),mats["silver"],group,parent,.035)
    box("Lightbox shell",(.61,.27,1.94),(1.47,-.14,DECK+1.05),mats["ivory"],group,parent,.045)
    box("Lightbox face",(.51,.016,1.78),(1.47,-.287,DECK+1.05),mats["paper"],group,parent,.027)
    poster_graphic("Lightbox graphic",.48,1.7,1.47,-.308,DECK+.21,mats["blue"],group,parent)
    arch("Dimensional sign",.96,.95,.22,.2,-.49,-1.14,DECK,mats["ivory"],group,parent)
    disk=cylinder("Dimensional blue roundel",.32,.17,(.12,-1.13,DECK+.32),mats["blue"],group,parent,32);disk.rotation_euler.x=math.pi/2
    merge_kit(group,parent)


def preview_setup():
    scene=bpy.context.scene
    group=collection("Services preview lighting")
    camera_data=bpy.data.cameras.new("Services orthographic camera")
    camera=bpy.data.objects.new("ServicesPreviewCamera",camera_data);group.objects.link(camera)
    camera.location=(7,-8,6.5)
    camera.rotation_euler=(Vector((0,0,.85))-camera.location).to_track_quat("-Z","Y").to_euler()
    camera_data.type="ORTHO";camera_data.ortho_scale=7.7
    scene.camera=camera
    for name,position,power,size in [("Key",(-3,-4,7),650,5),("Fill",(5,-1,4),380,5),("Rim",(0,5,5),480,4)]:
        data=bpy.data.lights.new("Services "+name,"AREA");data.energy=power;data.shape="DISK";data.size=size
        light=bpy.data.objects.new("Services "+name,data);group.objects.link(light);light.location=position
        light.rotation_euler=(Vector((0,0,.7))-light.location).to_track_quat("-Z","Y").to_euler()
    engine=scene.render.engine
    if "EEVEE" not in engine:
        for candidate in ["BLENDER_EEVEE","BLENDER_EEVEE_NEXT"]:
            try:
                scene.render.engine=candidate
                break
            except TypeError:
                pass
    scene.render.resolution_x=896;scene.render.resolution_y=896;scene.render.resolution_percentage=100
    scene.render.film_transparent=True
    available=[item.identifier for item in scene.view_settings.bl_rna.properties["view_transform"].enum_items]
    if "AgX" in available:
        scene.view_settings.view_transform="AgX"
    for area in bpy.context.screen.areas:
        if area.type=="VIEW_3D":
            area.spaces.active.region_3d.view_perspective="CAMERA"
            area.spaces.active.shading.type="MATERIAL"


def visibility(index):
    for kit_index,name in enumerate(KIT_NAMES):
        parent=bpy.data.objects[name]
        for child in parent.children_recursive:
            child.hide_render=kit_index!=index
            child.hide_set(kit_index!=index)


def finish():
    os.makedirs(SOURCE,exist_ok=True);os.makedirs(PUBLIC,exist_ok=True)
    for obj in bpy.context.selected_objects:
        obj.select_set(False)
    for name in ["ServicesPlatform"]+KIT_NAMES:
        parent=bpy.data.objects[name]
        parent.select_set(True)
        for child in parent.children_recursive:
            child.hide_set(False);child.hide_render=False;child.select_set(True)
    glb_path=os.path.join(PUBLIC,"mandegar-services.glb")
    bpy.ops.export_scene.gltf(filepath=glb_path,export_format="GLB",use_selection=True,use_active_scene=True,export_apply=True,export_animations=False,export_cameras=False,export_lights=False)
    visibility(0)
    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(SOURCE,"mandegar-services.blend"))
    with open(glb_path,"rb") as file:
        file.seek(12)
        json_length,_=struct.unpack("<II",file.read(8))
        gltf=json.loads(file.read(json_length))
    draw_calls=sum(len(mesh["primitives"]) for mesh in gltf["meshes"])
    nodes={node.get("name"): node for node in gltf["nodes"]}
    def mesh_calls(node):
        return (len(gltf["meshes"][node["mesh"]]["primitives"]) if "mesh" in node else 0) + sum(mesh_calls(gltf["nodes"][index]) for index in node.get("children",[]))
    per_pose={name: mesh_calls(nodes["ServicesPlatform"])+mesh_calls(nodes[name]) for name in KIT_NAMES}
    manifest={"source":"Blender 5.0; authored by scripts/blender/build-services.py", "nodes":["ServicesPlatform"]+KIT_NAMES,"detailNodes":[name+"_Details" for name in KIT_NAMES],"deckHeight":DECK,"platformSize":[4.8,4.0],"glbBytes":os.path.getsize(glb_path),"materials":len(gltf["materials"]),"totalDrawCalls":draw_calls,"drawCallsPerPose":per_pose,"textureBytes":0,"animation":"Runtime deterministic rotation and staggered architecture/equipment assembly; no animation clips", "externalMedia":False}
    for obj in bpy.context.scene.objects:
        if obj.type=="MESH":
            obj.data.calc_loop_triangles()
    manifest["triangles"]=sum(len(obj.data.loop_triangles) for obj in bpy.context.scene.objects if obj.type=="MESH")
    with open(os.path.join(SOURCE,"asset-manifest.json"),"w",encoding="utf-8") as file:
        json.dump(manifest,file,indent=2)
    print(json.dumps(manifest))


def render_existing():
    scene=bpy.data.scenes[SCENE_NAME]
    bpy.context.window.scene=scene
    os.makedirs(SOURCE,exist_ok=True)
    formats=[item.identifier for item in scene.render.image_settings.bl_rna.properties["file_format"].enum_items]
    if "PNG" in formats:
        scene.render.image_settings.file_format="PNG"
    modes=[item.identifier for item in scene.render.image_settings.bl_rna.properties["color_mode"].enum_items]
    if "RGBA" in modes:
        scene.render.image_settings.color_mode="RGBA"
    for index,name in enumerate(POSTER_NAMES):
        visibility(index)
        scene.render.filepath=os.path.join(SOURCE,name+".png")
        bpy.ops.render.render(write_still=True)
        print("SERVICES_POSTER "+name,flush=True)


if __name__=="__main__":
    if "--render-existing" in sys.argv:
        render_existing()
    else:
        setup();build_platform();build_events();build_exhibitions();build_digital();build_content();build_advertising();preview_setup();finish()
