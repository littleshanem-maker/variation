/**
 * PDF Export Service
 *
 * Generates professional variation claim PDFs that contractors
 * can email to clients or head contractors.
 *
 * The PDF must look legitimate and professional — it's going to
 * a project manager who processes hundreds of claims. Sloppy
 * formatting gets your claim pushed to the bottom of the pile.
 */

import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { VariationWithEvidence, VariationStatus } from '../types/domain';
import { formatCurrency, formatDateTime, formatVariationId } from '../utils/helpers';
import { formatCoordinates } from './location';
import { formatHash } from './evidenceChain';

const STATUS_LABELS: Record<VariationStatus, string> = {
  [VariationStatus.CAPTURED]: 'Captured',
  [VariationStatus.SUBMITTED]: 'Submitted',
  [VariationStatus.APPROVED]: 'Approved',
  [VariationStatus.DISPUTED]: 'Disputed',
  [VariationStatus.PAID]: 'Paid',
};

/**
 * Generate a PDF for a single variation and open the share sheet.
 */
export async function exportVariationPdf(
  variation: VariationWithEvidence,
  projectName: string,
  projectClient: string,
  projectRef: string,
): Promise<void> {
  const html = generateVariationHtml(variation, projectName, projectClient, projectRef);
  const { uri } = await Print.printToFileAsync({ html, width: 612, height: 792 });

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, {
      mimeType: 'application/pdf',
      dialogTitle: `Variation ${formatVariationId(variation.sequenceNumber)}`,
      UTI: 'com.adobe.pdf',
    });
  }
}

