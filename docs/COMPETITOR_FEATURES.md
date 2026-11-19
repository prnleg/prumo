# What other apps do that Prumo doesn't (yet)

> Owner request (2026-11-18): "search for apps that do the same things and list their functions that we don't
> have yet. The most amount of things the better." This is a **backlog to pick from**, not a plan.
> Nothing here is accepted. Each item still needs the normal steps (ROADMAP order, ADR when it is a new decision).
> Items marked ⛔ are **non-goals today** (`docs/GOALS.md`) — listed so we know they exist; they need the owner
> to change GOALS first. ⏸ = parked "for now" in GOALS. 🧩 = would fit as an optional module (ADR-019/059).

Apps looked at: Sweet Home 3D (open source), Planner 5D, Floorplanner, RoomSketcher, Cedreo, Chief Architect /
Home Designer, SketchUp + LayOut, Revit, Archicad, FreeCAD BIM, magicplan, Homestyler / Coohom, Eberick /
QiAlvenaria (Brazilian structural), and The Sims 4 build mode (interaction reference only — UX_PRINCIPLES).
Sources at the end. Vendor pages are marketing; treat "has X" as "says it has X".

## 1. Drawing and editing the plan

| # | Feature | Seen in | Note |
|---|---|---|---|
| 1.1 | Curved / round walls | Sweet Home 3D, Chief, Archicad, Revit | ⏸ Q-096 |
| 1.2 | Dimension tool (draw your own measurement lines, dimension chains) | SH3D, SketchUp LayOut, Revit, Archicad, Chief | we show wall lengths only |
| 1.3 | Automatic outside dimension chains (overall + openings) | Archicad, Chief, RoomSketcher | |
| 1.4 | Free text labels and arrows / callouts on the plan | SH3D, LayOut, RoomSketcher | notes exist, plain labels don't |
| 1.5 | Edit a length by typing it and the wall moves (dimension drives geometry) | Revit, SketchUp | we have length field in the panel |
| 1.6 | Polylines / free 2D lines, hatches, fills (site lines, garden) | LayOut, FreeCAD, Archicad | |
| 1.7 | Trace over an imported image (sketch, scan, old plan) with scale calibration | SH3D ("import background image"), Floorplanner, Planner 5D | big beginner win: draw over a photo of the paper plan |
| 1.8 | Turn a photo/sketch of a plan into walls automatically (recognition) | Planner 5D, RoomSketcher, magicplan | AI; heavy |
| 1.9 | Scan a room with the phone (AR / LiDAR) into a plan | magicplan, RoomSketcher, Planner 5D | ⏸ mobile |
| 1.10 | Columns / pillars as objects | Sims, Chief, Revit, Archicad | structural meaning too (engineer) |
| 1.11 | Beams drawn in plan | Revit, Eberick, Archicad | Tier 2 territory |
| 1.12 | Half walls / railings / balustrades | Sims, Chief, SH3D | half walls exist; railings don't |
| 1.13 | Split a wall in two / join two walls | Revit, Archicad, Chief | |
| 1.14 | Offset / array copy (copy N times at a spacing) | SketchUp, Revit, Archicad | |
| 1.15 | Align / distribute selected items | LayOut, Archicad | |
| 1.16 | Lock an element against edits | Revit (pin), Archicad, SketchUp | we have "protected" for load-bearing only |
| 1.17 | Groups / named groups | SketchUp, SH3D | |
| 1.18 | Measure tool (distance between two points without drawing) | SketchUp (tape), SH3D, Archicad | |
| 1.19 | Guides / construction lines | SketchUp | |
| 1.20 | Snap to midpoints / perpendicular / extension lines of other walls | Archicad, Revit, SketchUp | we snap to grid, ends, angles |
| 1.21 | Reference grid lines (axes A, B, 1, 2) | Revit, Archicad, Eberick | |
| 1.22 | Wall layers (block + plaster + finish as separate build-up) | Archicad, Revit, Chief | we have finishes per face |
| 1.23 | Room by clicking inside an area enclosed by walls | Archicad, Chief | rooms are auto-detected already |
| 1.24 | Room auto-naming / numbering, room tags with area + perimeter + ceiling height | Archicad, Revit, RoomSketcher | |
| 1.25 | Ceiling height per room, dropped ceilings | Chief, SH3D, Sims | |
| 1.26 | Floor-level steps inside a floor (sunken living room, platforms) | Sims, Chief | |
| 1.27 | Openings that aren't doors/windows (pass-through, niche, arch) | Chief, SH3D, Sims (arches) | |
| 1.28 | Non-rectangular doors/windows (arched, round) | SH3D 4.2, Chief | |
| 1.29 | Skylights / roof windows | Chief, Archicad | needs roofs |
| 1.30 | Garage doors, sliding glass walls, more door/window catalogues | SH3D, Chief, Planner 5D | we have ~types per ADR-046 |
| 1.31 | Window/door sizes from a standard catalogue (Brazilian market sizes) | Chief, Archicad (local libs) | data pack candidate |
| 1.32 | Keyboard command palette / type-a-command | Archicad, Revit, SketchUp | |

