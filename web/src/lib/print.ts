import { formatCurrency, formatDate, formatDocDate, formatDocDateOnly, getStatusConfig, getVariationNumber } from './utils';
import type { Project, Variation, PhotoEvidence, VariationNotice, Document } from './types';

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
  tbody tr { page-break-inside: avoid; break-inside: avoid; }
  thead { display: table-header-group; }
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
    margin-top: 32px;
    padding-top: 12px; 
    border-top: 1px solid #E5E7EB; 
    font-size: 8pt; 
    color: #9CA3AF; 
    display: flex; 
    justify-content: space-between; 
  }
`;

// Inline SVG for the Variation Shield logo (purple shield with V chevron)
const VS_LOGO_SVG_16 = `<svg width="16" height="16" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M16 2L5 6.8V15.6C5 22.2 9.8 28.1 16 30C22.2 28.1 27 22.2 27 15.6V6.8L16 2Z" fill="#4f46e5"/><path d="M16 4.2L7 8.4V15.6C7 21 11 26 16 27.7V4.2Z" fill="rgba(255,255,255,0.07)"/><path d="M10.5 12L16 21L21.5 12" stroke="white" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const VS_LOGO_SVG_32 = `<svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M16 2L5 6.8V15.6C5 22.2 9.8 28.1 16 30C22.2 28.1 27 22.2 27 15.6V6.8L16 2Z" fill="#4f46e5"/><path d="M16 4.2L7 8.4V15.6C7 21 11 26 16 27.7V4.2Z" fill="rgba(255,255,255,0.07)"/><path d="M10.5 12L16 21L21.5 12" stroke="white" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

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
          ${VS_LOGO_SVG_32}
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
        ${VS_LOGO_SVG_16}
        <span>Variation Shield</span>
      </div>
      <div>Page <span class="page-number"></span></div>
    </div>
  `;

  openHtml(html, `Variation Register - ${now}`);
}

// ------------------------------------------------------------------
// 1b. GET FILTERED REGISTER HTML FOR PDF EXPORT
// ------------------------------------------------------------------
export function getFilteredRegisterHtml(
  variations: (Variation & { project_name: string })[],
  label: string   // e.g. "All Projects" or "Northern Hospital — Submitted"
): { html: string; css: string } {
  const totalValue = variations.reduce((s, v) => s + (v.estimated_value || 0), 0);
  const now = new Date().toLocaleDateString('en-AU', { day: '2-digit', month: 'long', year: 'numeric' });

  const rows = variations.map(v => `
    <tr>
      <td class="tabular-nums font-medium" style="color:#1B365D; font-family:monospace;">${getVariationNumber(v)}</td>
      <td class="font-medium">${escapeHtml(v.title)}</td>
      <td class="text-muted">${escapeHtml(v.project_name)}</td>
      <td>${getStatusConfig(v.status).label}</td>
      <td class="text-muted capitalize">${v.instruction_source?.replace(/_/g, ' ') || '—'}</td>
      <td class="text-right tabular-nums">${formatDate(v.captured_at)}</td>
      <td class="text-right tabular-nums font-medium">${formatCurrency(v.estimated_value)}</td>
    </tr>
  `).join('');

  const approvedValue = variations.filter(v => ['approved', 'paid'].includes(v.status)).reduce((s, v) => s + (v.estimated_value || 0), 0);
  const pendingValue  = variations.filter(v => ['submitted', 'captured', 'draft'].includes(v.status)).reduce((s, v) => s + (v.estimated_value || 0), 0);
  const disputedValue = variations.filter(v => v.status === 'disputed').reduce((s, v) => s + (v.estimated_value || 0), 0);

  const html = `
    <div class="doc-header">
      <div>
        <div class="brand">Variation Shield</div>
        <div class="doc-title">Variation Register</div>
        <div style="font-size:10pt; color:#6B7280; margin-top:4px;">${escapeHtml(label)}</div>
      </div>
      <div class="doc-meta">
        <div class="meta-row">Generated: ${now}</div>
        <div class="meta-row">${variations.length} variation${variations.length !== 1 ? 's' : ''}</div>
      </div>
    </div>

    <div class="summary-grid">
      <div class="summary-card">
        <div class="summary-label">Total Value</div>
        <div class="summary-value">${formatCurrency(totalValue)}</div>
      </div>
      <div class="summary-card">
        <div class="summary-label">Approved / Paid</div>
        <div class="summary-value">${formatCurrency(approvedValue)}</div>
      </div>
      <div class="summary-card">
        <div class="summary-label">Pending</div>
        <div class="summary-value">${formatCurrency(pendingValue)}</div>
      </div>
      <div class="summary-card">
        <div class="summary-label">Disputed</div>
        <div class="summary-value">${formatCurrency(disputedValue)}</div>
      </div>
    </div>

    <table>
      <thead>
        <tr>
          <th style="width:80px">Var No.</th>
          <th>Title</th>
          <th style="width:140px">Project</th>
          <th style="width:90px">Status</th>
          <th style="width:100px">Source</th>
          <th style="width:90px; text-align:right">Date</th>
          <th style="width:110px; text-align:right">Value</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
      <tfoot>
        <tr class="total-row">
          <td colspan="6" class="text-right">Total</td>
          <td class="text-right tabular-nums">${formatCurrency(totalValue)}</td>
        </tr>
      </tfoot>
    </table>
  `;

  return { html, css: GLOBAL_CSS };
}

// ------------------------------------------------------------------
// 2. PRINT PROJECT REGISTER (SINGLE PROJECT)
// ------------------------------------------------------------------
export function printProjectRegister(project: Project, variations: Variation[]) {
  const totalValue = variations.reduce((s, v) => s + v.estimated_value, 0);
  const now = new Date().toLocaleDateString('en-AU', { day: '2-digit', month: 'long', year: 'numeric' });

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
          ${VS_LOGO_SVG_32}
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
        ${VS_LOGO_SVG_16}
        <span>Variation Shield</span>
      </div>
      <div>${escapeHtml(project.name)}</div>
    </div>
  `;

  openHtml(html, `${project.name} - Variation Register`);
}

