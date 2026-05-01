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
      alert('Access denied');
      setPinInput('');
    }
  }

  if (locked) {
    return (
      <div className="min-h-screen bg-[#17212B] text-[#FFFCF5] flex items-center justify-center">
        <form onSubmit={handleUnlock} className="text-center space-y-4">
          <h1 className="text-2xl tracking-[0.2em] uppercase text-[#B42318] mb-8">Restricted access</h1>
          <input
            type="password"
            value={pinInput}
            onChange={(e) => setPinInput(e.target.value)}
            className="bg-[#111827] border border-[#334155] text-center text-xl p-2 w-40 rounded focus:border-[#B42318] outline-none"
            placeholder="PIN"
            autoFocus
          />
          <button type="submit" className="block w-full bg-[#FBE6E4] text-[#7A1810] py-2 rounded hover:bg-[#B42318] hover:text-[#FFFCF5] transition">
            Enter
          </button>
        </form>
      </div>
    );
  }

  if (loading || !data) {
    return <div className="min-h-screen bg-[#17212B] text-[#4B5563] flex items-center justify-center">Initializing uplink...</div>;
  }

  return (
    <div className="min-h-screen bg-[#17212B] text-[#D8D2C4] font-sans selection:bg-[#E76F00]/20">
      {/* Header */}
      <header className="border-b border-[#334155] bg-[#111827]/70 backdrop-blur sticky top-0 z-10">
        <div className="max-w-[1600px] mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-3 h-3 bg-[#2E7D32] rounded-full animate-pulse" />
            <h1 className="text-lg font-medium tracking-wide text-[#FFFCF5]">Mission control</h1>
            <span className="cond text-xs text-[#4B5563] border border-[#334155] px-2 py-0.5 rounded">Live</span>
          </div>
          <div className="num text-xs text-[#4B5563]">
            SYNC: {lastUpdated}
          </div>
        </div>
      </header>

      <main className="max-w-[1600px] mx-auto p-6 grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* COL 1: STRATEGY */}
        <div className="space-y-6">
          <Section title="Strategy" icon="🎯">
            <div className="prose prose-invert prose-sm max-w-none">
              <h3 className="cond text-[#E76F00] text-xs mb-2">Current mission</h3>
              <p className="text-[#D8D2C4] whitespace-pre-line leading-relaxed">{data.strategy?.mission}</p>

              <h3 className="cond text-[#8C6500] text-xs mt-6 mb-2">Strategic focus</h3>
              <p className="text-[#D8D2C4] whitespace-pre-line leading-relaxed">{data.strategy?.strategy}</p>
            </div>
          </Section>

          <Section title="Tactical Sprint" icon="⚡">
            <div className="space-y-3">
              <h4 className="cond text-xs text-[#8C6500]">In progress</h4>
              <ul className="space-y-2">
                {data.tactics?.inProgress?.map((task: string, i: number) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-[#FFFCF5] bg-[#FBF1D6] p-2 rounded border border-[#D8D2C4]">
                    <span className="text-[#8C6500] mt-0.5">►</span>
                    {task}
                  </li>
                ))}
              </ul>

              {data.tactics?.blocked?.length > 0 && (
                <>
                  <h4 className="cond text-xs text-[#B42318] mt-4">Blocked</h4>
                  <ul className="space-y-2">
                    {data.tactics?.blocked?.map((task: string, i: number) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-[#FBE6E4] bg-[#FBE6E4] p-2 rounded border border-[#D8D2C4]">
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
                  <h3 className="cond text-xs text-[#E76F00]">In progress</h3>
                  <span className="num text-xs bg-[#FBF1D6] text-[#8C6500] px-2 py-0.5 rounded-full">{data.kanban?.inProgress?.length || 0}</span>
                </div>
                <div className="space-y-2">
                  {data.kanban?.inProgress?.map((item: string, i: number) => (
                    <Card key={i} text={item} status="doing" />
                  ))}
                  {(!data.kanban?.inProgress || data.kanban.inProgress.length === 0) && (
                    <div className="text-sm text-[#334155] italic px-2">No active tasks</div>
                  )}
                </div>
              </div>

              {/* Backlog Preview */}
              <div>
                <div className="flex items-center justify-between mb-3 border-t border-[#334155] pt-4">
                  <h3 className="cond text-xs text-[#4B5563]">Up next</h3>
                  <span className="num text-xs bg-[#111827] text-[#4B5563] px-2 py-0.5 rounded-full">{data.kanban?.backlog?.length || 0}</span>
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
                  <div key={i} className="bg-[#334155] border border-[#334155] p-3 rounded flex items-center justify-between">
                    <div>
                      <div className="text-sm font-medium text-[#FFFCF5]">{item.title}</div>
                      <div className="text-xs text-[#4B5563]">{item.date}</div>
                    </div>
                    <span className={`cond text-xs px-2 py-1 rounded ${
                      item.status === 'Posted' ? 'bg-[#E5F0E6] text-[#1F5223]' : 'bg-[#FBF1D6] text-[#8C6500]'
                    }`}>
                      {item.status}
                    </span>
                  </div>
                ))}
                {(!data.content || data.content.length === 0) && (
                  <div className="text-sm text-[#4B5563]">Queue empty</div>
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
    <div className="bg-[#111827] border border-[#334155] rounded-lg overflow-hidden shadow-sm">
      <div className="bg-[#17212B] px-4 py-3 border-b border-[#334155] flex items-center gap-2">
        <span>{icon}</span>
        <h2 className="text-sm font-medium text-[#FFFCF5]">{title}</h2>
      </div>
      <div className="p-4">
        {children}
      </div>
    </div>
  );
}

function Card({ text, status }: { text: string, status: 'doing' | 'todo' | 'done' }) {
  const border = status === 'doing' ? 'border-l-2 border-l-[#E76F00]' : 'border-l-2 border-l-[#334155]';
  return (
    <div className={`bg-[#17212B] p-3 rounded text-sm text-[#D8D2C4] ${border} shadow-sm`}>
      {text}
    </div>
  );
}

function StatusIndicator({ label, status }: { label: string, status: 'operational' | 'degraded' | 'down' | 'active' | 'pending' }) {
  const colors = {
    operational: 'bg-[#2E7D32]',
    active: 'bg-[#2E7D32]',
    degraded: 'bg-[#8C6500]',
    pending: 'bg-[#8C6500]',
    down: 'bg-[#B42318]'
  };

  return (
    <div className="bg-[#17212B] p-3 rounded border border-[#334155] flex items-center justify-between">
      <span className="text-xs font-medium text-[#4B5563]">{label}</span>
      <div className={`w-2 h-2 rounded-full ${colors[status] || 'bg-[#4B5563]'}`} />
    </div>
  );
}
