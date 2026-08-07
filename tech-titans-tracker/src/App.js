import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  Trophy, Users, Wallet, BarChart3, Plus, X, Check, ChevronRight,
  MessageCircle, Download, Trash2, Archive, Search, ArrowLeft, Calendar,
  IndianRupee, UserPlus, AlertTriangle, CheckCircle2, Copy, ArrowUpDown, Filter
} from "lucide-react";

// --- FIREBASE IMPORTS ---
import { auth, provider, db } from "./firebase";
import { collection, onSnapshot, doc, getDoc, setDoc, deleteDoc } from "firebase/firestore";
import { signInWithPopup, signOut, onAuthStateChanged } from "firebase/auth";

// Access is controlled by Firestore security rules, which only allow a
// request through when a document exists at admins/{their email}. This
// check just mirrors that so the UI can show a friendly message instead of
// a stream of permission-denied errors from Firestore.
const isTeamMember = async (email) => {
  if (!email) return false;
  const snap = await getDoc(doc(db, "admins", email));
  return snap.exists();
};

/* ---------------------------------------------------------------------- */
/* Fonts & Styling (Tech Titans Theme)                                   */
/* ---------------------------------------------------------------------- */
const FontLoader = () => (
  <style>{`
    @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Inter:wght@400;500;600;700;800&family=IBM+Plex+Mono:wght@500;600&display=swap');
    :root {
      --pitch-cream: #F4F5F7; 
      --pitch-ink: #090C10;   
      --pitch-green: #F59E0B; /* Titan Orange */
      --pitch-green-deep: #1F2937; /* Slate Dark Grey */
      --stump-gold: #FCD34D;  
      --ball-red: #EF4444;    
      --line-soft: #E1E4E8;   
      --card: #FFFFFF;
      --field-green: #22C55E;
    }
    .ogc-root { font-family: 'Inter', sans-serif; background: var(--pitch-cream); color: var(--pitch-ink); }
    .ogc-display { font-family: 'Bebas Neue', 'Inter', sans-serif; letter-spacing: 0.03em; }
    .ogc-mono { font-family: 'IBM Plex Mono', monospace; }
    .ogc-scrollbar::-webkit-scrollbar { width: 6px; height: 6px; }
    .ogc-scrollbar::-webkit-scrollbar-thumb { background: var(--line-soft); border-radius: 3px; }
    button, input, select { font-family: inherit; }
    
    .ogc-card {
      transition: transform 0.2s ease, box-shadow 0.2s ease;
    }
    .ogc-card:hover {
      transform: translateY(-2px);
      box-shadow: 0 8px 30px rgba(9, 12, 16, 0.12);
    }
    .ogc-btn {
      transition: all 0.2s ease;
    }
    .ogc-btn:hover:not(:disabled) {
      transform: translateY(-1px);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    }
    .ogc-btn:active:not(:disabled) {
      transform: translateY(0);
    }
    .nav-btn {
      transition: all 0.2s ease;
    }
    .nav-btn:hover {
      background: rgba(245, 158, 11, 0.1);
      border-radius: 8px;
    }
    
    @keyframes confetti-fall-1 {
      0% { transform: translateY(0) rotate(0deg) scale(1); opacity: 1; }
      100% { transform: translateY(100vh) rotate(720deg) scale(0.5); opacity: 0; }
    }
    @keyframes confetti-fall-2 {
      0% { transform: translateY(0) rotate(0deg) scale(1); opacity: 1; }
      100% { transform: translateY(100vh) rotate(-540deg) scale(0.5); opacity: 0; }
    }
    @keyframes confetti-sway {
      0%, 100% { margin-left: 0; }
      50% { margin-left: 30px; }
    }
    @keyframes pulse-glow {
      0%, 100% { box-shadow: 0 0 0 0 rgba(245, 158, 11, 0.4); }
      50% { box-shadow: 0 0 0 8px rgba(245, 158, 11, 0); }
    }
  `}</style>
);

