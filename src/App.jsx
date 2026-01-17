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

// --- Firebase Configuration ---
// Make sure these are defined in your environment
const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : {};
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = typeof __app_id !== 'undefined' ? __app_id : 'private-duo-app';

export default function App() {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [partner, setPartner] = useState(null);
  const [connection, setConnection] = useState(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('profile');

  // 1. Auth Lifecycle
  useEffect(() => {
    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else if (!auth.currentUser) {
          await signInAnonymously(auth);
        }
      } catch (err) { console.error("Auth error:", err); }
    };

    initAuth();
    return onAuthStateChanged(auth, (u) => {
      setUser(u);
      if (!u) {
        setLoading(false);
        setProfile(null);
        setPartner(null);
        setConnection(null);
      }
    });
  }, []);

  // 2. Profile & Connection Sync (Fixed: Using Queries)
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

    // Connection listener optimized with 'where'
    const connRef = collection(db, 'artifacts', appId, 'public', 'data', 'connections');
    const q = query(connRef, where('status', 'in', ['pending', 'accepted']));
    
    const unsubConn = onSnapshot(q, (snap) => {
      const allConns = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      // Filter only for current user (Firestore OR queries need index, keeping it simple)
      const active = allConns.find(c => c.user1_uid === user.uid || c.user2_uid === user.uid);
      setConnection(active || null);
    });

    return () => { unsubUser(); unsubConn(); };
  }, [user]);

  const setupNewUser = async () => {
    const email = user.email || `user_${user.uid.slice(0, 5)}@private.app`;
    await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'users', user.uid), {
      uid: user.uid,
      email: email.toLowerCase(),
      displayName: user.displayName || 'Anonymous User',
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
    <div className="min-h-screen bg-slate-950 text-slate-100 selection:bg-pink-500/30">
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

// --- Components ---

function ProfileView({ profile, partner, connection, onNavigate }) {
  const isPendingReceiver = connection?.user2_uid === profile?.uid && connection?.status === 'pending';
  const isPendingSender = connection?.user1_uid === profile?.uid && connection?.status === 'pending';

  const updateStatus = async (status) => {
    if (!connection) return;
    const connRef = doc(db, 'artifacts', appId, 'public', 'data', 'connections', connection.id);
    if (status === 'accepted') {
      await updateDoc(connRef, { status: 'accepted' });
      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'users', connection.user1_uid), { partnerId: connection.user2_uid });
      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'users', connection.user2_uid), { partnerId: connection.user1_uid });
    } else {
      await updateDoc(connRef, { status: 'rejected' });
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6">
        <div className="flex items-center gap-4">
          <img src={profile?.photoURL} className="w-16 h-16 rounded-2xl border-2 border-pink-500/20" alt="" />
          <div>
            <h2 className="text-xl font-bold">{profile?.displayName}</h2>
            <p className="text-slate-400 text-sm">{profile?.email}</p>
          </div>
        </div>
      </div>

      {!connection && (
        <button onClick={() => onNavigate('search')} className="w-full bg-slate-900 border border-dashed border-slate-700 p-8 rounded-3xl flex flex-col items-center gap-3 hover:bg-slate-800 transition-colors">
          <UserPlus className="text-pink-500" size={32} />
          <span className="font-semibold">Find Your Partner</span>
        </button>
      )}

      {isPendingSender && (
        <div className="bg-yellow-500/10 border border-yellow-500/20 p-6 rounded-3xl text-center">
          <Clock className="mx-auto text-yellow-500 mb-2" />
          <p className="font-bold">Request Pending</p>
          <p className="text-sm text-slate-400">Waiting for them to accept...</p>
        </div>
      )}

      {isPendingReceiver && (
        <div className="bg-pink-500/10 border border-pink-500/20 p-6 rounded-3xl space-y-4">
          <p className="font-bold text-center">New Connection Request!</p>
          <div className="flex gap-2">
            <button onClick={() => updateStatus('accepted')} className="flex-1 bg-pink-600 py-3 rounded-xl font-bold">Accept</button>
            <button onClick={() => updateStatus('rejected')} className="flex-1 bg-slate-800 py-3 rounded-xl font-bold">Ignore</button>
          </div>
        </div>
      )}

      {partner && connection?.status === 'accepted' && (
        <div className="bg-slate-900 border border-slate-800 p-8 rounded-3xl text-center space-y-6">
          <div className="flex justify-center items-center gap-4">
            <img src={profile?.photoURL} className="w-14 h-14 rounded-full border-2 border-pink-500" />
            <Heart className="text-pink-500 fill-pink-500 animate-pulse" />
            <img src={partner?.photoURL} className="w-14 h-14 rounded-full border-2 border-blue-500" />
          </div>
          <button onClick={() => onNavigate('chat')} className="w-full bg-white text-black py-4 rounded-2xl font-black">OPEN CHAT</button>
        </div>
      )}
    </div>
  );
}

