'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Settings } from 'lucide-react';
import { createClient } from '@/lib/supabase';
import { useRole } from '@/lib/role';

function getTimeOfDay() {
  const h = new Date().getHours();
  if (h < 12) return 'morning';
  if (h < 17) return 'afternoon';
  return 'evening';
}

export default function FieldHome() {
  const { isField, isLoading: roleLoading, company } = useRole();
  const router = useRouter();
  const [displayName, setDisplayName] = useState('');

  useEffect(() => {
    if (!roleLoading && !isField) router.replace('/dashboard');
  }, [isField, roleLoading]);

  useEffect(() => {
    // Redirect straight to capture
    router.replace('/capture');
  }, []);

  useEffect(() => {
    async function loadUser() {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.replace('/login'); return; }
      const meta = session.user.user_metadata;
      setDisplayName(meta?.display_name || meta?.full_name || session.user.email?.split('@')[0] || 'Supervisor');
    }
    loadUser();
  }, []);

  // Show nothing while redirecting
  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center">
      <div className="text-slate-400 text-sm">Loading…</div>
    </div>
  );
}