// Cricket-themed SVG Icons
const CricketBat = ({ size = 24, color = "currentColor" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 20L8 16" />
    <rect x="8" y="4" width="4" height="14" rx="1" transform="rotate(45 10 11)" />
    <path d="M14.5 9.5L19 5" />
  </svg>
);

const CricketBall = ({ size = 24, color = "currentColor" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="9" />
    <path d="M12 3C9 6 9 10 12 12C15 14 15 18 12 21" />
    <path d="M8.5 5.5L7 7M16.5 5.5L18 7M8.5 18.5L7 17M16.5 18.5L18 17" />
  </svg>
);

const CricketStumps = ({ size = 24, color = "currentColor" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="8" y1="4" x2="8" y2="20" />
    <line x1="12" y1="4" x2="12" y2="20" />
    <line x1="16" y1="4" x2="16" y2="20" />
    <path d="M6 6H18" />
    <path d="M6 8H18" />
  </svg>
);

const CricketHelmet = ({ size = 24, color = "currentColor" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 2C7 2 4 6 4 10V14C4 16 5 18 7 19H17C19 18 20 16 20 14V10C20 6 17 2 12 2Z" />
    <path d="M4 12H8L10 14H14L16 12H20" />
    <circle cx="12" cy="8" r="1" fill={color} />
  </svg>
);

const CricketTrophy = ({ size = 24, color = "currentColor" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M6 9H4C3 9 2 8 2 7V6C2 5 3 4 4 4H6" />
    <path d="M18 9H20C21 9 22 8 22 7V6C22 5 21 4 20 4H18" />
    <path d="M6 4H18V10C18 14 15 17 12 17C9 17 6 14 6 10V4Z" />
    <path d="M12 17V20" />
    <path d="M8 22H16" />
    <path d="M9 22V20H15V22" />
    <circle cx="12" cy="9" r="2" />
  </svg>
);

const Confetti = () => {
  const pieces = useMemo(() => {
    const colors = ['#F59E0B', '#FCD34D', '#EF4444', '#10B981', '#3B82F6', '#8B5CF6', '#EC4899', '#F472B6', '#22D3EE'];
    return Array.from({ length: 80 }, (_, i) => ({
      id: i,
      left: Math.random() * 100,
      startTop: -20 - Math.random() * 100,
      delay: Math.random() * 0.8,
      duration: 2.5 + Math.random() * 1.5,
      color: colors[Math.floor(Math.random() * colors.length)],
      size: 8 + Math.random() * 10,
      shape: Math.random() > 0.6 ? 'circle' : Math.random() > 0.3 ? 'square' : 'rect',
      animation: Math.random() > 0.5 ? 'confetti-fall-1' : 'confetti-fall-2',
      swayDuration: 1 + Math.random() * 2,
    }));
  }, []);

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', pointerEvents: 'none', zIndex: 9999, overflow: 'hidden' }}>
      {pieces.map((p) => (
        <div
          key={p.id}
          style={{
            position: 'absolute',
            left: `${p.left}%`,
            top: p.startTop,
            width: p.shape === 'rect' ? p.size * 0.4 : p.size,
            height: p.size,
            backgroundColor: p.color,
            borderRadius: p.shape === 'circle' ? '50%' : '2px',
            animation: `${p.animation} ${p.duration}s ease-out ${p.delay}s forwards, confetti-sway ${p.swayDuration}s ease-in-out ${p.delay}s infinite`,
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
          }}
        />
      ))}
    </div>
  );
};

/* ---------------------------------------------------------------------- */
/* Helpers & Math                                                        */
/* ---------------------------------------------------------------------- */
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : `id-${Date.now()}-${Math.random().toString(16).slice(2)}`);
const inr = (n) => `₹${Math.round(n).toLocaleString("en-IN")}`;
const fmtDate = (d) => d ? new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—";

const formatWhatsAppNumber = (rawNumber) => {
  if (!rawNumber) return "";
  const cleanNumber = rawNumber.replace(/\D/g, "");
  return cleanNumber.length === 10 ? `91${cleanNumber}` : cleanNumber;
};

function computeTournamentStats(t) {
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

// Builds a UPI deep link (upi://pay?...) that opens PhonePe/GPay/any UPI app
// with just the UPI ID pre-filled. Amount is intentionally omitted so the user
// enters it manually - this bypasses the ₹2,000 NPCI limit on deep-link payments.
//
// NOTE: this generic "upi://" scheme works great on Android (the OS shows a
// picker of every installed UPI app), but iOS has no such picker — whichever
// one app happens to claim the generic scheme (often WhatsApp itself, since
// it also registers as a UPI handler) silently gets it, with no way for us
// to control which. See buildUpiAppLinks() below for the iOS-safe fix.
function buildUpiPaymentLink({ vpa, payeeName }) {
  if (!vpa) return "";
  const params = new URLSearchParams({
    pa: vpa,
    pn: payeeName || "Treasurer",
    cu: "INR",
  });
  return `upi://pay?${params.toString()}`;
}

// Per-app custom URL schemes for UPI. Amount is omitted so user enters it manually,
// bypassing the ₹2,000 NPCI limit. Google Pay's iOS scheme is "tez://", not "gpay://"
// — confirmed via Google's own docs; using "gpay://" silently fails on iOS.
function buildUpiAppLinks({ vpa, payeeName }) {
  if (!vpa) return [];
  const params = new URLSearchParams({ pa: vpa, pn: payeeName || "Treasurer", cu: "INR" });
  const qs = params.toString();
  return [
    { id: "gpay", label: "Google Pay", url: `tez://upi/pay?${qs}` },
    { id: "phonepe", label: "PhonePe", url: `phonepe://pay?${qs}` },
    { id: "paytm", label: "Paytm", url: `paytmmp://pay?${qs}` },
  ];
}

// Wraps the same payment details in a link to our own "Pay Now" page
// (see PayPage) instead of a raw upi:// link. WhatsApp reliably auto-links
// https:// URLs (unlike custom schemes), and it reads as a clean, short,
// trustworthy domain instead of a long encoded upi://pay?... string.
function buildPayNowUrl({ vpa, payeeName, amount, note }) {
  if (!vpa) return "";
  const params = new URLSearchParams({ pa: vpa, pn: payeeName || "Treasurer", am: String(amount) });
  if (note) params.set("tn", note);
  const base = `${window.location.origin}${process.env.PUBLIC_URL || ""}`;
  return `${base}/#/pay?${params.toString()}`;
}

// ⚠️ NEW: Centralized Settlement Logic replacing P2P computeSettlement
function computeCentralizedSettlement(t, stats, playersById) {
  const treasurer = playersById[t.treasurerId];
  const treasurerName = treasurer ? treasurer.name : "the Treasurer";
  const treasurerMobile = treasurer?.mobile || "";
  const treasurerUpiId = treasurer?.upiId || "";

  return stats.balances.map(b => {
    const player = playersById[b.playerId];
    const exactAmount = Math.abs(b.balance).toFixed(0);

    const matchLines = (b.matches && b.matches.length)
      ? [...b.matches].sort((a, b) => new Date(a.date) - new Date(b.date)).map((m) => `↣ ${m.name} ➤ Match Fee: ${inr(m.perPlayer)}`).join("\n")
      : "(no matches recorded yet)";

    const header = `Hi ${player?.name},\n\nYou have played the following match(es) in ${t.name}:\n${matchLines}\n\nTotal Cost For All Matches: ${inr(b.owed)}\nYou have paid a total of: ${inr(b.paid)}\nTotal Amount Due: ${inr(b.balance)}`;

    const payNowUrl = buildPayNowUrl({
      vpa: treasurerUpiId, payeeName: treasurerName, amount: exactAmount, note: `${t.name} fee`,
    });

    let closing;
    if (b.balance > 1) {
      const payLine = payNowUrl
        ? `Pay Now: ${payNowUrl}\n(or PhonePe/GPay to ${treasurerMobile || treasurerName} and share the screenshot)`
        : `Please send this to our Treasurer, ${treasurerName}${treasurerMobile ? ` (${treasurerMobile})` : ""}, via PhonePe/GPay and share the screenshot.`;
      closing = `\n\n${payLine}\n\nThanks,\n${treasurerName}`;
    } else if (b.balance < -1) {
      closing = `\n\n${treasurerName}${treasurerMobile ? ` (${treasurerMobile})` : ""} will transfer this refund to you shortly.\n\nThanks,\n${treasurerName}`;
    } else {
      closing = `\n\nYou're fully settled — no payment needed. Thanks for being part of Tech Titans!\n\n${treasurerName}`;
    }

    const message = header + closing;
    const waNumber = formatWhatsAppNumber(player?.mobile);
    const whatsappLink = `https://wa.me/${waNumber}?text=${encodeURIComponent(message)}`;

    return { ...b, exactAmount, message, whatsappLink, upiLink: b.balance > 1 ? payNowUrl : "" };
  });
}

function downloadCSV(filename, rows) {
  const csv = rows.map((r) => r.map((c) => `"${String(c ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function tournamentCSVRows(t, playersById, stats, centralizedSettlements) {
  const rows = [];
  rows.push(["Tournament", t.name], ["Start Date", fmtDate(t.startDate)], ["End Date", fmtDate(t.endDate)], ["Total Fee", t.totalFee], ["Status", t.status], ["Treasurer", playersById[t.treasurerId]?.name || "None"], []);
  rows.push(["-- Payments --"], ["Player", "Amount", "Date", "Type"]);
  (t.payments || []).forEach((p) => rows.push([playersById[p.playerId]?.name || "?", p.amount, fmtDate(p.date), p.type === "refund" ? "Refund" : "Payment"]));
  rows.push([], ["-- Matches --"], ["Match", "Date", "Participants", "Base Cost", "Additional", "Total Cost/Match", "Cost/Player"]);
  stats.perMatch.forEach((m) => rows.push([m.name, fmtDate(m.date), m.participantIds.map((id) => playersById[id]?.name).join("; "), m.baseCost, m.additionalAmount, m.cost, m.perPlayer]));
  rows.push([], ["-- Settlement --"], ["Player", "Matches Played", "Owed", "Paid", "Balance (+ = owes, - = refund)"]);
  stats.balances.forEach((b) => rows.push([playersById[b.playerId]?.name || "?", b.matches.length, b.owed, b.paid, b.balance]));
  rows.push([], ["-- Instructions --"], ["Player", "Message"]);
  centralizedSettlements.forEach((x) => rows.push([playersById[x.playerId]?.name || "?", x.message.replace(/\n/g, ' ')]));
  return rows;
}

/* ---------------------------------------------------------------------- */
/* UI Atoms                                                              */
/* ---------------------------------------------------------------------- */
const Card = ({ children, style, className = "", ...rest }) => ( 
  <div 
    className={`ogc-card ${className}`} 
    style={{ background: "var(--card)", borderRadius: 14, border: "1px solid var(--line-soft)", boxShadow: "0 6px 24px rgba(9, 12, 16, 0.06)", padding: 16, ...style }} 
    {...rest}
  >
    {children}
  </div> 
);
const Pill = ({ children, tone = "green", icon: Icon }) => {
  const tones = { green: { bg: "#FFFBEB", fg: "#B45309" }, gold: { bg: "#FBF0D6", fg: "#7A5A0F" }, red: { bg: "#F6E1DE", fg: "var(--ball-red)" }, grey: { bg: "#EDEBE3", fg: "#665F4E" }, cricket: { bg: "#DCFCE7", fg: "#166534" } };
  return (
    <span style={{ background: tones[tone].bg, color: tones[tone].fg, fontSize: 12, fontWeight: 700, padding: "3px 10px", borderRadius: 999, whiteSpace: "nowrap", display: "inline-flex", alignItems: "center", gap: 4 }}>
      {Icon && <Icon size={11} />}
      {children}
    </span>
  );
};
const Btn = ({ children, variant = "primary", style, disabled, ...rest }) => {
  const variants = { primary: { background: "var(--pitch-green)", color: "#fff", border: "none" }, outline: { background: "transparent", color: "var(--pitch-green-deep)", border: "1.5px solid var(--pitch-green)" }, ghost: { background: "transparent", color: "var(--pitch-ink)", border: "none" }, danger: { background: "transparent", color: "var(--ball-red)", border: "1.5px solid var(--ball-red)" }, gold: { background: "var(--stump-gold)", color: "#3B2C08", border: "none" } };
  return <button className="ogc-btn" disabled={disabled} style={{ ...variants[variant], opacity: disabled ? 0.5 : 1, padding: "9px 16px", borderRadius: 10, fontWeight: 700, fontSize: 14, cursor: disabled ? "not-allowed" : "pointer", display: "inline-flex", alignItems: "center", gap: 6, ...style }} {...rest}>{children}</button>;
};
const Field = ({ label, children }) => ( <label style={{ display: "block", marginBottom: 12 }}><div style={{ fontSize: 12, fontWeight: 700, color: "#6B6552", marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.04em" }}>{label}</div>{children}</label> );
const inputStyle = { width: "100%", padding: "10px 12px", borderRadius: 9, border: "1.5px solid var(--line-soft)", fontSize: 15, background: "#fff", color: "var(--pitch-ink)", boxSizing: "border-box" };
const Modal = ({ title, onClose, children, wide }) => (
  <div style={{ position: "fixed", inset: 0, background: "rgba(18,23,17,0.55)", zIndex: 100, display: "flex", alignItems: "flex-end", justifyContent: "center" }} onClick={onClose}>
    <div className="ogc-scrollbar" style={{ background: "var(--pitch-cream)", width: "100%", maxWidth: wide ? 640 : 460, maxHeight: "88vh", overflowY: "auto", borderRadius: "18px 18px 0 0", padding: 20, boxShadow: "0 -8px 30px rgba(0,0,0,0.25)" }} onClick={(e) => e.stopPropagation()}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div className="ogc-display" style={{ fontSize: 26 }}>{title}</div>
        <button onClick={onClose} style={{ background: "#EDEBE3", border: "none", borderRadius: 999, width: 32, height: 32, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}><X size={18} /></button>
      </div>{children}
    </div>
  </div>
);
const EmptyState = ({ icon: Icon, title, sub }) => (
  <div style={{ textAlign: "center", padding: "40px 20px", color: "#8A836E", position: "relative" }}>
    <div style={{ width: 64, height: 64, borderRadius: 16, background: "linear-gradient(135deg, #F4F5F7 0%, #E5E7EB 100%)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 12px", boxShadow: "inset 0 2px 4px rgba(0,0,0,0.06)" }}>
      <Icon size={28} style={{ opacity: 0.5 }} />
    </div>
    <div style={{ fontWeight: 700, color: "var(--pitch-ink)", fontSize: 15 }}>{title}</div>
    <div style={{ fontSize: 13, marginTop: 4 }}>{sub}</div>
  </div>
);
const SectionTitle = ({ children }) => <div style={{ fontSize: 13, fontWeight: 800, color: "#6B6552", textTransform: "uppercase", letterSpacing: "0.05em", margin: "6px 2px 10px", display: "flex", alignItems: "center" }}>{children}</div>;
const StatusPill = ({ status }) => {
  const config = {
    Completed: { tone: "gold", icon: CricketTrophy },
    Ongoing: { tone: "green", icon: CricketBall },
    Upcoming: { tone: "grey", icon: Calendar }
  };
  const { tone, icon: Icon } = config[status] || { tone: "grey", icon: Calendar };
  return <Pill tone={tone} icon={Icon}>{status}</Pill>;
};
const MiniStat = ({ label, value }) => (
  <div style={{ background: "var(--pitch-cream)", borderRadius: 9, padding: "8px 6px", textAlign: "center" }}>
    <div className="ogc-mono" style={{ fontWeight: 700, fontSize: 13.5 }}>{value}</div>
    <div style={{ fontSize: 10, color: "#8A836E", marginTop: 2, textTransform: "uppercase", fontWeight: 700 }}>{label}</div>
  </div>
);

/* ---------------------------------------------------------------------- */
/* Public "Pay Now" landing page                                         */
/* Reached via a #/pay?... hash link shared in WhatsApp messages. Needs   */
/* no login and reads nothing from Firestore - everything it needs is    */
/* already encoded in the URL, the same details already visible in the   */
/* message itself.                                                       */
/* ---------------------------------------------------------------------- */
function parsePayParamsFromHash() {
  const hash = window.location.hash || "";
  if (!hash.startsWith("#/pay")) return null;
  const qIndex = hash.indexOf("?");
  const params = new URLSearchParams(qIndex === -1 ? "" : hash.slice(qIndex + 1));
  return {
    vpa: params.get("pa") || "",
    payeeName: params.get("pn") || "Treasurer",
    amount: params.get("am") || "",
    note: params.get("tn") || "",
  };
}

function PayPage({ params }) {
  const [copied, setCopied] = useState(false);
  const amount = Number(params.amount) || 0;
  const upiLink = buildUpiPaymentLink({
    vpa: params.vpa, payeeName: params.payeeName,
  });
  const appLinks = buildUpiAppLinks({
    vpa: params.vpa, payeeName: params.payeeName,
  });

  const copyUpiId = () => {
    if (navigator.clipboard) navigator.clipboard.writeText(params.vpa).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <div className="ogc-root" style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 24, textAlign: "center" }}>
      <FontLoader />
      <div style={{ width: 72, height: 72, borderRadius: 16, background: "var(--pitch-green-deep)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 18 }}>
        <IndianRupee size={32} color="#fff" />
      </div>
      <h1 className="ogc-display" style={{ fontSize: 30, marginBottom: 6 }}>Pay {params.payeeName}</h1>
      <div className="ogc-mono" style={{ fontSize: 34, fontWeight: 800, marginBottom: 4 }}>{inr(amount)}</div>
      {params.note && <div style={{ color: "#8A836E", fontSize: 13, marginBottom: 12 }}>{params.note}</div>}

      {upiLink ? (
        <>
          <div style={{ background: "#D1FAE5", border: "1px solid #10B981", borderRadius: 10, padding: "10px 16px", marginBottom: 16, maxWidth: 320 }}>
            <div style={{ fontSize: 12.5, color: "#065F46", fontWeight: 600 }}>
              Enter <b>{inr(amount)}</b> when the app opens
            </div>
          </div>

          <div style={{ fontSize: 11, fontWeight: 700, color: "#8A836E", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 10 }}>Open your UPI app</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, width: "100%", maxWidth: 300, marginBottom: 16 }}>
            {appLinks.map((app) => (
              <Btn key={app.id} variant="outline" style={{ padding: "11px 20px", fontSize: 14, justifyContent: "center" }} onClick={() => { window.location.href = app.url; }}>
                Open {app.label}
              </Btn>
            ))}
            <Btn variant="ghost" style={{ padding: "9px 20px", fontSize: 12.5, justifyContent: "center", color: "#8A836E" }} onClick={() => { window.location.href = upiLink; }}>
              Other UPI App
            </Btn>
          </div>

          <div style={{ background: "var(--card)", border: "1.5px solid var(--line-soft)", borderRadius: 12, padding: 16, maxWidth: 320, width: "100%" }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#6B6552", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 10 }}>
              Or copy UPI ID manually
            </div>
            <button onClick={copyUpiId} className="ogc-mono" style={{ width: "100%", fontSize: 14, fontWeight: 700, wordBreak: "break-all", background: copied ? "#D1FAE5" : "var(--pitch-cream)", border: copied ? "1.5px solid #10B981" : "1.5px solid var(--line-soft)", padding: "12px 14px", borderRadius: 8, cursor: "pointer", color: copied ? "#065F46" : "var(--pitch-ink)", transition: "all 0.2s", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
              <span>{params.vpa}</span>
              {copied ? <CheckCircle2 size={16} /> : <Copy size={16} />}
            </button>
            <div style={{ fontSize: 11, color: "#8A836E", marginTop: 6 }}>{copied ? "Copied to clipboard!" : "Tap to copy UPI ID"}</div>
          </div>
        </>
      ) : (
        <div style={{ color: "var(--ball-red)", fontSize: 14 }}>This payment link is missing details. Please ask for a new one.</div>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/* Main App                                                              */
/* ---------------------------------------------------------------------- */
export default function App() {
  // Public payment links (#/pay?...) bypass login entirely - they carry
  // everything needed to render in the URL itself, same as what's already
  // visible in the WhatsApp message that links to them.
  const payParams = useMemo(() => parsePayParamsFromHash(), []);

  const [user, setUser] = useState(null);
  const [authChecking, setAuthChecking] = useState(true);
  const [authError, setAuthError] = useState("");
  
  const [players, setPlayers] = useState([]);
  const [tournaments, setTournaments] = useState([]);
  const [payments, setPayments] = useState([]);
  const [matches, setMatches] = useState([]);
  
  const [tab, setTab] = useState("dashboard");
  const [openTournamentId, setOpenTournamentId] = useState(null);
  const [toast, setToast] = useState(null);
  const [showConfetti, setShowConfetti] = useState(false);

  const showToast = useCallback((msg, withConfetti = true) => { 
    setToast(msg); 
    if (withConfetti) {
      setShowConfetti(true);
      setTimeout(() => setShowConfetti(false), 2500);
    }
    setTimeout(() => setToast(null), 2200); 
  }, []);

  const playersById = useMemo(() => Object.fromEntries(players.map((p) => [p.id, p])), [players]);

  const tournamentsWithData = useMemo(() => {
    return tournaments.map((t) => ({
      ...t,
      matches: matches.filter((m) => m.tournamentId === t.id),
      payments: payments.filter((p) => p.tournamentId === t.id),
    }));
  }, [tournaments, matches, payments]);

  const openTournament = useMemo(() => {
    return tournamentsWithData.find((t) => t.id === openTournamentId);
  }, [tournamentsWithData, openTournamentId]);

  // Auth Listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        try {
          const allowed = await isTeamMember(currentUser.email);
          if (allowed) {
            setUser(currentUser); setAuthError("");
          } else {
            await signOut(auth);
            setAuthError("Access Denied: You are not authorized to view the Tech Titans tracker.");
          }
        } catch (error) {
          await signOut(auth);
          setAuthError("Couldn't verify access. Please try signing in again.");
        }
      } else {
        setUser(null);
      }
      setAuthChecking(false);
    });
    return () => unsubscribe();
  }, []);

  // Firestore Sync - Atomic Root Collections
  useEffect(() => {
    if (!user) return;
    const unsubPlayers = onSnapshot(collection(db, "players"), (snapshot) => {
      setPlayers(snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id })));
    });
    const unsubTournaments = onSnapshot(collection(db, "tournaments"), (snapshot) => {
      setTournaments(snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id })));
    });
    const unsubPayments = onSnapshot(collection(db, "payments"), (snapshot) => {
      setPayments(snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id })));
    });
    const unsubMatches = onSnapshot(collection(db, "matches"), (snapshot) => {
      setMatches(snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id })));
    });
    return () => { unsubPlayers(); unsubTournaments(); unsubPayments(); unsubMatches(); };
  }, [user]);

  // Database Handlers
  const firebaseSavePlayer = async (playerData) => {
    const id = playerData.id || uid();
    await setDoc(doc(db, "players", id), { ...playerData, id });
  };
  const firebaseDeletePlayer = async (id) => { await deleteDoc(doc(db, "players", id)); };

  const firebaseSaveTournament = async (tournData) => {
    const id = tournData.id || uid();
    const { matches: m, payments: p, ...metadata } = tournData; 
    await setDoc(doc(db, "tournaments", id), { ...metadata, id });
  };

  const firebaseDeleteTournament = async (id) => {
    await deleteDoc(doc(db, "tournaments", id));
    const assocPayments = payments.filter(p => p.tournamentId === id);
    for (const pay of assocPayments) await deleteDoc(doc(db, "payments", pay.id));
    const assocMatches = matches.filter(m => m.tournamentId === id);
    for (const mat of assocMatches) await deleteDoc(doc(db, "matches", mat.id));
  };

  const firebaseSavePayment = async (paymentData) => {
    const id = paymentData.id || uid();
    await setDoc(doc(db, "payments", id), { ...paymentData, id });
  };
  const firebaseDeletePayment = async (id) => { await deleteDoc(doc(db, "payments", id)); };

  const firebaseSaveMatch = async (matchData, existingId, tournamentId) => {
    const id = existingId || matchData.id || uid();
    await setDoc(doc(db, "matches", id), { ...matchData, id, tournamentId });
  };
  const firebaseDeleteMatch = async (id) => { await deleteDoc(doc(db, "matches", id)); };

  const handleLogin = async () => {
    try { await signInWithPopup(auth, provider); } 
    catch (error) { setAuthError("Login failed. Try again."); }
  };

  if (payParams) return <PayPage params={payParams} />;

  if (authChecking) return <div className="ogc-root" style={{ height: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}><FontLoader />Loading...</div>;

  if (!user) {
    return (
      <div className="ogc-root" style={{ height: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 20 }}>
        <FontLoader />
        <div style={{ width: 100, height: 100, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 20, overflow: "hidden" }}>
          <img src={`${process.env.PUBLIC_URL}/logo.png`} style={{ width: "100%", height: "100%", objectFit: "contain" }} alt="Team Logo" />
        </div>
        <h1 className="ogc-display" style={{ fontSize: 36, marginBottom: 5 }}>TECH TITANS TRACKER</h1>
        <p style={{ color: "#6B6552", marginBottom: 30, textAlign: "center" }}>Sign in to manage team expenses and matches.</p>
        {authError && <div style={{ color: "var(--ball-red)", background: "#F6E1DE", padding: "10px 16px", borderRadius: 8, marginBottom: 20, fontSize: 13, fontWeight: 600, textAlign: "center", maxWidth: 300 }}>{authError}</div>}
        <Btn onClick={handleLogin} style={{ padding: "12px 24px", fontSize: 16 }}><Users size={18} /> Sign In with Google</Btn>
      </div>
    );
  }

  return (
    <>
    <div className="ogc-root" style={{ minHeight: "100vh", maxWidth: 480, margin: "0 auto", position: "relative", paddingBottom: 74, boxShadow: "0 0 0 1px var(--line-soft)" }}>
      <FontLoader />
      
      {/* HEADER SECTION WITH CRICKET THEME */}
      <div style={{ background: "linear-gradient(135deg, var(--pitch-green-deep) 0%, #374151 100%)", color: "#fff", padding: "18px 18px 22px", position: "relative", overflow: "hidden", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        {/* Cricket pitch lines decoration */}
        <div style={{ position: "absolute", left: "50%", top: 0, bottom: 0, width: 2, background: "rgba(255,255,255,0.08)", transform: "translateX(-50%)" }} />
        <div style={{ position: "absolute", left: "50%", top: "50%", width: 30, height: 30, border: "2px solid rgba(255,255,255,0.08)", borderRadius: "50%", transform: "translate(-50%, -50%)" }} />
        {/* Cricket ball decoration */}
        <div style={{ position: "absolute", right: -15, top: -15, width: 80, height: 80, borderRadius: "50%", background: "var(--pitch-green)", opacity: 0.2, boxShadow: "inset -5px -5px 15px rgba(0,0,0,0.2)" }} />
        <div style={{ position: "absolute", right: 10, top: 10, opacity: 0.15 }}>
          <CricketBall size={40} color="#fff" />
        </div>
        {/* Stumps decoration */}
        <div style={{ position: "absolute", left: 15, bottom: 5, opacity: 0.1 }}>
          <CricketStumps size={30} color="#fff" />
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12, position: "relative" }}>
          <div style={{ width: 42, height: 42, borderRadius: 12, background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", boxShadow: "0 4px 12px rgba(0,0,0,0.2)" }}>
            <img src={`${process.env.PUBLIC_URL}/logo.png`} style={{ width: "100%", height: "100%", objectFit: "contain" }} alt="Team Logo" />
          </div>
          <div>
            <div className="ogc-display" style={{ fontSize: 26, lineHeight: 1, display: "flex", alignItems: "center", gap: 8 }}>
              TECH TITANS
              <CricketBat size={18} color="var(--pitch-green)" />
            </div>
            <div style={{ fontSize: 11, opacity: 0.7, fontWeight: 500, marginTop: 2 }}>Logged in as {user.email.split('@')[0]}</div>
          </div>
        </div>
        <button onClick={() => signOut(auth)} className="ogc-btn" style={{ position: "relative", background: "rgba(255,255,255,0.15)", border: "none", color: "#fff", padding: "8px 14px", borderRadius: 8, fontSize: 12, cursor: "pointer", backdropFilter: "blur(4px)" }}>Sign Out</button>
      </div>

      <div style={{ padding: "14px 14px 4px" }}>
        {openTournament ? (
          <TournamentDetail
            tournament={openTournament} players={players} playersById={playersById}
            onBack={() => setOpenTournamentId(null)}
            onUpdate={firebaseSaveTournament}
            onDelete={(id) => { firebaseDeleteTournament(id); setOpenTournamentId(null); showToast("Tournament exported & deleted"); }}
            showToast={showToast}
            firebaseSavePlayer={firebaseSavePlayer}
            firebaseSavePayment={firebaseSavePayment}
            firebaseDeletePayment={firebaseDeletePayment}
            firebaseSaveMatch={firebaseSaveMatch}
            firebaseDeleteMatch={firebaseDeleteMatch}
          />
        ) : (
          <>
            {tab === "dashboard" && <Dashboard tournaments={tournamentsWithData} players={players} playersById={playersById} onOpenTournament={setOpenTournamentId} />}
            {tab === "tournaments" && <TournamentsTab tournaments={tournamentsWithData} players={players} onSave={firebaseSaveTournament} onOpen={setOpenTournamentId} showToast={showToast} />}
            {tab === "dues" && <DuesTab tournaments={tournamentsWithData} playersById={playersById} onOpenTournament={setOpenTournamentId} />}
            {tab === "players" && <PlayersTab players={players} tournaments={tournamentsWithData} onSave={firebaseSavePlayer} onDelete={firebaseDeletePlayer} showToast={showToast} />}
            {tab === "reports" && <ReportsTab tournaments={tournamentsWithData} players={players} playersById={playersById} />}
          </>
        )}
      </div>

      {!openTournament && (
        <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, background: "#fff", borderTop: "1px solid var(--line-soft)", display: "flex", padding: "8px 6px", boxShadow: "0 -4px 20px rgba(0,0,0,0.05)" }}>
          {[
            { id: "dashboard", label: "Dashboard", icon: BarChart3, cricketIcon: null }, 
            { id: "tournaments", label: "Tournaments", icon: null, cricketIcon: CricketTrophy }, 
            { id: "dues", label: "Dues", icon: IndianRupee, cricketIcon: null }, 
            { id: "players", label: "Players", icon: null, cricketIcon: CricketHelmet }, 
            { id: "reports", label: "Reports", icon: Wallet, cricketIcon: null }
          ].map((it) => {
            const active = tab === it.id;
            const Icon = it.cricketIcon || it.icon;
            return (
              <button key={it.id} onClick={() => setTab(it.id)} className="nav-btn" style={{ flex: 1, background: active ? "rgba(245, 158, 11, 0.1)" : "none", border: "none", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 3, padding: "8px 2px", color: active ? "var(--pitch-green)" : "#9C9680", borderRadius: 10 }}>
                <Icon size={22} strokeWidth={active ? 2.4 : 2} color={active ? "var(--pitch-green)" : "#9C9680"} />
                <span style={{ fontSize: 10, fontWeight: active ? 800 : 600 }}>{it.label}</span>
                {active && <div style={{ width: 4, height: 4, borderRadius: "50%", background: "var(--pitch-green)", marginTop: -2 }} />}
              </button>
            );
          })}
        </div>
      )}

      {toast && <div style={{ position: "fixed", bottom: 84, left: "50%", transform: "translateX(-50%)", background: "var(--pitch-ink)", color: "#fff", padding: "12px 20px", borderRadius: 999, fontSize: 13, fontWeight: 600, zIndex: 200, maxWidth: "90%", textAlign: "center", boxShadow: "0 4px 20px rgba(0,0,0,0.25)" }}>{toast}</div>}
    </div>
    {showConfetti && <Confetti />}
    </>
  );
}

/* ---------------------------------------------------------------------- */
/* Tabs & Components                                                     */
/* ---------------------------------------------------------------------- */
function Dashboard({ tournaments, players, playersById, onOpenTournament }) {
  const active = tournaments.filter((t) => t.status !== "Completed");
  const completed = tournaments.filter((t) => t.status === "Completed");
  let pendingSettlements = 0;
  completed.forEach((t) => {
    const stats = computeTournamentStats(t);
    pendingSettlements += stats.balances.filter((b) => Math.round(b.balance) !== 0).length;
  });
  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
        <Card style={{ position: "relative", overflow: "hidden" }}>
          <div style={{ position: "absolute", right: 8, top: 8, opacity: 0.15 }}><CricketBat size={32} color="var(--pitch-green)" /></div>
          <div className="ogc-display" style={{ fontSize: 34, color: "var(--pitch-green)", lineHeight: 1 }}>{active.length}</div>
          <div style={{ fontSize: 11.5, fontWeight: 700, color: "#6B6552", marginTop: 4, textTransform: "uppercase" }}>Active Tournaments</div>
        </Card>
        <Card style={{ position: "relative", overflow: "hidden" }}>
          <div style={{ position: "absolute", right: 8, top: 8, opacity: 0.15 }}><CricketTrophy size={32} color="#8A6A16" /></div>
          <div className="ogc-display" style={{ fontSize: 34, color: "#8A6A16", lineHeight: 1 }}>{completed.length}</div>
          <div style={{ fontSize: 11.5, fontWeight: 700, color: "#6B6552", marginTop: 4, textTransform: "uppercase" }}>Completed</div>
        </Card>
        <Card style={{ position: "relative", overflow: "hidden" }}>
          <div style={{ position: "absolute", right: 8, top: 8, opacity: 0.15 }}><CricketHelmet size={32} color="#5C5647" /></div>
          <div className="ogc-display" style={{ fontSize: 34, color: "#5C5647", lineHeight: 1 }}>{players.length}</div>
          <div style={{ fontSize: 11.5, fontWeight: 700, color: "#6B6552", marginTop: 4, textTransform: "uppercase" }}>Total Players</div>
        </Card>
        <Card style={{ position: "relative", overflow: "hidden" }}>
          <div style={{ position: "absolute", right: 8, top: 8, opacity: 0.15 }}><CricketBall size={32} color="var(--ball-red)" /></div>
          <div className="ogc-display" style={{ fontSize: 34, color: "var(--ball-red)", lineHeight: 1 }}>{pendingSettlements}</div>
          <div style={{ fontSize: 11.5, fontWeight: 700, color: "#6B6552", marginTop: 4, textTransform: "uppercase" }}>Pending Settlements</div>
        </Card>
      </div>
      <SectionTitle><span style={{ display: "flex", alignItems: "center", gap: 6 }}><CricketStumps size={14} /> Tournament Summary</span></SectionTitle>
      {tournaments.length === 0 ? (
        <EmptyState icon={Trophy} title="No tournaments yet" sub="Create one from the Tournaments tab." />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {tournaments.map((t) => {
            const stats = computeTournamentStats(t);
            return (
              <Card key={t.id} onClick={() => onOpenTournament(t.id)} style={{ cursor: "pointer" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div><div style={{ fontWeight: 800 }}>{t.name}</div><div style={{ fontSize: 12, color: "#8A836E", marginTop: 2 }}>{fmtDate(t.startDate)} · {stats.numMatches} matches</div></div>
                  <StatusPill status={t.status} />
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 10, fontSize: 13 }}>
                  <span className="ogc-mono">Fee {inr(t.totalFee)}</span><span className="ogc-mono">Collected {inr(stats.paidTotal)}</span>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

// Tournament-wise view of who still owes money ("Pending Payment") and who
// the treasurer still owes a refund to ("Refund Due"). Pulls from the same
// computeTournamentStats() balances used everywhere else - no separate data
// source. Only non-archived tournaments are shown, across all statuses
// (Upcoming/Ongoing/Completed), and only players who aren't yet settled are
// listed per tournament (settled players are omitted to keep it scannable).
function DuesTab({ tournaments, playersById, onOpenTournament }) {
  const rows = useMemo(() => {
    return tournaments
      .filter((t) => !t.archived)
      .map((t) => {
        const stats = computeTournamentStats(t);
        const pending = stats.balances.filter((b) => Math.round(b.balance) > 0).sort((a, b) => b.balance - a.balance);
        const refundsDue = stats.balances.filter((b) => Math.round(b.balance) < 0).sort((a, b) => a.balance - b.balance);
        const totalPending = pending.reduce((s, b) => s + b.balance, 0);
        const totalRefundsDue = refundsDue.reduce((s, b) => s - b.balance, 0);
        const collectedPct = t.totalFee > 0 ? Math.round((stats.paidTotal / t.totalFee) * 100) : null;
        return { t, stats, pending, refundsDue, totalPending, totalRefundsDue, collectedPct };
      })
      .sort((a, b) => (b.totalPending + b.totalRefundsDue) - (a.totalPending + a.totalRefundsDue));
  }, [tournaments]);

  const tournamentsWithDues = rows.filter((r) => r.pending.length > 0 || r.refundsDue.length > 0).length;

  return (
    <div>
      <SectionTitle>Dues by Tournament</SectionTitle>
      {rows.length === 0 ? (
        <EmptyState icon={IndianRupee} title="No tournaments yet" sub="Create a tournament to start tracking dues." />
      ) : (
        <>
          <Card style={{ marginBottom: 12, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#6B6552" }}>Tournaments with outstanding dues</div>
            <div className="ogc-display" style={{ fontSize: 30, lineHeight: 1, color: tournamentsWithDues ? "var(--ball-red)" : "var(--pitch-green)" }}>{tournamentsWithDues}</div>
          </Card>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {rows.map(({ t, stats, pending, refundsDue, totalPending, totalRefundsDue, collectedPct }) => (
              <Card key={t.id}>
                <div onClick={() => onOpenTournament(t.id)} style={{ cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div>
                    <div style={{ fontWeight: 800 }}>{t.name}</div>
                    <div style={{ fontSize: 12, color: "#8A836E", marginTop: 2 }}>{fmtDate(t.startDate)} · {stats.numMatches} match{stats.numMatches === 1 ? "" : "es"}</div>
                  </div>
                  <StatusPill status={t.status} />
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginTop: 12 }}>
                  <MiniStat label="Pending" value={inr(totalPending)} />
                  <MiniStat label="Refunds Due" value={inr(totalRefundsDue)} />
                  <MiniStat label="Collected" value={collectedPct === null ? "—" : `${collectedPct}%`} />
                </div>

                {pending.length === 0 && refundsDue.length === 0 ? (
                  <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, color: "var(--pitch-green)", fontWeight: 700 }}>
                    <CheckCircle2 size={14} /> Everyone's settled
                  </div>
                ) : (
                  <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 10 }}>
                    {pending.length > 0 && (
                      <div>
                        <div style={{ fontSize: 11, fontWeight: 800, color: "var(--ball-red)", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 6 }}>Pending Payment ({pending.length})</div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                          {pending.map((b) => (
                            <div key={b.playerId} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "var(--pitch-cream)", borderRadius: 8, padding: "6px 10px" }}>
                              <span style={{ fontSize: 13, fontWeight: 600 }}>{playersById[b.playerId]?.name || "Unknown"}</span>
                              <Pill tone="red">{inr(b.balance)}</Pill>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {refundsDue.length > 0 && (
                      <div>
                        <div style={{ fontSize: 11, fontWeight: 800, color: "#8A6A16", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 6 }}>Refund Due ({refundsDue.length})</div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                          {refundsDue.map((b) => (
                            <div key={b.playerId} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "var(--pitch-cream)", borderRadius: 8, padding: "6px 10px" }}>
                              <span style={{ fontSize: 13, fontWeight: 600 }}>{playersById[b.playerId]?.name || "Unknown"}</span>
                              <Pill tone="gold">{inr(-b.balance)}</Pill>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function TournamentsTab({ tournaments, players, onSave, onOpen, showToast }) {
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [filter, setFilter] = useState("All");
  const [showArchived, setShowArchived] = useState(false);
  const visible = tournaments.filter((t) => {
    if (!!t.archived !== showArchived) return false;
    if (filter !== "All" && t.status !== filter) return false;
    return true;
  });

  const handleSave = (data) => {
    onSave(editing ? { ...editing, ...data } : { archived: false, ...data });
    showToast(editing ? `Tournament "${data.name}" updated` : `Tournament "${data.name}" created successfully`);
    setShowForm(false); setEditing(null);
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <SectionTitle>Tournaments</SectionTitle>
        <Btn onClick={() => { setEditing(null); setShowForm(true); }}><Plus size={16} /> New</Btn>
      </div>
      <div style={{ display: "flex", gap: 6, marginBottom: 12, overflowX: "auto" }}>
        {["All", "Upcoming", "Ongoing", "Completed"].map((f) => (
          <button key={f} onClick={() => setFilter(f)} style={{ padding: "6px 12px", borderRadius: 999, border: "1.5px solid var(--line-soft)", fontSize: 12.5, fontWeight: 700, background: filter === f ? "var(--pitch-green)" : "#fff", color: filter === f ? "#fff" : "var(--pitch-ink)", cursor: "pointer", whiteSpace: "nowrap" }}>{f}</button>
        ))}
        <button onClick={() => setShowArchived((s) => !s)} style={{ padding: "6px 12px", borderRadius: 999, border: "1.5px solid var(--line-soft)", fontSize: 12.5, fontWeight: 700, background: showArchived ? "var(--stump-gold)" : "#fff", color: "var(--pitch-ink)", cursor: "pointer", whiteSpace: "nowrap", marginLeft: "auto" }}><Archive size={12} style={{ marginRight: 4, display: "inline" }} />{showArchived ? "Archived" : "Active"}</button>
      </div>
      {visible.length === 0 ? (
        <EmptyState icon={Trophy} title={showArchived ? "No archived tournaments" : "No tournaments here"} sub="Try a different filter, or create a new tournament." />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {visible.map((t) => {
            const stats = computeTournamentStats(t);
            return (
              <Card key={t.id}>
                <div onClick={() => onOpen(t.id)} style={{ cursor: "pointer" }}>
                  <div style={{ display: "flex", justifyContent: "space-between" }}><div style={{ fontWeight: 800 }}>{t.name}</div><StatusPill status={t.status} /></div>
                  <div style={{ fontSize: 12, color: "#8A836E", margin: "4px 0 8px" }}>{fmtDate(t.startDate)} — {fmtDate(t.endDate)}</div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}><span className="ogc-mono">Fee {inr(t.totalFee)}</span><span className="ogc-mono">{stats.numMatches} matches</span><ChevronRight size={16} color="#8A836E" /></div>
                </div>
                <div style={{ display: "flex", gap: 8, marginTop: 10, borderTop: "1px solid var(--line-soft)", paddingTop: 10 }}>
                  <Btn variant="ghost" style={{ padding: "5px 8px", fontSize: 12.5 }} onClick={() => { setEditing(t); setShowForm(true); }}>Edit</Btn>
                  <Btn variant="ghost" style={{ padding: "5px 8px", fontSize: 12.5 }} onClick={() => { 
                    onSave({ 
                      name: `${t.name} (Copy)`, 
                      startDate: t.startDate, 
                      endDate: t.endDate, 
                      totalFee: t.totalFee, 
                      status: "Upcoming", 
                      treasurerId: t.treasurerId,
                      archived: false 
                    }); 
                    showToast("Tournament cloned"); 
                  }}><Copy size={13} /> Clone</Btn>
                  <Btn variant="ghost" style={{ padding: "5px 8px", fontSize: 12.5 }} onClick={() => { onSave({ ...t, archived: !t.archived }); showToast(t.archived ? "Restored from archive" : "Archived"); }}><Archive size={13} /> {t.archived ? "Unarchive" : "Archive"}</Btn>
                </div>
              </Card>
            );
          })}
        </div>
      )}
      {showForm && (
        <Modal title={editing ? "Edit Tournament" : "New Tournament"} onClose={() => { setShowForm(false); setEditing(null); }}>
          <TournamentFormBody players={players} initial={editing} onSave={handleSave} />
        </Modal>
      )}
    </div>
  );
}

function TournamentFormBody({ players, initial, onSave }) {
  const [name, setName] = useState(initial?.name || "");
  const [startDate, setStartDate] = useState(initial?.startDate || "");
  const [endDate, setEndDate] = useState(initial?.endDate || "");
  const [totalFee, setTotalFee] = useState(initial?.totalFee ?? "");
  const [status, setStatus] = useState(initial?.status || "Upcoming");
  const [treasurerId, setTreasurerId] = useState(initial?.treasurerId || "");

  const canSave = name.trim() && startDate && totalFee !== "" && Number(totalFee) > 0 && treasurerId !== "";
  return (
    <>
      <Field label="Tournament name"><input style={inputStyle} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Summer Corporate League" /></Field>
      <Field label="Start date"><input type="date" style={inputStyle} value={startDate} onChange={(e) => setStartDate(e.target.value)} /></Field>
      <Field label="End date (optional)"><input type="date" style={inputStyle} value={endDate} onChange={(e) => setEndDate(e.target.value)} /></Field>
      <Field label="Total tournament fee (₹)"><input type="number" min="0" style={inputStyle} value={totalFee} onChange={(e) => setTotalFee(e.target.value)} /></Field>
      <Field label="Designated Treasurer">
        <select style={inputStyle} value={treasurerId} onChange={(e) => setTreasurerId(e.target.value)}>
          <option value="">Select a Treasurer...</option>
          {players.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </Field>
      <Field label="Status">
        <select style={inputStyle} value={status} onChange={(e) => setStatus(e.target.value)}><option>Upcoming</option><option>Ongoing</option><option>Completed</option></select>
      </Field>
      <Btn style={{ width: "100%", justifyContent: "center", marginTop: 8 }} disabled={!canSave} onClick={() => canSave && onSave({ name: name.trim(), startDate, endDate, totalFee: Number(totalFee), status, treasurerId })}><Check size={16} /> Save Tournament</Btn>
    </>
  );
}

function PlayersTab({ players, tournaments, onSave, onDelete, showToast }) {
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [q, setQ] = useState("");
  const filtered = players.filter((p) => p.name.toLowerCase().includes(q.toLowerCase()) || p.mobile.includes(q));

  const handleSave = (data) => {
    onSave(editing ? { ...editing, ...data } : { active: true, ...data });
    showToast(editing ? "Player updated" : "Player added");
    setShowForm(false); setEditing(null);
  };
  const handleRemove = (id) => {
    const inUse = tournaments.some((t) => (t.payments || []).some((p) => p.playerId === id) || (t.matches || []).some((m) => m.participantIds.includes(id)) || t.treasurerId === id);
    if (inUse) { showToast("Can't delete — player has recorded matches, payments, or is a Treasurer"); return; }
    onDelete(id); showToast("Player removed");
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <SectionTitle>Players</SectionTitle>
        <Btn onClick={() => { setEditing(null); setShowForm(true); }}><UserPlus size={16} /> Add</Btn>
      </div>
      <div style={{ position: "relative", marginBottom: 12 }}>
        <Search size={15} style={{ position: "absolute", left: 11, top: 12, color: "#9C9680" }} />
        <input style={{ ...inputStyle, paddingLeft: 32 }} placeholder="Search name or mobile" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      {filtered.length === 0 ? (
        <EmptyState icon={Users} title="No players found" sub="Add your first player to get started." />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {filtered.map((p) => (
            <Card key={p.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: 12 }}>
              <div><div style={{ fontWeight: 700, display: "flex", alignItems: "center", gap: 8 }}>{p.name} {!p.active && <Pill tone="grey">Inactive</Pill>}</div><div style={{ fontSize: 12.5, color: "#8A836E" }}>{p.mobile}</div></div>
              <div style={{ display: "flex", gap: 6 }}>
                <button onClick={() => { setEditing(p); setShowForm(true); }} style={{ background: "#EDEBE3", border: "none", borderRadius: 8, padding: "6px 10px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>Edit</button>
                <button onClick={() => handleRemove(p.id)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--ball-red)" }}><Trash2 size={16} /></button>
              </div>
            </Card>
          ))}
        </div>
      )}
      {showForm && (
        <Modal title={editing ? "Edit Player" : "Add Player"} onClose={() => { setShowForm(false); setEditing(null); }}>
          <PlayerFormBody initial={editing} onSave={handleSave} />
        </Modal>
      )}
    </div>
  );
}

function PlayerFormBody({ initial, onSave }) {
  const [name, setName] = useState(initial?.name || "");
  const [mobile, setMobile] = useState(initial?.mobile || "");
  const [upiId, setUpiId] = useState(initial?.upiId || "");
  const [active, setActive] = useState(initial?.active ?? true);
  const canSave = name.trim() && mobile.trim();
  return (
    <>
      <Field label="Name"><input style={inputStyle} value={name} onChange={(e) => setName(e.target.value)} placeholder="Player name" /></Field>
      <Field label="Mobile number"><input style={inputStyle} value={mobile} onChange={(e) => setMobile(e.target.value)} placeholder="e.g. 9876543210" /></Field>
      <Field label="UPI ID (only needed if this player will be a Treasurer)">
        <input style={inputStyle} value={upiId} onChange={(e) => setUpiId(e.target.value)} placeholder="e.g. name@upi or 9876543210@ybl" />
        <div style={{ fontSize: 11.5, color: "#8A836E", marginTop: 4 }}>Lets players pay them with one tap via PhonePe/GPay instead of typing the amount manually.</div>
      </Field>
      <label style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14, fontSize: 14, fontWeight: 600 }}><input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} /> Active player</label>
      <Btn style={{ width: "100%", justifyContent: "center" }} disabled={!canSave} onClick={() => canSave && onSave({ name: name.trim(), mobile: mobile.trim(), upiId: upiId.trim(), active })}><Check size={16} /> Save Player</Btn>
    </>
  );
}

function TournamentDetail({ 
  tournament, players, playersById, onBack, onUpdate, onDelete, showToast, 
  firebaseSavePayment, firebaseDeletePayment, firebaseSaveMatch, firebaseDeleteMatch, firebaseSavePlayer 
}){
  const [section, setSection] = useState("payments");
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [showMatchForm, setShowMatchForm] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmMatchDelete, setConfirmMatchDelete] = useState(null);
  const [showCloneMatchPicker, setShowCloneMatchPicker] = useState(false);
  const [waFilter, setWaFilter] = useState("all");
  const [waSort, setWaSort] = useState("desc");
  const [settlementFilter, setSettlementFilter] = useState("all");
  const [settlementSort, setSettlementSort] = useState("desc");
  const [paymentFilter, setPaymentFilter] = useState("all");
  const [paymentSort, setPaymentSort] = useState("desc");

  const stats = computeTournamentStats(tournament);
  // ⚠️ NEW: Replace P2P computeSettlement with Centralized Math
  const centralizedSettlement = computeCentralizedSettlement(tournament, stats, playersById);
  const remainingFee = tournament.totalFee - stats.paidTotal;

  const addPayment = (data) => { 
    firebaseSavePayment({ ...data, tournamentId: tournament.id }); 
    setShowPaymentForm(false); 
  };
  const removePayment = (id) => firebaseDeletePayment(id);

  // One-tap settle: records a real payment for the outstanding balance, so
  // paidTotal/reports/CSV all stay accurate automatically. Positive amount
  // = money received from the player; negative = a refund paid out to them.
  // Fully reversible - the generated entry can be deleted like any payment.
  const markSettled = (b) => {
    const amount = Math.round(b.balance);
    if (amount === 0) return;
    firebaseSavePayment({
      playerId: b.playerId,
      tournamentId: tournament.id,
      amount,
      date: new Date().toISOString().slice(0, 10),
      type: amount < 0 ? "refund" : "payment",
      note: amount < 0 ? "Marked as refunded from Settlement tab" : "Marked as received from Settlement tab",
    });
    const name = playersById[b.playerId]?.name || "Player";
    showToast(amount < 0 ? `Marked ${inr(-amount)} refunded to ${name}` : `Marked ${inr(amount)} received from ${name}`);
  };
  
  const saveMatch = (data, existingId) => {
    const isEdit = !!existingId;
    const isClone = !!showMatchForm?.cloneFrom;
    firebaseSaveMatch(data, existingId, tournament.id);
    setShowMatchForm(null);
    showToast(isEdit ? `Match "${data.name}" updated` : isClone ? `Match "${data.name}" cloned successfully` : `Match "${data.name}" added`);
  };
  const removeMatch = (id) => {
    firebaseDeleteMatch(id);
    setConfirmMatchDelete(null);
    showToast("Match deleted");
  };
  
  const cloneMatch = (sourceMatch) => {
    setShowCloneMatchPicker(false);
    setShowMatchForm({ 
      cloneFrom: sourceMatch,
      participantIds: sourceMatch.participantIds || []
    });
  };
  
  const exportCSV = () => downloadCSV(`${tournament.name.replace(/\s+/g, "_")}_export.csv`, tournamentCSVRows(tournament, playersById, stats, centralizedSettlement));
  
  return (
    <div>
      <button onClick={onBack} style={{ display: "flex", alignItems: "center", gap: 4, background: "none", border: "none", cursor: "pointer", color: "var(--pitch-green-deep)", fontWeight: 700, marginBottom: 10, padding: 0 }}><ArrowLeft size={16} /> All Tournaments</button>
      <Card style={{ marginBottom: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div><div className="ogc-display" style={{ fontSize: 24, lineHeight: 1 }}>{tournament.name}</div><div style={{ fontSize: 12.5, color: "#8A836E", marginTop: 4 }}>Treasurer: {playersById[tournament.treasurerId]?.name || "None"}</div></div>
          <StatusPill status={tournament.status} />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginTop: 14 }}>
          <MiniStat label="Total Fee" value={inr(tournament.totalFee)} /><MiniStat label="Collected" value={inr(stats.paidTotal)} /><MiniStat label="Per Match" value={stats.numMatches ? inr(stats.costPerMatch) : "—"} />
        </div>
        {remainingFee !== 0 && (
          <div style={{ marginTop: 10, fontSize: 12.5, display: "flex", alignItems: "center", gap: 6, color: remainingFee > 0 ? "var(--ball-red)" : "#8A6A16" }}><AlertTriangle size={14} />{remainingFee > 0 ? `${inr(remainingFee)} of the fee is not yet collected` : `${inr(-remainingFee)} collected over the total fee`}</div>
        )}
        <select value={tournament.status} onChange={(e) => onUpdate({ ...tournament, status: e.target.value })} style={{ ...inputStyle, marginTop: 12 }}>
          <option>Upcoming</option><option>Ongoing</option><option>Completed</option>
        </select>
        <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
          <Btn variant="outline" style={{ flex: 1, justifyContent: "center", fontSize: 12.5 }} onClick={exportCSV}><Download size={14} /> Export CSV</Btn>
          <Btn variant="danger" style={{ flex: 1, justifyContent: "center", fontSize: 12.5 }} onClick={() => setConfirmDelete(true)}><Trash2 size={14} /> Delete</Btn>
        </div>
      </Card>
      
      <div style={{ display: "flex", gap: 6, marginBottom: 12, overflowX: "auto" }}>
        {["payments", "matches", "settlement", "whatsapp"].map((s) => (
          <button key={s} onClick={() => setSection(s)} style={{ padding: "6px 13px", borderRadius: 999, border: "1.5px solid var(--line-soft)", fontSize: 12.5, fontWeight: 700, textTransform: "capitalize", background: section === s ? "var(--pitch-green)" : "#fff", color: section === s ? "#fff" : "var(--pitch-ink)", cursor: "pointer", whiteSpace: "nowrap" }}>{s}</button>
        ))}
      </div>

      {section === "payments" && (
        <div>
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 10 }}><Btn onClick={() => setShowPaymentForm(true)}><Plus size={15} /> Record Payment</Btn></div>
          {(tournament.payments || []).length === 0 ? <EmptyState icon={IndianRupee} title="No payments yet" sub="Record who paid the tournament fee." /> : (() => {
            const allPayments = tournament.payments || [];
            const paymentCount = allPayments.filter(p => p.type !== "refund").length;
            const refundCount = allPayments.filter(p => p.type === "refund").length;
            
            const filtered = allPayments.filter((p) => {
              if (paymentFilter === "payment") return p.type !== "refund";
              if (paymentFilter === "refund") return p.type === "refund";
              return true;
            });
            
            const sorted = [...filtered].sort((a, b) => {
              return paymentSort === "asc" ? a.amount - b.amount : b.amount - a.amount;
            });
            
            return (
              <>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 4 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 4, marginRight: 8 }}>
                    <Filter size={13} color="#8A836E" />
                    <span style={{ fontSize: 11, fontWeight: 700, color: "#8A836E", textTransform: "uppercase" }}>Type:</span>
                  </div>
                  {[
                    { id: "all", label: `All (${allPayments.length})` },
                    { id: "payment", label: `Payment (${paymentCount})` },
                    { id: "refund", label: `Refund (${refundCount})` }
                  ].map((f) => (
                    <button key={f.id} onClick={() => setPaymentFilter(f.id)} style={{ padding: "4px 10px", borderRadius: 999, border: "1.5px solid var(--line-soft)", fontSize: 11.5, fontWeight: 700, background: paymentFilter === f.id ? "var(--pitch-green)" : "#fff", color: paymentFilter === f.id ? "#fff" : "var(--pitch-ink)", cursor: "pointer", whiteSpace: "nowrap" }}>{f.label}</button>
                  ))}
                </div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 4, marginRight: 8 }}>
                    <ArrowUpDown size={13} color="#8A836E" />
                    <span style={{ fontSize: 11, fontWeight: 700, color: "#8A836E", textTransform: "uppercase" }}>Sort:</span>
                  </div>
                  {[
                    { id: "desc", label: "Amount (High to Low)" },
                    { id: "asc", label: "Amount (Low to High)" }
                  ].map((s) => (
                    <button key={s.id} onClick={() => setPaymentSort(s.id)} style={{ padding: "4px 10px", borderRadius: 999, border: "1.5px solid var(--line-soft)", fontSize: 11.5, fontWeight: 700, background: paymentSort === s.id ? "var(--pitch-green-deep)" : "#fff", color: paymentSort === s.id ? "#fff" : "var(--pitch-ink)", cursor: "pointer", whiteSpace: "nowrap" }}>{s.label}</button>
                  ))}
                </div>
                {filtered.length === 0 ? (
                  <EmptyState icon={IndianRupee} title={`No ${paymentFilter}s recorded`} sub="Try a different filter." />
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {sorted.map((p) => (
                      <Card key={p.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: 12 }}>
                        <div>
                          <div style={{ fontWeight: 700, display: "flex", alignItems: "center", gap: 6 }}>
                            {playersById[p.playerId]?.name || "Unknown"}
                            {p.type === "refund" ? <Pill tone="gold">Refund</Pill> : <Pill tone="green">Payment</Pill>}
                          </div>
                          <div style={{ fontSize: 12, color: "#8A836E" }}>{fmtDate(p.date)}</div>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}><span className="ogc-mono" style={{ fontWeight: 700 }}>{inr(p.amount)}</span><button onClick={() => removePayment(p.id)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--ball-red)" }}><Trash2 size={15} /></button></div>
                      </Card>
                    ))}
                  </div>
                )}
              </>
            );
          })()}
          {showPaymentForm && <Modal title="Record Payment" onClose={() => setShowPaymentForm(false)}><PaymentFormBody players={players} onSave={addPayment} /></Modal>}
        </div>
      )}

      {section === "matches" && (
        <div>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginBottom: 10 }}>
            {(tournament.matches || []).length > 0 && (
              <Btn variant="outline" onClick={() => setShowCloneMatchPicker(true)}><Copy size={15} /> Clone from Previous</Btn>
            )}
            <Btn onClick={() => setShowMatchForm({})}><Plus size={15} /> Add Match</Btn>
          </div>
          {(tournament.matches || []).length === 0 ? <EmptyState icon={Calendar} title="No matches yet" sub="Add matches as the tournament progresses." /> : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {[...stats.perMatch].sort((a, b) => new Date(a.date) - new Date(b.date)).map((m) => (
                <Card key={m.id} style={{ padding: 12 }}>
                  <div style={{ display: "flex", justifyContent: "space-between" }}><div style={{ fontWeight: 700 }}>{m.name}</div><span className="ogc-mono" style={{ fontSize: 12.5 }}>{inr(m.cost)} / match</span></div>
                  <div style={{ fontSize: 12, color: "#8A836E", margin: "3px 0 8px" }}>
                    {fmtDate(m.date)} · {m.participantCount} player(s) · {inr(m.perPlayer)}/player
                    {m.additionalAmount > 0 && ` · +${inr(m.additionalAmount)} extra`}
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 8 }}>
                    {m.participantIds.map((id) => <span key={id} style={{ fontSize: 11.5, background: "#EDEBE3", padding: "3px 8px", borderRadius: 999 }}>{playersById[id]?.name || "?"}</span>)}
                  </div>
                  <div style={{ display: "flex", gap: 8, borderTop: "1px solid var(--line-soft)", paddingTop: 8 }}>
                    <Btn variant="ghost" style={{ padding: "4px 8px", fontSize: 12 }} onClick={() => setShowMatchForm(m)}>Edit</Btn>
                    <Btn variant="ghost" style={{ padding: "4px 8px", fontSize: 12, color: "var(--ball-red)" }} onClick={() => setConfirmMatchDelete(m)}>Remove</Btn>
                  </div>
                </Card>
              ))}
            </div>
          )}
          {showMatchForm && (
            <Modal title={showMatchForm.id ? "Edit Match" : showMatchForm.cloneFrom ? "Clone Match" : "Add Match"} onClose={() => setShowMatchForm(null)}>
              <MatchFormBody 
                players={players} 
                firebaseSavePlayer={firebaseSavePlayer} 
                initial={showMatchForm.id ? showMatchForm : null} 
                cloneParticipants={showMatchForm.cloneFrom ? showMatchForm.participantIds : null}
                onSave={(data) => saveMatch(data, showMatchForm.id)} 
              />
            </Modal>
          )}
          {showCloneMatchPicker && (
            <Modal title="Select Match to Clone" onClose={() => setShowCloneMatchPicker(false)}>
              <p style={{ fontSize: 13, color: "#8A836E", marginBottom: 12 }}>Choose a match to clone. The players from that match will be pre-selected.</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {[...stats.perMatch].sort((a, b) => new Date(a.date) - new Date(b.date)).map((m) => (
                  <Card key={m.id} onClick={() => cloneMatch(m)} style={{ padding: 12, cursor: "pointer" }}>
                    <div style={{ fontWeight: 700 }}>{m.name}</div>
                    <div style={{ fontSize: 12, color: "#8A836E", marginTop: 2 }}>{fmtDate(m.date)} · {m.participantCount} player(s)</div>
                  </Card>
                ))}
              </div>
            </Modal>
          )}
          {confirmMatchDelete && (
            <Modal title="Delete Match?" onClose={() => setConfirmMatchDelete(null)}>
              <p style={{ fontSize: 14, lineHeight: 1.5, color: "#5C5647" }}>Are you sure you want to delete <b>{confirmMatchDelete.name}</b>? This will affect settlement calculations and can't be undone.</p>
              <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
                <Btn variant="ghost" style={{ flex: 1, justifyContent: "center" }} onClick={() => setConfirmMatchDelete(null)}>Cancel</Btn>
                <Btn variant="danger" style={{ flex: 1, justifyContent: "center" }} onClick={() => removeMatch(confirmMatchDelete.id)}><Trash2 size={14} /> Delete Match</Btn>
              </div>
            </Modal>
          )}
        </div>
      )}

      {section === "settlement" && (
        <div>
          {stats.balances.length === 0 ? <EmptyState icon={Wallet} title="Nothing to settle yet" sub="Add matches with participants first." /> : (() => {
            const allBalances = stats.balances;
            const owesCount = allBalances.filter(b => Math.round(b.balance) > 0).length;
            const refundCount = allBalances.filter(b => Math.round(b.balance) < 0).length;
            const settledCount = allBalances.filter(b => Math.round(b.balance) === 0).length;
            
            const filtered = allBalances.filter((b) => {
              const bal = Math.round(b.balance);
              if (settlementFilter === "owes") return bal > 0;
              if (settlementFilter === "refund") return bal < 0;
              if (settlementFilter === "settled") return bal === 0;
              return true;
            });
            
            const sorted = [...filtered].sort((a, b) => {
              const amtA = Math.abs(a.balance);
              const amtB = Math.abs(b.balance);
              return settlementSort === "asc" ? amtA - amtB : amtB - amtA;
            });
            
            return (
              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
                <SectionTitle>Centralized Ledger</SectionTitle>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 4 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 4, marginRight: 8 }}>
                    <Filter size={13} color="#8A836E" />
                    <span style={{ fontSize: 11, fontWeight: 700, color: "#8A836E", textTransform: "uppercase" }}>Status:</span>
                  </div>
                  {[
                    { id: "all", label: `All (${allBalances.length})` },
                    { id: "owes", label: `Owes (${owesCount})` },
                    { id: "refund", label: `Refund Due (${refundCount})` },
                    { id: "settled", label: `Settled (${settledCount})` }
                  ].map((f) => (
                    <button key={f.id} onClick={() => setSettlementFilter(f.id)} style={{ padding: "4px 10px", borderRadius: 999, border: "1.5px solid var(--line-soft)", fontSize: 11.5, fontWeight: 700, background: settlementFilter === f.id ? "var(--pitch-green)" : "#fff", color: settlementFilter === f.id ? "#fff" : "var(--pitch-ink)", cursor: "pointer", whiteSpace: "nowrap" }}>{f.label}</button>
                  ))}
                </div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 4, marginRight: 8 }}>
                    <ArrowUpDown size={13} color="#8A836E" />
                    <span style={{ fontSize: 11, fontWeight: 700, color: "#8A836E", textTransform: "uppercase" }}>Sort:</span>
                  </div>
                  {[
                    { id: "desc", label: "Amount (High to Low)" },
                    { id: "asc", label: "Amount (Low to High)" }
                  ].map((s) => (
                    <button key={s.id} onClick={() => setSettlementSort(s.id)} style={{ padding: "4px 10px", borderRadius: 999, border: "1.5px solid var(--line-soft)", fontSize: 11.5, fontWeight: 700, background: settlementSort === s.id ? "var(--pitch-green-deep)" : "#fff", color: settlementSort === s.id ? "#fff" : "var(--pitch-ink)", cursor: "pointer", whiteSpace: "nowrap" }}>{s.label}</button>
                  ))}
                </div>
                {filtered.length === 0 ? (
                  <EmptyState icon={Wallet} title={`No ${settlementFilter === "owes" ? "pending payments" : settlementFilter === "refund" ? "refunds due" : "settled players"}`} sub="Try a different filter." />
                ) : sorted.map((b) => {
                  const settled = Math.round(b.balance) === 0;
                  return (
                    <Card key={b.playerId} style={{ padding: 12 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div style={{ fontWeight: 700 }}>{playersById[b.playerId]?.name || "Unknown"}</div>
                        {settled ? <Pill tone="green"><CheckCircle2 size={11} style={{ marginRight: 3, display: "inline" }} />Settled</Pill> : b.balance > 0 ? <Pill tone="red">Owes {inr(b.balance)}</Pill> : <Pill tone="gold">Gets {inr(-b.balance)}</Pill>}
                      </div>
                      <div style={{ fontSize: 12, color: "#8A836E", marginTop: 4 }}>{b.matches.length} matches · Owed {inr(b.owed)} · Paid {inr(b.paid)}</div>
                      {!settled && (
                        <div style={{ marginTop: 8, borderTop: "1px solid var(--line-soft)", paddingTop: 8 }}>
                          <Btn variant="outline" style={{ padding: "5px 10px", fontSize: 12 }} onClick={() => markSettled(b)}>
                            <CheckCircle2 size={13} /> {b.balance > 0 ? "Mark Received" : "Mark Refunded"}
                          </Btn>
                        </div>
                      )}
                    </Card>
                  );
                })}
              </div>
            );
          })()}
        </div>
      )}

      {/* ⚠️ NEW: WhatsApp Tab with Click-to-Chat functionality */}
      {section === "whatsapp" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {tournament.status !== "Completed" ? <EmptyState icon={MessageCircle} title="Mark tournament as Completed" sub="WhatsApp summaries generate once the tournament is finished." /> : centralizedSettlement.length === 0 ? <EmptyState icon={MessageCircle} title="No player data yet" sub="Add matches and participants first." /> : (() => {
            const unsettled = centralizedSettlement.filter((b) => Math.round(b.balance) !== 0);
            if (unsettled.length === 0) return <EmptyState icon={CheckCircle2} title="Everyone is settled!" sub="No pending payments or refunds to notify." />;
            
            const filtered = unsettled.filter((b) => {
              if (waFilter === "due") return b.balance > 0;
              if (waFilter === "refund") return b.balance < 0;
              return true;
            });
            
            const sorted = [...filtered].sort((a, b) => {
              const amtA = Math.abs(a.balance);
              const amtB = Math.abs(b.balance);
              return waSort === "asc" ? amtA - amtB : amtB - amtA;
            });
            
            const dueCount = unsettled.filter((b) => b.balance > 0).length;
            const refundCount = unsettled.filter((b) => b.balance < 0).length;
            
            return (
              <>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 4 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 4, marginRight: 8 }}>
                    <Filter size={13} color="#8A836E" />
                    <span style={{ fontSize: 11, fontWeight: 700, color: "#8A836E", textTransform: "uppercase" }}>Filter:</span>
                  </div>
                  {[
                    { id: "all", label: `All (${unsettled.length})` },
                    { id: "due", label: `Due (${dueCount})` },
                    { id: "refund", label: `Refund (${refundCount})` }
                  ].map((f) => (
                    <button key={f.id} onClick={() => setWaFilter(f.id)} style={{ padding: "4px 10px", borderRadius: 999, border: "1.5px solid var(--line-soft)", fontSize: 11.5, fontWeight: 700, background: waFilter === f.id ? "var(--pitch-green)" : "#fff", color: waFilter === f.id ? "#fff" : "var(--pitch-ink)", cursor: "pointer", whiteSpace: "nowrap" }}>{f.label}</button>
                  ))}
                </div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 4, marginRight: 8 }}>
                    <ArrowUpDown size={13} color="#8A836E" />
                    <span style={{ fontSize: 11, fontWeight: 700, color: "#8A836E", textTransform: "uppercase" }}>Sort:</span>
                  </div>
                  {[
                    { id: "desc", label: "Amount (High to Low)" },
                    { id: "asc", label: "Amount (Low to High)" }
                  ].map((s) => (
                    <button key={s.id} onClick={() => setWaSort(s.id)} style={{ padding: "4px 10px", borderRadius: 999, border: "1.5px solid var(--line-soft)", fontSize: 11.5, fontWeight: 700, background: waSort === s.id ? "var(--pitch-green-deep)" : "#fff", color: waSort === s.id ? "#fff" : "var(--pitch-ink)", cursor: "pointer", whiteSpace: "nowrap" }}>{s.label}</button>
                  ))}
                </div>
                {filtered.length === 0 ? (
                  <EmptyState icon={MessageCircle} title={`No ${waFilter === "due" ? "pending dues" : "refunds"}`} sub="Try a different filter." />
                ) : sorted.map((b) => (
                  <Card key={b.playerId} style={{ padding: 12 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8, gap: 6 }}>
                      <div style={{ fontWeight: 700, display: "flex", alignItems: "center", gap: 6 }}>
                        {playersById[b.playerId]?.name}
                        {b.balance > 0 ? <Pill tone="red">{inr(b.balance)}</Pill> : <Pill tone="gold">{inr(-b.balance)}</Pill>}
                        {b.upiLink && <Pill tone="green"><IndianRupee size={11} style={{ marginRight: 3, display: "inline" }} />UPI</Pill>}
                      </div>
                      <a href={b.whatsappLink} target="_blank" rel="noopener noreferrer" style={{ background: "#25D366", color: "#fff", border: "none", borderRadius: 8, padding: "6px 10px", display: "flex", alignItems: "center", gap: 5, fontSize: 12, fontWeight: 700, cursor: "pointer", textDecoration: "none" }}><MessageCircle size={13} /> Send</a>
                    </div>
                    <pre style={{ whiteSpace: "pre-wrap", fontFamily: "inherit", fontSize: 12.5, margin: 0, color: "#5C5647", background: "var(--pitch-cream)", padding: 10, borderRadius: 8 }}>{b.message}</pre>
                  </Card>
                ))}
              </>
            );
          })()}
        </div>
      )}

      {confirmDelete && (
        <Modal title="Delete Tournament?" onClose={() => setConfirmDelete(false)}>
          <p style={{ fontSize: 14, lineHeight: 1.5, color: "#5C5647" }}>This will download a CSV backup of all matches, payments and settlement data for <b>{tournament.name}</b>, then permanently delete it. This can't be undone.</p>
          <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
            <Btn variant="ghost" style={{ flex: 1, justifyContent: "center" }} onClick={() => setConfirmDelete(false)}>Cancel</Btn>
            <Btn variant="danger" style={{ flex: 1, justifyContent: "center" }} onClick={() => { exportCSV(); onDelete(tournament.id); }}><Download size={14} /> Export & Delete</Btn>
          </div>
        </Modal>
      )}
    </div>
  );
}

function PaymentFormBody({ players, onSave }) {
  const [playerId, setPlayerId] = useState(players[0]?.id || "");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const canSave = playerId && amount !== "" && Number(amount) > 0;
  return (
    <>
      <Field label="Player">
        <select style={inputStyle} value={playerId} onChange={(e) => setPlayerId(e.target.value)}>
          {players.length === 0 && <option value="">Add a player first</option>}
          {players.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </Field>
      <Field label="Amount paid (₹)"><input type="number" style={inputStyle} value={amount} onChange={(e) => setAmount(e.target.value)} /></Field>
      <Field label="Payment date"><input type="date" style={inputStyle} value={date} onChange={(e) => setDate(e.target.value)} /></Field>
      <Btn style={{ width: "100%", justifyContent: "center" }} disabled={!canSave} onClick={() => canSave && onSave({ playerId, amount: Number(amount), date })}><Check size={16} /> Save Payment</Btn>
    </>
  );
}

function MatchFormBody({ players, firebaseSavePlayer, initial, cloneParticipants, onSave }) {
  const [name, setName] = useState(initial?.name || "");
  const [date, setDate] = useState(initial?.date || new Date().toISOString().slice(0, 10));
  const [participantIds, setParticipantIds] = useState(initial?.participantIds || cloneParticipants || []);
  const [additionalAmount, setAdditionalAmount] = useState(initial?.additionalAmount ?? "");
  const [quickAdd, setQuickAdd] = useState(false);
  const [qName, setQName] = useState(""); const [qMobile, setQMobile] = useState("");
  const [playerSearch, setPlayerSearch] = useState("");

  const toggle = (id) => setParticipantIds((ids) => ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]);
  const canSave = name.trim() && date && participantIds.length > 0;
  
  const sortedAndFilteredPlayers = useMemo(() => {
    return [...players]
      .sort((a, b) => a.name.localeCompare(b.name))
      .filter((p) => p.name.toLowerCase().includes(playerSearch.toLowerCase()));
  }, [players, playerSearch]);

  const addQuickPlayer = async () => {
    if (!qName.trim() || !qMobile.trim()) return;
    const newId = uid();
    await firebaseSavePlayer({ id: newId, name: qName.trim(), mobile: qMobile.trim(), active: true });
    setParticipantIds((ids) => [...ids, newId]);
    setQName(""); setQMobile(""); setQuickAdd(false);
  };

  return (
    <>
      <Field label="Match number / name"><input style={inputStyle} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Match 3 vs Titans" /></Field>
      <Field label="Match date"><input type="date" style={inputStyle} value={date} onChange={(e) => setDate(e.target.value)} /></Field>
      <Field label="Additional amount for this match (₹)">
        <input type="number" min="0" style={inputStyle} value={additionalAmount} onChange={(e) => setAdditionalAmount(e.target.value)} placeholder="0 — e.g. extra ball/umpire cost" />
        <div style={{ fontSize: 11.5, color: "#8A836E", marginTop: 4 }}>Optional. Split equally among participants on top of the base share.</div>
      </Field>
      
      <div style={{ fontSize: 12, fontWeight: 700, color: "#6B6552", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 8 }}>
        Participants ({participantIds.length} selected)
      </div>
      <div style={{ position: "relative", marginBottom: 8 }}>
        <Search size={15} style={{ position: "absolute", left: 11, top: 10, color: "#9C9680" }} />
        <input style={{ ...inputStyle, paddingLeft: 32 }} placeholder="Search players by name" value={playerSearch} onChange={(e) => setPlayerSearch(e.target.value)} />
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, maxHeight: 220, overflowY: "auto", padding: "4px 2px", marginBottom: 12, border: "1px solid var(--line-soft)", borderRadius: 8 }} className="ogc-scrollbar">
        {players.length === 0 ? (
          <div style={{ padding: 16, color: "#8A836E", fontSize: 13, width: "100%", textAlign: "center" }}>No players yet. Add players or import from Cricheroes.</div>
        ) : sortedAndFilteredPlayers.length === 0 ? (
          <div style={{ padding: 16, color: "#8A836E", fontSize: 13, width: "100%", textAlign: "center" }}>No players match "{playerSearch}"</div>
        ) : sortedAndFilteredPlayers.map((p) => {
          const sel = participantIds.includes(p.id);
          return <button key={p.id} onClick={() => toggle(p.id)} type="button" style={{ padding: "6px 12px", borderRadius: 999, border: `1.5px solid ${sel ? "var(--pitch-green)" : "var(--line-soft)"}`, background: sel ? "var(--pitch-green)" : "#fff", color: sel ? "#fff" : "var(--pitch-ink)", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>{p.name}</button>;
        })}
      </div>

      {!quickAdd ? (
        <button onClick={() => setQuickAdd(true)} style={{ background: "none", border: "none", color: "var(--pitch-green-deep)", fontWeight: 700, fontSize: 13, cursor: "pointer", padding: 0, marginBottom: 14, display: "flex", alignItems: "center", gap: 4 }}><UserPlus size={14} /> New player joining this match</button>
      ) : (
        <div style={{ border: "1.5px dashed var(--line-soft)", borderRadius: 10, padding: 10, marginBottom: 14 }}>
          <input style={{ ...inputStyle, marginBottom: 8 }} placeholder="Name" value={qName} onChange={(e) => setQName(e.target.value)} />
          <input style={{ ...inputStyle, marginBottom: 8 }} placeholder="Mobile" value={qMobile} onChange={(e) => setQMobile(e.target.value)} />
          <Btn variant="outline" style={{ width: "100%", justifyContent: "center", fontSize: 12.5 }} onClick={addQuickPlayer}>Add & Select</Btn>
        </div>
      )}
      <Btn style={{ width: "100%", justifyContent: "center" }} disabled={!canSave} onClick={() => canSave && onSave({ name: name.trim(), date, participantIds, additionalAmount: additionalAmount === "" ? 0 : Number(additionalAmount) })}><Check size={16} /> Save Match</Btn>
    </>
  );
}

function ReportsTab({ tournaments, players, playersById }) {
  const [report, setReport] = useState("expense");
  const perTournamentStats = tournaments.map((t) => ({ t, stats: computeTournamentStats(t) }));
  const playerAgg = {};
  players.forEach((p) => { playerAgg[p.id] = { owed: 0, paid: 0, matches: 0 }; });
  perTournamentStats.forEach(({ stats }) => {
    stats.balances.forEach((b) => {
      if (!playerAgg[b.playerId]) playerAgg[b.playerId] = { owed: 0, paid: 0, matches: 0 };
      playerAgg[b.playerId].owed += b.owed; playerAgg[b.playerId].paid += b.paid; playerAgg[b.playerId].matches += b.matches.length;
    });
  });
  const allPayments = [];
  tournaments.forEach((t) => (t.payments || []).forEach((p) => allPayments.push({ ...p, tournamentName: t.name })));
  allPayments.sort((a, b) => new Date(b.date) - new Date(a.date));

  return (
    <div>
      <SectionTitle>Reports</SectionTitle>
      <div style={{ display: "flex", gap: 6, marginBottom: 14, overflowX: "auto" }}>
        {[["expense", "Tournament Expense"], ["player", "Player-wise"], ["history", "Payment History"], ["outstanding", "Outstanding"], ["contrib", "Contributions"]].map(([id, label]) => (
          <button key={id} onClick={() => setReport(id)} style={{ padding: "6px 12px", borderRadius: 999, border: "1.5px solid var(--line-soft)", fontSize: 12, fontWeight: 700, background: report === id ? "var(--pitch-green)" : "#fff", color: report === id ? "#fff" : "var(--pitch-ink)", cursor: "pointer", whiteSpace: "nowrap" }}>{label}</button>
        ))}
      </div>

      {report === "expense" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {perTournamentStats.length === 0 && <EmptyState icon={Trophy} title="No tournaments yet" sub="" />}
          {perTournamentStats.map(({ t, stats }) => (
            <Card key={t.id} style={{ padding: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}><b>{t.name}</b><StatusPill status={t.status} /></div>
              <div style={{ fontSize: 12.5, color: "#8A836E", marginTop: 6, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4 }}>
                <span>Fee: <b className="ogc-mono">{inr(t.totalFee)}</b></span><span>Matches: <b>{stats.numMatches}</b></span>
                <span>Per match: <b className="ogc-mono">{stats.numMatches ? inr(stats.costPerMatch) : "—"}</b></span><span>Collected: <b className="ogc-mono">{inr(stats.paidTotal)}</b></span>
              </div>
            </Card>
          ))}
          {perTournamentStats.length > 0 && <Btn variant="outline" style={{ justifyContent: "center" }} onClick={() => downloadCSV("tournament_expense_report.csv", [["Tournament", "Status", "Fee", "Matches", "Per Match", "Collected"], ...perTournamentStats.map(({ t, stats }) => [t.name, t.status, t.totalFee, stats.numMatches, stats.costPerMatch, stats.paidTotal])])}><Download size={14} /> Export CSV</Btn>}
        </div>
      )}

      {report === "player" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {players.length === 0 && <EmptyState icon={Users} title="No players yet" sub="" />}
          {players.map((p) => {
            const a = playerAgg[p.id] || { owed: 0, paid: 0, matches: 0 };
            const bal = a.owed - a.paid;
            return (
              <Card key={p.id} style={{ padding: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}><b>{p.name}</b>{Math.round(bal) === 0 ? <Pill tone="green">Settled</Pill> : bal > 0 ? <Pill tone="red">Owes {inr(bal)}</Pill> : <Pill tone="gold">Gets {inr(-bal)}</Pill>}</div>
                <div style={{ fontSize: 12.5, color: "#8A836E", marginTop: 6 }}>{a.matches} matches · Owed {inr(a.owed)} · Paid {inr(a.paid)}</div>
              </Card>
            );
          })}
          {players.length > 0 && <Btn variant="outline" style={{ justifyContent: "center" }} onClick={() => downloadCSV("player_expense_report.csv", [["Player", "Mobile", "Matches", "Owed", "Paid", "Balance"], ...players.map((p) => { const a = playerAgg[p.id] || { owed: 0, paid: 0, matches: 0 }; return [p.name, p.mobile, a.matches, a.owed, a.paid, a.owed - a.paid]; })])}><Download size={14} /> Export CSV</Btn>}
        </div>
      )}

      {report === "history" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {allPayments.length === 0 && <EmptyState icon={IndianRupee} title="No payments recorded" sub="" />}
          {allPayments.map((p) => (
            <Card key={p.id} style={{ padding: 12, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div><div style={{ fontWeight: 700 }}>{playersById[p.playerId]?.name || "Unknown"}</div><div style={{ fontSize: 12, color: "#8A836E" }}>{p.tournamentName} · {fmtDate(p.date)}</div></div>
              <span className="ogc-mono" style={{ fontWeight: 700 }}>{inr(p.amount)}</span>
            </Card>
          ))}
          {allPayments.length > 0 && <Btn variant="outline" style={{ justifyContent: "center" }} onClick={() => downloadCSV("payment_history.csv", [["Player", "Tournament", "Amount", "Date"], ...allPayments.map((p) => [playersById[p.playerId]?.name, p.tournamentName, p.amount, p.date])])}><Download size={14} /> Export CSV</Btn>}
        </div>
      )}

      {report === "outstanding" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {players.filter((p) => Math.round((playerAgg[p.id]?.owed || 0) - (playerAgg[p.id]?.paid || 0)) > 0).map((p) => {
            const a = playerAgg[p.id];
            const bal = a.owed - a.paid;
            return <Card key={p.id} style={{ padding: 12, display: "flex", justifyContent: "space-between", alignItems: "center" }}><div><div style={{ fontWeight: 700 }}>{p.name}</div><div style={{ fontSize: 12, color: "#8A836E" }}>{p.mobile}</div></div><Pill tone="red">{inr(bal)}</Pill></Card>;
          })}
          {players.filter((p) => Math.round((playerAgg[p.id]?.owed || 0) - (playerAgg[p.id]?.paid || 0)) > 0).length === 0 && <EmptyState icon={CheckCircle2} title="No outstanding balances" sub="Everyone is settled up." />}
        </div>
      )}

      {report === "contrib" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {tournaments.length === 0 && <EmptyState icon={Wallet} title="No tournaments yet" sub="" />}
          {tournaments.map((t) => {
            const stats = computeTournamentStats(t);
            const contributorIds = [...new Set((t.payments || []).map((p) => p.playerId))];
            return (
              <Card key={t.id} style={{ padding: 12 }}>
                <b>{t.name}</b>
                <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 6 }}>
                  {contributorIds.map((pid) => {
                    const paid = (t.payments || []).filter((p) => p.playerId === pid).reduce((s, p) => s + p.amount, 0);
                    const b = stats.balances.find((x) => x.playerId === pid);
                    const bal = b ? b.owed - b.paid : -paid;
                    return <div key={pid} style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5 }}><span>{playersById[pid]?.name}</span><span className="ogc-mono">Paid {inr(paid)} {bal < 0 ? `· gets back ${inr(-bal)}` : bal > 0 ? `· owes more ${inr(bal)}` : "· settled"}</span></div>;
                  })}
                  {contributorIds.length === 0 && <span style={{ fontSize: 12.5, color: "#8A836E" }}>No contributions recorded</span>}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}