// ------------------------------------------------------------------
// 3a. BUILDER: VARIATION NOTICE HTML
// ------------------------------------------------------------------
type CompanyPrintInfo = {
  logoUrl?: string;
  abn?: string;
  address?: string;
  phone?: string;
  preferredStandard?: 'AS4000' | 'AS2124' | 'both';
};

function getNoticeLanguage(standard?: 'AS4000' | 'AS2124' | 'both'): string {
  if (standard === 'AS4000') {
    return `TAKE NOTICE that pursuant to Clause 36 of AS 4000–1997 <em>(General Conditions of Contract)</em>, the Contractor hereby gives notice that the following event constitutes a Variation to the Contract and claims an adjustment to the Contract Sum and/or time for Practical Completion accordingly.`;
  }
  if (standard === 'AS2124') {
    return `TAKE NOTICE that pursuant to Clause 40 of AS 2124–1992 <em>(General Conditions of Contract)</em>, the Contractor hereby gives notice that the following event constitutes a Variation to the Contract and claims an adjustment to the Contract Sum and/or time for Practical Completion accordingly.`;
  }
  return `TAKE NOTICE that pursuant to Clause 36 of AS 4000–1997 <em>(General Conditions of Contract)</em> or Clause 40 of AS 2124–1992 <em>(General Conditions of Contract)</em>, as applicable, the Contractor hereby gives notice that the following event constitutes a Variation to the Contract and claims an adjustment to the Contract Sum and/or time for Practical Completion accordingly.`;
}

