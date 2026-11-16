// UI strings (ADR-021/034). ICU MessageFormat. Every key exists in every locale (tested).
export type Locale = "en" | "pt-BR";
export const LOCALES: Locale[] = ["en", "pt-BR"];

export const en = {
  "app.name": "Prumo",
  "project.untitled": "Untitled project",
  "module.architect.name": "Architect",

  "tool.select": "Select",
  "tool.wall": "Wall",
  "tool.wall.tip": "Draw walls (W)",
  "tool.select.tip": "Select (V)",
  "tool.door": "Door",
  "tool.door.tip": "Place doors (D)",
  "tool.window": "Window",
  "tool.window.tip": "Place windows (J)",

  "action.undo": "Undo",
  "action.redo": "Redo",
  "action.undo.tip": "Undo: {label}",
  "action.redo.tip": "Redo: {label}",
  "action.nothing": "nothing to undo",
  "action.fit": "Fit to screen",

  "cmd.addWall": "add wall",
  "cmd.addDoor": "add door",
  "cmd.addWindow": "add window",
  "cmd.addOpening": "add door or window",
  "cmd.move": "move",
  "cmd.delete": "{count, plural, one {delete # item} other {delete # items}}",
  "cmd.deleteWithHosted":
    "{count, plural, one {delete # item} other {delete # items}} and {hosted, plural, one {# door or window on it} other {# doors or windows on them}}",
  "cmd.removeModuleData": "remove {module} data",

  "hint.wall.idle": "Click to start a wall.",
  "hint.wall.active": "Click to place the end. Click the first point to close a room. Esc or double-click to stop.",
  "hint.opening":
    "Move over a wall and click to place a {kind, select, door {door} other {window}}. It snaps to the middle, the ends, and next to other openings. Hold Alt to place freely.",
  "hint.opening.tooShort": "This wall is too short for this {kind, select, door {door} other {window}}.",
  "hint.select": "Selecting comes in a later version. Press W to draw walls.",
  "hint.pan": "Scroll or middle-drag to move around · pinch or Ctrl+wheel to zoom",

  "status.snap": "Grid {grid} · {angle}° steps · hold Alt to place freely",
  "status.walls": "{count, plural, one {# wall} other {# walls}}",

  "problem.opening-outside-wall": "A door or window wouldn't fit in this wall anymore.",
  "problem.opening-above-wall": "A door or window would be taller than this wall.",
  "problem.openings-overlap": "Two doors or windows would overlap.",
  "problem.wall-too-short": "That wall is too short.",
  "problem.non-positive-size": "Sizes must be bigger than zero.",
  "problem.host-missing": "A door or window lost its wall.",
  "problem.host-not-wall": "Doors and windows can only go in walls.",
  "problem.host-other-level": "A door or window would be on a different floor than its wall.",
  "problem.level-missing": "That floor doesn't exist.",

  footer: "Learning tool, not engineering advice.",
} as const;

export type MessageKey = keyof typeof en;

export const ptBR: Record<MessageKey, string> = {
  "app.name": "Prumo",
  "project.untitled": "Projeto sem nome",
  "module.architect.name": "Arquitetura",

  "tool.select": "Selecionar",
  "tool.wall": "Parede",
  "tool.wall.tip": "Desenhar paredes (W)",
  "tool.select.tip": "Selecionar (V)",
  "tool.door": "Porta",
  "tool.door.tip": "Colocar portas (D)",
  "tool.window": "Janela",
  "tool.window.tip": "Colocar janelas (J)",

  "action.undo": "Desfazer",
  "action.redo": "Refazer",
  "action.undo.tip": "Desfazer: {label}",
  "action.redo.tip": "Refazer: {label}",
  "action.nothing": "nada para desfazer",
  "action.fit": "Ajustar à tela",

  "cmd.addWall": "adicionar parede",
  "cmd.addDoor": "adicionar porta",
  "cmd.addWindow": "adicionar janela",
  "cmd.addOpening": "adicionar porta ou janela",
  "cmd.move": "mover",
  "cmd.delete": "{count, plural, one {apagar # item} other {apagar # itens}}",
  "cmd.deleteWithHosted":
    "{count, plural, one {apagar # item} other {apagar # itens}} e {hosted, plural, one {# porta ou janela nele} other {# portas ou janelas neles}}",
  "cmd.removeModuleData": "remover dados de {module}",

  "hint.wall.idle": "Clique para começar uma parede.",
  "hint.wall.active":
    "Clique para marcar o fim. Clique no primeiro ponto para fechar um cômodo. Esc ou clique duplo para parar.",
  "hint.opening":
    "Passe sobre uma parede e clique para colocar uma {kind, select, door {porta} other {janela}}. Ela se encaixa no meio, nas pontas e ao lado de outras aberturas. Mantenha Alt apertado para posicionar livremente.",
  "hint.opening.tooShort": "Esta parede é curta demais para esta {kind, select, door {porta} other {janela}}.",
  "hint.select": "A seleção chega numa próxima versão. Aperte W para desenhar paredes.",
  "hint.pan": "Role ou arraste com o botão do meio para mover · pinça ou Ctrl+roda para zoom",

  "status.snap": "Grade {grid} · passos de {angle}° · mantenha Alt apertado para posicionar livremente",
  "status.walls": "{count, plural, one {# parede} other {# paredes}}",

  "problem.opening-outside-wall": "Uma porta ou janela não caberia mais nesta parede.",
  "problem.opening-above-wall": "Uma porta ou janela ficaria mais alta que esta parede.",
  "problem.openings-overlap": "Duas portas ou janelas ficariam uma sobre a outra.",
  "problem.wall-too-short": "Essa parede é curta demais.",
  "problem.non-positive-size": "As medidas precisam ser maiores que zero.",
  "problem.host-missing": "Uma porta ou janela ficou sem parede.",
  "problem.host-not-wall": "Portas e janelas só podem ficar em paredes.",
  "problem.host-other-level": "Uma porta ou janela ficaria num andar diferente da sua parede.",
  "problem.level-missing": "Esse andar não existe.",

  footer: "Ferramenta de aprendizado, não é orientação de engenharia.",
};

export const CATALOGUES: Record<Locale, Record<MessageKey, string>> = { en, "pt-BR": ptBR };
