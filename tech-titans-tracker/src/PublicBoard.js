import React, { useEffect, useMemo, useState } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { Search, Users, ChevronDown } from "lucide-react";
import { db } from "./firebase";
import { computeTournamentStats, fmtDate, inr } from "./settlementMath";

function FontLoader() {
  return (
    <style>{`
    @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Inter:wght@400;500;600;700;800&family=IBM+Plex+Mono:wght@500;600&display=swap');
    :root {
      --pitch-cream: #F4F5F7;
      --pitch-ink: #090C10;
      --pitch-green: #F59E0B;
      --pitch-green-deep: #1F2937;
      --stump-gold: #FCD34D;
      --ball-red: #EF4444;
      --line-soft: #E1E4E8;
      --card: #FFFFFF;
    }
    .ogc-root { font-family: 'Inter', sans-serif; background: var(--pitch-cream); color: var(--pitch-ink); }
    .ogc-display { font-family: 'Bebas Neue', 'Inter', sans-serif; letter-spacing: 0.03em; }
    .ogc-mono { font-family: 'IBM Plex Mono', monospace; }
    .ogc-scrollbar::-webkit-scrollbar { width: 6px; height: 6px; }
    .ogc-scrollbar::-webkit-scrollbar-thumb { background: var(--line-soft); border-radius: 3px; }
    input { font-family: inherit; }
    @keyframes tt-ball-spin {
      from { transform: rotate(0deg) translateY(0); }
      50% { transform: rotate(180deg) translateY(-6px); }
      to { transform: rotate(360deg) translateY(0); }
    }
    @keyframes tt-pitch-pan {
      0%, 100% { background-position: 50% 40%; }
      50% { background-position: 52% 48%; }
    }
    .tt-ball-spin { animation: tt-ball-spin 2.8s ease-in-out infinite; }
    .tt-header-pitch {
      background-size: cover;
      background-position: 50% 42%;
      animation: tt-pitch-pan 12s ease-in-out infinite;
    }
    `}</style>
  );
}

const STATUS_META = [
  { id: "Ongoing", title: "In progress", hint: "Matches underway" },
  { id: "Upcoming", title: "Upcoming", hint: "Not started yet" },
  { id: "Completed", title: "Completed", hint: "Finished" },
];

function paymentStatus(balance) {
  const bal = Math.round(balance);
  if (bal > 0) return { kind: "due", label: "Due", amount: bal };
  if (bal < 0) return { kind: "refund", label: "Refund", amount: -bal };
  return { kind: "settled", label: "Settled", amount: 0 };
}

function playerMatchesStatusFilter(p, statusFilter) {
  if (statusFilter === "all") return true;
  const kinds = new Set(p.tournaments.map((t) => paymentStatus(t.balance).kind));
  if (statusFilter === "due") return kinds.has("due");
  if (statusFilter === "refund") return kinds.has("refund");
  if (statusFilter === "settled") return p.tournaments.length > 0 && [...kinds].every((k) => k === "settled");
  return true;
}

function StatusPill({ balance }) {
  const s = paymentStatus(balance);
  const styles = {
    due: { background: "#F6E1DE", color: "#B91C1C" },
    refund: { background: "#FBF0D6", color: "#7A5A0F" },
    settled: { background: "#DCFCE7", color: "#166534" },
  };
  const text = s.kind === "settled" ? "Settled" : `${s.label} ${inr(s.amount)}`;
  return (
    <span style={{ ...styles[s.kind], fontSize: 12, fontWeight: 800, padding: "4px 10px", borderRadius: 999, whiteSpace: "nowrap" }}>
      {text}
    </span>
  );
}

