// ADR-006: float64 mm + explicit tolerance. Never compare lengths with === (CLAUDE.md rule 10).

/** Default length tolerance, mm. ADR-006 value; geometry may use tighter local epsilons with a comment. */
export const EPS = 0.01;

export const nearlyEqual = (a: number, b: number, eps = EPS) => Math.abs(a - b) <= eps;
