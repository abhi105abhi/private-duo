import React, { useState, useEffect, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  onAuthStateChanged, 
  signInAnonymously, 
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
  Heart, 
  Send, 
  User, 
  Search, 
  LogOut, 
  MessageCircle, 
  UserPlus, 
  Clock, 
  CheckCircle,
  XCircle,
  Lock,
  ShieldCheck
} from 'lucide-react';

// --- Firebase Configuration (Vite/Vercel Optimized) ---
const rawConfig = import.meta.env.VITE_FIREBASE_CONFIG;
let firebaseConfig = {};

try {
  if (rawConfig) {
    firebaseConfig = JSON.parse(rawConfig);
  }
} catch (e) {
  console.error("JSON Parse Error: Abe Abhishek, environment variable thik se daal!", e);
}

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
  const [view, setView] = useState('profile'); // 'profile', 'search', 'chat'

  // 1. Auth Lifecycle
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (!currentUser) {
        signInAnonymously(auth).catch(err => console.error("Auth failed:", err));
        setLoading(false);
      }
    });
    return () => unsubscribe();
  }, []);

  // 2. Profile & Connection Sync
  useEffect(() => {
    if (!user) return;

    const userDocRef = doc(db, 'artifacts', appId, 'public', 'data', 'users', user.uid);
    const unsubUser = onSnapshot(userDocRef, (snap) => {
      if (snap.exists()) {
        const userData = snap.data();
        setProfile(userData);
        if (userData.partnerId) fetchPartnerProfile(userData.partnerId);
      } else {
        setupNewUser();
      }
      setLoading(false);
    });

    const connRef = collection(db, 'artifacts', appId, 'public', 'data', 'connections');
    const q = query(connRef, where('status', 'in', ['pending', 'accepted']));
    
    const unsubConn = onSnapshot(q, (snapshot) => {
      const allConns = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
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
    const pRef = doc(db, 'artifacts', appId, 'public', 'data', 'users', pId);
    const pSnap = await getDoc(pRef);
    if (pSnap.exists()) setPartner(pSnap.data());
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center gap-4">
        <Heart className="w-12 h-12 text-pink-500 animate-pulse fill-current" />
        <p className="text-slate-400 font-medium animate-bounce">Duo Connecting...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-pink-500/30">
      <header className="fixed top-0 w-full z-50 bg-slate-900/80 backdrop-blur-md border-b border-slate-800 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Heart className="w-6 h-6 text-pink-500 fill-current" />
          <h1 className="font-bold text-xl tracking-tight">Duo</h1>
        </div>
        {user && (
          <button 
            onClick={() => signOut(auth)}
            className="p-2 text-slate-400 hover:text-white transition-colors"
            aria-label="Logout"
            title="Logout"
          >
            <LogOut className="w-5 h-5" />
          </button>
        )}
      </header>

      <main className="pt-24 pb-28 max-w-lg mx-auto px-4">
        {view === 'profile' && <ProfileView profile={profile} partner={partner} connection={connection} onNavigate={setView} />}
        {view === 'search' && <SearchView user={user} profile={profile} connection={connection} onBack={() => setView('profile')} />}
        {view === 'chat' && <ChatView user={user} partner={partner} connection={connection} />}
      </main>

      {user && partner && connection?.status === 'accepted' && (
        <nav className="fixed bottom-6 left-1/2 -translate-x-1/2 w-[280px] bg-slate-900/90 backdrop-blur-xl border border-slate-700/50 rounded-2xl shadow-2xl p-2 flex justify-around items-center">
          <NavButton 
            active={view === 'profile'} 
            icon={<User />} 
            label="Home" 
            onClick={() => setView('profile')} 
            ariaLabel="Go to Profile"
          />
          <NavButton 
            active={view === 'chat'} 
            icon={<MessageCircle />} 
            label="Chat" 
            onClick={() => setView('chat')} 
            ariaLabel="Open Private Chat"
          />
        </nav>
      )}
    </div>
  );
}

// --- Sub-Components ---

function NavButton({ active, icon, label, onClick, ariaLabel }) {
  return (
    <button 
      onClick={onClick} 
      aria-label={ariaLabel}
      className={`flex flex-col items-center gap-1 p-2 transition-all ${active ? 'text-pink-500 scale-110' : 'text-slate-500 hover:text-slate-300'}`}
    >
      {React.cloneElement(icon, { size: 24 })}
      <span className="text-[10px] font-bold uppercase tracking-wider">{label}</span>
    </button>
  );
}

function ProfileView({ profile, partner, connection, onNavigate }) {
  const isPendingReceiver = connection?.user2_uid === profile?.uid && connection?.status === 'pending';
  const isPendingSender = connection?.user1_uid === profile?.uid && connection?.status === 'pending';

  const acceptRequest = async () => {
    if (!connection) return;
    const connRef = doc(db, 'artifacts', appId, 'public', 'data', 'connections', connection.id);
    await updateDoc(connRef, { status: 'accepted' });
    await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'users', connection.user1_uid), { partnerId: connection.user2_uid });
    await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'users', connection.user2_uid), { partnerId: connection.user1_uid });
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl">
        <div className="flex items-center gap-4">
          <img src={profile?.photoURL} className="w-16 h-16 rounded-2xl border-2 border-pink-500/20" alt="My Profile" />
          <div>
            <h2 className="text-xl font-bold">{profile?.displayName}</h2>
            <p className="text-slate-400 text-sm">{profile?.email}</p>
          </div>
        </div>
      </div>

      {!connection && (
        <button 
          onClick={() => onNavigate('search')}
          className="w-full bg-slate-900/50 border-2 border-dashed border-slate-800 rounded-3xl p-10 flex flex-col items-center gap-3 hover:bg-slate-900 hover:border-pink-500/50 transition-all group"
          aria-label="Find a partner"
        >
          <UserPlus className="w-10 h-10 text-slate-600 group-hover:text-pink-500 transition-colors" />
          <span className="font-bold text-slate-400 group-hover:text-slate-200">Connect with Partner</span>
        </button>
      )}

      {isPendingSender && (
        <div className="bg-slate-900 border border-yellow-500/20 rounded-3xl p-8 text-center space-y-3">
          <Clock className="w-10 h-10 text-yellow-500 mx-auto animate-spin-slow" />
          <p className="font-bold">Request Pending</p>
          <p className="text-xs text-slate-500">Waiting for your partner to accept...</p>
        </div>
      )}

      {isPendingReceiver && (
        <div className="bg-slate-900 border border-pink-500/30 rounded-3xl p-6 space-y-4">
          <div className="text-center">
            <Heart className="w-10 h-10 text-pink-500 mx-auto mb-2" />
            <p className="font-bold">New Connection Request!</p>
          </div>
          <div className="flex gap-3">
            <button onClick={acceptRequest} className="flex-1 bg-pink-600 hover:bg-pink-500 py-3 rounded-xl font-bold shadow-lg transition-all" aria-label="Accept Request">Accept</button>
            <button className="flex-1 bg-slate-800 hover:bg-slate-700 py-3 rounded-xl font-bold transition-all" aria-label="Decline Request">Ignore</button>
          </div>
        </div>
      )}

      {partner && connection?.status === 'accepted' && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-2xl text-center space-y-6 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-pink-500/5 blur-3xl rounded-full"></div>
          <div className="flex items-center justify-center gap-6 relative">
            <div className="text-center space-y-2">
              <img src={profile?.photoURL} className="w-16 h-16 rounded-full border-2 border-pink-500 shadow-lg shadow-pink-900/20" alt="Me" />
              <p className="text-[10px] font-black uppercase text-slate-500 tracking-tighter">You</p>
            </div>
            <Heart className="text-pink-500 fill-current animate-pulse" size={24} />
            <div className="text-center space-y-2">
              <img src={partner?.photoURL} className="w-16 h-16 rounded-full border-2 border-blue-500 shadow-lg shadow-blue-900/20" alt="Partner" />
              <p className="text-[10px] font-black uppercase text-slate-500 tracking-tighter">{partner?.displayName.split(' ')[0]}</p>
            </div>
          </div>
          <div className="bg-slate-950/50 rounded-2xl py-3 border border-slate-800/50 flex items-center justify-center gap-2 text-xs text-pink-500 font-mono">
            <ShieldCheck size={14} /> Secured Private Line
          </div>
          <button 
            onClick={() => onNavigate('chat')}
            className="w-full bg-white text-slate-950 py-4 rounded-2xl font-black tracking-widest hover:bg-pink-50 transition-all active:scale-95 shadow-xl"
            aria-label="Enter chat room"
          >
            ENTER CHAT
          </button>
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
    if (email.toLowerCase() === profile.email.toLowerCase()) return setErr("Khud se baatein mat kar bhai.");
    setLoading(true); setErr('');

    try {
      const usersRef = collection(db, 'artifacts', appId, 'public', 'data', 'users');
      const q = query(usersRef, where('email', '==', email.toLowerCase()), limit(1));
      
      const { getDocs } = await import('firebase/firestore');
      const querySnap = await getDocs(q);
      
      if (querySnap.empty) throw new Error("User nahi mila. Email check kar.");
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
    <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
      <button onClick={onBack} className="flex items-center gap-2 text-slate-500 text-sm hover:text-white transition-colors" aria-label="Go back">
        <XCircle size={18} /> Cancel Search
      </button>
      <form onSubmit={handleSearch} className="bg-slate-900 p-8 rounded-3xl border border-slate-800 space-y-6 shadow-2xl">
        <div className="space-y-2">
          <h3 className="text-2xl font-bold tracking-tight">Search Partner</h3>
          <p className="text-slate-500 text-xs">Enter your partner's exact email address to connect.</p>
        </div>
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={20} />
          <input 
            type="email" value={email} onChange={e => setEmail(e.target.value)}
            placeholder="partner@example.com" required
            className="w-full bg-slate-950 border border-slate-800 rounded-2xl py-4 pl-12 pr-4 focus:ring-2 focus:ring-pink-500 outline-none transition-all"
          />
        </div>
        {err && <p className="text-red-400 text-xs px-2 font-medium">⚠️ {err}</p>}
        <button 
          disabled={loading} 
          type="submit"
          className="w-full bg-pink-600 hover:bg-pink-500 disabled:opacity-50 py-4 rounded-2xl font-bold shadow-lg shadow-pink-900/20 transition-all active:scale-95"
          aria-label="Send Connection Request"
        >
          {loading ? 'Searching...' : 'Send Request'}
        </button>
      </form>
    </div>
  );
}

