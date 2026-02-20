/**
 * PDF Export Service — Phase 2
 *
 * Generates professional variation claim PDFs with:
 * - Embedded base64 photos (Phase 2)
 * - Status history timeline
 * - Evidence integrity hashes
 * - Batch export (all variations for a project)
 */

import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import { VariationDetail } from '../types/domain';
import { formatCurrency, formatDateTime, formatDate, formatVariationId } from '../utils/helpers';
import { formatCoordinates } from './location';
import { getStatusLabel } from '../theme';

// ============================================================
// SINGLE VARIATION PDF
// ============================================================

export async function exportVariationPDF(variation: VariationDetail): Promise<void> {
  const html = await buildVariationHTML(variation);
  const { uri } = await Print.printToFileAsync({ html, width: 595, height: 842 });

  const filename = `${formatVariationId(variation.sequenceNumber)}-${variation.title.replace(/[^a-zA-Z0-9]/g, '-').slice(0, 30)}.pdf`;
  const dest = `${FileSystem.documentDirectory}${filename}`;
  await FileSystem.moveAsync({ from: uri, to: dest });

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(dest, {
      mimeType: 'application/pdf',
      dialogTitle: `Share ${formatVariationId(variation.sequenceNumber)}`,
    });
  }
}

// ============================================================
// BATCH EXPORT — Phase 2
// ============================================================

