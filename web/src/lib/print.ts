import { formatCurrency, formatDate, getStatusConfig } from './utils';
import type { Project, Variation, PhotoEvidence } from './types';

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

  const projectSections = projects.map(p => {
    if (p.variations.length === 0) return '';
    const pTotal = p.variations.reduce((s, v) => s + v.estimated_value, 0);
    
    const rows = p.variations.map(v => `
      <tr>
        <td class="tabular-nums text-muted">#${v.sequence_number}</td>
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
              <th style="width:50px">ID</th>
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
        <div class="brand">Variation Shield</div>
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
      <div>Leveraged Systems</div>
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

  const rows = variations.map(v => `
    <tr>
      <td class="tabular-nums text-muted">#${v.sequence_number}</td>
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
        <div class="brand">Variation Register</div>
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
          <th style="width:50px">ID</th>
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
      <div>Leveraged Systems</div>
      <div>${escapeHtml(project.name)}</div>
    </div>
  `;

  openHtml(html, `${project.name} - Variation Register`);
}

// ------------------------------------------------------------------
// 3. PRINT VARIATION INSTRUCTION (SINGLE ITEM)
// ------------------------------------------------------------------
export function printVariation(
  variation: Variation, 
  project: Project, 
  photos: PhotoEvidence[], 
  photoUrls: Record<string, string>
) {
  const now = new Date().toLocaleDateString('en-AU', { day: '2-digit', month: 'long', year: 'numeric' });
  const status = getStatusConfig(variation.status).label;
  
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

  const html = `
    <div class="doc-header">
      <div>
        <div class="brand">Variation Instruction</div>
        <div class="doc-title">#${variation.sequence_number}: ${escapeHtml(variation.title)}</div>
      </div>
      <div class="doc-meta">
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
      <div>Leveraged Systems</div>
      <div>Ref: ${variation.evidence_hash?.substring(0,8) || ''}</div>
    </div>
  `;

  openHtml(html, `Variation ${variation.sequence_number} - ${variation.title}`);
}
