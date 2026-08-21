export const inr = (n) => `₹${Math.round(n).toLocaleString("en-IN")}`;
export const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—";

export function computeTournamentStats(t) {
  const numMatches = t.matches ? t.matches.length : 0;
  const costPerMatch = numMatches > 0 ? Math.round(t.totalFee / numMatches) : 0;
  const perMatch = (t.matches || []).map((m) => {
    const n = m.participantIds.length;
    const additionalAmount = Number(m.additionalAmount) || 0;
    const matchCost = costPerMatch + additionalAmount;
    const perPlayer = n > 0 ? Math.round(matchCost / n) : 0;
    return { ...m, cost: matchCost, baseCost: costPerMatch, additionalAmount, perPlayer, participantCount: n };
  });
  const paidTotal = (t.payments || []).reduce((s, p) => s + p.amount, 0);
  const playerStats = {};
  perMatch.forEach((m) => {
    m.participantIds.forEach((pid) => {
      if (!playerStats[pid]) playerStats[pid] = { owed: 0, paid: 0, matches: [] };
      playerStats[pid].owed += m.perPlayer;
      playerStats[pid].matches.push(m);
    });
  });
  (t.payments || []).forEach((p) => {
    if (!playerStats[p.playerId]) playerStats[p.playerId] = { owed: 0, paid: 0, matches: [] };
    playerStats[p.playerId].paid += p.amount;
  });
  const balances = Object.entries(playerStats).map(([playerId, s]) => ({
    playerId, owed: s.owed, paid: s.paid, balance: s.owed - s.paid, matches: s.matches,
  }));
  return { numMatches, costPerMatch, perMatch, paidTotal, playerStats, balances };
}

export function publicBoardUrl() {
  const base = `${window.location.origin}${process.env.PUBLIC_URL || ""}`;
  return `${base}/#/board`;
}
