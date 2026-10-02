from __future__ import annotations

from .model import AttachmentSocket, OpeningSocket


def front_door(width_m: float, height_m: float, lateral_position: float) -> OpeningSocket:
    return OpeningSocket("front-door", "FRONT", width_m, height_m, 0.0, lateral_position)


def front_window(index: int, width_m: float, height_m: float, sill_height_m: float, lateral_position: float) -> OpeningSocket:
    return OpeningSocket(f"front-window-{index}", "FRONT", width_m, height_m, sill_height_m, lateral_position)


def porch_socket(max_bounds_m: tuple[float, float, float]) -> AttachmentSocket:
    return AttachmentSocket("porch", "FRONT", max_bounds_m)
