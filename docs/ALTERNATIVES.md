# ALTERNATIVES — does this already exist? Build vs extend

> Status: **not properly researched yet.** The list below comes from general knowledge (planning session, Nov 2026), and features/prices/status **must be verified** before ADR-010 is decided.

## Existing tools (to evaluate)

| Tool | Type | Cost | Relevant strength | Why it may not fit |
|---|---|---|---|---|
| Sweet Home 3D | Floor-plan / interior | Free, open source | Easy walls/doors/windows | No structural feedback |
| Planner 5D / Floorplanner-type web apps | Floor-plan | Freemium | Very easy UX | No structural feedback |
| SketchUp | General 3D modelling | Paid (free web tier?) | Fast modelling, plugins | Not structural; plugins exist but are pro-oriented |
| FreeCAD (BIM / FEM workbenches) | Open-source CAD/BIM | Free | Real BIM objects, Python scripting, has FEM | Steep learning curve; UX not aimed at instant feedback |
| Blender + Bonsai (formerly BlenderBIM) | Open-source IFC/BIM | Free | Native IFC, powerful | Complex; structural analysis not its focus |
| Revit / ArchiCAD | Professional BIM | Expensive | Industry standard | Expert tools, costly |
| Robot / SAP2000 / ETABS | Professional structural analysis | Expensive | Real analysis | Expert-only |
| Eberick / TQS (Brazil) | Professional structural design (concrete/masonry) | Paid | Brazilian codes | Expert-only, design-focused |
| Open-source solvers: PyNite, OpenSees, Frame3DD, CalculiX | Libraries | Free | Real solvers | No UI; need integration |
| That Open Company / web-ifc (JS) | Web BIM libraries | Free/open | IFC in the browser | Library, not an app |

## The honest question

Is the value **"an easy editor"** (exists), **"structural analysis"** (exists, for experts), or **"live, explained structural consequences of edits, for non-experts"** (looks rare — *unverified*)?

If it's the third, building our own editor is defensible, *but* we should:
- reuse libraries where possible (geometry, maybe IFC export later),
- maybe borrow a solver for Tier 2 instead of writing one,
- not try to compete on editor features with Sweet Home 3D / SketchUp.

## Spike C (Phase 0)

Spend ≤ 1 session trying the "plugin" route in one tool (FreeCAD via Python, *or* Bonsai). Question to answer: *"Can I add a panel that live-updates findings when a wall/opening changes?"* If yes and it feels okay, ADR-010 might flip.

## Action items

- [ ] Verify each row (current status, price, license).
- [ ] Search specifically for "structural feedback for non-experts" / educational structural sandboxes; there may be academic or educational tools.
- [ ] Record findings + date here.