export default function PublicBoard() {
  const [directory, setDirectory] = useState([]);
  const [tournaments, setTournaments] = useState([]);
  const [matches, setMatches] = useState([]);
  const [payments, setPayments] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [openIds, setOpenIds] = useState({});

  useEffect(() => {
    const unsubs = [];
    const fail = (err) => {
      setError("Could not load the public board. Ask an admin to deploy Firestore rules.");
      setLoading(false);
      console.error(err);
    };
    try {
      unsubs.push(onSnapshot(collection(db, "playerDirectory"), (snap) => {
        setDirectory(snap.docs.map((d) => ({ ...d.data(), id: d.id })));
      }, fail));
      unsubs.push(onSnapshot(collection(db, "tournaments"), (snap) => {
        setTournaments(snap.docs.map((d) => ({ ...d.data(), id: d.id })));
      }, fail));
      unsubs.push(onSnapshot(collection(db, "matches"), (snap) => {
        setMatches(snap.docs.map((d) => ({ ...d.data(), id: d.id })));
      }, fail));
      unsubs.push(onSnapshot(collection(db, "payments"), (snap) => {
        setPayments(snap.docs.map((d) => ({ ...d.data(), id: d.id })));
        setLoading(false);
        setError("");
      }, fail));
    } catch (err) {
      fail(err);
    }
    return () => unsubs.forEach((u) => u && u());
  }, []);

  const namesById = useMemo(
    () => Object.fromEntries(directory.map((p) => [p.id, p.name])),
    [directory]
  );

  const tournamentsWithData = useMemo(
    () =>
      tournaments
        .filter((t) => !t.archived)
        .map((t) => ({
          ...t,
          matches: matches.filter((m) => m.tournamentId === t.id),
          payments: payments.filter((p) => p.tournamentId === t.id),
        })),
    [tournaments, matches, payments]
  );

  const playerRows = useMemo(() => {
    const byPlayer = {};
    directory.forEach((p) => {
      byPlayer[p.id] = { id: p.id, name: p.name, tournaments: [], netOwed: 0, netPaid: 0 };
    });
    tournamentsWithData.forEach((t) => {
      const stats = computeTournamentStats(t);
      stats.balances.forEach((b) => {
        if (!byPlayer[b.playerId]) {
          byPlayer[b.playerId] = {
            id: b.playerId,
            name: namesById[b.playerId] || "Unknown",
            tournaments: [],
            netOwed: 0,
            netPaid: 0,
          };
        }
        const matchRows = stats.perMatch
          .slice()
          .sort((a, c) => new Date(a.date) - new Date(c.date))
          .map((m) => {
            const played = (m.participantIds || []).includes(b.playerId);
            return {
              id: m.id,
              name: m.name,
              date: m.date,
              played,
              amount: played ? m.perPlayer : 0,
            };
          });
        byPlayer[b.playerId].tournaments.push({
          id: t.id,
          name: t.name,
          status: t.status,
          startDate: t.startDate,
          endDate: t.endDate,
          owed: b.owed,
          paid: b.paid,
          balance: b.balance,
          matches: matchRows,
        });
        byPlayer[b.playerId].netOwed += b.owed;
        byPlayer[b.playerId].netPaid += b.paid;
      });
    });
    return Object.values(byPlayer)
      .filter((p) => p.tournaments.length > 0)
      .map((p) => ({ ...p, netBalance: p.netOwed - p.netPaid }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [directory, tournamentsWithData, namesById]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = playerRows;
    if (q) list = list.filter((p) => p.name.toLowerCase().includes(q));
    if (selectedId) list = list.filter((p) => p.id === selectedId);
    list = list.filter((p) => playerMatchesStatusFilter(p, statusFilter));
    return list;
  }, [playerRows, query, selectedId, statusFilter]);

  const tournamentsByStatus = useMemo(() => {
    const buckets = { Ongoing: [], Upcoming: [], Completed: [] };
    tournamentsWithData.forEach((t) => {
      const key = STATUS_META.some((s) => s.id === t.status) ? t.status : "Upcoming";
      if (!buckets[key]) buckets[key] = [];
      buckets[key].push(t);
    });
    Object.keys(buckets).forEach((k) => {
      buckets[k].sort((a, b) => String(b.startDate || "").localeCompare(String(a.startDate || "")));
    });
    return buckets;
  }, [tournamentsWithData]);

  const asset = (name) => `${process.env.PUBLIC_URL || ""}/${name}`;

  return (
    <div className="ogc-root" style={{ minHeight: "100vh" }}>
      <FontLoader />
      <div
        className="tt-header-pitch"
        style={{
          color: "#fff",
          padding: "22px 20px 24px",
          position: "relative",
          backgroundImage: `linear-gradient(160deg, rgba(15,23,42,0.88) 0%, rgba(31,41,55,0.78) 55%, rgba(15,23,42,0.9) 100%), url("${asset("cricket-pitch-header.png")}")`,
        }}
      >
        <div style={{ maxWidth: 720, margin: "0 auto", position: "relative" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 700, opacity: 0.75, letterSpacing: "0.08em", textTransform: "uppercase" }}>Tech Titans</div>
              <h1 className="ogc-display" style={{ fontSize: 38, margin: "4px 0 8px" }}>Dues board</h1>
              <p style={{ margin: 0, fontSize: 13.5, opacity: 0.88, lineHeight: 1.45, maxWidth: 420 }}>
                Filter by your name to see dues, refunds, and matches you played. No login. Names and amounts only.
              </p>
            </div>
            <img
              className="tt-ball-spin"
              src={asset("cricket-ball-header.png")}
              alt=""
              width={72}
              height={72}
              style={{ width: 72, height: 72, borderRadius: "50%", objectFit: "cover", flexShrink: 0, boxShadow: "0 8px 24px rgba(0,0,0,0.35)" }}
            />
          </div>

          <div style={{ marginTop: 18, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 8 }}>
            {STATUS_META.map((s) => {
              const list = tournamentsByStatus[s.id] || [];
              return (
                <div
                  key={s.id}
                  style={{
                    background: "rgba(255,255,255,0.1)",
                    border: "1px solid rgba(255,255,255,0.16)",
                    borderRadius: 12,
                    padding: "10px 10px 12px",
                    backdropFilter: "blur(8px)",
                    minHeight: 88,
                  }}
                >
                  <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.06em", textTransform: "uppercase", opacity: 0.7 }}>{s.title}</div>
                  <div className="ogc-display" style={{ fontSize: 28, lineHeight: 1, margin: "4px 0 2px" }}>{list.length}</div>
                  <div style={{ fontSize: 10.5, opacity: 0.7, marginBottom: 6 }}>{s.hint}</div>
                  {list.length === 0 ? (
                    <div style={{ fontSize: 11, opacity: 0.55 }}>None</div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                      {list.map((t) => (
                        <div key={t.id} style={{ fontSize: 11.5, fontWeight: 700, lineHeight: 1.3 }}>
                          {t.name}
                          <div style={{ fontWeight: 500, opacity: 0.7, fontSize: 10 }}>{fmtDate(t.startDate)} – {fmtDate(t.endDate)}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 720, margin: "0 auto", padding: "16px 16px 40px" }}>
        <div style={{ position: "relative", marginBottom: 12 }}>
          <Search size={16} style={{ position: "absolute", left: 12, top: 13, color: "#9C9680" }} />
          <input
            value={query}
            onChange={(e) => { setQuery(e.target.value); setSelectedId(""); }}
            placeholder="Filter by player name"
            style={{ width: "100%", boxSizing: "border-box", padding: "12px 12px 12px 38px", borderRadius: 12, border: "1.5px solid var(--line-soft)", fontSize: 16, background: "#fff" }}
          />
        </div>

        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
          {[
            { id: "all", label: "All statuses" },
            { id: "due", label: "Due" },
            { id: "refund", label: "Refund" },
            { id: "settled", label: "Settled" },
          ].map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setStatusFilter(f.id)}
              style={{ padding: "6px 12px", borderRadius: 999, border: "1.5px solid var(--line-soft)", fontSize: 12, fontWeight: 700, background: statusFilter === f.id ? "#1F2937" : "#fff", color: statusFilter === f.id ? "#fff" : "#090C10", cursor: "pointer" }}
            >
              {f.label}
            </button>
          ))}
        </div>

        {playerRows.length > 0 && (
          <div className="ogc-scrollbar" style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 10, marginBottom: 8 }}>
            <button
              type="button"
              onClick={() => { setSelectedId(""); }}
              style={{ flexShrink: 0, padding: "6px 12px", borderRadius: 999, border: "1.5px solid var(--line-soft)", background: !selectedId ? "#F59E0B" : "#fff", color: !selectedId ? "#fff" : "#090C10", fontWeight: 700, fontSize: 12, cursor: "pointer" }}
            >
              All players
            </button>
            {playerRows.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => { setSelectedId(p.id); setQuery(""); setOpenIds((prev) => ({ ...prev, [p.id]: true })); }}
                style={{ flexShrink: 0, padding: "6px 12px", borderRadius: 999, border: "1.5px solid var(--line-soft)", background: selectedId === p.id ? "#1F2937" : "#fff", color: selectedId === p.id ? "#fff" : "#090C10", fontWeight: 700, fontSize: 12, cursor: "pointer" }}
              >
                {p.name}
              </button>
            ))}
          </div>
        )}

        {loading && <div style={{ textAlign: "center", padding: 40, color: "#8A836E" }}>Loading board…</div>}
        {error && <div style={{ background: "#F6E1DE", color: "#991B1B", padding: 14, borderRadius: 12, fontSize: 13, fontWeight: 600 }}>{error}</div>}

        {!loading && !error && filtered.length === 0 && (
          <div style={{ textAlign: "center", padding: 40, color: "#8A836E" }}>
            <Users size={28} style={{ opacity: 0.4, marginBottom: 8 }} />
            <div style={{ fontWeight: 700, color: "#090C10" }}>No players match</div>
            <div style={{ fontSize: 13, marginTop: 4 }}>Try another name, or tap All players.</div>
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {filtered.map((p) => {
            const open = !!openIds[p.id];
            return (
            <div key={p.id} style={{ background: "#fff", borderRadius: 16, border: "1px solid var(--line-soft)", boxShadow: "0 6px 24px rgba(9,12,16,0.06)" }}>
              <button
                type="button"
                onClick={() => setOpenIds((prev) => ({ ...prev, [p.id]: !prev[p.id] }))}
                style={{ width: "100%", textAlign: "left", background: "none", border: "none", padding: 16, cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}
              >
                <div>
                  <div style={{ fontWeight: 800, fontSize: 17, color: "#090C10" }}>{p.name}</div>
                  <div style={{ fontSize: 12, color: "#8A836E", marginTop: 2 }}>
                    {p.tournaments.length} tournament{p.tournaments.length === 1 ? "" : "s"}
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <StatusPill balance={p.netBalance} />
                  <ChevronDown size={18} color="#8A836E" style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform 0.15s" }} />
                </div>
              </button>

              {open && (
              <div style={{ padding: "0 16px 16px" }}>
              {p.tournaments.map((t) => (
                <div key={t.id} style={{ borderTop: "1px solid var(--line-soft)", paddingTop: 12, marginTop: 12 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginBottom: 6 }}>
                    <div>
                      <div style={{ fontWeight: 800 }}>{t.name}</div>
                      <div style={{ fontSize: 11.5, color: "#8A836E" }}>{t.status} · {fmtDate(t.startDate)} – {fmtDate(t.endDate)}</div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: 10, fontWeight: 800, color: "#8A836E", textTransform: "uppercase", marginBottom: 4 }}>Payment status</div>
                      <StatusPill balance={t.balance} />
                    </div>
                  </div>
                  <div style={{ fontSize: 12, color: "#6B6552", marginBottom: 8 }}>
                    Owed {inr(t.owed)} · Paid {inr(t.paid)}
                  </div>
                  <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
                      <thead>
                        <tr style={{ textAlign: "left", color: "#8A836E", fontSize: 10.5, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                          <th style={{ padding: "6px 4px" }}>Match</th>
                          <th style={{ padding: "6px 4px" }}>Date</th>
                          <th style={{ padding: "6px 4px" }}>Played</th>
                          <th style={{ padding: "6px 4px", textAlign: "right" }}>Your share</th>
                        </tr>
                      </thead>
                      <tbody>
                        {t.matches.length === 0 ? (
                          <tr><td colSpan={4} style={{ padding: 8, color: "#8A836E" }}>No matches yet</td></tr>
                        ) : t.matches.map((m) => (
                          <tr key={m.id} style={{ borderTop: "1px solid #F0EEE6", opacity: m.played ? 1 : 0.55 }}>
                            <td style={{ padding: "8px 4px", fontWeight: 600 }}>{m.name}</td>
                            <td style={{ padding: "8px 4px", whiteSpace: "nowrap" }}>{fmtDate(m.date)}</td>
                            <td style={{ padding: "8px 4px" }}>{m.played ? "Yes" : "No"}</td>
                            <td className="ogc-mono" style={{ padding: "8px 4px", textAlign: "right", fontWeight: 700 }}>{m.played ? inr(m.amount) : "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
              </div>
              )}
            </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
