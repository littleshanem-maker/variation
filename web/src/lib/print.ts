import { formatCurrency, formatDate, getStatusConfig, getVariationNumber } from './utils';
import type { Project, Variation, PhotoEvidence, VariationNotice } from './types';

interface ProjectWithVariations extends Project {
  variations: Variation[];
}

// ------------------------------------------------------------------
// GLOBAL STYLES (ASSURED / MINIMAL / PRINT-FRIENDLY)
// ------------------------------------------------------------------
const GLOBAL_CSS = `
  @page { margin: 15mm 15mm; size: A4; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { 
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    font-size: 9pt; 
    line-height: 1.4;
    color: #1C1C1E; 
    background: white; 
    -webkit-print-color-adjust: exact; 
    print-color-adjust: exact; 
  }

  /* UTILS */
  .tabular-nums { font-variant-numeric: tabular-nums; }
  .uppercase { text-transform: uppercase; letter-spacing: 0.05em; }
  .text-right { text-align: right; }
  .text-muted { color: #6B7280; }
  .font-medium { font-weight: 500; }
  .font-semibold { font-weight: 600; }
  .font-bold { font-weight: 700; }
  
  /* LAYOUT */
  .page-break { page-break-before: always; }
  .avoid-break { page-break-inside: avoid; }
  .container { max-width: 100%; margin: 0 auto; }

  /* HEADER */
  .doc-header { 
    display: flex; 
    justify-content: space-between; 
    align-items: flex-start; 
    padding-bottom: 24px; 
    border-bottom: 2px solid #1C1C1E; 
    margin-bottom: 32px; 
  }
  .brand { font-size: 14pt; font-weight: 700; color: #1C1C1E; letter-spacing: -0.02em; }
  .doc-title { font-size: 24pt; font-weight: 300; color: #1C1C1E; line-height: 1.1; margin-top: 8px; }
  .doc-meta { text-align: right; font-size: 9pt; color: #6B7280; }
  .meta-row { margin-bottom: 4px; }

  /* SUMMARY BOXES */
  .summary-grid { 
    display: grid; 
    grid-template-columns: repeat(4, 1fr); 
    gap: 16px; 
    margin-bottom: 40px; 
  }
  .summary-card { 
    border: 1px solid #E5E7EB; 
    padding: 16px; 
    border-radius: 4px; 
  }
  .summary-label { font-size: 8pt; color: #6B7280; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 8px; }
  .summary-value { font-size: 16pt; font-weight: 600; color: #1C1C1E; }

  /* TABLES */
  table { width: 100%; border-collapse: collapse; font-size: 9pt; }
  th { 
    text-align: left; 
    padding: 12px 8px; 
    border-bottom: 1px solid #1C1C1E; 
    font-weight: 600; 
    font-size: 8pt; 
    text-transform: uppercase; 
    letter-spacing: 0.05em; 
    color: #1C1C1E; 
  }
  td { 
    padding: 12px 8px; 
    border-bottom: 1px solid #E5E7EB; 
    vertical-align: top; 
  }
  tr.total-row td { 
    border-top: 2px solid #1C1C1E; 
    border-bottom: none; 
    font-weight: 700; 
    padding-top: 16px; 
  }
  
  /* VARIATION DETAIL SPECIFIC */
  .detail-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-bottom: 32px; }
  .field-group { margin-bottom: 24px; }
  .field-label { font-size: 8pt; color: #6B7280; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 6px; }
  .field-value { font-size: 10pt; color: #1C1C1E; font-weight: 500; }
  .field-value.large { font-size: 12pt; }
  
  .description-box { 
    border-top: 1px solid #E5E7EB; 
    border-bottom: 1px solid #E5E7EB; 
    padding: 24px 0; 
    margin: 32px 0; 
  }
  .description-text { font-size: 10pt; line-height: 1.6; white-space: pre-wrap; }

  .photo-grid { 
    display: grid; 
    grid-template-columns: repeat(2, 1fr); 
    gap: 16px; 
    margin-top: 24px; 
  }
  .photo-item { 
    break-inside: avoid; 
    border: 1px solid #E5E7EB; 
    padding: 8px; 
    background: #F9FAFB; 
  }
  .photo-img { 
    width: 100%; 
    height: 240px; 
    object-fit: cover; 
    display: block; 
    margin-bottom: 8px; 
  }
  .photo-caption { font-size: 8pt; color: #6B7280; }

  /* FOOTER */
  .footer { 
    position: fixed; 
    bottom: 0; 
    left: 0; 
    right: 0; 
    padding-top: 16px; 
    border-top: 1px solid #E5E7EB; 
    font-size: 8pt; 
    color: #9CA3AF; 
    display: flex; 
    justify-content: space-between; 
    background: white;
  }
`;

