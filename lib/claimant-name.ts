export const MAX_CLAIMANT_NAME = 120;

// Every control (Cc) and format (Cf) character, which covers bidi marks and
// overrides, zero-width characters and soft hyphens that could hide or reorder
// text in the organizer's list and CSV export; plus the line separators.
const INVISIBLE = /[\p{Cc}\p{Cf}\u2028\u2029]/gu;

// Removes invisible characters and collapses whitespace runs without trimming,
// so it can run on every keystroke of a controlled input.
export function flattenClaimantName(raw: string): string {
  return raw.replace(INVISIBLE, " ").replace(/\s+/g, " ");
}

// One printable line, trimmed and capped; undefined when nothing is left.
export function cleanClaimantName(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  return (
    flattenClaimantName(raw).trim().slice(0, MAX_CLAIMANT_NAME).trim() ||
    undefined
  );
}
