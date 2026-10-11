// Two item names mean the same item regardless of case and spacing:
// "Minced  beef" and "minced beef" are one thing.
//
// Deliberately exact beyond that. Anything looser (edit distance, plurals)
// turns "peas" into "pears", and every caller here acts on a match: warning
// about a duplicate, or deciding that something has run out.
export const sameName = (s) => (s || '').trim().toLowerCase().replace(/\s+/g, ' ');
