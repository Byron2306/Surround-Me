from __future__ import annotations

GROUND_X_PX_PER_M = 16.0
GROUND_Y_PX_PER_M = 8.0


def project_ground(world_x_m: float, world_y_m: float) -> tuple[float, float]:
    return (
        (float(world_x_m) - float(world_y_m)) * GROUND_X_PX_PER_M,
        (float(world_x_m) + float(world_y_m)) * GROUND_Y_PX_PER_M,
    )


def anchor_world_position(
    width_m: float,
    depth_m: float,
    anchor: tuple[float, float],
) -> tuple[float, float]:
    ax, ay = anchor
    return (float(width_m) * float(ax), float(depth_m) * float(ay))
