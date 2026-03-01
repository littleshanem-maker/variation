export function generateNoticeEmailCover(
  notice: { notice_number: string },
  project: { name: string; client: string }
): string {
  const subject = `Variation Notice ${notice.notice_number} — ${project.name}`;
  const body = [
    `Dear ${project.client},`,
    '',
    `Please find attached Variation Notice ${notice.notice_number} in relation to the above project.`,
    '',
    'This notice is issued in accordance with the terms of the contract. A formal Variation Request will follow if required.',
    '',
    'Please do not hesitate to contact us if you have any questions.',
    '',
    'Kind regards',
  ].join('\n');
  return `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

export function generateVariationEmailCover(
  variation: { variation_number?: string | null; sequence_number: number },
  project: { name: string; client: string }
): string {
  const varNumber = variation.variation_number ?? `VAR-${String(variation.sequence_number).padStart(3, '0')}`;
  const subject = `Variation Request ${varNumber} — ${project.name}`;
  const body = [
    `Dear ${project.client},`,
    '',
    `Please find attached Variation Request ${varNumber} in relation to the above project.`,
    '',
    'Please review and provide your written approval at your earliest convenience.',
    '',
    'Kind regards',
  ].join('\n');
  return `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}