function buildCompanyHeader(companyName: string, companyInfo?: CompanyPrintInfo): string {
  const logoImg = companyInfo?.logoUrl
    ? `<img src="${companyInfo.logoUrl}" style="height:48px;width:auto;max-width:120px;object-fit:contain;border-radius:4px;" />`
    : VS_LOGO_SVG_32;
  const nameBlock = companyInfo?.logoUrl
    ? `<div class="brand" style="font-size:13pt;">${escapeHtml(companyName || 'Variation Shield')}</div>`
    : `<div class="brand">${escapeHtml(companyName || 'Variation Shield')}</div>`;
  const meta = [
    companyInfo?.abn ? `ABN ${escapeHtml(companyInfo.abn)}` : '',
    companyInfo?.address ? escapeHtml(companyInfo.address) : '',
    companyInfo?.phone ? escapeHtml(companyInfo.phone) : '',
  ].filter(Boolean).map(s => `<div style="font-size:8pt;color:#6B7280;margin-top:2px;">${s}</div>`).join('');
  return `<div style="display:flex;align-items:center;gap:12px;margin-bottom:6px;">${logoImg}<div>${nameBlock}${meta}</div></div>`;
}

function buildNoticeHtml(
  notice: VariationNotice,
  project: Project,
  companyName: string,
  sender: { name: string; email: string },
  companyInfo?: CompanyPrintInfo,
  documents?: Document[],
  docUrls?: Record<string, string>
): string {
  // logoUrl kept for backward compat but footer now uses inline SVG

  const eventDateFormatted = formatDocDateOnly(notice.event_date + 'T00:00:00');
  const issuedFormatted = notice.issued_at ? formatDocDate(notice.issued_at) : '—';

  const costCheck = notice.cost_flag ? '☑' : '☐';
  const costClear = notice.cost_flag ? '☐' : '☑';
  const timeCheck = notice.time_flag ? '☑' : '☐';
  const timeClear = notice.time_flag ? '☐' : '☑';

  return `
    <div class="doc-header">
      <div>
        ${buildCompanyHeader(companyName, companyInfo)}
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
          <td style="padding:6px 16px 6px 0; font-size:9pt; font-weight:600; text-transform:uppercase; letter-spacing:0.05em; color:#6B7280; white-space:nowrap;">Time Implication</td>
          <td style="padding:6px 0; font-size:10pt;">${notice.estimated_days} ${notice.time_implication_unit || 'days'}</td>
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

    ${notice.cost_flag && (notice as any).cost_items?.length > 0 ? `
    <div style="margin-bottom:32px;">
      <div style="font-size:9pt; font-weight:700; text-transform:uppercase; letter-spacing:0.08em; color:#6B7280; margin-bottom:10px;">Cost Breakdown</div>
      <table style="width:100%; border-collapse:collapse; font-size:9pt;">
        <thead>
          <tr style="border-bottom:1px solid #E5E7EB;">
            <th style="text-align:left; padding:4px 8px 6px 0; color:#6B7280; font-weight:600;">Description</th>
            <th style="text-align:right; padding:4px 8px 6px 0; color:#6B7280; font-weight:600; width:60px;">Qty</th>
            <th style="text-align:left; padding:4px 8px 6px 0; color:#6B7280; font-weight:600; width:50px;">Unit</th>
            <th style="text-align:right; padding:4px 8px 6px 0; color:#6B7280; font-weight:600; width:80px;">Rate</th>
            <th style="text-align:right; padding:4px 0 6px 0; color:#6B7280; font-weight:600; width:80px;">Total</th>
          </tr>
        </thead>
        <tbody>
          ${(notice as any).cost_items.map((item: any) => `
          <tr style="border-bottom:1px solid #F5F5F5;">
            <td style="padding:5px 8px 5px 0; color:#1C1C1E;">${escapeHtml(item.description || '—')}</td>
            <td style="padding:5px 8px 5px 0; text-align:right; color:#1C1C1E;">${item.qty}</td>
            <td style="padding:5px 8px 5px 0; color:#6B7280;">${escapeHtml(item.unit || '')}</td>
            <td style="padding:5px 8px 5px 0; text-align:right; color:#1C1C1E;">$${Number(item.rate).toFixed(2)}</td>
            <td style="padding:5px 0; text-align:right; font-weight:600; color:#1C1C1E;">$${Number(item.total).toFixed(2)}</td>
          </tr>
          `).join('')}
          <tr style="border-top:2px solid #E5E7EB;">
            <td colspan="4" style="padding:8px 8px 4px 0; font-weight:700; font-size:9pt; text-align:right; color:#6B7280; text-transform:uppercase; letter-spacing:0.05em;">Total</td>
            <td style="padding:8px 0 4px 0; font-weight:700; font-size:10pt; text-align:right; color:#1C1C1E;">$${(notice as any).cost_items.reduce((s: number, i: any) => s + (Number(i.total) || 0), 0).toFixed(2)}</td>
          </tr>
        </tbody>
      </table>
    </div>
    ` : ''}

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

    <div style="margin-top:32px; padding-top:20px; border-top:2px solid #E5E7EB;">
      <div style="font-size:9pt; font-weight:700; text-transform:uppercase; letter-spacing:0.08em; color:#9CA3AF; margin-bottom:12px;">Document Information</div>
      <table style="width:100%; border-collapse:collapse; font-size:9pt;">
        <tr>
          <td style="padding:4px 0; color:#6B7280; width:160px; vertical-align:top;">Notice Number</td>
          <td style="padding:4px 0; font-weight:600; color:#1C1C1E;">${notice.notice_number}</td>
          <td style="padding:4px 0; color:#6B7280; width:160px; vertical-align:top;">Created</td>
          <td style="padding:4px 0; color:#1C1C1E;">${formatDocDate(notice.created_at)}</td>
        </tr>
        <tr>
          <td style="padding:4px 0; color:#6B7280; vertical-align:top;">Status</td>
          <td style="padding:4px 0; font-weight:600; color:#1C1C1E; text-transform:capitalize;">${notice.status}</td>
          <td style="padding:4px 0; color:#6B7280; vertical-align:top;">Issued</td>
          <td style="padding:4px 0; color:#1C1C1E;">${notice.issued_at ? formatDocDate(notice.issued_at) : '—'}</td>
        </tr>
        ${notice.acknowledged_at ? `
        <tr>
          <td style="padding:4px 0; color:#6B7280; vertical-align:top;">Acknowledged</td>
          <td style="padding:4px 0; color:#1C1C1E;" colspan="3">${formatDocDate(notice.acknowledged_at)}</td>
        </tr>
        ` : ''}
        <tr>
          <td style="padding:4px 0; color:#6B7280; vertical-align:top; padding-top:12px;">Sent By</td>
          <td style="padding:4px 0; font-weight:600; color:#1C1C1E; padding-top:12px;">${escapeHtml(sender.name || notice.issued_by_name || '—')}</td>
          <td style="padding:4px 0; color:#6B7280; vertical-align:top; padding-top:12px;">Email</td>
          <td style="padding:4px 0; color:#1C1C1E; padding-top:12px;">${escapeHtml(sender.email || notice.issued_by_email || '—')}</td>
        </tr>
        <tr>
          <td style="padding:4px 0; color:#6B7280; vertical-align:top;">Company</td>
          <td style="padding:4px 0; color:#1C1C1E;" colspan="3">${escapeHtml(companyName || '—')}</td>
        </tr>
        <tr>
          <td style="padding:4px 0; color:#6B7280; vertical-align:top;">Generated</td>
          <td style="padding:4px 0; color:#1C1C1E;" colspan="3">${formatDocDate(new Date().toISOString())}</td>
        </tr>
      </table>
    </div>

    ${buildAttachmentsSection(documents || [], docUrls || {})}

    <div style="margin-top:32px; padding:16px 0; border-top:1px solid #E5E7EB; border-bottom:1px solid #E5E7EB; margin-bottom:24px;">
      <div style="font-size:9pt; color:#6B7280; margin-bottom:8px;">TO: ${escapeHtml(project.client)}</div>
      <div style="font-size:10pt; line-height:1.6; margin-bottom:10px;">
        ${getNoticeLanguage(companyInfo?.preferredStandard)}
      </div>
      <div style="font-size:9pt; color:#6B7280; line-height:1.5;">
        The Contractor reserves all rights to claim additional time and cost in connection with this Variation in accordance with the Contract. The Principal/Superintendent is requested to provide written confirmation of this direction and the agreed adjustment within the time specified under the Contract.
      </div>
    </div>

    <div class="footer">
      <div style="display:flex;align-items:center;gap:6px;">
        ${VS_LOGO_SVG_16}
        <span>Variation Shield</span>
      </div>
      <div>${escapeHtml(notice.notice_number)} · ${escapeHtml(project.name)}</div>
    </div>
  `;
}

