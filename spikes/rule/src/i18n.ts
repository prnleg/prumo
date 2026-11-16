// Spike B — tiny i18n (ADR-021 proposed: keys + params, never concatenated sentences).
// Not a library choice: shows what we need from one (plural on a named param, typed params).

export type Locale = "en" | "pt-BR";
export const LOCALES: Locale[] = ["en", "pt-BR"];

/** A message: plain text with {param} slots, or a plural choice on one param. */
export type Msg = string | { plural: string; one: Msg; other: Msg };
export type Catalogue = Record<string, Msg>;

export function format(msg: Msg, locale: Locale, params: Record<string, string | number>): string {
  if (typeof msg !== "string") {
    const n = Number(params[msg.plural]);
    const cat = new Intl.PluralRules(locale).select(n);
    return format(cat === "one" ? msg.one : msg.other, locale, params);
  }
  return msg.replace(/\{(\w+)\}/g, (_, k: string) => {
    if (!(k in params)) throw new Error(`missing param {${k}}`);
    return String(params[k]);
  });
}

/** mm → "1.20 m" / "1,20 m". */
export const formatLength = (mm: number, locale: Locale) =>
  `${new Intl.NumberFormat(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(mm / 1000)} m`;

/** Every {slot} name in a message, including inside plural branches (for catalogue parity tests). */
export function slots(msg: Msg): string[] {
  if (typeof msg !== "string") return [...new Set([msg.plural, ...slots(msg.one), ...slots(msg.other)])].sort();
  return [...new Set([...msg.matchAll(/\{(\w+)\}/g)].map((m) => m[1]!))].sort();
}

/** Every leaf string (for the banned-words scan). */
export const leaves = (msg: Msg): string[] => (typeof msg === "string" ? [msg] : [...leaves(msg.one), ...leaves(msg.other)]);

const en: Catalogue = {
  // elements (labels are generated, never stored)
  "elem.wall": "wall {n}",
  "elem.window": "window {n}",
  "elem.door": "door {n}",
  "profile.br-nbr.structural-masonry": "Brazil – structural masonry ({version})",

  // the rule
  "rule.R-OPEN-001.name": "Opening in a load-bearing wall without a lintel",
  "rule.R-OPEN-001.message":
    "Possible issue: {opening} ({width} wide) is in {wall}, which this check treats as load-bearing, and no lintel is drawn over it. " +
    "A lintel is a small beam over an opening that carries the wall above it. " +
    "If this wall really is load-bearing, ask an engineer about a lintel for this opening.",

  // assumptions
  "as.roleMarked": "You marked {wall} as load-bearing.",
  "as.roleDefault": "Nobody marked whether {wall} is load-bearing, and the profile {profile} treats unmarked walls as load-bearing.",

  // what the rule does not consider
  "nc.lintelSize": "Whether a drawn lintel is long or strong enough (a separate check, not built yet).",
  "nc.bondBeam": "Whether a concrete band along the wall just above the opening (a bond beam) can replace the lintel.",
  "nc.sill": "Whether a window also needs reinforcement below it (sill reinforcement).",
  "nc.loads": "How much weight the wall actually carries.",

  // terms (tooltips; UX rule 20)
  "term.bearing": "Load-bearing wall: a wall that holds up the floor or roof above it.",
  "term.lintel": "Lintel: a small beam over a door or window opening.",

  // card chrome
  "sev.critical": "Critical",
  "sev.warning": "Warning",
  "sev.advisory": "Advice",
  "sev.info": "Note",
  "conf.rule-of-thumb": "Rule of thumb: a quick check, no calculation.",
  "conf.simplified-calc": "Simplified calculation.",
  "conf.analysis": "Structural analysis (still simplified).",
  "src.unverified": "UNVERIFIED: no source recorded yet, and not reviewed by an engineer.",
  "src.unreviewed": "Source: {source}. Not reviewed by an engineer yet (UNVERIFIED).",
  "src.reviewed": "Source: {source}. Reviewed by {by} on {date}.",
  "card.why": "What we noticed",
  "card.elements": "Elements",
  "card.assumptions": "Assumptions used",
  "card.confidence": "How this was checked",
  "card.source": "Source",
  "card.notConsidered": "What this check does not consider",
  "card.terms": "Terms",
  "badge.unverified": "UNVERIFIED",

  // summaries
  "summary.none": {
    plural: "n",
    one: "No issues detected by the {n} check implemented. It is simplified and doesn't cover {list}. It doesn't replace a structural engineer.",
    other: "No issues detected by the {n} checks implemented. These checks are simplified and don't cover {list}. They don't replace a structural engineer.",
  },
  "summary.some": {
    plural: "k",
    one: { plural: "n", one: "{k} possible issue found by the {n} check implemented.", other: "{k} possible issue found by the {n} checks implemented." },
    other: { plural: "n", one: "{k} possible issues found by the {n} check implemented.", other: "{k} possible issues found by the {n} checks implemented." },
  },
  "summary.notCovered": "lintel sizes, actual loads, foundations or soil, and wind or other sideways forces",
  footer: "Learning tool, not engineering advice.",
};

