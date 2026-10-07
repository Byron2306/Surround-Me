# A-02 review plots and procedural finish repair

Approved scope: place the master and A-02 in clear plots and improve A-02 roof, plaster, trim and weathering through the Blender-governed pipeline. Preserve geometry, no-porch rule, sockets, camera and exact final-byte bindings.

The review plots share projected ground height and lie inside the perimeter. Other structures and props are cleared around them, and the player starts between the houses. These placement changes apply only to `?house-variant=house.a.02`.

A-02's structural and extended roofs shared the same sloping planes. Its structural prism remains available for geometry evidence but is excluded from rendering; the extended roof is the visible skin. A new variant-only procedural finish provides staggered clay tile courses, dark joints, moss tint, chipped plaster, base damp, wood grain and window frames. Gable triangles use plaster. These shaders preserve mesh dimensions and silhouette.

The scene records both finish parameters and a hash of the shader implementation. Export requires those to match the installed code. Old A-02 renders therefore require a fresh build after this repair:

```bash
bash tools/build_house_a02.sh
```

After PASS, refresh `http://127.0.0.1:8000/?house-variant=house.a.02`.

Blender is unavailable in the development environment. The node graph and visibility regression tests are provided for a Blender-capable host; rendered visual quality remains pending human review. This repair does not claim parity with the master image's detail.

Validation: 42 Node tests, 15 export tests and 35 targeted Python regressions passed. One Blender test module is skipped on this host. Independent review found an optional-finish receipt read and an incomplete finish binding; both are corrected. New Blender tests inspect roof visibility, clay course nodes and plaster gable assignment. Fresh render and human appearance acceptance remain pending.