export async function exportProjectBatchPDF(
  projectName: string,
  variations: VariationDetail[],
): Promise<void> {
  const pages = await Promise.all(
    variations.map(v => buildVariationHTML(v, true)),
  );

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>${getBaseStyles()}</style>
    </head>
    <body>
      <div class="cover-page">
        <div class="cover-logo">VARIATION CAPTURE</div>
        <h1 class="cover-title">${escapeHtml(projectName)}</h1>
        <h2 class="cover-subtitle">Variation Register — ${variations.length} Variations</h2>
        <p class="cover-date">Generated ${formatDate(new Date().toISOString())}</p>
        <div class="cover-summary">
          <div class="summary-item">
            <span class="summary-label">Approved Value</span>
            <span class="summary-value">${formatCurrency(
              variations.filter(v => v.status === 'approved' || v.status === 'paid')
                .reduce((s, v) => s + v.estimatedValue, 0)
            )}</span>
          </div>
          <div class="summary-item">
            <span class="summary-label">In Flight</span>
            <span class="summary-value">${formatCurrency(
              variations.filter(v => v.status === 'submitted')
                .reduce((s, v) => s + v.estimatedValue, 0)
            )}</span>
          </div>
          <div class="summary-item">
            <span class="summary-label">Disputed</span>
            <span class="summary-value danger">${formatCurrency(
              variations.filter(v => v.status === 'disputed')
                .reduce((s, v) => s + v.estimatedValue, 0)
            )}</span>
          </div>
        </div>
        <p class="cover-footer">Pipeline Consulting Pty Ltd &middot; variationcapture.com.au</p>
      </div>
      ${pages.join('\n<div class="page-break"></div>\n')}
    </body>
    </html>
  `;

  const { uri } = await Print.printToFileAsync({ html, width: 595, height: 842 });
  const filename = `${projectName.replace(/[^a-zA-Z0-9]/g, '-').slice(0, 30)}-Variations.pdf`;
  const dest = `${FileSystem.documentDirectory}${filename}`;
  await FileSystem.moveAsync({ from: uri, to: dest });

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(dest, {
      mimeType: 'application/pdf',
      dialogTitle: `Share ${projectName} Variations`,
    });
  }
}

// ============================================================
// HTML BUILDERS
// ============================================================

async function buildVariationHTML(variation: VariationDetail, isBatchPage = false): Promise<string> {
  // Build photo section with embedded base64 images (Phase 2)
  let photoHTML = '';
  if (variation.photos.length > 0) {
    const photoItems = await Promise.all(
      variation.photos.map(async (photo) => {
        try {
          const base64 = await FileSystem.readAsStringAsync(photo.localUri, {
            encoding: FileSystem.EncodingType.Base64,
          });
          const ext = photo.localUri.toLowerCase().includes('.png') ? 'png' : 'jpeg';
          return `
            <div class="photo-item">
              <img src="data:image/${ext};base64,${base64}" class="photo-img" />
              <div class="photo-meta">
                ${photo.latitude ? `GPS: ${formatCoordinates(photo.latitude, photo.longitude!)}` : ''}
                &middot; ${formatDateTime(photo.capturedAt)}
              </div>
              <div class="photo-hash">SHA-256: ${photo.sha256Hash.slice(0, 16)}...</div>
            </div>
          `;
        } catch {
          return `
            <div class="photo-item photo-missing">
              <div class="photo-placeholder">Photo unavailable</div>
              <div class="photo-hash">SHA-256: ${photo.sha256Hash.slice(0, 16)}...</div>
            </div>
          `;
        }
      }),
    );
    photoHTML = `
      <div class="section">
        <h3>Photographic Evidence (${variation.photos.length})</h3>
        <div class="photo-grid">${photoItems.join('')}</div>
      </div>
    `;
  }

  // Voice notes section
  let voiceHTML = '';
  if (variation.voiceNotes.length > 0) {
    voiceHTML = `
      <div class="section">
        <h3>Voice Notes (${variation.voiceNotes.length})</h3>
        ${variation.voiceNotes.map(vn => `
          <div class="voice-item">
            <span class="voice-duration">${Math.round(vn.durationSeconds)}s recording</span>
            ${vn.transcription ? `<p class="voice-transcription">"${escapeHtml(vn.transcription)}"</p>` : '<p class="voice-pending">Transcription pending</p>'}
            ${vn.sha256Hash ? `<div class="photo-hash">SHA-256: ${vn.sha256Hash.slice(0, 16)}...</div>` : ''}
          </div>
        `).join('')}
      </div>
    `;
  }

  // AI description section
  let aiHTML = '';
  if (variation.aiDescription) {
    aiHTML = `
      <div class="section ai-section">
        <h3>AI-Generated Description</h3>
        <p>${escapeHtml(variation.aiDescription)}</p>
      </div>
    `;
  }

  // Status history
  const historyHTML = variation.statusHistory.length > 0 ? `
    <div class="section">
      <h3>Status History</h3>
      <table class="history-table">
        <tr><th>Date</th><th>From</th><th>To</th><th>Notes</th></tr>
        ${variation.statusHistory.map(sc => `
          <tr>
            <td>${formatDateTime(sc.changedAt)}</td>
            <td>${sc.fromStatus ? getStatusLabel(sc.fromStatus) : '—'}</td>
            <td><strong>${getStatusLabel(sc.toStatus)}</strong></td>
            <td>${sc.notes ? escapeHtml(sc.notes) : '—'}</td>
          </tr>
        `).join('')}
      </table>
    </div>
  ` : '';

  const content = `
    <div class="variation-page">
      <div class="header">
        <div class="header-left">
          <div class="var-id">${formatVariationId(variation.sequenceNumber)}</div>
          <h2>${escapeHtml(variation.title)}</h2>
          ${variation.projectName ? `<div class="project-name">${escapeHtml(variation.projectName)}</div>` : ''}
        </div>
        <div class="header-right">
          <div class="status-badge status-${variation.status}">${getStatusLabel(variation.status)}</div>
          <div class="value">${formatCurrency(variation.estimatedValue)}</div>
        </div>
      </div>

      <div class="details-grid">
        <div class="detail"><span class="detail-label">Captured</span><span>${formatDateTime(variation.capturedAt)}</span></div>
        <div class="detail"><span class="detail-label">Source</span><span>${variation.instructionSource.replace(/_/g, ' ')}</span></div>
        ${variation.instructedBy ? `<div class="detail"><span class="detail-label">Instructed By</span><span>${escapeHtml(variation.instructedBy)}</span></div>` : ''}
        ${variation.referenceDoc ? `<div class="detail"><span class="detail-label">Reference</span><span>${escapeHtml(variation.referenceDoc)}</span></div>` : ''}
        ${variation.latitude ? `<div class="detail"><span class="detail-label">GPS</span><span>${formatCoordinates(variation.latitude, variation.longitude!)}</span></div>` : ''}
      </div>

      ${variation.description ? `
        <div class="section">
          <h3>Description</h3>
          <p>${escapeHtml(variation.description)}</p>
        </div>
      ` : ''}

      ${aiHTML}
      ${photoHTML}
      ${voiceHTML}

      ${variation.notes ? `
        <div class="section">
          <h3>Notes</h3>
          <p>${escapeHtml(variation.notes)}</p>
        </div>
      ` : ''}

      ${historyHTML}

      <div class="evidence-footer">
        ${variation.evidenceHash ? `<div>Evidence Hash: ${variation.evidenceHash}</div>` : ''}
        <div>Generated by Variation Capture &middot; Pipeline Consulting Pty Ltd</div>
      </div>
    </div>
  `;

  if (isBatchPage) return content;

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>${getBaseStyles()}</style>
    </head>
    <body>${content}</body>
    </html>
  `;
}

