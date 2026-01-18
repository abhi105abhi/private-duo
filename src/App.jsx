import React, { useState, useEffect, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, onAuthStateChanged, signInAnonymously, signOut } from 'firebase/auth';
import { getFirestore, collection, doc, setDoc, getDoc, onSnapshot, addDoc, updateDoc, serverTimestamp, query, where, orderBy } from 'firebase/firestore';
import { Heart, Send, User, MessageCircle, LogOut, UserPlus, Search, XCircle, CheckCircle } from 'lucide-react';

// Firebase Logic - Fixed for Vercel
const rawConfig = import.meta.env.VITE_FIREBASE_CONFIG;
const firebaseConfig = rawConfig ? JSON.parse(rawConfig) : {};
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = 'private-duo-app';

export default function App() {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [partner, setPartner] = useState(null);
  const [connection, setConnection] = useState(null);
  const [view, setView] = useState('profile');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    return onAuthStateChanged(auth, (u) => {
      setUser(u);
      if (!u) {
        signInAnonymously(auth).catch(console.error);
        setLoading(false);
      }
    });
  }, []);

  useEffect(() => {
    if (!user) return;
    const userRef = doc(db, 'artifacts', appId, 'public', 'data', 'users', user.uid);
    const unsubUser = onSnapshot(userRef, (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setProfile(data);
        if (data.partnerId) fetchPartner(data.partnerId);
      } else { createProfile(); }
      setLoading(false);
    });

    const connRef = collection(db, 'artifacts', appId, 'public', 'data', 'connections');
    const q = query(connRef, where('status', 'in', ['pending', 'accepted']));
    const unsubConn = onSnapshot(q, (snap) => {
      const all = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      const active = all.find(c => c.user1_uid === user.uid || c.user2_uid === user.uid);
      setConnection(active || null);
    });

    return () => { unsubUser(); unsubConn(); };
  }, [user]);

  const createProfile = async () => {
    await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'users', user.uid), {
      uid: user.uid,
      email: user.email || `user_${user.uid.slice(0,4)}@duo.app`.toLowerCase(),
      displayName: 'Anonymous',
      photoURL: `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.uid}`,
      partnerId: null,
      createdAt: serverTimestamp()
    });
  };

  const fetchPartner = async (id) => {
    const pSnap = await getDoc(doc(db, 'artifacts', appId, 'public', 'data', 'users', id));
    if (pSnap.exists()) setPartner(pSnap.data());
  };

  if (loading) return <div className="min-h-screen bg-slate-950 flex items-center justify-center text-pink-500 font-bold">Connecting...</div>;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      <header className="p-4 bg-slate-900/50 backdrop-blur-md border-b border-slate-800 flex justify-between items-center fixed top-0 w-full z-10">
        <div className="flex items-center gap-2 font-bold text-lg text-pink-500"><Heart className="fill-current" size={20}/> Duo</div>
        <button onClick={() => signOut(auth)} className="text-slate-500"><LogOut size={20}/></button>
      </header>

      <main className="flex-1 pt-20 px-4 max-w-md mx-auto w-full pb-24">
        {view === 'profile' && <ProfileView profile={profile} partner={partner} connection={connection} setView={setView} />}
        {view === 'search' && <SearchView user={user} profile={profile} onBack={() => setView('profile')} />}
        {view === 'chat' && <ChatView user={user} connection={connection} partner={partner} />}
      </main>

      {partner && connection?.status === 'accepted' && (
        <nav className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-slate-900 border border-slate-800 rounded-2xl flex gap-10 px-8 py-3 shadow-2xl">
          <button onClick={() => setView('profile')} className={view === 'profile' ? 'text-pink-500' : 'text-slate-500'}><User/></button>
          <button onClick={() => setView('chat')} className={view === 'chat' ? 'text-pink-500' : 'text-slate-500'}><MessageCircle/></button>
        </nav>
      )}
    </div>
  );
}

// Sub-components: ProfileView, SearchView, ChatView (as provided previously)
// --- Internal Views ---

