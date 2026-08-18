/**
 * Fuzzy match + durable map keys for CricHeroes ↔ app players.
 */

export function normalizePlayerName(name) {
  return String(name || "")
    .toLowerCase()
    .replace(/\s*\((?:c|wk|captain|wicket[\s-]?keeper)\)\s*/gi, " ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function mappingDocId({ cricheroesPlayerId, cricheroesName }) {
  if (cricheroesPlayerId) return `id_${cricheroesPlayerId}`;
  const n = normalizePlayerName(cricheroesName);
  if (!n) throw new Error("Cannot build mapping key without id or name");
  return `name_${n.replace(/\s+/g, "_")}`;
}

function levenshtein(a, b) {
  const s = a || "";
  const t = b || "";
  if (s === t) return 0;
  if (!s.length) return t.length;
  if (!t.length) return s.length;
  const row = Array.from({ length: t.length + 1 }, (_, i) => i);
  for (let i = 1; i <= s.length; i++) {
    let prev = i;
    for (let j = 1; j <= t.length; j++) {
      const cur =
        s[i - 1] === t[j - 1]
          ? row[j - 1]
          : 1 + Math.min(row[j - 1], prev, row[j]);
      row[j - 1] = prev;
      prev = cur;
    }
    row[t.length] = prev;
  }
  return row[t.length];
}

/** @returns {{ player: object, score: number, reason: string }[]} */
export function rankPlayerMatches(cricheroesName, players) {
  const needle = normalizePlayerName(cricheroesName);
  if (!needle) return [];

  return players
    .map((player) => {
      const hay = normalizePlayerName(player.name);
      if (!hay) return { player, score: 0, reason: "empty" };
      if (hay === needle) return { player, score: 1, reason: "exact" };
      if (hay.includes(needle) || needle.includes(hay)) {
        const score = Math.min(hay.length, needle.length) / Math.max(hay.length, needle.length);
        return { player, score: 0.75 + 0.2 * score, reason: "contains" };
      }
      const tokensN = new Set(needle.split(" ").filter(Boolean));
      const tokensH = new Set(hay.split(" ").filter(Boolean));
      let overlap = 0;
      tokensN.forEach((t) => {
        if (tokensH.has(t)) overlap += 1;
      });
      if (overlap > 0) {
        const score = overlap / Math.max(tokensN.size, tokensH.size);
        return { player, score: 0.45 + 0.4 * score, reason: "tokens" };
      }
      const dist = levenshtein(needle, hay);
      const maxLen = Math.max(needle.length, hay.length) || 1;
      const sim = 1 - dist / maxLen;
      return { player, score: Math.max(0, sim * 0.7), reason: "fuzzy" };
    })
    .filter((x) => x.score >= 0.35)
    .sort((a, b) => b.score - a.score || a.player.name.localeCompare(b.player.name));
}

export function bestFuzzyPlayer(cricheroesName, players) {
  const ranked = rankPlayerMatches(cricheroesName, players);
  return ranked[0] || null;
}

export function resolveStoredMapping(chPlayer, mapsByKey) {
  if (!chPlayer) return null;
  if (chPlayer.cricheroesPlayerId) {
    const byId = mapsByKey[`id_${chPlayer.cricheroesPlayerId}`];
    if (byId) return byId;
  }
  const n = normalizePlayerName(chPlayer.name);
  if (n) {
    const byName = mapsByKey[`name_${n.replace(/\s+/g, "_")}`];
    if (byName) return byName;
  }
  return null;
}