## 2. Building parts we don't model yet

| # | Feature | Seen in | Note |
|---|---|---|---|
| 2.1 | Stairs tool (straight, L, U, spiral) + stair openings in slabs | Sims, Chief, SH3D, Revit | needed for real multi-storey houses |
| 2.2 | Ramps | Chief | accessibility (NBR 9050) |
| 2.3 | Automatic roof from the walls (hip / gable), roof pitch, overhang | Chief ("most powerful tool"), Cedreo, Sims | ⏸ pitched roofs (Q-098) |
| 2.4 | Manual roof planes, dormers, gutters | Chief, Archicad | ⏸ |
| 2.5 | Roof materials (tiles, metal, slab roof) | Cedreo | ⏸ |
| 2.6 | Foundations shown (footings, strip) | Sims (raise foundation), Revit, Eberick | ⛔ foundations |
| 2.7 | Terrain / plot boundary / setbacks / slope | Chief, Archicad, Cedreo | ⏸ terrain (Q-100) |
| 2.8 | Plot (lote) outline + checks like "building inside setbacks" (recuos) | Archicad, Cedreo | Brazil-relevant; municipal rules vary |
| 2.9 | Balconies, porches, decks | Chief, Sims | |
| 2.10 | Fences, walls around the lot, gates | Sims, Chief | |
| 2.11 | Built-in cabinets / kitchen counters ("smart cabinets") | Chief, Coohom | ⏸ catalogue |
| 2.12 | Furniture catalogue + import 3D models (OBJ, glTF) | SH3D, Planner 5D, Homestyler, SketchUp Warehouse | ⏸ "Buy mode" |
| 2.13 | Bathroom fixtures (toilet, sink, shower) as objects | all interior apps | also needed by a plumbing module 🧩 |
| 2.14 | Plumbing points / pipes | Revit MEP, QiBuilder (AltoQi) | ⛔ MEP — but Q-142 says future module 🧩 |
| 2.15 | Ventilation / AC units | Revit MEP | ⛔ MEP / Q-142 🧩 |
| 2.16 | Electrical circuits, panel board, load table | QiBuilder, Revit | Electrical module next slices 🧩 |
| 2.17 | Solar panels on the roof | Chief, specialist apps | needs roofs 🧩 |
| 2.18 | Water tank (caixa d'água) as a placed load | Brazilian practice | ties to "new loads" check |

## 3. Views and 3D

| # | Feature | Seen in | Note |
|---|---|---|---|
| 3.1 | Walk-through ("visit") camera at eye height, WASD keys | SH3D ("virtual visit"), Chief, Planner 5D | |
| 3.2 | Saved camera views / points of view | SH3D 3.0, SketchUp scenes | |
| 3.3 | Section view (cut the building vertically) | SketchUp, Revit, Archicad, FreeCAD | very useful for the "what's above" story |
| 3.4 | Elevations (front / side drawings) generated from the model | Revit, Archicad, Chief, LayOut | standard in a Brazilian "projeto" |
| 3.5 | Real sun by date + city (latitude), shadow study animation | SH3D (sun management), SketchUp, Revit | our sun is approximate (ADR-057/060) |
| 3.6 | Photoreal render / 360° panorama / VR | Planner 5D, Homestyler, Coohom, SH3D (render) | ⛔ photoreal |
| 3.7 | Video / fly-through export | SH3D, Planner 5D, Chief | |
| 3.8 | Textures on floors and ceilings, wallpaper, custom texture import | SH3D, Sims, Planner 5D | we have wall face patterns + colours |
| 3.9 | Light fixtures that light the 3D scene | SH3D, Chief | Electrical lights could feed this 🧩 |
| 3.10 | Clickable 3D editing (move walls in 3D) | SH3D, SketchUp, Sims | our 3D is view + pick |
| 3.11 | X-ray / transparency mode | SketchUp, Chief | |
| 3.12 | Day/night and dark mode for 3D | Sims, Planner 5D | |
| 3.13 | Exterior view with the lot, sky, trees | Cedreo, Chief | ⏸ terrain |

## 4. Output: drawings, lists, files

| # | Feature | Seen in | Note |
|---|---|---|---|
| 4.1 | Sheet layout with title block (carimbo), several views per sheet | LayOut, Revit, Archicad, Chief | Brazilian prefeitura sheets need a carimbo |
| 4.2 | North arrow + scale bar on the exported sheet | LayOut, Archicad | north added to the plan (ADR-060), not the sheet yet |
| 4.3 | DXF / DWG export and import | SketchUp, Chief, Archicad, FreeCAD, SH3D (via plug-in) | ROADMAP Phase 6+ |
| 4.4 | IFC export / import (open BIM) | FreeCAD, Archicad, Revit | ROADMAP Phase 6+ |
| 4.5 | SVG export of the plan | SH3D | easy, we draw SVG already |
| 4.6 | OBJ / glTF export of the 3D model | SH3D (OBJ), SketchUp | |
| 4.7 | Door / window schedule (list with sizes, counts) | Revit, Archicad, Chief | |
| 4.8 | Room / area table (areas, perimeters, finishes per room) | Archicad, Revit, RoomSketcher | useful for "quadro de áreas" |
| 4.9 | Materials quantity list (blocks, mortar, paint m²) | Chief, magicplan | quantities ≠ cost; check GOALS wording |
| 4.10 | Cost estimate with a price list | Chief, magicplan | ⛔ cost estimation |
| 4.11 | Branded / client reports with photos | magicplan, Cedreo | |
| 4.12 | Print directly (with print preview) | SH3D, all | we export PDF |
| 4.13 | Share a read-only link / web viewer | Floorplanner, RoomSketcher, Planner 5D | needs hosting |

## 5. Structure (vs Brazilian structural software)

| # | Feature | Seen in | Note |
|---|---|---|---|
| 5.1 | Full structural masonry design (block layout per course, grout, reinforcement) | QiAlvenaria, Eberick | ⛔ we inform, never design |
| 5.2 | Reinforced concrete frame design (beams, columns, slabs) | Eberick | ⛔ RC design |
| 5.3 | Block modulation / course drawing (paginação) of each wall | QiAlvenaria | drawing-only helper, could be info 🧩 |
| 5.4 | Wind loads | Eberick | Phase 6+ |
| 5.5 | Structural model export to engineers' tools | Eberick ↔ QiAlvenaria, IFC | via IFC (4.4) |

## 6. Working with others, files, app

| # | Feature | Seen in | Note |
|---|---|---|---|
| 6.1 | Real-time multi-user editing / comments | Planner 5D, Floorplanner, RoomSketcher | ⛔ real-time collaboration |
| 6.2 | Cloud sync between devices | Planner 5D, magicplan | |
| 6.3 | Templates / sample house plans to start from | Planner 5D, RoomSketcher, Chief | we have examples; a gallery would be bigger |
| 6.4 | Plug-in system for third parties | SH3D (Java plug-ins), SketchUp Extension Warehouse, FreeCAD addons | ⏸ ADR-020/023 — we're on the way (ADR-059) |
| 6.5 | Import other formats (SH3D files, SketchUp) | various | |
| 6.6 | Many languages (SH3D: 29) | SH3D | we have pt-BR + en |
| 6.7 | Web version (runs in a browser) | SH3D JS, Planner 5D, Floorplanner | our app is Vue — doable later |
| 6.8 | Mobile / tablet apps | Planner 5D, magicplan, RoomSketcher | ⏸ mobile |
| 6.9 | Guided design wizard / AI layout suggestions | Planner 5D (Smart Wizard), Homestyler | |
| 6.10 | Undo history list (jump back several steps) | Archicad, SketchUp | |
| 6.11 | Accessibility checks (door widths, turning circles, NBR 9050) | specialist plug-ins | info-only rule pack candidate 🧩 |
| 6.12 | Municipal code checks (minimum room size, window area per floor area — ventilation/lighting) | not common; some Brazilian tools | very Brazil-useful; values vary by city 🧩 |

## Sources

- [Sweet Home 3D — features](https://www.sweethome3d.com/features/), [version history](https://www.sweethome3d.com/history/), [4.0 release notes](https://www.sweethome3d.com/blog/sweet-home-3d-4-0-release-notes/)
- [Planner 5D — AI house design](https://planner5d.com/use/ai-house-design), [Unite.AI review](https://www.unite.ai/planner-5d-review/)
- [Cedreo — Roomsketcher vs Floorplanner vs Cedreo](https://cedreo.com/blog/roomsketcher-vs-floorplanner-vs-cedreo/), [Cedreo roof software](https://cedreo.com/roof-design-software/)
- [Home Designer (Chief Architect) — products](https://www.homedesignersoftware.com/products/), [2025 comparison matrix](https://cloud-hd.chiefarchitect.com/1/pdf/product-info/2025/comparison-matrix.pdf), [Chief Architect features](https://chiefarchitect.com/products/features)
- [SketchUp — creating a plan in LayOut](https://sketchup.trimble.com/en/blog/article/creating-plan-your-sketchup-model-layout)
- [Archicad vs Revit 2026](https://www.myarchitectai.com/blog/revit-vs-archicad)
- [FreeCAD BIM Workbench](https://wiki.freecad.org/BIM_Workbench), [Arch IFC](https://wiki.freecad.org/Arch_IFC)
- [magicplan — App Store](https://apps.apple.com/app/magicplan/id427424432)
- [Coohom vs Homestyler](https://blog.designfiles.co/coohom-vs-homestyler/), [Homestyler pricing](https://www.homestyler.com/pricing/business)
- [Eberick — engenharia360](https://engenharia360.com/eberick-saiba-tudo-sobre-o-uso-do-software-na-engenharia/)
- [The Sims 4 build mode — wiki](https://www.thesimswiki.com/wiki/Build_mode_(The_Sims_4))