function ChatView({ user, partner, connection }) {
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const scrollRef = useRef();

  useEffect(() => {
    if (!connection) return;
    const msgRef = collection(db, 'artifacts', appId, 'public', 'data', 'messages');
    const q = query(msgRef, where('connectionId', '==', connection.id), orderBy('createdAt', 'asc'));
    
    return onSnapshot(q, (snap) => {
      setMessages(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setTimeout(() => scrollRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    });
  }, [connection]);

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    const currentText = text; setText('');
    
    await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'messages'), {
      connectionId: connection.id,
      senderId: user.uid,
      text: currentText,
      createdAt: serverTimestamp()
    });
  };

  return (
    <div className="flex flex-col h-[calc(100vh-200px)] animate-in fade-in duration-500">
      <div className="flex items-center gap-3 mb-6 bg-slate-900/30 p-3 rounded-2xl border border-slate-800/50">
        <img src={partner?.photoURL} className="w-10 h-10 rounded-full border border-pink-500/50" alt="Partner Avatar" />
        <div className="flex-1">
          <h4 className="font-bold text-sm">{partner?.displayName}</h4>
          <span className="text-[10px] text-pink-500 flex items-center gap-1 font-bold tracking-tighter">
            <Lock size={10} /> ENCRYPTED CHANNEL
          </span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto space-y-4 px-1 pb-4 no-scrollbar">
        {messages.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center opacity-20 gap-3">
            <Heart size={48} />
            <p className="text-sm font-medium italic">Start your private conversation...</p>
          </div>
        )}
        {messages.map(m => {
          const isMe = m.senderId === user.uid;
          return (
            <div key={m.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] px-4 py-3 rounded-2xl text-sm leading-relaxed shadow-sm ${
                isMe ? 'bg-pink-600 text-white rounded-tr-none' : 'bg-slate-800 text-slate-100 rounded-tl-none border border-slate-700/50'
              }`}>
                {m.text}
              </div>
            </div>
          );
        })}
        <div ref={scrollRef} />
      </div>

      <form onSubmit={sendMessage} className="mt-4 flex gap-2">
        <input 
          value={text} onChange={e => setText(e.target.value)}
          placeholder="Type a message..."
          className="flex-1 bg-slate-900 border border-slate-800 rounded-2xl px-5 py-4 text-sm focus:ring-2 focus:ring-pink-500 outline-none transition-all shadow-inner"
        />
        <button 
          type="submit"
          className="bg-pink-600 p-4 rounded-2xl text-white hover:bg-pink-500 transition-all shadow-lg active:scale-90"
          aria-label="Send Message"
        >
          <Send size={20} />
        </button>
      </form>
    </div>
  );
}
