// Search for the command palette. Pure functions, so they can be unit-tested.
//
// A command is { id, label, keywords?, ... }. Every word the person types must
// appear in the label or in the command's keywords (any order, any case).

function words(query) {
  return String(query ?? "")
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);
}

function scoreCommand(command, tokens) {
  const label = command.label.toLowerCase();
  const keywords = String(command.keywords ?? "").toLowerCase();
  let score = 0;

  for (const token of tokens) {
    const inLabel = label.indexOf(token);
    if (inLabel === 0) score += 100;
    else if (inLabel > 0 && /\s/.test(label[inLabel - 1])) score += 60;
    else if (inLabel > 0) score += 25;
    else if (keywords.includes(token)) score += 8;
    else return null; // every word has to match something
  }
  return score;
}

// Returns the matching commands, best first. An empty query returns them all
// in their original order.
export function filterCommands(commands, query) {
  const tokens = words(query);
  if (tokens.length === 0) return [...commands];

  return commands
    .map((command, index) => ({ command, index, score: scoreCommand(command, tokens) }))
    .filter((entry) => entry.score !== null)
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map((entry) => entry.command);
}

// Splits a label into [{ text, match }] pieces so the matched words can be
// highlighted without ever putting text into HTML.
export function highlightParts(label, query) {
  const tokens = words(query);
  const lower = label.toLowerCase();
  const marked = new Array(label.length).fill(false);

  for (const token of tokens) {
    let from = 0;
    for (;;) {
      const at = lower.indexOf(token, from);
      if (at === -1) break;
      for (let index = at; index < at + token.length; index++) marked[index] = true;
      from = at + token.length;
    }
  }

  const parts = [];
  for (let index = 0; index < label.length; index++) {
    const last = parts[parts.length - 1];
    if (last && last.match === marked[index]) last.text += label[index];
    else parts.push({ text: label[index], match: marked[index] });
  }
  return parts;
}
