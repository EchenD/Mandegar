import * as THREE from "three";

export type BakedExhibitionSectionId = "central" | "left" | "right";
export type BakedSectionId = "environment" | BakedExhibitionSectionId;
export type BakedScreenId = "videoWall" | "interactive" | "game" | "main";

export const interactionAnchorNames = [
  "fxAnchor_interaction_photo_hotspot",
  "fxAnchor_interaction_photo_flash",
  "fxAnchor_interaction_photo_phone",
  "fxAnchor_interaction_touch_hotspot",
  "fxAnchor_interaction_stage_hotspot",
  "fxAnchor_stage_beam_origin_01",
  "fxAnchor_stage_beam_origin_02",
  "fxAnchor_stage_beam_origin_03",
  "fxAnchor_stage_beam_origin_04",
  "fxAnchor_stage_beam_origin_05",
  "fxAnchor_stage_beam_target_01",
  "fxAnchor_stage_beam_target_02",
  "fxAnchor_stage_beam_target_03",
  "fxAnchor_stage_beam_target_04",
  "fxAnchor_stage_beam_target_05",
  "fxAnchor_interaction_game_hotspot",
  "fxAnchor_interaction_draw_hotspot",
] as const;

const reportedContractWarnings = new Set<string>();

function reportContractWarning(message: string) {
  if (process.env.NODE_ENV === "production" || reportedContractWarnings.has(message)) return;
  reportedContractWarnings.add(message);
  console.warn(message);
}

export const bakedSceneContract = {
  textures: {
    environmentQuiet: {
      desktop: {
        runtime: "/textures/mandegar/baked/env_quiet.webp",
        ktx2: "/textures/mandegar/baked/env_quiet.ktx2",
      },
      mobile: {
        runtime: "/textures/mandegar/baked/mobile/env_quiet.webp",
        ktx2: "/textures/mandegar/baked/mobile/env_quiet.ktx2",
      },
    },
    environmentPeak: {
      desktop: {
        runtime: "/textures/mandegar/baked/env_peak.webp",
        ktx2: "/textures/mandegar/baked/env_peak.ktx2",
      },
      mobile: {
        runtime: "/textures/mandegar/baked/mobile/env_peak.webp",
        ktx2: "/textures/mandegar/baked/mobile/env_peak.ktx2",
      },
    },
    exhibitionQuiet: {
      desktop: {
        runtime: "/textures/mandegar/baked/exhibit_quiet.webp",
        ktx2: "/textures/mandegar/baked/exhibit_quiet.ktx2",
      },
      mobile: {
        runtime: "/textures/mandegar/baked/mobile/exhibit_quiet.webp",
        ktx2: "/textures/mandegar/baked/mobile/exhibit_quiet.ktx2",
      },
    },
    exhibitionPeak: {
      desktop: {
        runtime: "/textures/mandegar/baked/exhibit_peak.webp",
        ktx2: "/textures/mandegar/baked/exhibit_peak.ktx2",
      },
      mobile: {
        runtime: "/textures/mandegar/baked/mobile/exhibit_peak.webp",
        ktx2: "/textures/mandegar/baked/mobile/exhibit_peak.ktx2",
      },
    },
  },
  materials: {
    environment: "MAT_ENV_BAKED",
    exhibition: "MAT_EXHIBIT_BAKED",
  },
  environment: {
    root: "root_environment",
    section: "env_shell",
    revealAnchor: "fxAnchor_reveal_environment",
    camera: "camera_mandegar_master",
    cameraClip: "camera_master_loop",
  },
  exhibition: {
    root: "root_exhibition",
    sections: {
      central: {
        root: "section_central",
        revealAnchor: "fxAnchor_reveal_central",
        signalAnchor: "fxAnchor_signal_central",
      },
      left: {
        root: "section_left",
        revealAnchor: "fxAnchor_reveal_left",
        signalAnchor: "fxAnchor_signal_left",
      },
      right: {
        root: "section_right",
        revealAnchor: "fxAnchor_reveal_right",
        signalAnchor: "fxAnchor_signal_right",
      },
    },
    screens: {
      videoWall: "screen_video_wall_21x9",
      interactive: "screen_interactive_16x9",
      game: "screen_game_16x9",
      main: "screen_main_16x9",
    },
    screenSections: {
      videoWall: "central",
      interactive: "left",
      game: "right",
      main: "right",
    },
    interactionAnchors: {
      photoHotspot: "fxAnchor_interaction_photo_hotspot",
      photoFlash: "fxAnchor_interaction_photo_flash",
      photoPhone: "fxAnchor_interaction_photo_phone",
      touchHotspot: "fxAnchor_interaction_touch_hotspot",
      stageHotspot: "fxAnchor_interaction_stage_hotspot",
      gameHotspot: "fxAnchor_interaction_game_hotspot",
      drawHotspot: "fxAnchor_interaction_draw_hotspot",
      beamOrigins: [
        "fxAnchor_stage_beam_origin_01",
        "fxAnchor_stage_beam_origin_02",
        "fxAnchor_stage_beam_origin_03",
        "fxAnchor_stage_beam_origin_04",
        "fxAnchor_stage_beam_origin_05",
      ],
      beamTargets: [
        "fxAnchor_stage_beam_target_01",
        "fxAnchor_stage_beam_target_02",
        "fxAnchor_stage_beam_target_03",
        "fxAnchor_stage_beam_target_04",
        "fxAnchor_stage_beam_target_05",
      ],
      beamEmitterMeshes: [
        "fxMesh_stage_beam_origin_01",
        "fxMesh_stage_beam_origin_02",
        "fxMesh_stage_beam_origin_03",
        "fxMesh_stage_beam_origin_04",
        "fxMesh_stage_beam_origin_05",
      ],
    },
  },
  crowd: {
    root: "root_crowd",
    actorPrefix: "Human_",
    slots: "crowd_slots",
  },
} as const;

