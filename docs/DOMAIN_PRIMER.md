# DOMAIN PRIMER — Structural basics for a non-expert

Purpose: give the owner (and the AI) a shared vocabulary. Simplified on purpose. **Not engineering guidance.**
Values marked *(typical, verify)* are illustrative orders of magnitude, not design values.

---

## 1. What a structure does

A building's structure carries **loads** safely down to the **ground**. The route the forces take is the **load path**:

```
roof / floor slab  →  beams or bearing walls  →  columns / walls below  →  foundations  →  soil
```

Most structural "flaws" are a **broken or overloaded load path**: something is pushing down and nothing adequate is underneath it.

## 2. Loads

- **Dead load (permanent):** weight of the structure and finishes (concrete, blocks, plaster, floor tiles). Computed from volume × density.
- **Live load (imposed / variable):** people, furniture. Codes specify it per area, e.g. residential floors *(typical, verify: ~1.5–2.0 kN/m²)*.
- **Wind:** horizontal push/suction. Depends on location, height, terrain.
- **Seismic (earthquake):** horizontal shaking. Very region-dependent (much of Brazil is low-seismicity; Chile, Japan, and California are high).
- **Others:** snow, water tanks (common on Brazilian roofs and *heavy*), soil pressure, temperature.

**Load combinations:** codes multiply loads by safety factors and combine them (e.g. 1.4 × dead + 1.4 × live in some code formats, *verify*). We must decide whether we show **characteristic** (real expected) values or **design** (factored) values. Mixing them is a classic error (R-04).

## 3. Gravity vs lateral

- **Gravity** loads go down → walls/columns in **compression**, beams/slabs in **bending**.
- **Lateral** loads (wind/earthquake) push sideways → the building needs **bracing**: solid walls ("shear walls"), diagonal braces, or rigid frames. **Openings reduce bracing.** Too many large windows along one side can leave that direction weak, even when gravity is fine.

## 4. Element types

| Element | Job | Typical failure |
|---|---|---|
| **Slab** (floor/roof plate) | Spans between supports, carries area loads | Excess bending/deflection, punching near columns |
| **Beam** | Spans horizontally, carries line loads | Bending, shear, deflection |
| **Column** | Vertical, carries point loads down | Crushing, **buckling** (slender columns) |
| **Load-bearing wall** | Vertical, carries line loads down and often bracing too | Crushing, buckling, cracking around openings |
| **Non-load-bearing (partition/infill) wall** | Separates space; carries only itself | Cracking if the structure deflects onto it |
| **Lintel** (*verga* in Portuguese) | Small beam over an opening | Bending/deflection, insufficient bearing at the ends |
| **Sill reinforcement** (*contraverga*) | Under windows in masonry, against cracking at corners | Diagonal cracks from opening corners |
| **Foundation** | Spreads load into soil | Settlement (out of scope) |

## 5. The big fork: what system is the building?

### (a) Reinforced-concrete frame + infill masonry
Columns + beams + slabs carry everything. The brick/block walls in between are mostly **infill** (non-bearing).
→ Openings in infill walls are usually *structurally* minor (still need lintels for the masonry above the opening itself).
→ Removing a **column** or cutting a **beam** is serious.
⚠️ Exception: infill walls sometimes end up working as bracing in practice, and removing many can change behaviour. That's beyond a simple tool.

### (b) Structural (load-bearing) masonry
The walls **are** the structure. Floors sit directly on them.
→ **Every opening matters**: it cuts the wall that carries the floor, concentrates stress in the "piers" (the strips of wall between openings), and reduces bracing.
→ Removing a wall can remove support for the slab above.
→ Rules about minimum pier widths, opening distance from wall intersections, lintel bearing lengths, and wall alignment between storeys are central.

### (c) Light timber / light steel frame
Many small vertical **studs**. Openings need a **header** (lintel) plus **jack studs** (support the header) and **king studs** (full height beside the opening).
→ Different rules entirely.

**This is why ADR-004 matters so much.** The same edit ("add a 2 m window here") means three different things.

## 6. What changes in a wall when you add an opening

1. The load that used to go straight down through that part of the wall must **flow around** the opening → it concentrates in the **piers** on each side.
2. Something must span over the opening → a **lintel** (or an arch). It needs to rest on the wall on both sides (**bearing length**).
3. **Corners of openings concentrate stress** → typical diagonal cracks (hence sill/head reinforcement in masonry).
4. The wall's **bracing capacity** in its own direction goes down.
5. If an opening is too close to a **wall intersection or wall end**, the piece left over is too small to do anything.

## 7. Materials (what properties matter)

| Property | Meaning | Unit |
|---|---|---|
| Density / unit weight | How heavy (self-weight) | kN/m³ |
| Compressive strength | How much squeeze before crushing | MPa |
| Tensile strength | How much pull. **Masonry and plain concrete are very weak in tension**, which is why steel reinforcement exists | MPa |
| Modulus of elasticity (E) | Stiffness: how much it deforms under stress | MPa / GPa |
| (Timber) direction | Much stronger along the grain | — |

Typical orders of magnitude *(typical, verify; ranges are wide)*:
- Reinforced concrete: ~25 kN/m³; compressive strength 20–40 MPa (residential).
- Ceramic hollow block masonry: ~12–14 kN/m³ (wall incl. mortar, varies a lot).
- Concrete block masonry: ~14–20 kN/m³ (hollow/grouted varies).
- Softwood timber: ~4–6 kN/m³.
- Steel: ~78.5 kN/m³; E ≈ 200 GPa.

⚠️ "Masonry strength" depends on block strength **and** mortar **and** workmanship. A block rated at X MPa does **not** give a wall of X MPa.

## 8. Simple formulas we'll likely use in Tier 1 (for reference)

- Uniformly loaded simply supported beam (lintel), span L, load w per metre:
  - max bending moment `M = w·L²/8`
  - max shear `V = w·L/2`
  - max deflection `δ = 5·w·L⁴ / (384·E·I)`
- Compressive stress in a wall: `σ = N / A` (force per metre of wall ÷ wall thickness × 1 m).
- Slenderness: effective height ÷ effective thickness (codes limit this; value depends on the code/system).
- Tributary area: each support carries the slab area that's "closer" to it (half-span rule for one-way slabs).

## 9. Things this tool will likely never handle properly (be honest about it)

Foundations and soil, connections/details, cracking and long-term deformation (creep, shrinkage), construction sequence, fire, durability, dynamic/seismic analysis, workmanship quality.

## 10. Where to learn more (to be filled with verified references)

- A standard introductory structures textbook (TBD: owner + AI to pick one and record exact edition).
- The structural masonry / concrete code of the chosen country (ADR-009).
- *(Add verified links here, with the date checked.)*
