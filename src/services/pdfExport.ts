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

export async function exportVariationPDF(variation: VariationDetail, attachments?: PrintAttachment[]): Promise<void> {
  const html = await buildVariationHTML(variation, false, attachments);
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

async function buildVariationHTML(variation: VariationDetail, isBatchPage = false, attachments?: PrintAttachment[]): Promise<string> {
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

  // Attachments — embed images, list others
  const atts = attachments ?? [];
  let attachmentHTML = '';
  if (atts.length > 0) {
    const items: string[] = [];
    for (const att of atts) {
      const ext = att.fileName.toLowerCase().split('.').pop() ?? '';
      const imageExts = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'heic', 'heif'];
      const isImage = att.mimeType?.startsWith('image/') || imageExts.includes(ext);
      const isPdf = att.mimeType === 'application/pdf' || ext === 'pdf';
      if (isImage) {
        try {
          const base64 = await FileSystem.readAsStringAsync(att.localUri, {
            encoding: FileSystem.EncodingType.Base64,
          });
          const imgExt = att.mimeType?.includes('png') || att.fileName.toLowerCase().endsWith('.png') ? 'png' : 'jpeg';
          items.push(`
            <div class="photo-item" style="page-break-before:always;">
              <div style="padding:8px;background:#f8f6f3;font-weight:700;font-size:10pt;">${escapeHtml(att.fileName)}</div>
              <img src="data:image/${imgExt};base64,${base64}" class="photo-img" style="width:100%;height:auto;" />
              <div class="photo-hash">${att.fileSize ? formatFileSizePrint(att.fileSize) + ' · ' : ''}SHA-256: ${att.sha256Hash.slice(0, 16)}...</div>
            </div>
          `);
        } catch (err) {
          console.error('[PDF] Failed to embed attachment:', att.fileName, att.localUri, err);
          items.push(`
            <div class="photo-item photo-missing">
              <div class="photo-placeholder">${escapeHtml(att.fileName)} — unavailable</div>
              <div class="photo-hash">SHA-256: ${att.sha256Hash.slice(0, 16)}...</div>
            </div>
          `);
        }
      } else {
        items.push(`
          <div class="voice-item">
            <strong>${escapeHtml(att.fileName)}</strong>
            <div class="photo-hash">${att.mimeType ?? 'unknown'} · ${att.fileSize ? formatFileSizePrint(att.fileSize) + ' · ' : ''}SHA-256: ${att.sha256Hash.slice(0, 16)}...</div>
            <div style="font-size:9pt;color:#8a8580;font-style:italic;margin-top:4px;">File cannot be embedded — see digital record</div>
          </div>
        `);
      }
    }
    attachmentHTML = `
      <div class="section">
        <h3>Attachments (${atts.length})</h3>
        ${items.join('')}
      </div>
    `;
  }

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

      ${attachmentHTML}

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
// WEB PROJECT DETAILED PRINT (one page per variation, no photo embed)
// ============================================================

export function printProjectDetailedWeb(
  projectName: string,
  variations: VariationDetail[],
): void {
  const now = new Date().toLocaleDateString('en-AU', { day: '2-digit', month: 'long', year: 'numeric' });
  const totalValue = variations.reduce((s, v) => s + v.estimatedValue, 0);
  const statusColors: Record<string, string> = {
    captured: '#D4600A', submitted: '#1565C0', approved: '#2D7D46', paid: '#1A1A1A', disputed: '#C62828',
  };

  const pages = variations.map((v, i) => `
    <div class="var-page${i > 0 ? ' page-break' : ''}">
      <div class="var-header">
        <div class="var-header-left">
          <div class="var-id">${formatVariationId(v.sequenceNumber)}</div>
          <div class="var-title">${escapeHtml(v.title)}</div>
          <div class="var-project">${escapeHtml(v.projectName ?? projectName)}</div>
        </div>
        <div class="var-header-right">
          <span class="status-pill" style="background:${statusColors[v.status] ?? '#888'}">${getStatusLabel(v.status)}</span>
          <div class="var-value">${formatCurrency(v.estimatedValue)}</div>
        </div>
      </div>
      <div class="detail-grid">
        <div class="detail-item"><span class="dl">Captured</span><span>${formatDateTime(v.capturedAt)}</span></div>
        <div class="detail-item"><span class="dl">Source</span><span>${v.instructionSource.replace(/_/g, ' ')}</span></div>
        ${v.instructedBy ? `<div class="detail-item"><span class="dl">Instructed By</span><span>${escapeHtml(v.instructedBy)}</span></div>` : ''}
        ${v.referenceDoc ? `<div class="detail-item"><span class="dl">Reference</span><span>${escapeHtml(v.referenceDoc)}</span></div>` : ''}
        ${v.latitude ? `<div class="detail-item"><span class="dl">GPS</span><span>${v.latitude.toFixed(5)}, ${v.longitude?.toFixed(5)}</span></div>` : ''}
      </div>
      ${v.description ? `<div class="var-section"><div class="sec-label">Description</div><p>${escapeHtml(v.description)}</p></div>` : ''}
      ${v.notes ? `<div class="var-section"><div class="sec-label">Notes</div><p>${escapeHtml(v.notes)}</p></div>` : ''}
      ${v.statusHistory && v.statusHistory.length > 0 ? `
        <div class="var-section">
          <div class="sec-label">Status History</div>
          <table class="history-table">
            <tr><th>Date</th><th>From</th><th>To</th></tr>
            ${v.statusHistory.map(sc => `<tr><td>${formatDateTime(sc.changedAt)}</td><td>${sc.fromStatus ? getStatusLabel(sc.fromStatus) : '—'}</td><td><strong>${getStatusLabel(sc.toStatus)}</strong></td></tr>`).join('')}
          </table>
        </div>
      ` : ''}
      <div class="var-footer">Pipeline Consulting Pty Ltd · Variation Capture · Generated ${now}</div>
    </div>
  `).join('\n');

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>${escapeHtml(projectName)} — Variation Detail Export</title>
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    body { font-family:-apple-system,Helvetica Neue,Arial,sans-serif; font-size:9.5pt; color:#1a1a1a; background:white; }
    .page-break { page-break-before:always; }
    .var-page { padding:32px 48px; min-height:100vh; display:flex; flex-direction:column; }
    .var-header { display:flex; justify-content:space-between; align-items:flex-start; border-bottom:2px solid #D4600A; padding-bottom:14px; margin-bottom:18px; }
    .var-id { font-size:8.5pt; color:#D4600A; font-weight:700; letter-spacing:1px; text-transform:uppercase; margin-bottom:4px; }
    .var-title { font-size:18pt; font-weight:800; color:#1a1a1a; line-height:1.1; margin-bottom:4px; }
    .var-project { font-size:9pt; color:#6b6460; }
    .var-header-right { text-align:right; flex-shrink:0; margin-left:24px; }
    .status-pill { display:inline-block; padding:3px 10px; border-radius:3px; font-size:8.5pt; font-weight:700; color:white; margin-bottom:8px; }
    .var-value { font-size:22pt; font-weight:900; color:#1a1a1a; }
    .detail-grid { display:grid; grid-template-columns:1fr 1fr; gap:8px; background:#f8f6f3; padding:14px; border-radius:6px; margin-bottom:18px; }
    .detail-item { }
    .dl { display:block; font-size:7.5pt; color:#9a9490; text-transform:uppercase; letter-spacing:0.5px; font-weight:600; margin-bottom:2px; }
    .var-section { margin-bottom:16px; }
    .sec-label { font-size:9pt; font-weight:700; color:#D4600A; text-transform:uppercase; letter-spacing:0.5px; border-bottom:1px solid #e8e4dd; padding-bottom:4px; margin-bottom:8px; }
    .var-section p { font-size:9.5pt; line-height:1.5; color:#2a2a2a; }
    .history-table { width:100%; border-collapse:collapse; font-size:8.5pt; }
    .history-table th { text-align:left; padding:5px 8px; background:#f5f2ed; font-weight:700; border-bottom:1px solid #d4cfc7; }
    .history-table td { padding:5px 8px; border-bottom:1px solid #ede9e3; }
    .var-footer { margin-top:auto; padding-top:16px; border-top:1px solid #e8e4dd; font-size:7.5pt; color:#aaa; font-family:monospace; }
    @media print {
      body { -webkit-print-color-adjust:exact; print-color-adjust:exact; }
      .var-page { min-height:0; padding:20px 32px; }
      @page { margin:12mm 10mm; size:A4; }
    }
  </style>
</head>
<body>${pages}</body>
<script>window.onload=function(){window.print();}</script>
</html>`;

  const blob = new Blob([html], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  window.open(url, '_blank');
  setTimeout(() => URL.revokeObjectURL(url), 60000);
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

// ============================================================
// WEB SINGLE VARIATION PRINT
// ============================================================

export interface PrintAttachment {
  localUri: string;
  fileName: string;
  fileSize?: number;
  mimeType?: string;
  sha256Hash: string;
}

async function blobUrlToDataUrl(blobUrl: string): Promise<string> {
  try {
    const response = await fetch(blobUrl);
    const blob = await response.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch {
    return '';
  }
}

export async function printVariationWeb(variation: VariationDetail, attachments?: PrintAttachment[]): Promise<void> {
  const now = new Date().toLocaleDateString('en-AU', { day: '2-digit', month: 'long', year: 'numeric' });
  const statusColors: Record<string, string> = {
    captured: '#D4600A', submitted: '#1565C0', approved: '#2D7D46', paid: '#1A1A1A', disputed: '#C62828',
  };

  // Photos section
  let photoHTML = '';
  if (variation.photos.length > 0) {
    photoHTML = `
      <div class="section">
        <h3>Photographic Evidence</h3>
        <div class="photo-note">
          <span class="photo-icon">📷</span>
          <div>
            <strong>${variation.photos.length} photo${variation.photos.length !== 1 ? 's' : ''} captured</strong> — see digital record for full images.
            <div class="photo-details">
              ${variation.photos.map((p, i) => `
                <div class="photo-detail-item">
                  Photo ${i + 1}: ${formatDateTime(p.capturedAt)}
                  ${p.latitude ? ` · GPS: ${formatCoordinates(p.latitude, p.longitude!)}` : ''}
                  <span class="hash">SHA-256: ${p.sha256Hash.slice(0, 16)}…</span>
                </div>
              `).join('')}
            </div>
          </div>
        </div>
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
            ${vn.sha256Hash ? `<div class="hash">SHA-256: ${vn.sha256Hash.slice(0, 16)}…</div>` : ''}
          </div>
        `).join('')}
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

  // Attachments — convert everything to printable images
  const atts = attachments ?? [];
  interface ResolvedAttachment {
    fileName: string;
    fileSize?: number;
    mimeType?: string;
    sha256Hash: string;
    dataUrl: string;        // base64 data URL for images
    pdfDataUrl?: string;    // raw data URL for pdf.js rendering
    isImage: boolean;
    isPdf: boolean;
  }
  const resolved: ResolvedAttachment[] = [];
  for (const att of atts) {
    const isImage = att.mimeType?.startsWith('image/') ?? false;
    const isPdf = att.mimeType === 'application/pdf';
    let dataUrl = '';
    if (isImage || isPdf) {
      dataUrl = await blobUrlToDataUrl(att.localUri);
    }
    resolved.push({
      fileName: att.fileName,
      fileSize: att.fileSize,
      mimeType: att.mimeType,
      sha256Hash: att.sha256Hash,
      dataUrl: isImage ? dataUrl : '',
      pdfDataUrl: isPdf ? dataUrl : undefined,
      isImage,
      isPdf,
    });
  }

  let attachHTML = '';
  if (resolved.length > 0) {
    const items = resolved.map((att, idx) => {
      const meta = `${att.fileSize ? formatFileSizePrint(att.fileSize) + ' · ' : ''}SHA-256: ${att.sha256Hash.slice(0, 16)}…`;
      if (att.isImage && att.dataUrl) {
        return `
          <div class="attach-item page-break-before">
            <div class="attach-header">
              <strong>${escapeHtml(att.fileName)}</strong>
              <span class="hash">${meta}</span>
            </div>
            <img src="${att.dataUrl}" class="attach-img" />
          </div>
        `;
      } else if (att.isPdf && att.pdfDataUrl) {
        return `
          <div class="attach-item page-break-before">
            <div class="attach-header">
              <strong>${escapeHtml(att.fileName)}</strong>
              <span class="hash">${meta}</span>
            </div>
            <div class="pdf-pages" data-pdf-idx="${idx}"></div>
          </div>
        `;
      } else {
        return `
          <div class="attach-item">
            <div class="attach-header">
              <strong>${escapeHtml(att.fileName)}</strong>
              <span class="hash">${att.mimeType ? escapeHtml(att.mimeType) + ' · ' : ''}${meta}</span>
            </div>
            <div class="attach-nopreview">File type cannot be rendered — see digital record</div>
          </div>
        `;
      }
    });
    attachHTML = `
      <div class="section">
        <h3>Attachments (${resolved.length})</h3>
        ${items.join('')}
      </div>
    `;
  }

  // Build PDF data map for the client-side script
  const pdfDataMap: Record<number, string> = {};
  resolved.forEach((att, idx) => {
    if (att.isPdf && att.pdfDataUrl) {
      pdfDataMap[idx] = att.pdfDataUrl;
    }
  });
  const hasPdfs = Object.keys(pdfDataMap).length > 0;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>${formatVariationId(variation.sequenceNumber)} — ${escapeHtml(variation.title)}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, Helvetica Neue, Arial, sans-serif; font-size: 10pt; color: #1a1a1a; line-height: 1.4; padding: 32px 48px; background: white; }

    /* Header */
    .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #D4600A; padding-bottom: 14px; margin-bottom: 20px; }
    .header-left { }
    .var-id { font-size: 9pt; color: #D4600A; font-weight: 700; letter-spacing: 1px; text-transform: uppercase; margin-bottom: 4px; }
    h1 { font-size: 18pt; font-weight: 800; color: #1a1a1a; line-height: 1.1; margin-bottom: 4px; }
    .project-name { font-size: 9pt; color: #6b6460; }
    .header-right { text-align: right; flex-shrink: 0; margin-left: 24px; }
    .status-badge { display: inline-block; padding: 3px 10px; border-radius: 4px; font-size: 9pt; font-weight: 700; color: white; margin-bottom: 8px; }
    .value { font-size: 22pt; font-weight: 900; color: #1a1a1a; }

    /* Details grid */
    .details-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 20px; padding: 14px; background: #f8f6f3; border-radius: 6px; }
    .detail-label { display: block; font-size: 8pt; color: #9a9490; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600; margin-bottom: 2px; }

    /* Sections */
    .section { margin-bottom: 20px; }
    .section h3 { font-size: 11pt; font-weight: 700; color: #D4600A; margin-bottom: 8px; border-bottom: 1px solid #e8e4dd; padding-bottom: 4px; }
    .section p { font-size: 10pt; line-height: 1.6; }

    /* Photos note */
    .photo-note { display: flex; gap: 12px; padding: 14px; background: #f8f6f3; border-radius: 6px; border-left: 3px solid #D4600A; }
    .photo-icon { font-size: 20pt; }
    .photo-details { margin-top: 8px; }
    .photo-detail-item { font-size: 8.5pt; color: #6b6460; padding: 3px 0; border-bottom: 1px solid #ede9e3; }

    /* Voice */
    .voice-item { padding: 10px 14px; background: #f8f6f3; border-radius: 6px; margin-bottom: 8px; }
    .voice-duration { font-size: 9pt; font-weight: 600; color: #D4600A; }
    .voice-transcription { font-size: 10pt; font-style: italic; margin-top: 4px; line-height: 1.5; }
    .voice-pending { font-size: 9pt; color: #8a8580; font-style: italic; }

    /* History */
    .history-table { width: 100%; border-collapse: collapse; font-size: 9pt; }
    .history-table th { text-align: left; padding: 6px 8px; background: #f5f2ed; font-weight: 700; font-size: 8pt; text-transform: uppercase; letter-spacing: 0.5px; color: #6b6460; border-bottom: 1px solid #d4cfc7; }
    .history-table td { padding: 6px 8px; border-bottom: 1px solid #ede9e3; }

    /* Attachments */
    .attach-item { margin-bottom: 16px; border: 1px solid #e8e4dd; border-radius: 6px; overflow: hidden; }
    .attach-header { padding: 10px 14px; background: #f8f6f3; border-bottom: 1px solid #e8e4dd; }
    .attach-header strong { font-size: 10pt; display: block; margin-bottom: 2px; }
    .attach-img { width: 100%; height: auto; display: block; }
    .attach-nopreview { padding: 20px 14px; font-size: 9pt; color: #8a8580; font-style: italic; text-align: center; background: #faf8f5; }
    .pdf-page-img { width: 100%; height: auto; display: block; }
    .page-break-before { page-break-before: always; }

    /* Hashes */
    .hash { font-size: 7.5pt; color: #aaa; font-family: monospace; }

    /* Evidence footer */
    .evidence-footer { margin-top: 30px; padding-top: 14px; border-top: 1px solid #e8e4dd; font-size: 8pt; color: #9a9490; }
    .evidence-hash { font-family: monospace; font-size: 7.5pt; color: #aaa; margin-bottom: 6px; }
    .footer-brand { display: flex; justify-content: space-between; margin-top: 6px; }

    /* Print */
    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; padding: 0; }
      @page { margin: 15mm 12mm; size: A4; }
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="header-left">
      <div class="var-id">${formatVariationId(variation.sequenceNumber)}</div>
      <h1>${escapeHtml(variation.title)}</h1>
      ${variation.projectName ? `<div class="project-name">${escapeHtml(variation.projectName)}</div>` : ''}
    </div>
    <div class="header-right">
      <div class="status-badge" style="background:${statusColors[variation.status] ?? '#888'}">${getStatusLabel(variation.status)}</div>
      <div class="value">${formatCurrency(variation.estimatedValue)}</div>
    </div>
  </div>

  <div class="details-grid">
    <div><span class="detail-label">Captured</span><span>${formatDateTime(variation.capturedAt)}</span></div>
    <div><span class="detail-label">Source</span><span>${variation.instructionSource.replace(/_/g, ' ')}</span></div>
    ${variation.instructedBy ? `<div><span class="detail-label">Instructed By</span><span>${escapeHtml(variation.instructedBy)}</span></div>` : ''}
    ${variation.referenceDoc ? `<div><span class="detail-label">Reference</span><span>${escapeHtml(variation.referenceDoc)}</span></div>` : ''}
    ${variation.latitude ? `<div><span class="detail-label">GPS</span><span>${formatCoordinates(variation.latitude, variation.longitude!)}</span></div>` : ''}
    ${variation.locationAccuracy ? `<div><span class="detail-label">Accuracy</span><span>±${Math.round(variation.locationAccuracy)}m</span></div>` : ''}
  </div>

  ${variation.description ? `
    <div class="section">
      <h3>Description</h3>
      <p>${escapeHtml(variation.description)}</p>
    </div>
  ` : ''}

  ${variation.aiDescription ? `
    <div class="section" style="background:#fff8f0;padding:14px;border-radius:6px;border-left:3px solid #D4600A;">
      <h3 style="border-bottom:none;padding-bottom:0;">AI-Generated Description</h3>
      <p>${escapeHtml(variation.aiDescription)}</p>
    </div>
  ` : ''}

  ${photoHTML}
  ${voiceHTML}

  ${variation.notes ? `
    <div class="section">
      <h3>Notes</h3>
      <p>${escapeHtml(variation.notes)}</p>
    </div>
  ` : ''}

  ${attachHTML}

  ${historyHTML}

  <div class="evidence-footer">
    ${variation.evidenceHash ? `<div class="evidence-hash">Evidence Hash: ${variation.evidenceHash}</div>` : ''}
    <div class="footer-brand">
      <span>Pipeline Consulting Pty Ltd · Variation Capture</span>
      <span>Generated ${now}</span>
    </div>
  </div>

  ${hasPdfs ? `<script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.0.379/pdf.min.mjs" type="module"></script>` : ''}
  <script${hasPdfs ? ' type="module"' : ''}>
    async function renderAndPrint() {
      ${hasPdfs ? `
      const pdfjsLib = await import('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.0.379/pdf.min.mjs');
      pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.0.379/pdf.worker.min.mjs';
      const pdfData = ${JSON.stringify(pdfDataMap)};
      for (const [idx, dataUrl] of Object.entries(pdfData)) {
        try {
          const base64 = dataUrl.split(',')[1];
          const binary = atob(base64);
          const bytes = new Uint8Array(binary.length);
          for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
          const pdf = await pdfjsLib.getDocument({ data: bytes }).promise;
          const container = document.querySelector('[data-pdf-idx="' + idx + '"]');
          for (let p = 1; p <= pdf.numPages; p++) {
            const page = await pdf.getPage(p);
            const viewport = page.getViewport({ scale: 2.0 });
            const canvas = document.createElement('canvas');
            canvas.width = viewport.width;
            canvas.height = viewport.height;
            const ctx = canvas.getContext('2d');
            await page.render({ canvasContext: ctx, viewport }).promise;
            const img = document.createElement('img');
            img.src = canvas.toDataURL('image/png');
            img.className = 'pdf-page-img';
            container.appendChild(img);
          }
        } catch (e) {
          console.error('PDF render failed:', e);
          const container = document.querySelector('[data-pdf-idx="' + idx + '"]');
          if (container) container.innerHTML = '<div class="attach-nopreview">PDF could not be rendered</div>';
        }
      }
      ` : ''}
      // Wait for all images to load before printing
      const images = document.querySelectorAll('img');
      await Promise.all(Array.from(images).map(img =>
        img.complete ? Promise.resolve() : new Promise(r => { img.onload = r; img.onerror = r; })
      ));
      window.print();
    }
    renderAndPrint();
  </script>
</body>
</html>`;

  const blob = new Blob([html], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  window.open(url, '_blank');
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

function formatFileSizePrint(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/\n/g, '<br>');
}
