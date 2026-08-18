import React, { useEffect, useMemo, useState } from "react";
import { Check, Upload, Users, UserPlus, AlertTriangle } from "lucide-react";
import { parseScorecardHtml } from "./parseCricHeroesScorecard";
import {
  bestFuzzyPlayer,
  mappingDocId,
  resolveStoredMapping,
} from "./cricheroesFuzzy";

const STEPS = ["upload", "team", "map", "bill"];

function stepIndex(step) {
  return STEPS.indexOf(step);
}

function confidenceLabel(score, fromStore) {
  if (fromStore) return { text: "Saved", bg: "#DBEAFE", color: "#1D4ED8" };
  if (score >= 0.95) return { text: "Exact", bg: "#DCFCE7", color: "#166534" };
  if (score >= 0.7) return { text: "Likely", bg: "#FEF3C7", color: "#92400E" };
  if (score >= 0.35) return { text: "Maybe", bg: "#FFEDD5", color: "#9A3412" };
  return { text: "Unmapped", bg: "#FEE2E2", color: "#991B1B" };
}

/**
 * Full CricHeroes HTML import wizard for a tournament Matches tab.
 */
export default function CricHeroesImportWizard({
  tournament,
  players,
  playersById,
  allMatches,
  tournaments,
  mapsByKey,
  onSaveMappings,
  onSavePlayer,
  onSaveMatch,
  onClose,
  showToast,
  Btn,
  Field,
  inputStyle,
  Modal,
}) {
  const [step, setStep] = useState("upload");
  const [fileName, setFileName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [parsed, setParsed] = useState(null);
  const [duplicate, setDuplicate] = useState(null);
  const [selectedTeamName, setSelectedTeamName] = useState("");
  /** @type {Record<string, { playerId: string|null, mode: 'map'|'new', score?: number, fromStore?: boolean, newName?: string, newMobile?: string }>} */
  const [rowState, setRowState] = useState({});
  const [mappingsSaved, setMappingsSaved] = useState(false);
  const [billSelected, setBillSelected] = useState({});
  const [additionalAmount, setAdditionalAmount] = useState("");
  const [creating, setCreating] = useState(false);

  const teamPlayers = useMemo(() => {
    if (!parsed || !selectedTeamName) return [];
    const team = parsed.teams.find((t) => t.name === selectedTeamName);
    return team ? team.players : [];
  }, [parsed, selectedTeamName]);

  const findDuplicate = (matchId) => {
    if (!matchId) return null;
    const hit = (allMatches || []).find(
      (m) => String(m.cricheroesMatchId || "") === String(matchId)
    );
    if (!hit) return null;
    const t = (tournaments || []).find((x) => x.id === hit.tournamentId);
    return {
      matchId: hit.id,
      matchName: hit.name,
      matchDate: hit.date,
      tournamentId: hit.tournamentId,
      tournamentName: t?.name || "Unknown tournament",
    };
  };

  const initRowsForTeam = (chPlayers) => {
    const next = {};
    const billed = {};
    chPlayers.forEach((ch, idx) => {
      const key = `${ch.cricheroesPlayerId || "n"}:${ch.name}:${idx}`;
      const stored = resolveStoredMapping(ch, mapsByKey || {});
      if (stored && playersById[stored.playerId]) {
        next[key] = {
          playerId: stored.playerId,
          mode: "map",
          score: 1,
          fromStore: true,
        };
      } else {
        const best = bestFuzzyPlayer(ch.name, players);
        next[key] = {
          playerId: best ? best.player.id : null,
          mode: "map",
          score: best ? best.score : 0,
          fromStore: false,
        };
      }
      billed[key] = true;
    });
    setRowState(next);
    setBillSelected(billed);
    setMappingsSaved(false);
  };

  const onFileChange = async (e) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = "";
    if (!file) return;
    const lower = file.name.toLowerCase();
    if (!lower.endsWith(".html") && !lower.endsWith(".htm")) {
      setError("Please upload a .html or .htm file.");
      return;
    }
    setBusy(true);
    setError("");
    setParsed(null);
    setDuplicate(null);
    setFileName(file.name);
    try {
      const html = await file.text();
      const result = parseScorecardHtml(html, { fileName: file.name });
      if (!result.matchName || !result.date || !result.teams || result.teams.length < 2) {
        throw new Error("Could not parse match name, date, and both teams from this file.");
      }
      const dup = findDuplicate(result.matchId);
      setParsed(result);
      if (dup) {
        setDuplicate(dup);
        setStep("upload");
        showToast("Duplicate CricHeroes match — import blocked", false);
        return;
      }
      const auto =
        result.teams.find((t) => /tech\s*titans/i.test(t.name))?.name ||
        result.teams[0]?.name ||
        "";
      setSelectedTeamName(auto);
      setStep("team");
      showToast("Scorecard loaded — confirm your team", false);
    } catch (err) {
      setError(err.message || String(err));
      showToast("Could not parse HTML", false);
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (step === "map" && teamPlayers.length && Object.keys(rowState).length === 0) {
      initRowsForTeam(teamPlayers);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, selectedTeamName, teamPlayers.length]);

  const rowKeys = useMemo(
    () =>
      teamPlayers.map(
        (ch, idx) => `${ch.cricheroesPlayerId || "n"}:${ch.name}:${idx}`
      ),
    [teamPlayers]
  );

  const updateRow = (key, patch) => {
    setRowState((prev) => ({ ...prev, [key]: { ...prev[key], ...patch } }));
    setMappingsSaved(false);
  };

  const saveMappings = async () => {
    const payloads = [];
    const rowPatches = {};

    for (let i = 0; i < teamPlayers.length; i++) {
      const ch = teamPlayers[i];
      const key = rowKeys[i];
      const row = rowState[key];
      if (!row) continue;

      if (row.mode === "new") {
        const name = (row.newName || ch.name || "").trim();
        const mobile = (row.newMobile || "").trim();
        if (!name || !mobile) {
          showToast("New players need name and mobile before saving mappings", false);
          return;
        }
        const newId = crypto.randomUUID
          ? crypto.randomUUID()
          : `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;
        await onSavePlayer({
          id: newId,
          name,
          mobile,
          upiId: "",
          active: true,
        });
        rowPatches[key] = {
          mode: "map",
          playerId: newId,
          fromStore: false,
          score: 1,
          newName: undefined,
          newMobile: undefined,
        };
        payloads.push({
          cricheroesPlayerId: ch.cricheroesPlayerId || null,
          cricheroesName: ch.name,
          playerId: newId,
        });
      } else if (row.playerId) {
        payloads.push({
          cricheroesPlayerId: ch.cricheroesPlayerId || null,
          cricheroesName: ch.name,
          playerId: row.playerId,
        });
      }
    }

    if (!payloads.length) {
      showToast("Map at least one player before saving", false);
      return;
    }

    if (Object.keys(rowPatches).length) {
      setRowState((prev) => {
        const next = { ...prev };
        Object.entries(rowPatches).forEach(([k, patch]) => {
          next[k] = { ...next[k], ...patch };
        });
        return next;
      });
    }

    const docs = payloads.map((p) => {
      const id = mappingDocId(p);
      return {
        id,
        playerId: p.playerId,
        cricheroesPlayerId: p.cricheroesPlayerId,
        cricheroesName: p.cricheroesName,
        updatedAt: new Date().toISOString(),
      };
    });
    await onSaveMappings(docs);
    setMappingsSaved(true);
    showToast("Player mappings saved for future imports");
  };

  const activatePlayer = async (playerId) => {
    const p = playersById[playerId];
    if (!p) return;
    await onSavePlayer({ ...p, active: true });
    showToast(`Activated ${p.name}`);
  };

  const allMappedForBill = () => {
    return rowKeys.every((key) => {
      if (!billSelected[key]) return true;
      const row = rowState[key];
      return row && row.mode === "map" && row.playerId;
    });
  };

  const inactiveBilled = () => {
    const list = [];
    rowKeys.forEach((key) => {
      if (!billSelected[key]) return;
      const row = rowState[key];
      if (!row?.playerId) return;
      const p = playersById[row.playerId];
      if (p && p.active === false) list.push(p);
    });
    return list;
  };

  const canCreate = () => {
    const anyBill = rowKeys.some((k) => billSelected[k]);
    if (!anyBill) return false;
    if (!allMappedForBill()) return false;
    if (inactiveBilled().length) return false;
    if (!mappingsSaved) return false;
    return true;
  };

  const createMatch = async () => {
    if (!canCreate()) return;
    setCreating(true);
    try {
      const participantIds = [];
      const seen = new Set();
      rowKeys.forEach((key) => {
        if (!billSelected[key]) return;
        const id = rowState[key]?.playerId;
        if (id && !seen.has(id)) {
          seen.add(id);
          participantIds.push(id);
        }
      });
      const payload = {
        name: parsed.matchName,
        date: parsed.date,
        participantIds,
        additionalAmount:
          additionalAmount === "" ? 0 : Math.round(Number(additionalAmount) || 0),
      };
      if (parsed.matchId) payload.cricheroesMatchId = String(parsed.matchId);
      await onSaveMatch(payload);
      showToast(`Match "${parsed.matchName}" imported`);
      onClose();
    } catch (err) {
      showToast(err.message || "Failed to create match", false);
    } finally {
      setCreating(false);
    }
  };

  const goMap = () => {
    if (!selectedTeamName) {
      showToast("Select your team", false);
      return;
    }
    initRowsForTeam(
      parsed.teams.find((t) => t.name === selectedTeamName)?.players || []
    );
    setStep("map");
  };

  return (
    <Modal title="Import from CricHeroes" onClose={onClose}>
      {/* Colorful step rail */}
      <div style={{ display: "flex", gap: 6, marginBottom: 14, flexWrap: "wrap" }}>
        {[
          { id: "upload", label: "1 · Upload", color: "#0EA5E9" },
          { id: "team", label: "2 · Team", color: "#8B5CF6" },
          { id: "map", label: "3 · Map", color: "#F59E0B" },
          { id: "bill", label: "4 · Bill", color: "#10B981" },
        ].map((s) => {
          const active = step === s.id;
          const done = stepIndex(step) > stepIndex(s.id);
          return (
            <div
              key={s.id}
              style={{
                flex: 1,
                minWidth: 70,
                textAlign: "center",
                padding: "8px 6px",
                borderRadius: 10,
                fontSize: 11,
                fontWeight: 800,
                color: active || done ? "#fff" : "#6B6552",
                background: active || done ? s.color : "#F3F4F6",
                boxShadow: active ? `0 4px 12px ${s.color}55` : "none",
              }}
            >
              {s.label}
            </div>
          );
        })}
      </div>

      {step === "upload" && (
        <div>
          <p style={{ fontSize: 12.5, color: "#6B6552", marginBottom: 10, lineHeight: 1.45 }}>
            Save the CricHeroes page as HTML, then upload it. Parsing happens on your device.
          </p>
          <div
            style={{
              background: "#FFFBEB",
              border: "1.5px solid #F59E0B",
              borderRadius: 10,
              padding: "10px 12px",
              marginBottom: 12,
              fontSize: 12.5,
              color: "#92400E",
              lineHeight: 1.45,
              display: "flex",
              gap: 8,
              alignItems: "flex-start",
            }}
          >
            <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: 1 }} />
            <div>
              <b>Caution:</b> Save the page from the match <b>Scorecard</b> tab only
              (not Summary, Commentary, Teams, etc.). Use <b>File → Save Page As…</b> (HTML).
            </div>
          </div>
          <label
            style={{
              display: "block",
              border: "2px dashed #38BDF8",
              borderRadius: 14,
              padding: 18,
              textAlign: "center",
              cursor: busy ? "wait" : "pointer",
              background: "linear-gradient(180deg, #F0F9FF 0%, #fff 100%)",
              marginBottom: 12,
            }}
          >
            <Upload size={22} color="#0284C7" style={{ marginBottom: 6 }} />
            <div style={{ fontWeight: 800, color: "#0369A1" }}>
              {busy ? "Reading…" : "Upload .html scorecard"}
            </div>
            <div style={{ fontSize: 11.5, color: "#64748B", marginTop: 4 }}>
              {fileName || "Choose .html / .htm"}
            </div>
            <input
              type="file"
              accept=".html,.htm,text/html"
              disabled={busy}
              onChange={onFileChange}
              style={{ display: "none" }}
            />
          </label>
          {error && (
            <div style={{ background: "#FEF2F2", color: "#991B1B", borderRadius: 10, padding: 10, fontSize: 12.5 }}>
              {error}
            </div>
          )}
          {duplicate && (
            <div
              style={{
                background: "linear-gradient(135deg, #FEF2F2, #FFF7ED)",
                border: "1.5px solid #F87171",
                borderRadius: 12,
                padding: 12,
                marginTop: 8,
              }}
            >
              <div style={{ display: "flex", gap: 8, alignItems: "flex-start", color: "#991B1B", fontWeight: 800 }}>
                <AlertTriangle size={18} /> Duplicate CricHeroes match
              </div>
              <p style={{ fontSize: 13, color: "#7F1D1D", marginTop: 8, lineHeight: 1.45 }}>
                Match ID <b>{parsed?.matchId}</b> already exists. Delete the older match first, then import again.
              </p>
              <div style={{ fontSize: 12.5, background: "#fff", borderRadius: 8, padding: 10, marginTop: 8 }}>
                <div><b>Tournament:</b> {duplicate.tournamentName}</div>
                <div><b>Match:</b> {duplicate.matchName}</div>
                <div><b>Date:</b> {duplicate.matchDate}</div>
              </div>
            </div>
          )}
        </div>
      )}

      {step === "team" && parsed && (
        <div>
          <p style={{ fontSize: 12.5, color: "#6B6552", marginBottom: 8 }}>
            Confirm which side is <b>your</b> team. Tech Titans is auto-selected when found.
          </p>
          <div
            style={{
              background: "linear-gradient(135deg, #ECFDF5, #EFF6FF)",
              borderRadius: 12,
              padding: 12,
              marginBottom: 12,
            }}
          >
            <div style={{ fontWeight: 800, fontSize: 15 }}>{parsed.matchName}</div>
            <div style={{ fontSize: 12, color: "#64748B", marginTop: 4 }}>Date {parsed.date}</div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 14 }}>
            {parsed.teams.map((t, i) => {
              const sel = selectedTeamName === t.name;
              const colors = [
                { bg: "#EEF2FF", border: "#6366F1", accent: "#4338CA" },
                { bg: "#FDF2F8", border: "#EC4899", accent: "#BE185D" },
              ][i % 2];
              return (
                <button
                  key={t.name}
                  type="button"
                  onClick={() => setSelectedTeamName(t.name)}
                  style={{
                    textAlign: "left",
                    padding: 12,
                    borderRadius: 12,
                    border: `2px solid ${sel ? colors.border : "#E5E7EB"}`,
                    background: sel ? colors.bg : "#fff",
                    cursor: "pointer",
                    boxShadow: sel ? `0 4px 14px ${colors.border}33` : "none",
                  }}
                >
                  <div style={{ fontWeight: 800, color: colors.accent, display: "flex", alignItems: "center", gap: 6 }}>
                    <Users size={15} /> {t.name}
                    {sel && <Check size={14} />}
                  </div>
                  <div style={{ fontSize: 12, color: "#6B7280", marginTop: 4 }}>
                    {t.players.length} players
                  </div>
                </button>
              );
            })}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <Btn variant="ghost" style={{ flex: 1, justifyContent: "center" }} onClick={() => setStep("upload")}>
              Back
            </Btn>
            <Btn style={{ flex: 1, justifyContent: "center", background: "#8B5CF6" }} onClick={goMap}>
              Confirm team
            </Btn>
          </div>
        </div>
      )}

      {step === "map" && (
        <div>
          <p style={{ fontSize: 12.5, color: "#6B6552", marginBottom: 10, lineHeight: 1.4 }}>
            Review fuzzy / saved mappings. Edit if needed, then <b>Save mappings</b> (remembered for next time).
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 10, maxHeight: 360, overflowY: "auto", marginBottom: 12 }}>
            {teamPlayers.map((ch, idx) => {
              const key = rowKeys[idx];
              const row = rowState[key] || { mode: "map", playerId: null, score: 0 };
              const mapped = row.playerId ? playersById[row.playerId] : null;
              const badge = confidenceLabel(row.score || 0, row.fromStore);
              return (
                <div
                  key={key}
                  style={{
                    border: "1.5px solid #E5E7EB",
                    borderRadius: 12,
                    padding: 10,
                    background: "linear-gradient(180deg, #FFFBEB 0%, #fff 40%)",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginBottom: 8 }}>
                    <div style={{ fontWeight: 800, fontSize: 13, color: "#92400E" }}>{ch.name}</div>
                    <span style={{ fontSize: 10, fontWeight: 800, padding: "3px 8px", borderRadius: 999, background: badge.bg, color: badge.color }}>
                      {badge.text}
                    </span>
                  </div>

                  <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
                    <button
                      type="button"
                      onClick={() => updateRow(key, { mode: "map" })}
                      style={{
                        flex: 1, fontSize: 11, fontWeight: 700, padding: "6px 8px", borderRadius: 8, cursor: "pointer",
                        border: row.mode === "map" ? "1.5px solid #0EA5E9" : "1px solid #E5E7EB",
                        background: row.mode === "map" ? "#E0F2FE" : "#fff", color: "#0369A1",
                      }}
                    >
                      Map existing
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        updateRow(key, {
                          mode: "new",
                          newName: ch.name,
                          newMobile: row.newMobile || "",
                          playerId: null,
                        })
                      }
                      style={{
                        flex: 1, fontSize: 11, fontWeight: 700, padding: "6px 8px", borderRadius: 8, cursor: "pointer",
                        border: row.mode === "new" ? "1.5px solid #10B981" : "1px solid #E5E7EB",
                        background: row.mode === "new" ? "#D1FAE5" : "#fff", color: "#047857",
                      }}
                    >
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 4, justifyContent: "center" }}>
                        <UserPlus size={12} /> New player
                      </span>
                    </button>
                  </div>

                  {row.mode === "map" ? (
                    <>
                      <select
                        style={{ ...inputStyle, marginBottom: mapped && mapped.active === false ? 8 : 0 }}
                        value={row.playerId || ""}
                        onChange={(e) =>
                          updateRow(key, {
                            playerId: e.target.value || null,
                            fromStore: false,
                            score: e.target.value ? 0.9 : 0,
                          })
                        }
                      >
                        <option value="">— Select player —</option>
                        {[...players]
                          .sort((a, b) => a.name.localeCompare(b.name))
                          .map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name}{p.active === false ? " (inactive)" : ""}
                            </option>
                          ))}
                      </select>
                      {mapped && mapped.active === false && (
                        <Btn
                          variant="outline"
                          style={{ width: "100%", justifyContent: "center", fontSize: 12, borderColor: "#F59E0B", color: "#B45309" }}
                          onClick={() => activatePlayer(mapped.id)}
                        >
                          Activate {mapped.name}
                        </Btn>
                      )}
                    </>
                  ) : (
                    <>
                      <Field label="Name">
                        <input
                          style={inputStyle}
                          value={row.newName || ""}
                          onChange={(e) => updateRow(key, { newName: e.target.value })}
                        />
                      </Field>
                      <Field label="Mobile (required)">
                        <input
                          style={inputStyle}
                          value={row.newMobile || ""}
                          onChange={(e) => updateRow(key, { newMobile: e.target.value })}
                          placeholder="e.g. 9876543210"
                        />
                      </Field>
                    </>
                  )}
                </div>
              );
            })}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <Btn
              style={{ width: "100%", justifyContent: "center", background: "#F59E0B" }}
              onClick={saveMappings}
            >
              <Check size={15} /> Save mappings
            </Btn>
            {mappingsSaved && (
              <div style={{ fontSize: 12, color: "#166534", fontWeight: 700, textAlign: "center" }}>
                Mappings saved ✓
              </div>
            )}
            <div style={{ display: "flex", gap: 8 }}>
              <Btn variant="ghost" style={{ flex: 1, justifyContent: "center" }} onClick={() => setStep("team")}>
                Back
              </Btn>
              <Btn
                style={{ flex: 1, justifyContent: "center", background: "#10B981" }}
                disabled={!mappingsSaved}
                onClick={() => {
                  if (!mappingsSaved) {
                    showToast("Save mappings before continuing", false);
                    return;
                  }
                  setStep("bill");
                }}
              >
                Next: billing
              </Btn>
            </div>
          </div>
        </div>
      )}

      {step === "bill" && (
        <div>
          <p style={{ fontSize: 12.5, color: "#6B6552", marginBottom: 8 }}>
            Choose who to bill (all selected by default). Inactive billed players must be activated first.
          </p>
          <div
            style={{
              background: "linear-gradient(135deg, #ECFDF5, #D1FAE5)",
              border: "1.5px solid #34D399",
              borderRadius: 10,
              padding: "10px 12px",
              marginBottom: 10,
              fontWeight: 800,
              fontSize: 14,
              color: "#047857",
              textAlign: "center",
            }}
          >
            {rowKeys.filter((k) => billSelected[k]).length} of {rowKeys.length} player
            {rowKeys.filter((k) => billSelected[k]).length === 1 ? "" : "s"} selected for billing
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 12, maxHeight: 260, overflowY: "auto" }}>
            {teamPlayers.map((ch, idx) => {
              const key = rowKeys[idx];
              const row = rowState[key];
              const p = row?.playerId ? playersById[row.playerId] : null;
              const checked = !!billSelected[key];
              return (
                <label
                  key={key}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: 10,
                    borderRadius: 10,
                    border: `1.5px solid ${checked ? "#34D399" : "#E5E7EB"}`,
                    background: checked ? "#ECFDF5" : "#fff",
                    cursor: "pointer",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={(e) =>
                      setBillSelected((prev) => ({ ...prev, [key]: e.target.checked }))
                    }
                  />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: 13 }}>{p?.name || ch.name}</div>
                    <div style={{ fontSize: 11, color: "#6B7280" }}>
                      from {ch.name}
                      {p && p.active === false ? " · inactive" : ""}
                    </div>
                  </div>
                  {p && p.active === false && (
                    <Btn
                      variant="outline"
                      style={{ fontSize: 11, padding: "4px 8px", borderColor: "#F59E0B", color: "#B45309" }}
                      onClick={(e) => {
                        e.preventDefault();
                        activatePlayer(p.id);
                      }}
                    >
                      Activate
                    </Btn>
                  )}
                </label>
              );
            })}
          </div>

          {inactiveBilled().length > 0 && (
            <div style={{ background: "#FEF3C7", color: "#92400E", borderRadius: 10, padding: 10, fontSize: 12.5, marginBottom: 10, fontWeight: 600 }}>
              Activate inactive players before creating the match: {inactiveBilled().map((p) => p.name).join(", ")}
            </div>
          )}
          {!mappingsSaved && (
            <div style={{ background: "#FEE2E2", color: "#991B1B", borderRadius: 10, padding: 10, fontSize: 12.5, marginBottom: 10 }}>
              Mappings were changed — go back and Save mappings again.
            </div>
          )}

          <Field label="Additional amount for this match (₹)">
            <input
              type="number"
              min="0"
              style={inputStyle}
              value={additionalAmount}
              onChange={(e) => setAdditionalAmount(e.target.value)}
              placeholder="0 — e.g. umpire fee"
            />
          </Field>

          <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
            <Btn variant="ghost" style={{ flex: 1, justifyContent: "center" }} onClick={() => setStep("map")}>
              Back
            </Btn>
            <Btn
              style={{ flex: 1, justifyContent: "center", background: "#059669" }}
              disabled={!canCreate() || creating}
              onClick={createMatch}
            >
              {creating ? "Creating…" : "Create match"}
            </Btn>
          </div>
        </div>
      )}
    </Modal>
  );
}