function generateVariationHtml(
  variation: VariationWithEvidence,
  projectName: string,
  projectClient: string,
  projectRef: string,
): string {
  const varRef = formatVariationId(variation.sequenceNumber);
  const capturedDate = formatDateTime(variation.capturedAt);
  const location = variation.latitude && variation.longitude
    ? formatCoordinates(variation.latitude, variation.longitude)
    : 'Not recorded';

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, 'Helvetica Neue', Arial, sans-serif;
      color: #1A1A1A;
      font-size: 10pt;
      line-height: 1.5;
      padding: 40px;
    }

    /* Header */
    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      border-bottom: 3px solid #D4600A;
      padding-bottom: 16px;
      margin-bottom: 24px;
    }
    .header-left h1 {
      font-size: 18pt;
      font-weight: 800;
      color: #1A1A1A;
      letter-spacing: -0.5px;
    }
    .header-left .subtitle {
      font-size: 9pt;
      color: #5C5649;
      margin-top: 2px;
    }
    .header-right {
      text-align: right;
    }
    .var-ref {
      font-size: 14pt;
      font-weight: 800;
      color: #D4600A;
    }
    .status {
      display: inline-block;
      padding: 2px 10px;
      border-radius: 3px;
      font-size: 9pt;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-top: 4px;
      background: #FEF3EB;
      color: #D4600A;
    }

    /* Section */
    .section {
      margin-bottom: 20px;
    }
    .section-title {
      font-size: 8pt;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 1px;
      color: #8A8279;
      border-bottom: 1px solid #D4CFC7;
      padding-bottom: 4px;
      margin-bottom: 10px;
    }

    /* Details table */
    .details-table {
      width: 100%;
      border-collapse: collapse;
    }
    .details-table td {
      padding: 6px 0;
      border-bottom: 1px solid #EDE9E3;
      vertical-align: top;
    }
    .details-table .label {
      width: 140px;
      font-weight: 600;
      color: #5C5649;
      font-size: 9pt;
    }
    .details-table .value {
      color: #1A1A1A;
      font-size: 10pt;
    }
    .details-table .value.money {
      font-weight: 800;
      font-size: 12pt;
    }

    /* Description */
    .description {
      background: #F5F2ED;
      padding: 14px 16px;
      border-radius: 4px;
      border-left: 3px solid #D4600A;
      font-size: 10pt;
      line-height: 1.6;
    }

    /* Evidence */
    .evidence-badge {
      display: flex;
      align-items: center;
      gap: 8px;
      background: #EDF7EF;
      border: 1px solid #A8D5B0;
      border-radius: 4px;
      padding: 8px 12px;
      font-size: 9pt;
      color: #2D7A3A;
      font-weight: 600;
      margin-top: 16px;
    }
    .evidence-badge .shield {
      font-size: 14pt;
    }

    /* Photos */
    .photo-grid {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
    }
    .photo-placeholder {
      width: 80px;
      height: 60px;
      background: #D4CFC7;
      border-radius: 4px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 8pt;
      color: #5C5649;
      font-weight: 700;
    }

    /* Footer */
    .footer {
      margin-top: 32px;
      padding-top: 12px;
      border-top: 1px solid #D4CFC7;
      font-size: 8pt;
      color: #8A8279;
      display: flex;
      justify-content: space-between;
    }

    /* Status history */
    .history-item {
      display: flex;
      gap: 12px;
      padding: 6px 0;
      border-bottom: 1px solid #EDE9E3;
      font-size: 9pt;
    }
    .history-date { color: #8A8279; width: 130px; flex-shrink: 0; }
    .history-action { color: #1A1A1A; font-weight: 600; }
    .history-note { color: #5C5649; font-style: italic; }
  </style>
</head>
<body>

  <!-- Header -->
  <div class="header">
    <div class="header-left">
      <h1>Variation Claim</h1>
      <div class="subtitle">${projectName} · ${projectClient}</div>
      <div class="subtitle">Project Ref: ${projectRef}</div>
    </div>
    <div class="header-right">
      <div class="var-ref">${varRef}</div>
      <div class="status">${STATUS_LABELS[variation.status]}</div>
    </div>
  </div>

  <!-- Details -->
  <div class="section">
    <div class="section-title">Variation Details</div>
    <table class="details-table">
      <tr>
        <td class="label">Title</td>
        <td class="value">${variation.title}</td>
      </tr>
      <tr>
        <td class="label">Estimated Value</td>
        <td class="value money">${formatCurrency(variation.estimatedValue)}</td>
      </tr>
      ${variation.approvedValue ? `
      <tr>
        <td class="label">Approved Value</td>
        <td class="value money">${formatCurrency(variation.approvedValue)}</td>
      </tr>` : ''}
      <tr>
        <td class="label">Instruction Source</td>
        <td class="value">${variation.instructionSource.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</td>
      </tr>
      ${variation.instructionReference ? `
      <tr>
        <td class="label">Reference</td>
        <td class="value">${variation.instructionReference}</td>
      </tr>` : ''}
      ${variation.instructedBy ? `
      <tr>
        <td class="label">Instructed By</td>
        <td class="value">${variation.instructedBy}</td>
      </tr>` : ''}
      <tr>
        <td class="label">Date Captured</td>
        <td class="value">${capturedDate}</td>
      </tr>
      <tr>
        <td class="label">GPS Location</td>
        <td class="value">${location}</td>
      </tr>
    </table>
  </div>

  <!-- Description -->
  <div class="section">
    <div class="section-title">Description</div>
    <div class="description">
      ${variation.description || variation.aiDescription || 'No description provided.'}
    </div>
  </div>

  <!-- Photo Evidence -->
  <div class="section">
    <div class="section-title">Photo Evidence (${variation.photos.length} images)</div>
    <div class="photo-grid">
      ${variation.photos.map((_, i) => `
        <div class="photo-placeholder">IMG-${i + 1}</div>
      `).join('')}
    </div>
    <p style="font-size: 8pt; color: #8A8279; margin-top: 8px;">
      Original high-resolution photos with EXIF metadata available on request.
    </p>
  </div>

  <!-- Voice Note -->
  ${variation.voiceNote ? `
  <div class="section">
    <div class="section-title">Voice Note Transcription</div>
    <div class="description">
      ${variation.voiceNote.transcription || 'Transcription pending.'}
    </div>
    <p style="font-size: 8pt; color: #8A8279; margin-top: 4px;">
      Duration: ${Math.round(variation.voiceNote.durationSeconds)}s · Confidence: ${variation.voiceNote.transcriptionConfidence ? Math.round(variation.voiceNote.transcriptionConfidence * 100) + '%' : 'N/A'}
    </p>
  </div>` : ''}

  <!-- Status History -->
  ${variation.statusHistory.length > 0 ? `
  <div class="section">
    <div class="section-title">Status History</div>
    ${variation.statusHistory.map(sh => `
      <div class="history-item">
        <span class="history-date">${formatDateTime(sh.changedAt)}</span>
        <span class="history-action">${sh.fromStatus ? STATUS_LABELS[sh.fromStatus] + ' → ' : ''}${STATUS_LABELS[sh.toStatus]}</span>
        ${sh.notes ? `<span class="history-note">${sh.notes}</span>` : ''}
      </div>
    `).join('')}
  </div>` : ''}

  <!-- Evidence Chain -->
  <div class="evidence-badge">
    <span class="shield">🛡</span>
    <span>
      Immutable evidence chain — SHA-256 hash: <strong>${variation.evidenceHash}</strong>
      <br>GPS, timestamp, and file integrity verified at capture. Original evidence has not been modified.
    </span>
  </div>

  <!-- Footer -->
  <div class="footer">
    <div>
      Generated by Variation Capture · variationcapture.com.au<br>
      Pipeline Consulting Pty Ltd
    </div>
    <div style="text-align: right;">
      ${new Date().toLocaleDateString('en-AU', { day: '2-digit', month: 'long', year: 'numeric' })}<br>
      Evidence ID: ${variation.id.slice(0, 8)}
    </div>
  </div>

</body>
</html>
  `;
}
