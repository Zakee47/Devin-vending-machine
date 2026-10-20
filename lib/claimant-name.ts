export const MAX_CLAIMANT_NAME = 120;

// Control, format and bidi-override characters that could hide or reorder
// text in the organizer's list and CSV export.
const INVISIBLE =
  /[\u0000-\u001f\u007f-\u009f\u00ad\u200b-\u200f\u2028-\u202e\u2060-\u206f\ufeff]/g;

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
