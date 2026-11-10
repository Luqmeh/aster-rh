/**
 * Arithmétique décimale fixe (4 décimales) pour les soldes de congés.
 * Évite les erreurs de floating-point IEEE sur les calculs autoritatifs.
 */

export const LEAVE_QTY_SCALE = BigInt(10_000); // 4 décimales
const ZERO = BigInt(0);

export type ScaledQty = bigint;

export function toScaled(value: number | string): ScaledQty {
  const raw = String(value).trim();
  if (!raw || raw === "NaN") {
    throw new Error("Quantité invalide.");
  }
  const negative = raw.startsWith("-");
  const unsigned = negative ? raw.slice(1) : raw;
  const [intPartRaw, fracRaw = ""] = unsigned.split(".");
  const intPart = intPartRaw === "" ? "0" : intPartRaw;
  if (!/^\d+$/.test(intPart) || (fracRaw && !/^\d+$/.test(fracRaw))) {
    throw new Error(`Quantité invalide : ${value}`);
  }
  const frac = (fracRaw + "0000").slice(0, 4);
  const scaled = BigInt(intPart) * LEAVE_QTY_SCALE + BigInt(frac);
  return negative ? -scaled : scaled;
}

export function fromScaled(value: ScaledQty): number {
  const negative = value < ZERO;
  const abs = negative ? -value : value;
  const intPart = abs / LEAVE_QTY_SCALE;
  const frac = abs % LEAVE_QTY_SCALE;
  const asString = `${negative ? "-" : ""}${intPart}.${frac.toString().padStart(4, "0")}`;
  return Number(asString);
}

export function formatScaled(value: ScaledQty): string {
  const negative = value < ZERO;
  const abs = negative ? -value : value;
  const intPart = abs / LEAVE_QTY_SCALE;
  const frac = abs % LEAVE_QTY_SCALE;
  const fracStr = frac.toString().padStart(4, "0").replace(/0+$/, "");
  const body =
    fracStr.length === 0
      ? `${intPart}`
      : `${intPart}.${fracStr}`;
  return negative ? `-${body}` : body;
}

export function addScaled(a: ScaledQty, b: ScaledQty): ScaledQty {
  return a + b;
}

export function subScaled(a: ScaledQty, b: ScaledQty): ScaledQty {
  return a - b;
}

export function negScaled(a: ScaledQty): ScaledQty {
  return -a;
}

export function isZeroScaled(a: ScaledQty): boolean {
  return a === ZERO;
}

export function compareScaled(a: ScaledQty, b: ScaledQty): number {
  if (a === b) return 0;
  return a < b ? -1 : 1;
}

export function zeroScaled(): ScaledQty {
  return ZERO;
}
