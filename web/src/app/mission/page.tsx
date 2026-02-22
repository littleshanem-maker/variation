'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase';

// PIN Protection
const PIN = '1234';

export default function MissionControl() {
  const [locked, setLocked] = useState(true);
  const [pinInput, setPinInput] = useState('');
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<string>('');

  useEffect(() => {
    // Check local storage for session
    const session = localStorage.getItem('mission_session');
    if (session === 'active') setLocked(false);
  }, []);

  useEffect(() => {
    if (!locked) fetchData();
    const interval = setInterval(fetchData, 30000); // Poll every 30s
    return () => clearInterval(interval);
  }, [locked]);

  async function fetchData() {
    const supabase = createClient();
    const { data: store, error } = await supabase
      .from('mission_store')
      .select('data, updated_at')
      .eq('id', 'latest')
      .single();

    if (store && store.data) {
      setData(store.data);
      setLastUpdated(new Date(store.updated_at).toLocaleTimeString());
      setLoading(false);
    }
  }

  function handleUnlock(e: React.FormEvent) {
    e.preventDefault();
    if (pinInput === PIN) {
      setLocked(false);
      localStorage.setItem('mission_session', 'active');
      fetchData();
    } else {
      alert('Access Denied');
      setPinInput('');
    }
  }

  if (locked) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center font-mono">
        <form onSubmit={handleUnlock} className="text-center space-y-4">
          <h1 className="text-2xl tracking-[0.2em] uppercase text-red-500 mb-8">Restricted Access</h1>
          <input 
            type="password" 
            value={pinInput}
            onChange={(e) => setPinInput(e.target.value)}
            className="bg-gray-900 border border-gray-700 text-center text-xl p-2 w-40 rounded focus:border-red-500 outline-none"
            placeholder="PIN"
            autoFocus
          />
          <button type="submit" className="block w-full bg-red-900/30 text-red-400 py-2 rounded hover:bg-red-900/50 transition">
            ENTER
          </button>
        </form>
      </div>
    );
  }

  if (loading || !data) {
    return <div className="min-h-screen bg-black text-gray-500 flex items-center justify-center font-mono">INITIALIZING UPLINK...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-900 text-gray-300 font-sans selection:bg-blue-500/30">
      {/* Header */}
      <header className="border-b border-gray-800 bg-black/50 backdrop-blur sticky top-0 z-10">
        <div className="max-w-[1600px] mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse shadow-[0_0_10px_#22c55e]" />
            <h1 className="text-lg font-bold tracking-wider text-white uppercase">Mission Control</h1>
            <span className="text-xs text-gray-500 border border-gray-700 px-2 py-0.5 rounded">LIVE</span>
          </div>
          <div className="text-xs font-mono text-gray-500">
            SYNC: {lastUpdated}
          </div>
        </div>
      </header>

      <main className="max-w-[1600px] mx-auto p-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* COL 1: STRATEGY */}
        <div className="space-y-6">
          <Section title="Strategy" icon="🎯">
            <div className="prose prose-invert prose-sm max-w-none">
              <h3 className="text-blue-400 text-xs uppercase tracking-widest font-bold mb-2">Current Mission</h3>
              <p className="text-gray-300 whitespace-pre-line leading-relaxed">{data.strategy?.mission}</p>
              
              <h3 className="text-purple-400 text-xs uppercase tracking-widest font-bold mt-6 mb-2">Strategic Focus</h3>
              <p className="text-gray-300 whitespace-pre-line leading-relaxed">{data.strategy?.strategy}</p>
            </div>
          </Section>

          <Section title="Tactical Sprint" icon="⚡">
            <div className="space-y-3">
              <h4 className="text-xs uppercase text-yellow-500 font-bold tracking-wider">In Progress</h4>
              <ul className="space-y-2">
                {data.tactics?.inProgress?.map((task: string, i: number) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-white bg-yellow-500/10 p-2 rounded border border-yellow-500/20">
                    <span className="text-yellow-500 mt-0.5">►</span>
                    {task}
                  </li>
                ))}
              </ul>
              
              {data.tactics?.blocked?.length > 0 && (
                <>
                  <h4 className="text-xs uppercase text-red-500 font-bold tracking-wider mt-4">Blocked</h4>
                  <ul className="space-y-2">
                    {data.tactics?.blocked?.map((task: string, i: number) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-red-300 bg-red-900/20 p-2 rounded border border-red-900/30">
                        <span>⛔</span> {task}
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          </Section>
        </div>

        {/* COL 2: OPERATIONS (KANBAN) */}
        <div className="space-y-6">
          <Section title="Operations (Kanban)" icon="🏗️">
            <div className="space-y-6">
              {/* Doing */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xs uppercase text-blue-400 font-bold tracking-wider">In Progress</h3>
                  <span className="text-xs bg-blue-900/30 text-blue-300 px-2 py-0.5 rounded-full">{data.kanban?.inProgress?.length || 0}</span>
                </div>
                <div className="space-y-2">
                  {data.kanban?.inProgress?.map((item: string, i: number) => (
                    <Card key={i} text={item} status="doing" />
                  ))}
                  {(!data.kanban?.inProgress || data.kanban.inProgress.length === 0) && (
                    <div className="text-sm text-gray-600 italic px-2">No active tasks</div>
                  )}
                </div>
              </div>

              {/* Backlog Preview */}
              <div>
                <div className="flex items-center justify-between mb-3 border-t border-gray-800 pt-4">
                  <h3 className="text-xs uppercase text-gray-500 font-bold tracking-wider">Up Next</h3>
                  <span className="text-xs bg-gray-800 text-gray-400 px-2 py-0.5 rounded-full">{data.kanban?.backlog?.length || 0}</span>
                </div>
                <div className="space-y-2 opacity-70">
                  {data.kanban?.backlog?.slice(0, 5).map((item: string, i: number) => (
                    <Card key={i} text={item} status="todo" />
                  ))}
                </div>
              </div>
            </div>
          </Section>
        </div>

        {/* COL 3: CONTENT & COMMS */}
        <div className="space-y-6">
          <Section title="Content Queue" icon="📡">
             <div className="space-y-3">
                {data.content?.map((item: any, i: number) => (
                  <div key={i} className="bg-gray-800/50 border border-gray-700 p-3 rounded flex items-center justify-between">
                    <div>
                      <div className="text-sm font-medium text-white">{item.title}</div>
                      <div className="text-xs text-gray-500">{item.date}</div>
                    </div>
                    <span className={`text-xs px-2 py-1 rounded ${
                      item.status === 'Posted' ? 'bg-green-900/30 text-green-400' : 'bg-blue-900/30 text-blue-400'
                    }`}>
                      {item.status}
                    </span>
                  </div>
                ))}
                {(!data.content || data.content.length === 0) && (
                  <div className="text-sm text-gray-500">Queue empty</div>
                )}
             </div>
          </Section>

          <Section title="System Status" icon="🖥️">
             <div className="grid grid-cols-2 gap-3">
               <StatusIndicator label="Vercel App" status="operational" />
               <StatusIndicator label="Supabase DB" status="operational" />
               <StatusIndicator label="LinkedIn" status="active" />
               <StatusIndicator label="MailerLite" status="pending" />
             </div>
          </Section>
        </div>

      </main>
    </div>
  );
}

function Section({ title, icon, children }: { title: string, icon: string, children: React.ReactNode }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-lg overflow-hidden shadow-sm">
      <div className="bg-gray-800/50 px-4 py-3 border-b border-gray-800 flex items-center gap-2">
        <span>{icon}</span>
        <h2 className="text-sm font-semibold text-gray-200 uppercase tracking-wide">{title}</h2>
      </div>
      <div className="p-4">
        {children}
      </div>
    </div>
  );
}

function Card({ text, status }: { text: string, status: 'doing' | 'todo' | 'done' }) {
  const border = status === 'doing' ? 'border-l-2 border-l-blue-500' : 'border-l-2 border-l-gray-600';
  return (
    <div className={`bg-gray-800 p-3 rounded text-sm text-gray-300 ${border} shadow-sm`}>
      {text}
    </div>
  );
}

function StatusIndicator({ label, status }: { label: string, status: 'operational' | 'degraded' | 'down' | 'active' | 'pending' }) {
  const colors = {
    operational: 'bg-green-500',
    active: 'bg-green-500',
    degraded: 'bg-yellow-500',
    pending: 'bg-yellow-500',
    down: 'bg-red-500'
  };
  
  return (
    <div className="bg-gray-800 p-3 rounded border border-gray-700 flex items-center justify-between">
      <span className="text-xs font-medium text-gray-400">{label}</span>
      <div className={`w-2 h-2 rounded-full ${colors[status] || 'bg-gray-500'} shadow-[0_0_8px_currentColor]`} />
    </div>
  );
}
