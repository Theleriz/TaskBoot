// Cloze syntax, as in Anki: {{c1::answer}} or {{c1::answer::hint}}.
// Gaps with the same number are hidden together; each number is a separate review item.
// The answer ends at the first "}}": write "x^{2} }}" (with a space) for TeX that ends in braces.

export const CLOZE_RE = /\{\{c(\d{1,3})::([\s\S]*?)(?:::([\s\S]*?))?\}\}/g;

/** Gap numbers used in the text, ascending, as strings ("1", "2", …). */
export function clozeNumbers(text: string): string[] {
  const numbers = new Set<number>();
  for (const m of text.matchAll(CLOZE_RE)) {
    const n = Number(m[1]);
    if (n > 0) numbers.add(n);
  }
  return [...numbers].sort((a, b) => a - b).map(String);
}

/** The next free gap number, for the "add a gap" button. */
export function nextClozeNumber(text: string): number {
  const used = clozeNumbers(text).map(Number);
  return used.length ? Math.max(...used) + 1 : 1;
}