// ------------------------------------------------------------------
// 3. PRINT VARIATION NOTICE (SINGLE NOTICE)
// ------------------------------------------------------------------
export function printNotice(
  notice: VariationNotice,
  project: Project,
  companyName: string = '',
  sender: { name: string; email: string } = { name: '', email: '' },
  companyInfo?: CompanyPrintInfo,
  documents?: Document[],
  docUrls?: Record<string, string>
) {
  const html = buildNoticeHtml(notice, project, companyName, sender, companyInfo, documents, docUrls);
  openHtml(html, `${notice.notice_number} - Variation Notice`);
}

// ------------------------------------------------------------------
// 3b. GET NOTICE HTML FOR PDF EXPORT
// ------------------------------------------------------------------
export function getNoticeHtmlForPdf(
  notice: VariationNotice,
  project: Project,
  companyName: string,
  sender: { name: string; email: string },
  companyInfo?: CompanyPrintInfo,
  documents?: Document[],
  docUrls?: Record<string, string>
): { html: string; css: string } {
  return {
    html: buildNoticeHtml(notice, project, companyName, sender, companyInfo, documents, docUrls),
    css: GLOBAL_CSS,
  };
}

// ------------------------------------------------------------------
// 4a. BUILDER: VARIATION HTML
// ------------------------------------------------------------------
function buildAttachmentsSection(documents: Document[], docUrls: Record<string, string>): string {
  if (!documents || documents.length === 0) return '';
  const isImage = (type: string) => /^image\//i.test(type);
  const imageDocs = documents.filter(d => isImage(d.file_type));
  const otherDocs = documents.filter(d => !isImage(d.file_type));
  return `
    <div class="avoid-break" style="margin-bottom:32px;">
      <h3 style="font-size:11pt; font-weight:600; text-transform:uppercase; letter-spacing:0.05em; margin-bottom:16px; border-bottom:1px solid #E5E7EB; padding-bottom:8px;">Attachments</h3>
      ${imageDocs.length > 0 ? `
        <div class="photo-grid" style="margin-bottom:16px;">
          ${imageDocs.map(d => {
            const url = docUrls[d.id];
            if (!url) return '';
            return `<div class="photo-item">
              <img src="${url}" class="photo-img" />
              <div class="photo-caption">${escapeHtml(d.file_name)}</div>
            </div>`;
          }).join('')}
        </div>
      ` : ''}
      ${otherDocs.length > 0 ? `
        <ul style="list-style:none; padding:0; margin:0;">
          ${otherDocs.map(d => `
            <li style="padding:8px 0; border-bottom:1px solid #F0F0F0; font-size:9pt; color:#374151;">
              📎 ${escapeHtml(d.file_name)}
              <span style="color:#9CA3AF; font-size:8pt; margin-left:8px;">(${(d.file_size / 1024).toFixed(0)} KB)</span>
            </li>
          `).join('')}
        </ul>
      ` : ''}
    </div>
  `;
}

