// A normalized key for a bank/card transaction description, used to remember
// how you categorize/rename recurring transactions. Strips digits and
// punctuation and keeps the first few words, so "TRANSFER TO CR. CARD MB 0291"
// and "TRANSFER TO CR. CARD PC 5510" collapse to the same key "TRANSFER TO CR CARD".
export function ruleKey(desc: string): string {
  return (desc || '')
    .toUpperCase()
    .replace(/[^A-Z ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean)
    .slice(0, 4)
    .join(' ');
}
