'use client';

import { useEffect } from 'react';
import { Plus, Trash2 } from 'lucide-react';

export interface CostItem {
  id: string;
  description: string;
  qty: number | '';
  unit: string;
  rate: number | '';
  total: number;
}

interface Props {
  items: CostItem[];
  onChange: (items: CostItem[]) => void;
  onTotalChange?: (totalCents: number) => void;
}

const UNITS = ['hrs', 'days', 'each', 'm', 'm²', 'm³', 'lm', 't', 'lot'];

function calcTotal(item: CostItem): number {
  const qty = typeof item.qty === 'number' ? item.qty : 0;
  const rate = typeof item.rate === 'number' ? item.rate : 0;
  return Math.round(qty * rate * 100) / 100;
}

function newItem(): CostItem {
  return { id: crypto.randomUUID(), description: '', qty: '', unit: 'hrs', rate: '', total: 0 };
}

export default function CostItemsTable({ items, onChange, onTotalChange }: Props) {
  const grandTotal = items.reduce((s, i) => s + i.total, 0);

  useEffect(() => {
    onTotalChange?.(Math.round(grandTotal * 100)); // pass cents to parent
  }, [grandTotal]);

  function update(id: string, field: keyof CostItem, value: string | number) {
    const updated = items.map(item => {
      if (item.id !== id) return item;
      const next = { ...item, [field]: value };
      next.total = calcTotal(next);
      return next;
    });
    onChange(updated);
  }

  function addRow() {
    onChange([...items, newItem()]);
  }

  function removeRow(id: string) {
    onChange(items.filter(i => i.id !== id));
  }

  const inputCls = "w-full px-2 py-1.5 text-[13px] border border-[#D8D2C4] rounded outline-none bg-[#FFFCF5] focus:border-[#17212B] focus:ring-1 focus:ring-[#17212B]";

  return (
    <div className="space-y-2">
      {/* Table header — desktop */}
      <div className="hidden sm:grid grid-cols-[2fr_80px_90px_100px_90px_32px] gap-2 px-1">
        {['Description', 'Qty', 'Unit', 'Rate ($)', 'Total', ''].map(h => (
          <div key={h} className="text-[10px] font-medium uppercase tracking-wider" style={{ color: '#6B7280' }}>{h}</div>
        ))}
      </div>

      {/* Rows */}
      {items.length === 0 && (
        <div className="text-[13px] text-center py-4" style={{ color: '#6B7280' }}>
          No items yet — click Add Row below.
        </div>
      )}

      {items.map((item, idx) => (
        <div key={item.id} className="rounded-lg border border-[#D8D2C4] bg-[#FFFCF5] p-3 sm:p-0 sm:rounded-none sm:border-0 sm:bg-transparent space-y-2 sm:space-y-0">
          {/* Mobile label */}
          <div className="sm:hidden text-[11px] font-medium uppercase tracking-wider" style={{ color: '#6B7280' }}>Item {idx + 1}</div>

          {/* Mobile: description row */}
          <div className="sm:hidden flex items-center gap-2">
            <input
              type="text"
              value={item.description}
              onChange={e => update(item.id, 'description', e.target.value)}
              className={inputCls + ' flex-1'}
              placeholder="e.g. Site supervisor labour"
            />
            <button
              type="button"
              onClick={() => removeRow(item.id)}
              className="flex-shrink-0 flex items-center justify-center w-8 h-8 rounded hover:bg-[#FBE6E4] transition-colors"
            >
              <Trash2 size={15} style={{ color: '#6B7280' }} />
            </button>
          </div>

          {/* Mobile: qty / unit / rate / total row */}
          <div className="sm:hidden grid grid-cols-[1fr_90px_1fr_auto] gap-2 items-center">
            {/* Qty */}
            <div>
              <div className="text-[10px] font-medium uppercase tracking-wider mb-1" style={{ color: '#6B7280' }}>Qty</div>
              <input
                type="number"
                value={item.qty}
                onChange={e => update(item.id, 'qty', e.target.value === '' ? '' : parseFloat(e.target.value))}
                className={inputCls}
                placeholder="0"
                min="0"
                step="0.5"
              />
            </div>
            {/* Unit */}
            <div>
              <div className="text-[10px] font-medium uppercase tracking-wider mb-1" style={{ color: '#6B7280' }}>Unit</div>
              <select
                value={item.unit}
                onChange={e => update(item.id, 'unit', e.target.value)}
                className={inputCls}
              >
                {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
            {/* Rate */}
            <div>
              <div className="text-[10px] font-medium uppercase tracking-wider mb-1" style={{ color: '#6B7280' }}>Rate ($)</div>
              <div className="relative">
                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[12px]" style={{ color: '#6B7280' }}>$</span>
                <input
                  type="number"
                  value={item.rate}
                  onChange={e => update(item.id, 'rate', e.target.value === '' ? '' : parseFloat(e.target.value))}
                  className={inputCls + ' pl-5'}
                  placeholder="0.00"
                  min="0"
                  step="0.01"
                />
              </div>
            </div>
            {/* Total */}
            <div className="text-right">
              <div className="text-[10px] font-medium uppercase tracking-wider mb-1" style={{ color: '#6B7280' }}>Total</div>
              <div className="px-1 py-1.5 text-[13px] font-medium tabular-nums" style={{ color: '#111827' }}>
                ${item.total.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </div>
          </div>

          {/* Desktop: single row (unchanged) */}
          <div className="hidden sm:grid grid-cols-[2fr_80px_90px_100px_90px_32px] gap-2 items-center">
            <input
              type="text"
              value={item.description}
              onChange={e => update(item.id, 'description', e.target.value)}
              className={inputCls}
              placeholder="e.g. Site supervisor labour"
            />
            <input
              type="number"
              value={item.qty}
              onChange={e => update(item.id, 'qty', e.target.value === '' ? '' : parseFloat(e.target.value))}
              className={inputCls}
              placeholder="0"
              min="0"
              step="0.5"
            />
            <select
              value={item.unit}
              onChange={e => update(item.id, 'unit', e.target.value)}
              className={inputCls}
            >
              {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
            </select>
            <div className="relative">
              <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[12px]" style={{ color: '#6B7280' }}>$</span>
              <input
                type="number"
                value={item.rate}
                onChange={e => update(item.id, 'rate', e.target.value === '' ? '' : parseFloat(e.target.value))}
                className={inputCls + ' pl-5'}
                placeholder="0.00"
                min="0"
                step="0.01"
              />
            </div>
            <div className="px-2 py-1.5 text-[13px] font-medium text-right" style={{ color: '#111827' }}>
              ${item.total.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <button
              type="button"
              onClick={() => removeRow(item.id)}
              className="flex items-center justify-center w-7 h-7 rounded hover:bg-[#FBE6E4] transition-colors"
            >
              <Trash2 size={14} style={{ color: '#6B7280' }} />
            </button>
          </div>
        </div>
      ))}

      {/* Footer: Add row + total */}
      <div className="flex items-center justify-between pt-2 border-t" style={{ borderColor: '#D8D2C4' }}>
        <button
          type="button"
          onClick={addRow}
          className="flex items-center gap-1.5 text-[13px] font-medium px-3 py-1.5 rounded-md border border-[#D8D2C4] hover:bg-[#F5F2EA] transition-colors"
          style={{ color: '#17212B' }}
        >
          <Plus size={14} />
          Add Row
        </button>

        <div className="flex items-center gap-3">
          <span className="text-[12px] font-medium uppercase tracking-wider" style={{ color: '#6B7280' }}>Total</span>
          <span className="text-[16px] font-medium tabular-nums" style={{ color: '#111827' }}>
            ${grandTotal.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        </div>
      </div>
    </div>
  );
}
