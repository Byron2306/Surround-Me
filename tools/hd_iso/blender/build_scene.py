from __future__ import annotations

from .build_mesh import build_house_objects
from .camera import ensure_canonical_camera


def build_house_scene(bpy, manifest: dict) -> dict[str, object]:
    """Build the canonical House A Blender scene from validated manifest truth.

    The scene wrapper owns no geometry choices. It installs the frozen camera
    and delegates all structural construction to ``build_house_objects``.
    """
    scene = bpy.context.scene
    camera_proof = ensure_canonical_camera(scene)
    if camera_proof.status != "PASS":
        raise RuntimeError(f"canonical camera refused: {camera_proof.reasons}")

    objects = build_house_objects(bpy, manifest)
    return {
        "scene": scene,
        "cameraProof": camera_proof,
        "objects": objects,
    }
