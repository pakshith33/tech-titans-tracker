import React, { useState, useEffect, useMemo } from 'react';
import { auth, provider, db } from './firebase';
import { signInWithPopup, signOut, onAuthStateChanged } from 'firebase/auth';
import { collection, onSnapshot, doc, setDoc } from 'firebase/firestore';
import './App.css';

// 1. FRONTEND WHITELIST
const ALLOWED_EMAILS = ["techtitans.admin@gmail.com", "captain@techtitans.com"];

// 2. WHATSAPP FORMATTER (Forces +91 for Indian numbers)
const formatWhatsAppNumber = (rawNumber) => {
  if (!rawNumber) return "";
  const cleanNumber = rawNumber.replace(/\D/g, "");
  return cleanNumber.length === 10 ? `91${cleanNumber}` : cleanNumber;
};

function App() {
  const [user, setUser] = useState(null);
  const [accessDenied, setAccessDenied] = useState(false);
  
  // Database States
  const [players, setPlayers] = useState([]);
  const [tournaments, setTournaments] = useState([]);
  const [matches, setMatches] = useState([]);
  const [payments, setPayments] = useState([]);
  
  // Active View State
  const [activeTournament, setActiveTournament] = useState(null);

  // --- AUTHENTICATION LOGIC ---
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (currentUser) {
        if (ALLOWED_EMAILS.includes(currentUser.email)) {
          setUser(currentUser);
          setAccessDenied(false);
        } else {
          signOut(auth);
          setAccessDenied(true);
        }
      } else {
        setUser(null);
      }
    });
    return unsubscribe;
  }, []);

  const handleLogin = () => signInWithPopup(auth, provider);
  const handleLogout = () => signOut(auth);

  // --- DATA STREAMING (Firestore onSnapshot) ---
  useEffect(() => {
    if (!user) return;
    
    const unsubs = [
      onSnapshot(collection(db, "players"), (snap) => setPlayers(snap.docs.map(d => ({ id: d.id, ...d.data() })))),
      onSnapshot(collection(db, "tournaments"), (snap) => setTournaments(snap.docs.map(d => ({ id: d.id, ...d.data() })))),
      onSnapshot(collection(db, "matches"), (snap) => setMatches(snap.docs.map(d => ({ id: d.id, ...d.data() })))),
      onSnapshot(collection(db, "payments"), (snap) => setPayments(snap.docs.map(d => ({ id: d.id, ...d.data() }))))
    ];
    
    return () => unsubs.forEach(unsub => unsub());
  }, [user]);

  // --- MATHEMATICAL SETTLEMENT ENGINE ---
  const settlementData = useMemo(() => {
    if (!activeTournament || !players.length) return [];

    // Filter matches and payments for the active tournament
    const tourneyMatches = matches.filter(m => m.tournamentId === activeTournament.id);
    const tourneyPayments = payments.filter(p => p.tournamentId === activeTournament.id);

    // Identify the Treasurer
    const treasurer = players.find(p => p.id === activeTournament.treasurerId);
    const treasurerName = treasurer ? treasurer.name : "the Treasurer";

    // 1. Calculate Cost Per Match
    const costPerMatch = tourneyMatches.length > 0 ? (activeTournament.totalFee / tourneyMatches.length) : 0;

    // 2. Map Player Balances
    const balances = players.map(player => {
      // Calculate how much they owe based on attendance
      let amountOwed = 0;
      tourneyMatches.forEach(match => {
        if (match.participantIds.includes(player.id)) {
          amountOwed += (costPerMatch / match.participantIds.length);
        }
      });

      // Calculate how much they have already paid
      const amountPaid = tourneyPayments
        .filter(p => p.playerId === player.id)
        .reduce((sum, p) => sum + p.amount, 0);

      const netBalance = amountOwed - amountPaid;
      let exactAmount = Math.abs(netBalance).toFixed(0);
      let settlementMessage = "";

      // Centralized Treasurer Logic
      if (netBalance > 1) { // Owes money
        settlementMessage = `Hi ${player.name}, the tournament fee breakdown is ready. You owe ₹${exactAmount}. Please send this directly to ${treasurerName}.`;
      } else if (netBalance < -1) { // Overpaid (Refund due)
        settlementMessage = `Hi ${player.name}, the tournament fee breakdown is ready. You overpaid by ₹${exactAmount}. ${treasurerName} will transfer this refund to you shortly.`;
      } else {
        settlementMessage = `Hi ${player.name}, your tournament fee breakdown is ready. Your balance is perfectly settled!`;
      }

      const waNumber = formatWhatsAppNumber(player.mobile);
      const waLink = `https://wa.me/${waNumber}?text=${encodeURIComponent(settlementMessage)}`;

      return {
        ...player,
        netBalance,
        message: settlementMessage,
        whatsappLink: waLink
      };
    });

    return balances;
  }, [activeTournament, players, matches, payments]);

  // --- RENDER UI ---
  if (!user) {
    return (
      <div className="login-screen">
        <h1>Tech Titans Tracker</h1>
        {accessDenied && <p style={{color: 'red'}}>Access Denied. You are not on the whitelist.</p>}
        <button onClick={handleLogin}>Sign In with Google</button>
      </div>
    );
  }

  return (
    <div className="dashboard">
      <header>
        <h2>Welcome to Tech Titans, {user.displayName}</h2>
        <button onClick={handleLogout}>Log Out</button>
      </header>

      {/* TOURNAMENT SELECTOR (Example simplified view) */}
      <section>
        <h3>Active Tournament Data</h3>
        <select onChange={(e) => setActiveTournament(tournaments.find(t => t.id === e.target.value))}>
          <option value="">Select Tournament...</option>
          {tournaments.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
      </section>

      {/* SETTLEMENT & WHATSAPP DASHBOARD */}
      {activeTournament && (
        <section className="settlement-dashboard">
          <h3>Settlements (Treasurer: {players.find(p => p.id === activeTournament.treasurerId)?.name || 'None Set'})</h3>
          
          <div className="ledger">
            {settlementData.map(record => (
              <div key={record.id} style={{ border: '1px solid #ccc', margin: '10px', padding: '10px' }}>
                <p><strong>{record.name}</strong></p>
                <p>{record.message}</p>
                <a 
                  href={record.whatsappLink} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  style={{ display: 'inline-block', padding: '8px 12px', background: '#25D366', color: '#fff', textDecoration: 'none', borderRadius: '4px' }}
                >
                  Send via WhatsApp
                </a>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

export default App;