export function getContractObject(root: THREE.Object3D, name: string) {
  return root.getObjectByName(name) ?? null;
}

export function validateContractNodes(
  root: THREE.Object3D,
  names: readonly string[],
  label: string,
) {
  const missing = names.filter((name) => !root.getObjectByName(name));
  if (missing.length > 0) {
    reportContractWarning(
      `[Mandegar] ${label} is missing required nodes: ${missing.join(", ")}`,
    );
  }
  return missing;
}

export function validateContractMaterials(
  root: THREE.Object3D,
  names: readonly string[],
  label: string,
) {
  const found = new Set<string>();
  root.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    materials.forEach((material) => found.add(material.name));
  });
  const missing = names.filter((name) => !found.has(name));
  if (missing.length > 0) {
    reportContractWarning(
      `[Mandegar] ${label} is missing required source materials: ${missing.join(", ")}`,
    );
  }
  return missing;
}

export function validateInteractionAnchors(root: THREE.Object3D) {
  const missing = interactionAnchorNames.filter((name) => !root.getObjectByName(name));
  missing.forEach((name) => {
    reportContractWarning(
      `[Mandegar] Exhibition GLB is missing required interaction anchor: ${name}; using deterministic runtime fallback.`,
    );
  });
  return missing;
}

export const requiredEnvironmentNodes = [
  bakedSceneContract.environment.root,
  bakedSceneContract.environment.section,
  bakedSceneContract.environment.revealAnchor,
  bakedSceneContract.environment.camera,
] as const;

export const requiredExhibitionNodes = [
  bakedSceneContract.exhibition.root,
  bakedSceneContract.exhibition.sections.central.root,
  bakedSceneContract.exhibition.sections.central.revealAnchor,
  bakedSceneContract.exhibition.sections.central.signalAnchor,
  bakedSceneContract.exhibition.sections.left.root,
  bakedSceneContract.exhibition.sections.left.revealAnchor,
  bakedSceneContract.exhibition.sections.left.signalAnchor,
  bakedSceneContract.exhibition.sections.right.root,
  bakedSceneContract.exhibition.sections.right.revealAnchor,
  bakedSceneContract.exhibition.sections.right.signalAnchor,
  ...Object.values(bakedSceneContract.exhibition.screens),
  ...bakedSceneContract.exhibition.interactionAnchors.beamEmitterMeshes,
] as const;