// ============================================================
// STYLES
// ============================================================

function getBaseStyles(): string {
  return `
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, Helvetica, Arial, sans-serif; font-size: 10pt; color: #1a1a1a; line-height: 1.4; padding: 20px; }
    .page-break { page-break-before: always; }
    .cover-page { text-align: center; padding: 120px 40px 60px; page-break-after: always; }
    .cover-logo { font-size: 11pt; letter-spacing: 4px; color: #D4600A; font-weight: 700; margin-bottom: 40px; }
    .cover-title { font-size: 24pt; font-weight: 800; margin-bottom: 8px; }
    .cover-subtitle { font-size: 14pt; font-weight: 400; color: #4a4a4a; margin-bottom: 40px; }
    .cover-date { color: #8a8580; margin-bottom: 40px; }
    .cover-summary { display: flex; justify-content: center; gap: 60px; margin-bottom: 60px; }
    .summary-item { text-align: center; }
    .summary-label { display: block; font-size: 9pt; color: #8a8580; text-transform: uppercase; letter-spacing: 1px; }
    .summary-value { display: block; font-size: 20pt; font-weight: 800; margin-top: 4px; }
    .summary-value.danger { color: #C62828; }
    .cover-footer { color: #8a8580; font-size: 9pt; position: absolute; bottom: 40px; left: 0; right: 0; }
    .variation-page { padding: 10px 0; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #D4600A; padding-bottom: 12px; margin-bottom: 16px; }
    .var-id { font-size: 9pt; color: #D4600A; font-weight: 700; letter-spacing: 1px; }
    h2 { font-size: 16pt; font-weight: 800; margin-top: 4px; }
    .project-name { font-size: 9pt; color: #8a8580; margin-top: 2px; }
    .header-right { text-align: right; }
    .status-badge { display: inline-block; padding: 3px 10px; border-radius: 4px; font-size: 9pt; font-weight: 700; color: white; }
    .status-captured { background: #D4600A; }
    .status-submitted { background: #1565C0; }
    .status-approved { background: #2D7D46; }
    .status-disputed { background: #C62828; }
    .status-paid { background: #1A1A1A; }
    .value { font-size: 18pt; font-weight: 800; margin-top: 4px; }
    .details-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 16px; padding: 12px; background: #f8f6f3; border-radius: 6px; }
    .detail-label { font-size: 8pt; color: #8a8580; text-transform: uppercase; letter-spacing: 0.5px; display: block; }
    .section { margin-bottom: 16px; }
    .section h3 { font-size: 11pt; font-weight: 700; color: #D4600A; margin-bottom: 8px; border-bottom: 1px solid #e8e4dd; padding-bottom: 4px; }
    .section p { font-size: 10pt; line-height: 1.5; }
    .ai-section { background: #fff8f0; padding: 12px; border-radius: 6px; border-left: 3px solid #D4600A; }
    .ai-section h3 { border-bottom: none; padding-bottom: 0; }
    .photo-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    .photo-item { border: 1px solid #e8e4dd; border-radius: 6px; overflow: hidden; }
    .photo-img { width: 100%; height: auto; max-height: 200px; object-fit: cover; display: block; }
    .photo-meta { font-size: 8pt; color: #8a8580; padding: 4px 8px; }
    .photo-hash { font-size: 7pt; color: #aaa; padding: 2px 8px 4px; font-family: monospace; }
    .photo-missing { padding: 40px; text-align: center; background: #f5f2ed; }
    .voice-item { padding: 8px 12px; background: #f8f6f3; border-radius: 6px; margin-bottom: 8px; }
    .voice-duration { font-size: 9pt; font-weight: 600; color: #D4600A; }
    .voice-transcription { font-size: 10pt; font-style: italic; margin-top: 4px; line-height: 1.5; }
    .voice-pending { font-size: 9pt; color: #8a8580; font-style: italic; }
    .history-table { width: 100%; border-collapse: collapse; font-size: 9pt; }
    .history-table th { text-align: left; padding: 6px 8px; background: #f5f2ed; font-weight: 700; border-bottom: 1px solid #d4cfc7; }
    .history-table td { padding: 6px 8px; border-bottom: 1px solid #e8e4dd; }
    .evidence-footer { margin-top: 24px; padding-top: 12px; border-top: 1px solid #e8e4dd; font-size: 8pt; color: #8a8580; font-family: monospace; }
  `;
}

// ============================================================
// WEB REGISTER PRINT
// ============================================================

