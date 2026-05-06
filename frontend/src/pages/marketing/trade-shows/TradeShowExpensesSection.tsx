import React, { useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  tradeShowsApi,
  TradeShowExpense,
  TradeShowExpenseCategory,
  EXPENSE_CATEGORY_OPTIONS,
} from '../../../services/tradeShows';
import { useTitanFeedback } from '../../../context/TitanFeedbackContext';

interface Props {
  tradeShowId: number;
  expenses: TradeShowExpense[];
  totalBudget: number | null;
}

const fmtMoney = (n: number) =>
  '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const fmtDate = (val?: string | null) => {
  if (!val) return '—';
  const d = new Date(val.includes('T') ? val : val + 'T00:00:00');
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

const sectionTitle: React.CSSProperties = {
  fontSize: '0.9rem',
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
  color: '#475569',
  marginTop: 0,
  marginBottom: '1rem',
  paddingBottom: '0.5rem',
  borderBottom: '1px solid #e5e7eb',
};

const labelStyle: React.CSSProperties = {
  fontSize: '0.75rem',
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
  color: '#6b7280',
  fontWeight: 600,
  marginBottom: '0.25rem',
};

type ExpenseFormState = {
  category: TradeShowExpenseCategory;
  description: string;
  vendor: string;
  amount: string;
  expense_date: string;
  notes: string;
};

const emptyExpense: ExpenseFormState = {
  category: 'other',
  description: '',
  vendor: '',
  amount: '',
  expense_date: '',
  notes: '',
};

const categoryLabel = (c: string) =>
  EXPENSE_CATEGORY_OPTIONS.find(o => o.value === c)?.label || c;

