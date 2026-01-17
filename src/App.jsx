import React, { useState, useEffect, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  onAuthStateChanged, 
  signInAnonymously, 
  signInWithCustomToken,
  signOut 
} from 'firebase/auth';
import { 
  getFirestore, 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  serverTimestamp,
  query,
  where,
  orderBy,
  limit
} from 'firebase/firestore';
import { 
  Heart, Send, User, Search, LogOut, MessageCircle, 
  UserPlus, Clock, CheckCircle, XCircle, Lock, ShieldCheck 
} from 'lucide-react';

// --- Firebase Configuration (Fixed for Vite/Vercel) ---
const configRaw = import.meta.env.VITE_FIREBASE_CONFIG;
const firebaseConfig = configRaw ? JSON.parse(configRaw) : {};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = 'private-duo-app';

export default function App() {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [partner, setPartner] = useState(null);
  const [connection, setConnection] = useState(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('profile');

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      if (!u) {
        signInAnonymously(auth).catch(err => console.error("Auth error:", err));
        setLoading(false);
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;

    const userDocRef = doc(db, 'artifacts', appId, 'public', 'data', 'users', user.uid);
    const unsubUser = onSnapshot(userDocRef, (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setProfile(data);
        if (data.partnerId) fetchPartnerProfile(data.partnerId);
      } else {
        setupNewUser();
      }
      setLoading(false);
    });

    const connRef = collection(db, 'artifacts', appId, 'public', 'data', 'connections');
    const q = query(connRef, where('status', 'in', ['pending', 'accepted']));
    
    const unsubConn = onSnapshot(q, (snap) => {
      const allConns = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      const active = allConns.find(c => c.user1_uid === user.uid || c.user2_uid === user.uid);
      setConnection(active || null);
    });

    return () => { unsubUser(); unsubConn(); };
  }, [user]);

  const setupNewUser = async () => {
    if (!user) return;
    const email = user.email || `user_${user.uid.slice(0, 5)}@private.app`;
    await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'users', user.uid), {
      uid: user.uid,
      email: email.toLowerCase(),
      displayName: 'Anonymous User',
      photoURL: `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.uid}`,
      partnerId: null,
      createdAt: serverTimestamp()
    });
  };

  const fetchPartnerProfile = async (pId) => {
    const pSnap = await getDoc(doc(db, 'artifacts', appId, 'public', 'data', 'users', pId));
    if (pSnap.exists()) setPartner(pSnap.data());
  };

  if (loading) return <LoadingScreen />;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 selection:bg-pink-500/30 font-sans">
      <header className="fixed top-0 w-full z-50 bg-slate-900/80 backdrop-blur-md border-b border-slate-800 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Heart className="w-6 h-6 text-pink-500 fill-current" />
          <span className="font-bold text-xl tracking-tight">Duo</span>
        </div>
        {user && <button onClick={() => signOut(auth)} className="text-slate-400 hover:text-white"><LogOut size={20}/></button>}
      </header>

      <main className="pt-24 pb-24 max-w-lg mx-auto px-4">
        {view === 'profile' && <ProfileView profile={profile} partner={partner} connection={connection} onNavigate={setView} />}
        {view === 'search' && <SearchView user={user} profile={profile} connection={connection} onBack={() => setView('profile')} />}
        {view === 'chat' && <ChatView user={user} partner={partner} connection={connection} />}
      </main>

      {user && partner && connection?.status === 'accepted' && (
        <nav className="fixed bottom-6 left-1/2 -translate-x-1/2 w-[280px] bg-slate-900/90 backdrop-blur-xl border border-slate-700/50 rounded-2xl shadow-2xl p-2 flex justify-around">
          <NavButton active={view === 'profile'} icon={<User/>} label="Home" onClick={() => setView('profile')} />
          <NavButton active={view === 'chat'} icon={<MessageCircle/>} label="Chat" onClick={() => setView('chat')} />
        </nav>
      )}
    </div>
  );
}

// --- Sub-components (Keep existing UI logic but ensure tailwind classes are clean) ---
function NavButton({ active, icon, label, onClick }) {
  return (
    <button onClick={onClick} className={`flex flex-col items-center p-2 transition-colors ${active ? 'text-pink-500' : 'text-slate-500'}`}>
      {React.cloneElement(icon, { size: 24 })}
      <span className="text-[10px] font-bold uppercase mt-1">{label}</span>
    </button>
  );
}

function LoadingScreen() {
  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center">
      <div className="w-10 h-10 border-4 border-pink-500 border-t-transparent rounded-full animate-spin"></div>
    </div>
  );
}

// Note: Include ProfileView, SearchView, and ChatView from previous version here.