export function printRegisterWeb(
  variations: VariationDetail[],
  generatedAt?: string,
): void {
  const now = generatedAt ?? new Date().toLocaleDateString('en-AU', { day: '2-digit', month: 'long', year: 'numeric' });

  // Group by project
  const byProject: Record<string, VariationDetail[]> = {};
  for (const v of variations) {
    const key = v.projectName ?? 'Unknown Project';
    if (!byProject[key]) byProject[key] = [];
    byProject[key].push(v);
  }

  const totalValue = variations.reduce((s, v) => s + v.estimatedValue, 0);
  const approvedValue = variations.filter(v => v.status === 'approved' || v.status === 'paid').reduce((s, v) => s + v.estimatedValue, 0);
  const inFlightValue = variations.filter(v => v.status === 'submitted').reduce((s, v) => s + v.estimatedValue, 0);
  const disputedValue = variations.filter(v => v.status === 'disputed').reduce((s, v) => s + v.estimatedValue, 0);

  const statusColors: Record<string, string> = {
    captured: '#D4600A',
    submitted: '#1565C0',
    approved: '#2D7D46',
    paid: '#1A1A1A',
    disputed: '#C62828',
  };

  const projectSections = Object.entries(byProject).map(([projectName, vars]) => {
    const projectTotal = vars.reduce((s, v) => s + v.estimatedValue, 0);
    const rows = vars.map((v, i) => `
      <tr class="${i % 2 === 0 ? '' : 'alt-row'}">
        <td class="col-id">${formatVariationId(v.sequenceNumber)}</td>
        <td class="col-title">${escapeHtml(v.title)}</td>
        <td class="col-ref">${v.referenceDoc ? escapeHtml(v.referenceDoc) : '—'}</td>
        <td class="col-instructed">${v.instructedBy ? escapeHtml(v.instructedBy) : '—'}</td>
        <td class="col-status"><span class="status-pill" style="background:${statusColors[v.status] ?? '#888'}">${getStatusLabel(v.status)}</span></td>
        <td class="col-value">${formatCurrency(v.estimatedValue)}</td>
        <td class="col-date">${formatDate(v.capturedAt)}</td>
      </tr>
    `).join('');

    return `
      <div class="project-section">
        <div class="project-header">
          <span class="project-name">${escapeHtml(projectName)}</span>
          <span class="project-total">${formatCurrency(projectTotal)}</span>
        </div>
        <table class="register-table">
          <thead>
            <tr>
              <th class="col-id">Var #</th>
              <th class="col-title">Title / Description</th>
              <th class="col-ref">Reference</th>
              <th class="col-instructed">Instructed By</th>
              <th class="col-status">Status</th>
              <th class="col-value">Est. Value</th>
              <th class="col-date">Captured</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
          <tfoot>
            <tr class="total-row">
              <td colspan="5" style="text-align:right;font-weight:700;padding-right:12px;">Project Total</td>
              <td class="col-value" style="font-weight:800;">${formatCurrency(projectTotal)}</td>
              <td></td>
            </tr>
          </tfoot>
        </table>
      </div>
    `;
  }).join('\n');

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Variation Register — ${now}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, Helvetica Neue, Arial, sans-serif; font-size: 9pt; color: #1a1a1a; background: white; }

    /* ── COVER ── */
    .cover { padding: 60px 48px 48px; border-bottom: 3px solid #D4600A; page-break-after: always; }
    .cover-brand { font-size: 9pt; letter-spacing: 3px; color: #D4600A; font-weight: 700; text-transform: uppercase; margin-bottom: 40px; }
    .cover-title { font-size: 28pt; font-weight: 900; color: #1a1a1a; line-height: 1.1; margin-bottom: 6px; }
    .cover-subtitle { font-size: 12pt; color: #6b6460; margin-bottom: 4px; }
    .cover-meta { font-size: 9pt; color: #9a9490; margin-top: 32px; margin-bottom: 48px; }
    .summary-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 1px; background: #e8e4dd; border: 1px solid #e8e4dd; border-radius: 8px; overflow: hidden; margin-bottom: 40px; }
    .summary-card { background: white; padding: 20px 24px; }
    .summary-label { font-size: 8pt; color: #9a9490; text-transform: uppercase; letter-spacing: 1px; font-weight: 600; margin-bottom: 6px; }
    .summary-value { font-size: 18pt; font-weight: 800; }
    .summary-count { font-size: 8pt; color: #9a9490; margin-top: 4px; }
    .cover-footer { font-size: 8pt; color: #9a9490; border-top: 1px solid #e8e4dd; padding-top: 16px; display: flex; justify-content: space-between; }

    /* ── REGISTER ── */
    .register-body { padding: 32px 48px; }
    .project-section { margin-bottom: 40px; page-break-inside: avoid; }
    .project-header { display: flex; justify-content: space-between; align-items: baseline; padding: 10px 0; border-bottom: 2px solid #D4600A; margin-bottom: 0; }
    .project-name { font-size: 13pt; font-weight: 800; color: #1a1a1a; }
    .project-total { font-size: 13pt; font-weight: 800; color: #D4600A; }

    .register-table { width: 100%; border-collapse: collapse; font-size: 8.5pt; }
    .register-table thead tr { background: #f5f2ed; }
    .register-table th { padding: 8px 10px; text-align: left; font-weight: 700; font-size: 7.5pt; text-transform: uppercase; letter-spacing: 0.5px; color: #6b6460; border-bottom: 1px solid #d4cfc7; white-space: nowrap; }
    .register-table td { padding: 9px 10px; border-bottom: 1px solid #ede9e3; vertical-align: middle; }
    .alt-row td { background: #faf8f5; }
    .total-row td { background: #f5f2ed; border-top: 2px solid #d4cfc7; padding: 8px 10px; font-size: 9pt; }

    .col-id    { width: 60px; font-weight: 700; color: #D4600A; font-size: 8pt; }
    .col-title { min-width: 180px; }
    .col-ref   { width: 90px; color: #6b6460; }
    .col-instructed { width: 110px; }
    .col-status { width: 80px; }
    .col-value { width: 90px; font-weight: 700; text-align: right; }
    .col-date  { width: 80px; color: #9a9490; white-space: nowrap; }

    .status-pill { display: inline-block; padding: 2px 7px; border-radius: 3px; font-size: 7.5pt; font-weight: 700; color: white; }

    /* ── GRAND TOTAL ── */
    .grand-total { margin: 0 0 40px; padding: 16px 24px; background: #f5f2ed; border-radius: 8px; display: flex; justify-content: space-between; align-items: center; }
    .grand-total-label { font-size: 11pt; font-weight: 700; color: #1a1a1a; }
    .grand-total-value { font-size: 20pt; font-weight: 900; color: #1a1a1a; }

    /* ── PRINT ── */
    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .cover { page-break-after: always; }
      .project-section { page-break-inside: avoid; }
      @page { margin: 15mm 12mm; size: A4; }
    }
  </style>
</head>
<body>

  <!-- COVER PAGE -->
  <div class="cover">
    <div class="cover-brand">Pipeline Consulting · Variation Capture</div>
    <div class="cover-title">Variation<br>Register</div>
    <div class="cover-subtitle">${variations.length} variation${variations.length !== 1 ? 's' : ''} across ${Object.keys(byProject).length} project${Object.keys(byProject).length !== 1 ? 's' : ''}</div>
    <div class="cover-meta">Generated ${now}</div>

    <div class="summary-grid">
      <div class="summary-card">
        <div class="summary-label">Total Claimed</div>
        <div class="summary-value">${formatCurrency(totalValue)}</div>
        <div class="summary-count">${variations.length} variations</div>
      </div>
      <div class="summary-card">
        <div class="summary-label">Approved / Paid</div>
        <div class="summary-value" style="color:#2D7D46">${formatCurrency(approvedValue)}</div>
        <div class="summary-count">${variations.filter(v => v.status === 'approved' || v.status === 'paid').length} variations</div>
      </div>
      <div class="summary-card">
        <div class="summary-label">In Flight</div>
        <div class="summary-value" style="color:#1565C0">${formatCurrency(inFlightValue)}</div>
        <div class="summary-count">${variations.filter(v => v.status === 'submitted').length} submitted</div>
      </div>
      <div class="summary-card">
        <div class="summary-label">Disputed</div>
        <div class="summary-value" style="color:#C62828">${formatCurrency(disputedValue)}</div>
        <div class="summary-count">${variations.filter(v => v.status === 'disputed').length} variations</div>
      </div>
    </div>

    <div class="cover-footer">
      <span>Pipeline Consulting Pty Ltd</span>
      <span>Confidential — Not for Distribution</span>
      <span>variationcapture.com.au</span>
    </div>
  </div>

  <!-- REGISTER BODY -->
  <div class="register-body">
    <div class="grand-total">
      <span class="grand-total-label">Total Portfolio Value</span>
      <span class="grand-total-value">${formatCurrency(totalValue)}</span>
    </div>
    ${projectSections}
  </div>

  <script>window.onload = function() { window.print(); }</script>
</body>
</html>`;

  const blob = new Blob([html], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  window.open(url, '_blank');
  // Clean up after a delay
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/\n/g, '<br>');
}
