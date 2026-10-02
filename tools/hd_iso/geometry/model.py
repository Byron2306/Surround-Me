from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

Facade = Literal["FRONT", "BACK", "LEFT", "RIGHT"]


@dataclass(frozen=True)
class OpeningSocket:
    name: str
    facade: Facade
    width_m: float
    height_m: float
    sill_height_m: float
    lateral_position: float


@dataclass(frozen=True)
class AttachmentSocket:
    name: str
    facade: Facade
    bounds_m: tuple[float, float, float]


@dataclass(frozen=True)
class HouseGeometry:
    template_id: str
    width_m: float
    depth_m: float
    max_height_m: float
    anchor: tuple[float, float]
    facade_orientation: Facade
    wall_height_m: float
    roof_pitch_degrees: float
    ridge_axis: Literal["X", "Y"]
    eave_overhang_m: float
    door: OpeningSocket
    windows: tuple[OpeningSocket, ...]
    attachments: tuple[AttachmentSocket, ...]
    roof_rise_m: float = 0.0


@dataclass(frozen=True)
class GeometryManifest:
    schema_version: str
    template_id: str
    structural_seed: int
    house: HouseGeometry
