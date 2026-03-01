export function generateNoticeMailto(
  notice: {
    notice_number: string;
    event_date: string;
    event_description: string;
    cost_flag: boolean;
    time_flag: boolean;
    estimated_days?: number | null;
    contract_clause?: string | null;
    issued_by_name?: string | null;
    issued_by_email?: string | null;
    issued_at?: string | null;
  },
  project: { name: string; client: string },
  companyName: string
): string {
  const issuedDate = notice.issued_at
    ? new Date(notice.issued_at).toLocaleDateString('en-AU', { day: '2-digit', month: 'short', year: 'numeric' })
    : new Date().toLocaleDateString('en-AU', { day: '2-digit', month: 'short', year: 'numeric' });

  const eventDate = new Date(notice.event_date + 'T00:00:00').toLocaleDateString('en-AU', {
    day: '2-digit', month: 'short', year: 'numeric'
  });

  const subject = `Variation Notice ${notice.notice_number} — ${project.name}`;

  const body = [
    'VARIATION NOTICE',
    '════════════════════════════════',
    '',
    `Notice No:   ${notice.notice_number}`,
    `Project:     ${project.name}`,
    `Client:      ${project.client}`,
    `Event Date:  ${eventDate}`,
    `Issued:      ${issuedDate}`,
    '',
    'DESCRIPTION OF EVENT',
    '────────────────────',
    notice.event_description,
    '',
    'IMPLICATIONS',
    '────────────',
    `Cost Implication:  ${notice.cost_flag ? 'Yes' : 'No'}`,
    `Time Implication:  ${notice.time_flag ? 'Yes' : 'No'}`,
    ...(notice.time_flag && notice.estimated_days ? [`Estimated Days:    ${notice.estimated_days}`] : []),
    ...(notice.contract_clause ? [`Contract Clause:   ${notice.contract_clause}`] : []),
    '',
    ...(notice.issued_by_name ? [`Issued by: ${notice.issued_by_name}`] : []),
    ...(notice.issued_by_email ? [`           ${notice.issued_by_email}`] : []),
    '',
    '════════════════════════════════',
    'This notice is issued in accordance with the terms of the contract.',
    'A formal Variation Request will follow if required.',
    '',
    `Sent via Variation Shield — leveragedsystems.com.au`,
  ].join('\n');

  return `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

export function generateVariationMailto(
  variation: {
    variation_number?: string | null;
    sequence_number: number;
    title: string;
    description?: string | null;
    instruction_source?: string | null;
    instructed_by?: string | null;
    estimated_value: number;
    status: string;
    captured_at: string;
  },
  project: { name: string; client: string },
  companyName: string
): string {
  const varNumber = variation.variation_number ?? `VAR-${String(variation.sequence_number).padStart(3, '0')}`;
  const capturedDate = new Date(variation.captured_at).toLocaleDateString('en-AU', {
    day: '2-digit', month: 'short', year: 'numeric'
  });

  const statusLabel: Record<string, string> = {
    draft: 'Draft',
    captured: 'Draft',
    submitted: 'Submitted for Approval',
    approved: 'Approved',
    rejected: 'Rejected',
    disputed: 'Disputed',
    paid: 'Paid',
  };

  const subject = `Variation Request ${varNumber} — ${project.name}`;

  const value = new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(variation.estimated_value || 0);

  const body = [
    'VARIATION REQUEST',
    '════════════════════════════════',
    '',
    `Variation No:  ${varNumber}`,
    `Project:       ${project.name}`,
    `Client:        ${project.client}`,
    `Status:        ${statusLabel[variation.status] ?? variation.status}`,
    `Date:          ${capturedDate}`,
    '',
    'TITLE',
    '─────',
    variation.title,
    '',
    ...(variation.description ? [
      'DESCRIPTION',
      '───────────',
      variation.description,
      '',
    ] : []),
    `Instruction Source:  ${variation.instruction_source ? variation.instruction_source.replace(/_/g, ' ') : '—'}`,
    `Instructed By:       ${variation.instructed_by || '—'}`,
    `Estimated Value:     ${value}`,
    '',
    '════════════════════════════════',
    'Please review and respond to this variation request at your earliest convenience.',
    '',
    `Sent via Variation Shield — leveragedsystems.com.au`,
  ].join('\n');

  return `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}