function buildVariationHtml(
  variation: Variation,
  project: Project,
  photos: PhotoEvidence[],
  photoUrls: Record<string, string>,
  companyName: string,
  sender: { name: string; email: string },
  linkedNotice?: VariationNotice | null,
  revisions?: Variation[],
  companyInfo?: CompanyPrintInfo,
  documents?: Document[],
  docUrls?: Record<string, string>
): string {
  const status = getStatusConfig(variation.status).label;
  const varNumber = getVariationNumber(variation);

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

  return `
    <div class="doc-header">
      <div>
        ${buildCompanyHeader(companyName || project.name, companyInfo)}
        <div class="doc-title">Variation Request</div>
      </div>
      <div class="doc-meta">
        <div class="meta-row" style="font-size:11pt; font-weight:700; color:#1C1C1E; margin-bottom:6px;">${escapeHtml(varNumber)}</div>
        <div class="meta-row">Date: ${formatDocDate(variation.captured_at)}</div>
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
        ${variation.response_due_date ? `
        <div class="field-group">
          <div class="field-label">Response Due</div>
          <div class="field-value" style="color:${new Date(variation.response_due_date + 'T00:00:00') < new Date() ? '#DC2626' : '#1C1C1E'};">${formatDocDateOnly(variation.response_due_date + 'T00:00:00')}</div>
        </div>
        ` : ''}
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
        ${linkedNotice ? `
        <div class="field-group">
          <div class="field-label">Variation Notice</div>
          <div class="field-value" style="font-family:monospace;">${escapeHtml(linkedNotice.notice_number)}</div>
          <div class="field-value text-muted" style="font-weight:400; margin-top:2px; font-size:9pt;">${linkedNotice.issued_at ? `Issued ${formatDocDate(linkedNotice.issued_at)}` : `Status: ${linkedNotice.status}`}</div>
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

    ${(variation as any).cost_items?.length > 0 ? `
    <div style="margin-bottom:32px;">
      <div style="font-size:9pt; font-weight:700; text-transform:uppercase; letter-spacing:0.08em; color:#6B7280; margin-bottom:10px;">Cost Breakdown</div>
      <table style="width:100%; border-collapse:collapse; font-size:9pt;">
        <thead>
          <tr style="border-bottom:1px solid #E5E7EB;">
            <th style="text-align:left; padding:4px 8px 6px 0; color:#6B7280; font-weight:600;">Description</th>
            <th style="text-align:right; padding:4px 8px 6px 0; color:#6B7280; font-weight:600; width:60px;">Qty</th>
            <th style="text-align:left; padding:4px 8px 6px 0; color:#6B7280; font-weight:600; width:50px;">Unit</th>
            <th style="text-align:right; padding:4px 8px 6px 0; color:#6B7280; font-weight:600; width:80px;">Rate</th>
            <th style="text-align:right; padding:4px 0 6px 0; color:#6B7280; font-weight:600; width:80px;">Total</th>
          </tr>
        </thead>
        <tbody>
          ${(variation as any).cost_items.map((item: any) => `
          <tr style="border-bottom:1px solid #F5F5F5;">
            <td style="padding:5px 8px 5px 0; color:#1C1C1E;">${escapeHtml(item.description || '—')}</td>
            <td style="padding:5px 8px 5px 0; text-align:right; color:#1C1C1E;">${item.qty}</td>
            <td style="padding:5px 8px 5px 0; color:#6B7280;">${escapeHtml(item.unit || '')}</td>
            <td style="padding:5px 8px 5px 0; text-align:right; color:#1C1C1E;">$${Number(item.rate).toFixed(2)}</td>
            <td style="padding:5px 0; text-align:right; font-weight:600; color:#1C1C1E;">$${Number(item.total).toFixed(2)}</td>
          </tr>
          `).join('')}
          <tr style="border-top:2px solid #E5E7EB;">
            <td colspan="4" style="padding:8px 8px 4px 0; font-weight:700; font-size:9pt; text-align:right; color:#6B7280; text-transform:uppercase; letter-spacing:0.05em;">Total</td>
            <td style="padding:8px 0 4px 0; font-weight:700; font-size:10pt; text-align:right; color:#1C1C1E;">$${(variation as any).cost_items.reduce((s: number, i: any) => s + (Number(i.total) || 0), 0).toFixed(2)}</td>
          </tr>
        </tbody>
      </table>
    </div>
    ` : ''}

    <div style="padding-top:20px; margin-bottom:32px;">
      <div style="font-size:9pt; font-weight:700; text-transform:uppercase; letter-spacing:0.08em; color:#9CA3AF; margin-bottom:12px;">Document Information</div>
      <table style="width:100%; border-collapse:collapse; font-size:9pt;">
        <tr>
          <td style="padding:4px 0; color:#6B7280; width:160px; vertical-align:top;">Variation No.</td>
          <td style="padding:4px 0; font-weight:600; color:#1C1C1E;">${escapeHtml(varNumber)}</td>
          <td style="padding:4px 0; color:#6B7280; width:160px; vertical-align:top;">Captured</td>
          <td style="padding:4px 0; color:#1C1C1E;">${formatDocDate(variation.captured_at)}</td>
        </tr>
        <tr>
          <td style="padding:4px 0; color:#6B7280; vertical-align:top;">Status</td>
          <td style="padding:4px 0; font-weight:600; color:#1C1C1E;">${escapeHtml(status)}</td>
          <td style="padding:4px 0; color:#6B7280; vertical-align:top;">Last Updated</td>
          <td style="padding:4px 0; color:#1C1C1E;">${formatDocDate(variation.updated_at)}</td>
        </tr>
        <tr>
          <td style="padding:4px 0; color:#6B7280; vertical-align:top; padding-top:12px;">Submitted By</td>
          <td style="padding:4px 0; font-weight:600; color:#1C1C1E; padding-top:12px;">${escapeHtml(sender.name || variation.requestor_name || '—')}</td>
          <td style="padding:4px 0; color:#6B7280; vertical-align:top; padding-top:12px;">Email</td>
          <td style="padding:4px 0; color:#1C1C1E; padding-top:12px;">${escapeHtml(sender.email || variation.requestor_email || '—')}</td>
        </tr>
        <tr>
          <td style="padding:4px 0; color:#6B7280; vertical-align:top;">Company</td>
          <td style="padding:4px 0; color:#1C1C1E;" colspan="3">${escapeHtml(companyName || '—')}</td>
        </tr>
        <tr>
          <td style="padding:4px 0; color:#6B7280; vertical-align:top;">Generated</td>
          <td style="padding:4px 0; color:#1C1C1E;" colspan="3">${formatDocDate(new Date().toISOString())}</td>
        </tr>
        ${variation.evidence_hash ? `
        <tr>
          <td style="padding:4px 0; color:#6B7280; vertical-align:top;">Document Ref</td>
          <td style="padding:4px 0; font-family:monospace; font-size:8pt; color:#6B7280;" colspan="3">${variation.evidence_hash.substring(0, 16)}...</td>
        </tr>
        ` : ''}
        ${revisions && revisions.length > 1 ? `
        <tr>
          <td colspan="4" style="padding-top:14px; padding-bottom:6px;">
            <div style="font-size:8pt; color:#6B7280; text-transform:uppercase; letter-spacing:0.05em; margin-bottom:6px; border-top:1px solid #E5E7EB; padding-top:12px;">Revision History</div>
            <table style="width:100%; border-collapse:collapse; font-size:9pt;">
              <tr>
                <th style="text-align:left; color:#6B7280; font-weight:500; padding-bottom:4px; width:180px;">Variation No.</th>
                <th style="text-align:left; color:#6B7280; font-weight:500; padding-bottom:4px; width:160px;">Date</th>
                <th style="text-align:left; color:#6B7280; font-weight:500; padding-bottom:4px;">Status</th>
              </tr>
              ${revisions.map(r => {
                const revNum = getVariationNumber(r);
                const isCurrent = r.id === variation.id;
                return `<tr style="${isCurrent ? 'font-weight:600;' : ''}">
                  <td style="padding:3px 0; color:#1C1C1E; font-family:monospace;">${escapeHtml(revNum)}${isCurrent ? ' ◀' : ''}</td>
                  <td style="padding:3px 0; color:#6B7280;">${formatDocDate(r.captured_at)}</td>
                  <td style="padding:3px 0; color:#1C1C1E; text-transform:capitalize;">${escapeHtml(r.status)}</td>
                </tr>`;
              }).join('')}
            </table>
          </td>
        </tr>
        ` : ''}
      </table>
    </div>

    ${photoGrid}

    ${buildAttachmentsSection(documents || [], docUrls || {})}

    <div style="margin-top:32px; padding:16px 0; border-top:1px solid #E5E7EB; border-bottom:1px solid #E5E7EB; margin-bottom:32px;">
      <div style="font-size:10pt; line-height:1.6; margin-bottom:10px;">
        ${getNoticeLanguage(companyInfo?.preferredStandard)}
      </div>
      <div style="font-size:9pt; color:#6B7280; line-height:1.5;">
        The Contractor reserves all rights to claim additional time and cost in connection with this Variation in accordance with the Contract. The Principal/Superintendent is requested to provide written confirmation of this direction and the agreed adjustment within the time specified under the Contract.
      </div>
    </div>

    <div class="footer">
      <div style="display:flex;align-items:center;gap:6px;">
        ${VS_LOGO_SVG_16}
        <span>Variation Shield</span>
      </div>
      <div>${escapeHtml(varNumber)} · Ref: ${variation.evidence_hash?.substring(0,8) || ''}</div>
    </div>
  `;
}

// ------------------------------------------------------------------
// 4. PRINT VARIATION INSTRUCTION (SINGLE ITEM)
// ------------------------------------------------------------------
export function printVariation(
  variation: Variation,
  project: Project,
  photos: PhotoEvidence[],
  photoUrls: Record<string, string>,
  companyName: string = '',
  sender: { name: string; email: string } = { name: '', email: '' },
  linkedNotice?: VariationNotice | null,
  revisions?: Variation[],
  companyInfo?: CompanyPrintInfo,
  documents?: Document[],
  docUrls?: Record<string, string>
) {
  const varNumber = getVariationNumber(variation);
  const html = buildVariationHtml(variation, project, photos, photoUrls, companyName, sender, linkedNotice, revisions, companyInfo, documents, docUrls);
  openHtml(html, `${varNumber} - ${variation.title}`);
}

// ------------------------------------------------------------------
// 4b. GET VARIATION HTML FOR PDF EXPORT
// ------------------------------------------------------------------
export function getVariationHtmlForPdf(
  variation: Variation,
  project: Project,
  photos: PhotoEvidence[],
  photoUrls: Record<string, string>,
  companyName: string,
  sender: { name: string; email: string },
  linkedNotice?: VariationNotice | null,
  revisions?: Variation[],
  companyInfo?: CompanyPrintInfo,
  documents?: Document[],
  docUrls?: Record<string, string>
): { html: string; css: string } {
  return {
    html: buildVariationHtml(variation, project, photos, photoUrls, companyName, sender, linkedNotice, revisions, companyInfo, documents, docUrls),
    css: GLOBAL_CSS,
  };
}