// ------------------------------------------------------------------
// HELPER: CREATE & OPEN BLOB
// ------------------------------------------------------------------
function openHtml(htmlContent: string, title: string) {
  const fullHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>${title}</title>
  <style>${GLOBAL_CSS}</style>
</head>
<body>
  ${htmlContent}
  <script>window.onload=function(){window.print();}</script>
</body>
</html>`;

  const blob = new Blob([fullHtml], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  window.open(url, '_blank');
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

function escapeHtml(text: string): string {
  if (!text) return '';
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ------------------------------------------------------------------
// 1. PRINT FULL REGISTER (ALL PROJECTS)
// ------------------------------------------------------------------
export function printRegister(projects: ProjectWithVariations[]) {
  const allVariations = projects.flatMap(p => p.variations);
  const totalValue = allVariations.reduce((s, v) => s + v.estimated_value, 0);
  const now = new Date().toLocaleDateString('en-AU', { day: '2-digit', month: 'long', year: 'numeric' });
  const logoUrl = `${window.location.origin}/variation-shield-logo.jpg`;

  const projectSections = projects.map(p => {
    if (p.variations.length === 0) return '';
    const pTotal = p.variations.reduce((s, v) => s + v.estimated_value, 0);
    
    const rows = p.variations.map(v => `
      <tr>
        <td class="tabular-nums font-medium" style="color:#1B365D; font-family:monospace;">${getVariationNumber(v)}</td>
        <td class="font-medium">${escapeHtml(v.title)}</td>
        <td>${getStatusConfig(v.status).label}</td>
        <td class="text-muted capitalize">${v.instruction_source?.replace(/_/g, ' ') || '—'}</td>
        <td class="text-right tabular-nums">${formatDate(v.captured_at)}</td>
        <td class="text-right tabular-nums font-medium">${formatCurrency(v.estimated_value)}</td>
      </tr>
    `).join('');

    return `
      <div class="avoid-break" style="margin-bottom: 40px;">
        <div style="display:flex; justify-content:space-between; align-items:baseline; margin-bottom:12px; border-bottom:1px solid #E5E7EB; padding-bottom:8px;">
          <h3 style="font-size:12pt; font-weight:600;">${escapeHtml(p.name)}</h3>
          <span style="font-size:10pt; font-weight:600;">${formatCurrency(pTotal)}</span>
        </div>
        <table>
          <thead>
            <tr>
              <th style="width:80px">Var No.</th>
              <th>Description</th>
              <th style="width:100px">Status</th>
              <th style="width:100px">Source</th>
              <th style="width:100px; text-align:right">Date</th>
              <th style="width:120px; text-align:right">Value</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    `;
  }).join('');

  const html = `
    <div class="doc-header">
      <div>
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:6px;">
          <img src="${logoUrl}" style="width:32px;height:32px;border-radius:6px;object-fit:cover;" />
          <div class="brand">Variation Shield</div>
        </div>
        <div class="doc-title">Variation Register</div>
      </div>
      <div class="doc-meta">
        <div class="meta-row">Generated: ${now}</div>
        <div class="meta-row">${allVariations.length} items · ${projects.length} projects</div>
      </div>
    </div>

    <div class="summary-grid">
      <div class="summary-card">
        <div class="summary-label">Total Value</div>
        <div class="summary-value">${formatCurrency(totalValue)}</div>
      </div>
      <div class="summary-card">
        <div class="summary-label">Approved</div>
        <div class="summary-value">${formatCurrency(allVariations.filter(v => v.status === 'approved' || v.status === 'paid').reduce((s, v) => s + v.estimated_value, 0))}</div>
      </div>
      <div class="summary-card">
        <div class="summary-label">Pending</div>
        <div class="summary-value">${formatCurrency(allVariations.filter(v => v.status === 'submitted' || v.status === 'captured').reduce((s, v) => s + v.estimated_value, 0))}</div>
      </div>
      <div class="summary-card">
        <div class="summary-label">Disputed</div>
        <div class="summary-value">${formatCurrency(allVariations.filter(v => v.status === 'disputed').reduce((s, v) => s + v.estimated_value, 0))}</div>
      </div>
    </div>

    ${projectSections}

    <div class="footer">
      <div style="display:flex;align-items:center;gap:6px;">
        <img src="${logoUrl}" style="width:16px;height:16px;border-radius:3px;object-fit:cover;" />
        <span>Variation Shield</span>
      </div>
      <div>Page <span class="page-number"></span></div>
    </div>
  `;

  openHtml(html, `Variation Register - ${now}`);
}

// ------------------------------------------------------------------
// 2. PRINT PROJECT REGISTER (SINGLE PROJECT)
// ------------------------------------------------------------------
export function printProjectRegister(project: Project, variations: Variation[]) {
  const totalValue = variations.reduce((s, v) => s + v.estimated_value, 0);
  const now = new Date().toLocaleDateString('en-AU', { day: '2-digit', month: 'long', year: 'numeric' });
  const logoUrl = `${window.location.origin}/variation-shield-logo.jpg`;

  const rows = variations.map(v => `
    <tr>
      <td class="tabular-nums font-medium" style="color:#1B365D; font-family:monospace;">${getVariationNumber(v)}</td>
      <td class="font-medium">${escapeHtml(v.title)}</td>
      <td>${getStatusConfig(v.status).label}</td>
      <td class="text-muted capitalize">${v.instruction_source?.replace(/_/g, ' ') || '—'}</td>
      <td class="text-right tabular-nums">${formatDate(v.captured_at)}</td>
      <td class="text-right tabular-nums font-medium">${formatCurrency(v.estimated_value)}</td>
    </tr>
  `).join('');

  const html = `
    <div class="doc-header">
      <div>
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:6px;">
          <img src="${logoUrl}" style="width:32px;height:32px;border-radius:6px;object-fit:cover;" />
          <div class="brand">Variation Shield</div>
        </div>
        <div class="doc-title">${escapeHtml(project.name)}</div>
        <div style="font-size:11pt; color:#6B7280; margin-top:4px;">${escapeHtml(project.client)}</div>
      </div>
      <div class="doc-meta">
        <div class="meta-row">Generated: ${now}</div>
        <div class="meta-row">${variations.length} variations</div>
      </div>
    </div>

    <table>
      <thead>
        <tr>
          <th style="width:80px">Var No.</th>
          <th>Description</th>
          <th style="width:100px">Status</th>
          <th style="width:100px">Source</th>
          <th style="width:100px; text-align:right">Date</th>
          <th style="width:120px; text-align:right">Value</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
      <tfoot>
        <tr class="total-row">
          <td colspan="5" class="text-right">Project Total</td>
          <td class="text-right tabular-nums">${formatCurrency(totalValue)}</td>
        </tr>
      </tfoot>
    </table>

    <div class="footer">
      <div style="display:flex;align-items:center;gap:6px;">
        <img src="${logoUrl}" style="width:16px;height:16px;border-radius:3px;object-fit:cover;" />
        <span>Variation Shield</span>
      </div>
      <div>${escapeHtml(project.name)}</div>
    </div>
  `;

  openHtml(html, `${project.name} - Variation Register`);
}

// ------------------------------------------------------------------
// 3. PRINT VARIATION NOTICE (SINGLE NOTICE)
// ------------------------------------------------------------------
export function printNotice(
  notice: VariationNotice,
  project: Project,
  companyName: string = ''
) {
  const now = new Date().toLocaleDateString('en-AU', { day: '2-digit', month: 'long', year: 'numeric' });
  const logoUrl = `${window.location.origin}/variation-shield-logo.jpg`;

  const eventDateFormatted = new Date(notice.event_date + 'T00:00:00').toLocaleDateString('en-AU', {
    day: '2-digit', month: 'long', year: 'numeric',
  });
  const issuedFormatted = notice.issued_at
    ? new Date(notice.issued_at).toLocaleDateString('en-AU', { day: '2-digit', month: 'long', year: 'numeric' })
    : '—';

  const costCheck = notice.cost_flag ? '☑' : '☐';
  const costClear = notice.cost_flag ? '☐' : '☑';
  const timeCheck = notice.time_flag ? '☑' : '☐';
  const timeClear = notice.time_flag ? '☐' : '☑';

  const html = `
    <div class="doc-header">
      <div>
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:6px;">
          <img src="${logoUrl}" style="width:32px;height:32px;border-radius:6px;object-fit:cover;" />
          <div class="brand">${escapeHtml(companyName || 'Variation Shield')}</div>
        </div>
        <div class="doc-title">Variation Notice</div>
      </div>
      <div class="doc-meta">
        <div class="meta-row" style="font-size:14pt; font-weight:700; color:#1C1C1E; margin-bottom:6px;">${escapeHtml(notice.notice_number)}</div>
        <div class="meta-row">Issued: ${issuedFormatted}</div>
        <div class="meta-row">Status: <strong style="text-transform:capitalize;">${notice.status}</strong></div>
      </div>
    </div>

    <div class="detail-grid" style="margin-bottom:24px;">
      <div>
        <div class="field-group">
          <div class="field-label">Project</div>
          <div class="field-value large">${escapeHtml(project.name)}</div>
        </div>
        <div class="field-group">
          <div class="field-label">Client</div>
          <div class="field-value">${escapeHtml(project.client)}</div>
        </div>
        ${project.reference ? `<div class="field-group"><div class="field-label">Contract Ref</div><div class="field-value">${escapeHtml(project.reference)}</div></div>` : ''}
      </div>
      <div>
        <div class="field-group">
          <div class="field-label">Event Date</div>
          <div class="field-value">${eventDateFormatted}</div>
        </div>
        ${notice.contract_clause ? `<div class="field-group"><div class="field-label">Contract Clause</div><div class="field-value">${escapeHtml(notice.contract_clause)}</div></div>` : ''}
        ${notice.issued_by_name ? `<div class="field-group"><div class="field-label">Issued By</div><div class="field-value">${escapeHtml(notice.issued_by_name)}</div>${notice.issued_by_email ? `<div class="field-value text-muted" style="font-weight:400;font-size:9pt;margin-top:2px;">${escapeHtml(notice.issued_by_email)}</div>` : ''}</div>` : ''}
      </div>
    </div>

    <div style="margin-bottom:24px; padding:16px 0; border-top:1px solid #E5E7EB; border-bottom:1px solid #E5E7EB;">
      <div style="font-size:9pt; color:#6B7280; margin-bottom:8px;">TO: ${escapeHtml(project.client)}</div>
      <div style="font-size:10pt; line-height:1.6;">
        TAKE NOTICE that the undersigned hereby gives notice pursuant to the contract that a variation event has occurred as described below.
      </div>
    </div>

    <div class="description-box">
      <div class="field-label">Description of Event</div>
      <div class="description-text">${escapeHtml(notice.event_description)}</div>
    </div>

    <div style="margin-bottom:32px;">
      <table style="width:auto; border-collapse:collapse;">
        <tr>
          <td style="padding:6px 16px 6px 0; font-size:9pt; font-weight:600; text-transform:uppercase; letter-spacing:0.05em; color:#6B7280; white-space:nowrap;">Cost Implication</td>
          <td style="padding:6px 0; font-size:10pt;">${costCheck} Yes &nbsp;&nbsp; ${costClear} No</td>
        </tr>
        <tr>
          <td style="padding:6px 16px 6px 0; font-size:9pt; font-weight:600; text-transform:uppercase; letter-spacing:0.05em; color:#6B7280; white-space:nowrap;">Time Implication</td>
          <td style="padding:6px 0; font-size:10pt;">${timeCheck} Yes &nbsp;&nbsp; ${timeClear} No</td>
        </tr>
        ${notice.time_flag && notice.estimated_days != null ? `
        <tr>
          <td style="padding:6px 16px 6px 0; font-size:9pt; font-weight:600; text-transform:uppercase; letter-spacing:0.05em; color:#6B7280; white-space:nowrap;">Estimated Days</td>
          <td style="padding:6px 0; font-size:10pt;">${notice.estimated_days}</td>
        </tr>
        ` : ''}
        ${notice.contract_clause ? `
        <tr>
          <td style="padding:6px 16px 6px 0; font-size:9pt; font-weight:600; text-transform:uppercase; letter-spacing:0.05em; color:#6B7280; white-space:nowrap;">Contract Clause</td>
          <td style="padding:6px 0; font-size:10pt;">${escapeHtml(notice.contract_clause)}</td>
        </tr>
        ` : ''}
      </table>
    </div>

    <div style="font-size:10pt; line-height:1.6; margin-bottom:32px;">
      A formal Variation Request will be submitted in accordance with the contract.
    </div>

    <div style="display:flex; justify-content:space-between; padding-top:24px; border-top:1px solid #E5E7EB;">
      <div>
        <div class="field-label">Issued by</div>
        <div class="field-value">${escapeHtml(notice.issued_by_name || '—')}</div>
        ${notice.issued_by_email ? `<div style="font-size:9pt; color:#6B7280; margin-top:2px;">${escapeHtml(notice.issued_by_email)}</div>` : ''}
      </div>
      <div style="text-align:right;">
        <div class="field-label">${escapeHtml(notice.notice_number)}</div>
        <div class="field-value">${escapeHtml(companyName || 'Variation Shield')}</div>
      </div>
    </div>

    <div class="footer">
      <div style="display:flex;align-items:center;gap:6px;">
        <img src="${logoUrl}" style="width:16px;height:16px;border-radius:3px;object-fit:cover;" />
        <span>Variation Shield</span>
      </div>
      <div>${escapeHtml(notice.notice_number)} · ${escapeHtml(project.name)}</div>
    </div>
  `;

  openHtml(html, `${notice.notice_number} - Variation Notice`);
}

// ------------------------------------------------------------------
// 4. PRINT VARIATION INSTRUCTION (SINGLE ITEM)
// ------------------------------------------------------------------
export function printVariation(
  variation: Variation, 
  project: Project, 
  photos: PhotoEvidence[], 
  photoUrls: Record<string, string>,
  companyName: string = ''
) {
  const now = new Date().toLocaleDateString('en-AU', { day: '2-digit', month: 'long', year: 'numeric' });
  const status = getStatusConfig(variation.status).label;
  const varNumber = getVariationNumber(variation);
  const logoUrl = `${window.location.origin}/variation-shield-logo.jpg`;
  
  const photoGrid = photos.length > 0 ? `
    <div class="avoid-break">
      <h3 style="font-size:11pt; font-weight:600; text-transform:uppercase; letter-spacing:0.05em; margin-bottom:16px; border-bottom:1px solid #E5E7EB; padding-bottom:8px;">Photographic Evidence</h3>
      <div class="photo-grid">
        ${photos.map(p => {
          const url = photoUrls[p.id];
          if (!url) return '';
          return `
            <div class="photo-item">
              <img src="${url}" class="photo-img" />
              <div class="photo-caption">${formatDate(p.captured_at)}</div>
            </div>
          `;
        }).join('')}
      </div>
    </div>
  ` : '';

  const displayName = variation.requestor_name && !variation.requestor_name.includes('@')
    ? variation.requestor_name
    : '—';

  const requestorSection = (variation.requestor_name || variation.requestor_email) ? `
    <div class="field-group">
      <div class="field-label">Submitted By</div>
      <div class="field-value">${escapeHtml(displayName)}</div>
      ${variation.requestor_email ? `<div class="field-value text-muted" style="font-weight:400; margin-top:2px; font-size:9pt;">${escapeHtml(variation.requestor_email)}</div>` : ''}
    </div>
  ` : '';



  const html = `
    <div class="doc-header">
      <div>
        <div class="brand">${escapeHtml(companyName || project.name)}</div>
        <div class="doc-title">Variation Form</div>
      </div>
      <div class="doc-meta">
        <div class="meta-row" style="font-size:11pt; font-weight:700; color:#1C1C1E; margin-bottom:6px;">${escapeHtml(varNumber)}</div>
        <div class="meta-row">Date: ${formatDate(variation.captured_at)}</div>
        <div class="meta-row">Status: <strong>${status}</strong></div>
      </div>
    </div>

    <div class="detail-grid">
      <div>
        <div class="field-group">
          <div class="field-label">Project</div>
          <div class="field-value large">${escapeHtml(project.name)}</div>
          <div class="field-value text-muted" style="font-weight:400; margin-top:2px;">${escapeHtml(project.client)}</div>
        </div>
        <div class="field-group">
          <div class="field-label">Instruction Source</div>
          <div class="field-value capitalize">${variation.instruction_source?.replace(/_/g, ' ') || '—'}</div>
        </div>
        ${requestorSection}
      </div>
      <div>
        <div class="field-group">
          <div class="field-label">Estimated Value</div>
          <div class="field-value large tabular-nums">${formatCurrency(variation.estimated_value)}</div>
        </div>
        <div class="field-group">
          <div class="field-label">Instructed By</div>
          <div class="field-value">${escapeHtml(variation.instructed_by || '—')}</div>
        </div>
        ${variation.reference_doc ? `
        <div class="field-group">
          <div class="field-label">Reference Document</div>
          <div class="field-value">${escapeHtml(variation.reference_doc)}</div>
        </div>
        ` : ''}
      </div>
    </div>

    <div class="description-box">
      <div class="field-label">Description of Works</div>
      <div class="description-text">${escapeHtml(variation.ai_description || variation.description || '')}</div>
    </div>

    ${variation.notes ? `
      <div class="avoid-break" style="margin-bottom:32px;">
        <div class="field-label">Additional Notes</div>
        <div class="description-text">${escapeHtml(variation.notes)}</div>
      </div>
    ` : ''}

    ${photoGrid}

    <div class="footer">
      <div style="display:flex;align-items:center;gap:6px;">
        <img src="${logoUrl}" style="width:16px;height:16px;border-radius:3px;object-fit:cover;" />
        <span>Variation Shield</span>
      </div>
      <div>${escapeHtml(varNumber)} · Ref: ${variation.evidence_hash?.substring(0,8) || ''}</div>
    </div>
  `;

  openHtml(html, `${varNumber} - ${variation.title}`);
}
