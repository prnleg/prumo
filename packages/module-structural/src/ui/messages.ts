// Structural's own strings (ADR-059: a module brings its own words). Same keys in every locale (tested).
// Step 1 of moving Structural onto the module hooks: the chase and slab tools.
export const MESSAGES: Readonly<Record<string, Readonly<Record<string, string>>>> = {
  en: {
    "module.structural.name": "Structural checks",
    "tool.chase": "Chase",
    "tool.chase.tip": "Mark where a wall will be cut for pipes or wiring (a chase)",
    "chaseDir.label": "Chase direction",
    "chaseDir.horizontal": "Horizontal",
    "chaseDir.horizontal.tip": "A cut running along the wall (e.g. a pipe going sideways)",
    "chaseDir.vertical": "Vertical",
    "chaseDir.vertical.tip": "A cut running up and down (e.g. wiring to a switch)",
    "hint.chase.idle": "Click on a wall where the horizontal cut starts.",
    "hint.chase.active": "Click where the cut ends, on the same wall. Esc cancels.",
    "hint.chase.vertical": "Click on a wall where the vertical cut goes.",
    "tool.slab": "Slab",
    "tool.slab.tip": "Draw the slabs (lajes): cover rooms with a click, or draw any outline",
    "slabMode.label": "How to make the slab",
    "slabMode.rooms": "Cover rooms",
    "slabMode.rooms.tip": "Click the rooms the slab covers, then Enter",
    "slabMode.outline": "Draw outline",
    "slabMode.outline.tip": "Click each corner; click the first one again to close (balconies, overhangs)",
    "slab.create": "Create the slab ({count, plural, one {# room} other {# rooms}})",
    "hint.slab.rooms.idle": "Click the rooms this slab covers. Rooms that touch become one slab.",
    "hint.slab.rooms.active":
      "{count, plural, one {# room} other {# rooms}} picked. Click more, Enter to create, Esc to cancel.",
    "hint.slab.outline.idle":
      "Click the first corner of the slab. Corners snap to wall ends; hold Alt to place freely.",
    "hint.slab.outline.active":
      "Click the next corner. Click the first corner again, double-click or press Enter to close.",
  },
  "pt-BR": {
    "module.structural.name": "Verificações estruturais",
    "tool.chase": "Rasgo",
    "tool.chase.tip": "Marcar onde a parede vai ser cortada para canos ou fios (um rasgo)",
    "chaseDir.label": "Direção do rasgo",
    "chaseDir.horizontal": "Horizontal",
    "chaseDir.horizontal.tip": "Um corte que corre ao longo da parede (ex.: um cano indo para o lado)",
    "chaseDir.vertical": "Vertical",
    "chaseDir.vertical.tip": "Um corte de cima a baixo (ex.: fio descendo até um interruptor)",
    "hint.chase.idle": "Clique na parede onde o corte horizontal começa.",
    "hint.chase.active": "Clique onde o corte termina, na mesma parede. Esc cancela.",
    "hint.chase.vertical": "Clique na parede onde vai o corte vertical.",
    "tool.slab": "Laje",
    "tool.slab.tip": "Desenhar as lajes: cobrir cômodos com um clique, ou desenhar qualquer contorno",
    "slabMode.label": "Como fazer a laje",
    "slabMode.rooms": "Cobrir cômodos",
    "slabMode.rooms.tip": "Clique nos cômodos que a laje cobre e depois Enter",
    "slabMode.outline": "Desenhar contorno",
    "slabMode.outline.tip": "Clique em cada canto; clique no primeiro de novo para fechar (sacadas, beirais)",
    "slab.create": "Criar a laje ({count, plural, one {# cômodo} other {# cômodos}})",
    "hint.slab.rooms.idle": "Clique nos cômodos que esta laje cobre. Cômodos vizinhos viram uma laje só.",
    "hint.slab.rooms.active":
      "{count, plural, one {# cômodo escolhido} other {# cômodos escolhidos}}. Clique em mais, Enter para criar, Esc para cancelar.",
    "hint.slab.outline.idle":
      "Clique no primeiro canto da laje. Os cantos grudam nas pontas das paredes; mantenha Alt apertado para posicionar livre.",
    "hint.slab.outline.active":
      "Clique no próximo canto. Clique no primeiro de novo, dê dois cliques ou Enter para fechar.",
  },
};