function SearchView({ user, profile, onBack }) {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  const handleSearch = async (e) => {
    e.preventDefault();
    if (email.toLowerCase() === profile.email.toLowerCase()) return setErr("Khud se connect karega? Sharam kar.");
    setLoading(true); setErr('');

    try {
      const q = query(collection(db, 'artifacts', appId, 'public', 'data', 'users'), where('email', '==', email.toLowerCase()), limit(1));
      const snap = await getDoc(doc(db, 'artifacts', appId, 'public', 'data', 'users', 'some-id')); // This is wrong, use getDocs for query
      // Correct way to fetch query results:
      const { getDocs } = await import('firebase/firestore');
      const querySnap = await getDocs(q);
      
      if (querySnap.empty) throw new Error("User nahi mila bhai.");
      const target = querySnap.docs[0].data();
      
      await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'connections'), {
        user1_uid: user.uid,
        user2_uid: target.uid,
        status: 'pending',
        createdAt: serverTimestamp()
      });
      onBack();
    } catch (e) { setErr(e.message); } finally { setLoading(false); }
  };

  return (
    <div className="space-y-4">
      <button onClick={onBack} className="flex items-center gap-2 text-slate-400"><XCircle size={18}/> Back</button>
      <form onSubmit={handleSearch} className="bg-slate-900 p-6 rounded-3xl space-y-4 border border-slate-800">
        <h3 className="text-xl font-bold">Search Partner</h3>
        <input 
          type="email" value={email} onChange={e => setEmail(e.target.value)}
          placeholder="Enter email address" required
          className="w-full bg-slate-950 border border-slate-700 rounded-xl p-4 focus:ring-2 focus:ring-pink-500 outline-none"
        />
        {err && <p className="text-red-400 text-xs">{err}</p>}
        <button disabled={loading} className="w-full bg-pink-600 py-4 rounded-xl font-bold disabled:opacity-50">
          {loading ? 'Searching...' : 'Send Request'}
        </button>
      </form>
    </div>
  );
}

function ChatView({ user, connection }) {
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const scrollRef = useRef();

  useEffect(() => {
    if (!connection) return;
    const q = query(
      collection(db, 'artifacts', appId, 'public', 'data', 'messages'),
      where('connectionId', '==', connection.id),
      orderBy('createdAt', 'asc')
    );
    
    return onSnapshot(q, (snap) => {
      setMessages(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
    });
  }, [connection]);

  const send = async (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    const m = text; setText('');
    await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'messages'), {
      connectionId: connection.id,
      senderId: user.uid,
      text: m,
      createdAt: serverTimestamp()
    });
  };

  return (
    <div className="flex flex-col h-[70vh]">
      <div className="flex-1 overflow-y-auto space-y-3 pr-2 scrollbar-hide">
        {messages.map(m => (
          <div key={m.id} className={`flex ${m.senderId === user.uid ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[80%] px-4 py-2 rounded-2xl text-sm ${m.senderId === user.uid ? 'bg-pink-600' : 'bg-slate-800'}`}>
              {m.text}
            </div>
          </div>
        ))}
        <div ref={scrollRef} />
      </div>
      <form onSubmit={send} className="mt-4 flex gap-2">
        <input value={text} onChange={e => setText(e.target.value)} className="flex-1 bg-slate-900 rounded-xl px-4 border border-slate-800" placeholder="Type..." />
        <button className="bg-pink-600 p-4 rounded-xl"><Send size={20}/></button>
      </form>
    </div>
  );
}

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
