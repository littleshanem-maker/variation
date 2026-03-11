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

  const inputCls = "w-full px-2 py-1.5 text-[13px] border border-[#E5E7EB] rounded outline-none bg-white focus:border-[#1B365D] focus:ring-1 focus:ring-[#1B365D]";

  return (
    <div className="space-y-2">
      {/* Table header — desktop */}
      <div className="hidden sm:grid grid-cols-[2fr_80px_90px_100px_90px_32px] gap-2 px-1">
        {['Description', 'Qty', 'Unit', 'Rate ($)', 'Total', ''].map(h => (
          <div key={h} className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: '#9CA3AF' }}>{h}</div>
        ))}
      </div>

      {/* Rows */}
      {items.length === 0 && (
        <div className="text-[13px] text-center py-4" style={{ color: '#9CA3AF' }}>
          No items yet — click Add Row below.
        </div>
      )}

      {items.map((item, idx) => (
        <div key={item.id}>
          {/* Mobile label */}
          <div className="sm:hidden text-[11px] font-medium mb-1" style={{ color: '#6B7280' }}>Item {idx + 1}</div>

          <div className="grid grid-cols-[2fr_80px_90px_100px_90px_32px] gap-2 items-center">
            {/* Description */}
            <input
              type="text"
              value={item.description}
              onChange={e => update(item.id, 'description', e.target.value)}
              className={inputCls}
              placeholder="e.g. Site supervisor labour"
            />

            {/* Qty */}
            <input
              type="number"
              value={item.qty}
              onChange={e => update(item.id, 'qty', e.target.value === '' ? '' : parseFloat(e.target.value))}
              className={inputCls}
              placeholder="0"
              min="0"
              step="0.5"
            />

            {/* Unit */}
            <select
              value={item.unit}
              onChange={e => update(item.id, 'unit', e.target.value)}
              className={inputCls}
            >
              {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
            </select>

            {/* Rate */}
            <div className="relative">
              <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[12px]" style={{ color: '#9CA3AF' }}>$</span>
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

            {/* Total */}
            <div className="px-2 py-1.5 text-[13px] font-medium text-right" style={{ color: '#1C1C1E' }}>
              ${item.total.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>

            {/* Delete */}
            <button
              type="button"
              onClick={() => removeRow(item.id)}
              className="flex items-center justify-center w-7 h-7 rounded hover:bg-red-50 transition-colors"
            >
              <Trash2 size={14} style={{ color: '#9CA3AF' }} />
            </button>
          </div>
        </div>
      ))}

      {/* Footer: Add row + total */}
      <div className="flex items-center justify-between pt-2 border-t" style={{ borderColor: '#F0F0EE' }}>
        <button
          type="button"
          onClick={addRow}
          className="flex items-center gap-1.5 text-[13px] font-medium px-3 py-1.5 rounded-md border border-[#E5E7EB] hover:bg-[#F5F3EF] transition-colors"
          style={{ color: '#1B365D' }}
        >
          <Plus size={14} />
          Add Row
        </button>

        <div className="flex items-center gap-3">
          <span className="text-[12px] font-semibold uppercase tracking-wider" style={{ color: '#9CA3AF' }}>Total</span>
          <span className="text-[16px] font-bold tabular-nums" style={{ color: '#1C1C1E' }}>
            ${grandTotal.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        </div>
      </div>
    </div>
  );
}