const TradeShowExpensesSection: React.FC<Props> = ({ tradeShowId, expenses, totalBudget }) => {
  const queryClient = useQueryClient();
  const { confirm } = useTitanFeedback();

  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<TradeShowExpense | null>(null);
  const [form, setForm] = useState<ExpenseFormState>(emptyExpense);
  const [error, setError] = useState<string | null>(null);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['trade-show', String(tradeShowId)] });

  const addMutation = useMutation({
    mutationFn: (data: Partial<TradeShowExpense>) => tradeShowsApi.addExpense(tradeShowId, data),
    onSuccess: () => { invalidate(); closeModal(); },
    onError: (err: any) => setError(err?.response?.data?.error || 'Failed to add expense'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ expenseId, data }: { expenseId: number; data: Partial<TradeShowExpense> }) =>
      tradeShowsApi.updateExpense(tradeShowId, expenseId, data),
    onSuccess: () => { invalidate(); closeModal(); },
    onError: (err: any) => setError(err?.response?.data?.error || 'Failed to update expense'),
  });

  const deleteMutation = useMutation({
    mutationFn: (expenseId: number) => tradeShowsApi.removeExpense(tradeShowId, expenseId),
    onSuccess: invalidate,
  });

  const closeModal = () => {
    setShowModal(false);
    setEditing(null);
    setForm(emptyExpense);
    setError(null);
  };

  const openAdd = () => {
    setEditing(null);
    setForm(emptyExpense);
    setError(null);
    setShowModal(true);
  };

  const openEdit = (e: TradeShowExpense) => {
    setEditing(e);
    setForm({
      category: e.category,
      description: e.description || '',
      vendor: e.vendor || '',
      amount: String(e.amount ?? ''),
      expense_date: (e.expense_date || '').split('T')[0],
      notes: e.notes || '',
    });
    setError(null);
    setShowModal(true);
  };

  const handleDelete = async (e: TradeShowExpense) => {
    const ok = await confirm({
      message: `Delete this ${categoryLabel(e.category)} expense?`,
      title: 'Delete Expense',
      danger: true,
    });
    if (ok) deleteMutation.mutate(e.id);
  };

  const submit = (ev: React.FormEvent) => {
    ev.preventDefault();
    setError(null);
    const amt = parseFloat(form.amount);
    if (isNaN(amt)) {
      setError('Please enter a valid amount');
      return;
    }
    const data: Partial<TradeShowExpense> = {
      category: form.category,
      description: form.description.trim() || null,
      vendor: form.vendor.trim() || null,
      amount: amt,
      expense_date: form.expense_date || null,
      notes: form.notes.trim() || null,
    };
    if (editing) {
      updateMutation.mutate({ expenseId: editing.id, data });
    } else {
      addMutation.mutate(data);
    }
  };

  const grouped = useMemo(() => {
    const map = new Map<string, { items: TradeShowExpense[]; subtotal: number }>();
    for (const e of expenses) {
      const key = e.category || 'other';
      const amt = typeof e.amount === 'string' ? parseFloat(e.amount) : (e.amount ?? 0);
      if (!map.has(key)) map.set(key, { items: [], subtotal: 0 });
      const bucket = map.get(key)!;
      bucket.items.push(e);
      bucket.subtotal += isNaN(amt) ? 0 : amt;
    }
    return Array.from(map.entries()).sort((a, b) => {
      const aIdx = EXPENSE_CATEGORY_OPTIONS.findIndex(o => o.value === a[0]);
      const bIdx = EXPENSE_CATEGORY_OPTIONS.findIndex(o => o.value === b[0]);
      return aIdx - bIdx;
    });
  }, [expenses]);

  const total = useMemo(() => {
    return expenses.reduce((sum, e) => {
      const amt = typeof e.amount === 'string' ? parseFloat(e.amount) : (e.amount ?? 0);
      return sum + (isNaN(amt) ? 0 : amt);
    }, 0);
  }, [expenses]);

  const variance = totalBudget !== null ? totalBudget - total : null;

  return (
    <div className="card" style={{ padding: '1.25rem', marginBottom: '1.5rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h3 style={{ ...sectionTitle, marginBottom: 0, paddingBottom: 0, borderBottom: 'none' }}>
          Expense Tracking
        </h3>
        <button className="btn btn-primary" onClick={openAdd}>+ Add Expense</button>
      </div>

      {expenses.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '2rem 1rem', color: '#6b7280' }}>
          No expenses tracked yet. Add the first expense to start tracking actuals against the budget.
        </div>
      ) : (
        <>
          <div style={{ overflowX: 'auto', marginBottom: '1rem' }}>
            <table className="sales-table" style={{ tableLayout: 'auto' }}>
              <thead>
                <tr>
                  <th style={{ width: '160px' }}>Category</th>
                  <th>Description</th>
                  <th>Vendor</th>
                  <th style={{ width: '110px' }}>Date</th>
                  <th style={{ width: '120px', textAlign: 'right' }}>Amount</th>
                  <th style={{ width: '90px' }}></th>
                </tr>
              </thead>
              <tbody>
                {grouped.map(([category, { items, subtotal }]) => (
                  <React.Fragment key={category}>
                    {items.map(e => (
                      <tr key={e.id}>
                        <td style={{ fontWeight: 600 }}>{categoryLabel(e.category)}</td>
                        <td>
                          {e.description || <span style={{ color: '#9ca3af' }}>—</span>}
                          {e.notes && (
                            <div style={{ fontSize: '0.75rem', color: '#6b7280', fontWeight: 'normal', marginTop: '2px' }}>
                              {e.notes}
                            </div>
                          )}
                        </td>
                        <td>{e.vendor || <span style={{ color: '#9ca3af' }}>—</span>}</td>
                        <td className="sales-date-cell">{fmtDate(e.expense_date)}</td>
                        <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                          {fmtMoney(typeof e.amount === 'string' ? parseFloat(e.amount) : (e.amount ?? 0))}
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <button
                            onClick={() => openEdit(e)}
                            title="Edit"
                            style={{ background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', fontSize: '0.95rem', padding: '4px 6px', marginRight: '4px' }}
                            onMouseEnter={(ev) => (ev.currentTarget.style.color = '#3b82f6')}
                            onMouseLeave={(ev) => (ev.currentTarget.style.color = '#6b7280')}
                          >
                            ✏️
                          </button>
                          <button
                            onClick={() => handleDelete(e)}
                            title="Delete"
                            style={{ background: 'none', border: 'none', color: '#9ca3af', cursor: 'pointer', fontSize: '0.95rem', padding: '4px 6px' }}
                            onMouseEnter={(ev) => (ev.currentTarget.style.color = '#ef4444')}
                            onMouseLeave={(ev) => (ev.currentTarget.style.color = '#9ca3af')}
                          >
                            🗑️
                          </button>
                        </td>
                      </tr>
                    ))}
                    <tr style={{ background: '#f9fafb' }}>
                      <td colSpan={4} style={{ fontWeight: 600, color: '#475569', fontSize: '0.85rem' }}>
                        {categoryLabel(category)} subtotal
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: '#475569' }}>
                        {fmtMoney(subtotal)}
                      </td>
                      <td></td>
                    </tr>
                  </React.Fragment>
                ))}
                <tr style={{ borderTop: '2px solid #1f2937' }}>
                  <td colSpan={4} style={{ fontWeight: 700, fontSize: '1rem', paddingTop: '0.75rem' }}>
                    Total Expenses
                  </td>
                  <td style={{ textAlign: 'right', fontWeight: 700, fontSize: '1rem', fontVariantNumeric: 'tabular-nums', paddingTop: '0.75rem' }}>
                    {fmtMoney(total)}
                  </td>
                  <td></td>
                </tr>
              </tbody>
            </table>
          </div>

          {totalBudget !== null && (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
              gap: '0.75rem',
              padding: '0.75rem 1rem',
              background: '#f9fafb',
              borderRadius: '6px',
              border: '1px solid #e5e7eb',
            }}>
              <div>
                <div style={labelStyle}>Budget</div>
                <div style={{ fontWeight: 600 }}>{fmtMoney(totalBudget)}</div>
              </div>
              <div>
                <div style={labelStyle}>Actual</div>
                <div style={{ fontWeight: 600 }}>{fmtMoney(total)}</div>
              </div>
              <div>
                <div style={labelStyle}>Variance</div>
                <div style={{
                  fontWeight: 700,
                  color: (variance ?? 0) >= 0 ? '#10b981' : '#dc2626',
                }}>
                  {variance !== null ? (variance >= 0 ? '+' : '') + fmtMoney(variance) : '—'}
                  {variance !== null && (
                    <span style={{ fontSize: '0.75rem', color: '#6b7280', marginLeft: '6px', fontWeight: 400 }}>
                      ({variance >= 0 ? 'under' : 'over'})
                    </span>
                  )}
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {showModal && (
        <div
          style={{
            position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.45)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
            padding: '1rem',
          }}
          onClick={closeModal}
        >
          <div
            style={{
              background: 'white', borderRadius: '12px', padding: '1.5rem',
              width: '100%', maxWidth: '520px', maxHeight: '90vh', overflowY: 'auto',
              boxShadow: '0 20px 50px rgba(0,0,0,0.25)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 style={{ fontSize: '1.25rem', fontWeight: 600, marginTop: 0, marginBottom: '1rem' }}>
              {editing ? 'Edit Expense' : 'Add Expense'}
            </h2>

            {error && (
              <div style={{ padding: '0.5rem 0.75rem', marginBottom: '0.75rem', background: '#fee2e2', borderRadius: '6px', color: '#991b1b', fontSize: '0.85rem' }}>
                {error}
              </div>
            )}

            <form onSubmit={submit}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div className="form-group">
                  <label className="form-label">Category *</label>
                  <select
                    className="form-input"
                    value={form.category}
                    onChange={(e) => setForm(f => ({ ...f, category: e.target.value as TradeShowExpenseCategory }))}
                  >
                    {EXPENSE_CATEGORY_OPTIONS.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Amount *</label>
                  <input
                    className="form-input"
                    type="number"
                    step="0.01"
                    value={form.amount}
                    onChange={(e) => setForm(f => ({ ...f, amount: e.target.value }))}
                    placeholder="0.00"
                    required
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Description</label>
                <input
                  className="form-input"
                  value={form.description}
                  onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="e.g., Hotel for 3 nights"
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div className="form-group">
                  <label className="form-label">Vendor</label>
                  <input
                    className="form-input"
                    value={form.vendor}
                    onChange={(e) => setForm(f => ({ ...f, vendor: e.target.value }))}
                    placeholder="e.g., Marriott"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Date</label>
                  <input
                    className="form-input"
                    type="date"
                    value={form.expense_date}
                    onChange={(e) => setForm(f => ({ ...f, expense_date: e.target.value }))}
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Notes</label>
                <textarea
                  className="form-input"
                  rows={2}
                  value={form.notes}
                  onChange={(e) => setForm(f => ({ ...f, notes: e.target.value }))}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1rem' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={closeModal}
                  disabled={addMutation.isPending || updateMutation.isPending}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={addMutation.isPending || updateMutation.isPending}
                >
                  {(addMutation.isPending || updateMutation.isPending)
                    ? 'Saving…'
                    : editing ? 'Save Changes' : 'Add Expense'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default TradeShowExpensesSection;