function ProfileView({ profile, partner, connection, setView }) {
  const isPendingReceiver = connection?.user2_uid === profile?.uid && connection?.status === 'pending';
  
  const accept = async () => {
    const connRef = doc(db, 'artifacts', appId, 'public', 'data', 'connections', connection.id);
    await updateDoc(connRef, { status: 'accepted' });
    await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'users', connection.user1_uid), { partnerId: connection.user2_uid });
    await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'users', connection.user2_uid), { partnerId: connection.user1_uid });
  };

  return (
    <div className="space-y-6">
      <div className="bg-slate-900 p-6 rounded-3xl border border-slate-800">
        <div className="flex items-center gap-4">
          <img src={profile?.photoURL} className="w-14 h-14 rounded-xl" alt="" />
          <div><h2 className="font-bold">{profile?.displayName}</h2><p className="text-xs text-slate-400">{profile?.email}</p></div>
        </div>
      </div>
      {!connection && <button onClick={() => setView('search')} className="w-full border-2 border-dashed border-slate-800 p-8 rounded-3xl text-slate-500 font-bold hover:bg-slate-900 transition">Find Partner</button>}
      {isPendingReceiver && (
        <div className="bg-pink-500/10 p-6 rounded-3xl border border-pink-500/20 text-center space-y-4">
          <p className="text-sm font-bold">New Connection Request!</p>
          <button onClick={accept} className="w-full bg-pink-600 py-3 rounded-xl font-bold">Accept</button>
        </div>
      )}
      {partner && (
        <div className="bg-slate-900 p-8 rounded-3xl text-center space-y-4">
          <div className="flex justify-center items-center gap-4">
            <img src={profile?.photoURL} className="w-12 h-12 rounded-full border-2 border-pink-500" />
            <Heart className="text-pink-500 fill-current animate-pulse" size={20}/>
            <img src={partner?.photoURL} className="w-12 h-12 rounded-full border-2 border-blue-500" />
          </div>
          <button onClick={() => setView('chat')} className="w-full bg-white text-black py-3 rounded-xl font-bold">START CHAT</button>
        </div>
      )}
    </div>
  );
}

function SearchView({ user, profile, onBack }) {
  const [email, setEmail] = useState('');
  const [err, setErr] = useState('');

  const search = async (e) => {
    e.preventDefault();
    if (email === profile.email) return setErr("Apne aap se baat karega?");
    const qUser = query(collection(db, 'artifacts', appId, 'public', 'data', 'users'), where('email', '==', email.toLowerCase()), limit(1));
    const { getDocs } = await import('firebase/firestore');
    const snap = await getDocs(qUser);
    if (snap.empty) return setErr("User nahi mila.");
    const target = snap.docs[0].data();
    await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'connections'), {
      user1_uid: user.uid, user2_uid: target.uid, status: 'pending', createdAt: serverTimestamp()
    });
    onBack();
  };

  return (
    <div className="space-y-4">
      <button onClick={onBack} className="text-slate-500 flex items-center gap-1 text-sm"><XCircle size={16}/> Back</button>
      <form onSubmit={search} className="bg-slate-900 p-6 rounded-3xl border border-slate-800 space-y-4">
        <h3 className="font-bold text-lg">Find Partner</h3>
        <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Email..." className="w-full bg-slate-950 p-4 rounded-xl outline-none border border-slate-700 focus:border-pink-500" required />
        {err && <p className="text-red-400 text-xs">{err}</p>}
        <button className="w-full bg-pink-600 py-4 rounded-xl font-bold shadow-lg shadow-pink-900/20">Send Request</button>
      </form>
    </div>
  );
}

function ChatView({ user, connection }) {
  const [msgs, setMsgs] = useState([]);
  const [text, setText] = useState('');
  const endRef = useRef();

  useEffect(() => {
    const q = query(collection(db, 'artifacts', appId, 'public', 'data', 'messages'), where('connectionId', '==', connection.id), orderBy('createdAt', 'asc'));
    return onSnapshot(q, (snap) => {
      setMsgs(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      endRef.current?.scrollIntoView({ behavior: 'smooth' });
    });
  }, [connection]);

  const send = async (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    const t = text; setText('');
    await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'messages'), {
      connectionId: connection.id, senderId: user.uid, text: t, createdAt: serverTimestamp()
    });
  };

  return (
    <div className="flex flex-col h-[75vh]">
      <div className="flex-1 overflow-y-auto space-y-4 pr-2">
        {msgs.map(m => (
          <div key={m.id} className={`flex ${m.senderId === user.uid ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[80%] p-3 px-4 rounded-2xl text-sm ${m.senderId === user.uid ? 'bg-pink-600 rounded-tr-none' : 'bg-slate-800 rounded-tl-none'}`}>{m.text}</div>
          </div>
        ))}
        <div ref={endRef} />
      </div>
      <form onSubmit={send} className="mt-4 flex gap-2">
        <input value={text} onChange={e => setText(e.target.value)} className="flex-1 bg-slate-900 rounded-xl px-4 border border-slate-800" placeholder="Type..." />
        <button className="bg-pink-600 p-4 rounded-xl"><Send size={18}/></button>
      </form>
    </div>
  );
}

