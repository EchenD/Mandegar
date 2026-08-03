-- Mandegar modular proxy package v1
-- Authored in meters for 3ds Max 2022 and exported through the bundled Babylon GLB exporter.

fn registerNode node nodeArray =
(
  append nodeArray node
  node
)

fn buildMandegarHero =
(
global repoRoot = @"D:\Projects\Navid\Mandegar"
global outputRoot = repoRoot + @"\public\models\mandegar-v1"
global sourceRoot = repoRoot + @"\Docs\CreativeProduction\3d\max"

makeDir outputRoot
makeDir sourceRoot
resetMaxFile #noPrompt

units.SystemType = #Meters
units.DisplayType = #Metric

fn makeMaterial materialName materialColor materialOpacity:100 selfIllumination:0 =
(
  local material = standardMaterial name:materialName
  material.diffuse = materialColor
  material.ambient = materialColor
  material.specular = color 34 38 42
  material.specularLevel = 12
  material.glossiness = 24
  material.opacity = materialOpacity
  material.selfIllumAmount = selfIllumination
  material.twoSided = true
  material
)

global matWarmWhite = makeMaterial "mat_warm_white" (color 247 247 244)
global matSoftFog = makeMaterial "mat_soft_fog" (color 232 235 234)
global matCharcoal = makeMaterial "mat_charcoal" (color 22 25 29)
global matCobalt = makeMaterial "mat_cobalt_signal" (color 34 92 255) selfIllumination:70
global matCyan = makeMaterial "mat_cyan_media" (color 80 199 255) selfIllumination:55
global matVeil = makeMaterial "mat_translucent_veil" (color 235 241 244) materialOpacity:34 selfIllumination:8

global hallNodes = #()
global heroNodes = #()
global haloNodes = #()
global podNodes = #()
global mediaNodes = #()
global anchorNodes = #()

-- Hall floor and circular spatial boundary.
floor = cylinder name:"hall_floor" radius:10.0 height:0.10 sides:128 capsegs:1 heightsegs:1 pos:[0,0,-0.10]
floor.material = matSoftFog
registerNode floor hallNodes

inlay = torus name:"hall_circular_inlay" radius1:7.45 radius2:0.025 sides:96 segments:8 pos:[0,0,0.015]
inlay.material = matCharcoal
registerNode inlay hallNodes

-- Central vertically ribbed core.
core = cylinder name:"hero_core_shell" radius:2.20 height:3.20 sides:96 capsegs:1 heightsegs:1 pos:[0,0,0]
core.material = matWarmWhite
registerNode core heroNodes

ribCount = 64
for index = 0 to (ribCount - 1) do
(
  local angle = index * (360.0 / ribCount)
  local rib = box name:("hero_core_rib_" + formattedPrint index format:"03d") width:0.055 length:0.11 height:3.05 pos:[(cos angle) * 2.21, (sin angle) * 2.21, 0.08]
  rib.rotation = eulerAngles 0 0 (-angle)
  rib.material = matSoftFog
  registerNode rib heroNodes
)

-- Smaller canopy over the core.
canopy = cylinder name:"hero_canopy" radius:2.75 height:0.46 sides:96 capsegs:1 heightsegs:1 pos:[0,0,3.35]
canopy.material = matWarmWhite
registerNode canopy heroNodes

canopyLight = torus name:"hero_canopy_light" radius1:2.52 radius2:0.035 sides:96 segments:8 pos:[0,0,3.34]
canopyLight.material = matCyan
registerNode canopyLight heroNodes

-- Low curved/asymmetric stage proxy. Final sculpted stage replaces this module without changing pivots.
stageBase = cylinder name:"stage_base" radius:3.25 height:0.28 sides:96 capsegs:1 heightsegs:1 pos:[0,-1.65,0.02]
stageBase.scale = [1.0,0.34,1.0]
stageBase.material = matWarmWhite
registerNode stageBase heroNodes

stageFront = chamferBox name:"stage_front_rise" width:5.2 length:0.55 height:0.48 fillet:0.22 filletsegments:5 pos:[0,-2.55,0.12]
stageFront.rotation = eulerAngles 0 0 -4
stageFront.material = matWarmWhite
registerNode stageFront heroNodes

stageLight = box name:"stage_signal_edge" width:4.9 length:0.025 height:0.035 pos:[0,-2.84,0.58]
stageLight.rotation = eulerAngles 0 0 -4
stageLight.material = matCobalt
registerNode stageLight heroNodes

-- Rear translucent veil.
veil = chamferBox name:"hero_rear_veil" width:8.6 length:0.08 height:4.1 fillet:0.18 filletsegments:4 pos:[0,2.05,0.25]
veil.material = matVeil
registerNode veil heroNodes

-- Suspended signature halo and explicit runtime anchor.
halo = torus name:"ring_signature_halo" radius1:5.20 radius2:0.095 sides:12 segments:128 pos:[0,0,5.85]
halo.material = matWarmWhite
registerNode halo haloNodes

haloSignal = torus name:"ring_signal_surface" radius1:5.20 radius2:0.035 sides:8 segments:128 pos:[0,0,5.845]
haloSignal.material = matCobalt
registerNode haloSignal haloNodes

haloAnchor = point name:"fxAnchor_halo_center" size:0.20 cross:true box:false pos:[0,0,5.85]
registerNode haloAnchor anchorNodes

-- Two attached experience pods with media surfaces and interaction anchors.
for podSpec in #(#("left", -3.75), #("right", 3.75)) do
(
  sideLabel = podSpec[1]
  xPosition = podSpec[2]
  local pod = chamferBox name:("booth_" + sideLabel + "_shell") width:2.25 length:1.55 height:2.45 fillet:0.28 filletsegments:6 pos:[xPosition,-0.25,0]
  pod.material = matWarmWhite
  registerNode pod podNodes

  local portal = chamferBox name:("booth_" + sideLabel + "_portal") width:1.55 length:0.10 height:1.65 fillet:0.18 filletsegments:5 pos:[xPosition,-1.05,0.38]
  portal.material = matSoftFog
  registerNode portal podNodes

  local screen = box name:("led_" + sideLabel + "_screen_16x9") width:0.92 length:0.035 height:0.52 pos:[xPosition,-1.14,1.18]
  screen.material = matCyan
  registerNode screen mediaNodes

  local touch = chamferBox name:("touch_" + sideLabel + "_surface") width:0.95 length:0.48 height:0.08 fillet:0.05 filletsegments:3 pos:[xPosition,-1.52,0.78]
  touch.material = matCobalt
  registerNode touch podNodes

  local anchor = point name:("fxAnchor_" + sideLabel + "_interaction") size:0.15 cross:true box:false pos:[xPosition,-1.40,1.05]
  registerNode anchor anchorNodes
)

-- Layered architectural wings visually connect the experience pods to the central pavilion.
for wingSpec in #(#("left", -4.15), #("right", 4.15)) do
(
  wingLabel = wingSpec[1]
  wingX = wingSpec[2]
  local wing = chamferBox name:("wing_" + wingLabel + "_canopy") width:3.35 length:1.2 height:0.48 fillet:0.19 filletsegments:5 pos:[wingX,0.52,2.38]
  wing.material = matWarmWhite
  registerNode wing podNodes

  local wingLight = box name:("wing_" + wingLabel + "_signal") width:2.95 length:0.035 height:0.035 pos:[wingX,-0.10,2.42]
  wingLight.material = matCyan
  registerNode wingLight podNodes
)

-- Central media surface and runtime focus anchor.
centralMedia = box name:"led_central_media_21x9" width:3.2 length:0.035 height:1.05 pos:[0,-2.225,1.42]
centralMedia.material = matCharcoal
registerNode centralMedia mediaNodes

focusAnchor = point name:"fxAnchor_camera_focus" size:0.20 cross:true box:false pos:[0,-0.40,1.85]
registerNode focusAnchor anchorNodes

-- Save the editable 3ds Max source before web export.
saveMaxFile (sourceRoot + @"\Mandegar_Hero_v1.max") quiet:true

dotNet.loadAssembly @"C:\Program Files\Autodesk\3ds Max 2022\bin\assemblies\Max2Babylon.dll"
global babylonManager = dotNetObject "Max2Babylon.MaxScriptManager"

fn exportSelection nodes outputFile =
(
  clearSelection()
  select nodes
  local exportParams = babylonManager.InitParameters outputFile
  exportParams.outputPath = outputFile
  exportParams.outputFormat = "glb"
  exportParams.exportOnlySelected = true
  exportParams.exportHiddenObjects = false
  exportParams.exportMaterials = true
  exportParams.writeTextures = true
  exportParams.overwriteTextures = true
  exportParams.exportAnimations = false
  exportParams.optimizeVertices = true
  exportParams.exportTangents = true
  exportParams.enableKHRMaterialsUnlit = true
  exportParams.enableKHRTextureTransform = true
  exportParams.dracoCompression = false
  babylonManager.Export exportParams true
)

exportSelection hallNodes (outputRoot + @"\mandegar_hall_shell_v1.glb")
exportSelection heroNodes (outputRoot + @"\mandegar_hero_core_v1.glb")
exportSelection haloNodes (outputRoot + @"\mandegar_halo_v1.glb")
exportSelection (join podNodes mediaNodes) (outputRoot + @"\mandegar_experience_pods_v1.glb")
exportSelection (join (join (join (join hallNodes heroNodes) haloNodes) podNodes) (join mediaNodes anchorNodes)) (outputRoot + @"\mandegar_hero_assembled_v1.glb")

quitMax #noPrompt
)

try
(
  buildMandegarHero()
)
catch
(
  errorLog = createFile @"D:\Projects\Navid\Mandegar\Docs\CreativeProduction\3d\3dsmax-build-error.log"
  format "%\n" (getCurrentException()) to:errorLog
  close errorLog
  quitMax #noPrompt
)
