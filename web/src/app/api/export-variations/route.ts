import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function GET(req: NextRequest) {
  const cookieStore = await cookies();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll() {},
      },
    }
  );

  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  // Get user's company
  const { data: memberData } = await supabase
    .from('company_members')
    .select('company_id')
    .eq('user_id', session.user.id)
    .eq('is_active', true)
    .single();

  if (!memberData) {
    return NextResponse.json({ error: 'No company found' }, { status: 400 });
  }

  // Get all projects for this company
  const { data: projects } = await supabase
    .from('projects')
    .select('id, name')
    .eq('company_id', memberData.company_id);

  const projectMap: Record<string, string> = {};
  for (const p of (projects || [])) {
    projectMap[p.id] = p.name;
  }

  // Get all variations for those projects
  const projectIds = (projects || []).map((p: any) => p.id);
  if (projectIds.length === 0) {
    // Return empty CSV
    const csv = 'Variation #,Title,Status,Value ($),Project,Date Captured\n';
    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': 'attachment; filename="variation-shield-export.csv"',
      },
    });
  }

  const { data: variations } = await supabase
    .from('variations')
    .select('sequence_number, variation_number, title, status, estimated_value, project_id, captured_at')
    .in('project_id', projectIds)
    .order('captured_at', { ascending: true });

  // Build CSV
  const headers = ['Variation #', 'Title', 'Status', 'Value ($)', 'Project', 'Date Captured'];

  function escapeCsv(val: string | number | null | undefined): string {
    if (val === null || val === undefined) return '';
    const str = String(val);
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  }

  const rows = (variations || []).map((v: any) => {
    const varNum = v.variation_number || `VAR-${String(v.sequence_number).padStart(3, '0')}`;
    const value = v.estimated_value ? (v.estimated_value / 100).toFixed(2) : '0.00';
    const project = projectMap[v.project_id] || '';
    const date = v.captured_at ? new Date(v.captured_at).toLocaleDateString('en-AU') : '';
    return [varNum, v.title, v.status, value, project, date].map(escapeCsv).join(',');
  });

  const csv = [headers.join(','), ...rows].join('\n');

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': 'attachment; filename="variation-shield-export.csv"',
    },
  });
}