const ptBR: Catalogue = {
  "elem.wall": "parede {n}",
  "elem.window": "janela {n}",
  "elem.door": "porta {n}",
  "profile.br-nbr.structural-masonry": "Brasil – alvenaria estrutural ({version})",

  "rule.R-OPEN-001.name": "Abertura em parede portante sem verga",
  // ⚠ "a {opening}" / "na {wall}" only agree because parede, janela and porta are all feminine.
  // A masculine opening kind ("portão") would need a per-kind key or an ICU `select`.
  "rule.R-OPEN-001.message":
    "Possível problema: a {opening} ({width} de largura) está na {wall}, que esta verificação trata como portante, e não há verga desenhada sobre ela. " +
    "A verga é uma pequena viga sobre a abertura que sustenta a parede acima dela. " +
    "Se esta parede for mesmo portante, consulte um engenheiro sobre a verga desta abertura.",

  "as.roleMarked": "Você marcou a {wall} como portante.",
  "as.roleDefault": "Ninguém marcou se a {wall} é portante, e o perfil {profile} trata paredes sem marcação como portantes.",

  "nc.lintelSize": "Se uma verga desenhada é longa ou resistente o bastante (outra verificação, ainda não feita).",
  "nc.bondBeam": "Se uma faixa de concreto ao longo da parede logo acima da abertura (cinta) pode substituir a verga.",
  "nc.sill": "Se uma janela também precisa de reforço embaixo (contraverga).",
  "nc.loads": "Quanto peso a parede realmente sustenta.",

  "term.bearing": "Parede portante: parede que sustenta o piso ou o telhado acima dela.",
  "term.lintel": "Verga: pequena viga sobre o vão de uma porta ou janela.",

  "sev.critical": "Crítico",
  "sev.warning": "Atenção",
  "sev.advisory": "Sugestão",
  "sev.info": "Nota",
  "conf.rule-of-thumb": "Regra prática: verificação rápida, sem cálculo.",
  "conf.simplified-calc": "Cálculo simplificado.",
  "conf.analysis": "Análise estrutural (ainda simplificada).",
  "src.unverified": "NÃO VERIFICADA: ainda sem fonte registrada e sem revisão de um engenheiro.",
  "src.unreviewed": "Fonte: {source}. Ainda sem revisão de um engenheiro (NÃO VERIFICADA).",
  "src.reviewed": "Fonte: {source}. Revisada por {by} em {date}.",
  "card.why": "O que percebemos",
  "card.elements": "Elementos",
  "card.assumptions": "Suposições usadas",
  "card.confidence": "Como foi verificado",
  "card.source": "Fonte",
  "card.notConsidered": "O que esta verificação não considera",
  "card.terms": "Termos",
  "badge.unverified": "NÃO VERIFICADA",

  "summary.none": {
    plural: "n",
    one: "Nenhum problema detectado pela {n} verificação implementada. Ela é simplificada e não cobre {list}. Não substitui um engenheiro estrutural.",
    other: "Nenhum problema detectado pelas {n} verificações implementadas. Essas verificações são simplificadas e não cobrem {list}. Não substituem um engenheiro estrutural.",
  },
  "summary.some": {
    plural: "k",
    one: { plural: "n", one: "{k} possível problema encontrado pela {n} verificação implementada.", other: "{k} possível problema encontrado pelas {n} verificações implementadas." },
    other: { plural: "n", one: "{k} possíveis problemas encontrados pela {n} verificação implementada.", other: "{k} possíveis problemas encontrados pelas {n} verificações implementadas." },
  },
  "summary.notCovered": "tamanho de vergas, cargas reais, fundações ou solo, e vento ou outras forças laterais",
  footer: "Ferramenta de aprendizado, não é orientação de engenharia.",
};

export const CATALOGUES: Record<Locale, Catalogue> = { en, "pt-BR": ptBR };

export function t(locale: Locale, key: string, params: Record<string, string | number> = {}): string {
  const msg = CATALOGUES[locale][key];
  if (msg === undefined) throw new Error(`missing i18n key ${key} (${locale})`);
  return format(msg, locale, params);
}
