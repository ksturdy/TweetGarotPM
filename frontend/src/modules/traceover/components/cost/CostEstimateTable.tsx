import { useState, useCallback } from 'react';
import { Calculator, Download } from 'lucide-react';
import { useBomStore } from '../../stores/useBomStore';
import { usePdfStore } from '../../stores/usePdfStore';
import { downloadCsv } from '../../lib/export/csv';
import { formatCurrency, formatPercent } from '../../lib/utils/formatters';
import type { CostConfig, CostLineItem } from '../../types/cost';

export default function CostEstimateTable() {
  const activeDocumentId = usePdfStore((s) => s.activeDocumentId);
  const bomEntries = useBomStore((s) => s.bomEntries);
  const costEstimate = useBomStore((s) => s.costEstimate);
  const generateCostEstimate = useBomStore((s) => s.generateCostEstimate);

  const [showConfig, setShowConfig] = useState(false);
  const [taxRate, setTaxRate] = useState('8.25');
  const [overheadRate, setOverheadRate] = useState('10');
  const [profitRate, setProfitRate] = useState('15');

  const [editingCell, setEditingCell] = useState<{
    id: string;
    field: 'materialUnitCost' | 'laborUnitCost';
  } | null>(null);
  const [editValue, setEditValue] = useState('');

  const handleGenerate = useCallback(() => {
    const config: CostConfig = {
      taxRate: parseFloat(taxRate) / 100,
      overheadRate: parseFloat(overheadRate) / 100,
      profitRate: parseFloat(profitRate) / 100,
    };
    generateCostEstimate('Project Estimate', config);
    setShowConfig(false);
  }, [taxRate, overheadRate, profitRate, generateCostEstimate]);

  const handleExport = useCallback(() => {
    if (!costEstimate) return;
    const header = 'Description,Qty,Unit,Mat $/Unit,Labor $/Unit,Mat Total,Labor Total,Line Total\n';
    const csv =
      header +
      costEstimate.lineItems
        .map(
          (r) =>
            `"${r.description}",${r.quantity},${r.unit},${r.materialUnitCost},${r.laborUnitCost},${r.materialTotal},${r.laborTotal},${r.lineTotal}`,
        )
        .join('\n');
    downloadCsv(csv, 'cost-estimate.csv');
  }, [costEstimate]);

  const handleCellDoubleClick = useCallback(
    (id: string, field: 'materialUnitCost' | 'laborUnitCost', value: number) => {
      setEditingCell({ id, field });
      setEditValue(String(value));
    },
    [],
  );

  const handleCellBlur = useCallback(() => {
    setEditingCell(null);
  }, []);

  const handleCellKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') handleCellBlur();
      else if (e.key === 'Escape') setEditingCell(null);
    },
    [handleCellBlur],
  );

  const renderEditableCell = (item: CostLineItem, field: 'materialUnitCost' | 'laborUnitCost') => {
    const isEditing = editingCell?.id === item.id && editingCell?.field === field;
    const value = item[field];

    if (isEditing) {
      return (
        <input
          type="number"
          min={0}
          step="0.01"
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={handleCellBlur}
          onKeyDown={handleCellKeyDown}
          style={{
            width: 80,
            borderRadius: 4,
            border: '1px solid #3b82f6',
            backgroundColor: '#0d1825',
            padding: '2px 6px',
            textAlign: 'right',
            fontSize: 12,
            color: '#d4e3f3',
            outline: 'none',
          }}
          autoFocus
        />
      );
    }

    return (
      <span
        style={{ cursor: 'pointer', borderRadius: 4, padding: '2px 4px', color: '#7a9ab5' }}
        onDoubleClick={() => handleCellDoubleClick(item.id, field, value)}
        title="Double-click to edit"
      >
        {formatCurrency(value)}
      </span>
    );
  };

  const inputStyle: React.CSSProperties = {
    borderRadius: 4,
    border: '1px solid #1f3450',
    backgroundColor: '#0d1825',
    padding: '6px 8px',
    fontSize: 14,
    color: '#d4e3f3',
    outline: 'none',
    width: '100%',
  };

  const btnBase: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    padding: '4px 10px',
    fontSize: 11,
    fontWeight: 500,
    borderRadius: 6,
    border: 'none',
    cursor: 'pointer',
  };

  if (!activeDocumentId) {
    return (
      <div style={{ padding: 24, textAlign: 'center', fontSize: 14, color: '#7a9ab5' }}>
        Open a PDF to generate cost estimates.
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h3 style={{ fontSize: 12, fontWeight: 600, color: '#d4e3f3' }}>Cost Estimate</h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            onClick={() => setShowConfig(true)}
            disabled={bomEntries.length === 0}
            style={{ ...btnBase, backgroundColor: '#1e3a5f', color: '#fff', opacity: bomEntries.length === 0 ? 0.5 : 1 }}
          >
            <Calculator size={14} />
            Generate Estimate
          </button>
          {costEstimate && (
            <button onClick={handleExport} style={{ ...btnBase, backgroundColor: '#131f33', color: '#d4e3f3', border: '1px solid #1f3450' }}>
              <Download size={14} />
              Export CSV
            </button>
          )}
        </div>
      </div>

      {/* Config form */}
      {showConfig && (
        <div style={{ borderRadius: 8, border: '1px solid rgba(59, 130, 246, 0.3)', backgroundColor: 'rgba(59, 130, 246, 0.1)', padding: 16 }}>
          <h4 style={{ marginBottom: 12, fontSize: 12, fontWeight: 600, textTransform: 'uppercase', color: '#6db3f8' }}>
            Estimate Configuration
          </h4>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span style={{ fontSize: 12, color: '#7a9ab5' }}>Tax Rate %</span>
              <input type="number" min={0} max={100} step="0.01" value={taxRate} onChange={(e) => setTaxRate(e.target.value)} style={inputStyle} />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span style={{ fontSize: 12, color: '#7a9ab5' }}>Overhead %</span>
              <input type="number" min={0} max={100} step="0.01" value={overheadRate} onChange={(e) => setOverheadRate(e.target.value)} style={inputStyle} />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span style={{ fontSize: 12, color: '#7a9ab5' }}>Profit %</span>
              <input type="number" min={0} max={100} step="0.01" value={profitRate} onChange={(e) => setProfitRate(e.target.value)} style={inputStyle} />
            </label>
          </div>
          <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
            <button onClick={handleGenerate} style={{ ...btnBase, backgroundColor: '#1e3a5f', color: '#fff' }}>
              Generate
            </button>
            <button onClick={() => setShowConfig(false)} style={{ ...btnBase, backgroundColor: '#131f33', color: '#d4e3f3', border: '1px solid #1f3450' }}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Empty state */}
      {!costEstimate && !showConfig && (
        <div style={{ borderRadius: 8, border: '1px dashed #1f3450', backgroundColor: '#131f33', padding: 32, textAlign: 'center', fontSize: 14, color: '#7a9ab5' }}>
          {bomEntries.length === 0
            ? 'Generate a BOM first, then create a cost estimate.'
            : 'Click "Generate Estimate" to configure rates and build the cost estimate.'}
        </div>
      )}

      {/* Cost table */}
      {costEstimate && (
        <>
          <div style={{ overflowX: 'auto', borderRadius: 8, border: '1px solid #1f3450' }}>
            <table style={{ width: '100%', textAlign: 'left', fontSize: 12, borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #1f3450', backgroundColor: '#0d1825', fontSize: 10, fontWeight: 500, textTransform: 'uppercase', color: '#4a6a88' }}>
                  <th style={{ padding: '6px 8px' }}>Description</th>
                  <th style={{ padding: '6px 8px', textAlign: 'right' }}>Qty</th>
                  <th style={{ padding: '6px 8px' }}>Unit</th>
                  <th style={{ padding: '6px 8px', textAlign: 'right' }}>Mat $/Unit</th>
                  <th style={{ padding: '6px 8px', textAlign: 'right' }}>Labor $/Unit</th>
                  <th style={{ padding: '6px 8px', textAlign: 'right' }}>Mat Total</th>
                  <th style={{ padding: '6px 8px', textAlign: 'right' }}>Labor Total</th>
                  <th style={{ padding: '6px 8px', textAlign: 'right' }}>Line Total</th>
                </tr>
              </thead>
              <tbody>
                {costEstimate.lineItems.map((item) => (
                  <tr key={item.id} style={{ borderBottom: '1px solid #1f3450', backgroundColor: '#131f33' }}>
                    <td style={{ maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', padding: '6px 8px', fontWeight: 500, color: '#d4e3f3' }}>{item.description}</td>
                    <td style={{ padding: '6px 8px', textAlign: 'right', color: '#d4e3f3' }}>{item.quantity}</td>
                    <td style={{ whiteSpace: 'nowrap', padding: '6px 8px', color: '#7a9ab5' }}>{item.unit}</td>
                    <td style={{ padding: '6px 8px', textAlign: 'right' }}>{renderEditableCell(item, 'materialUnitCost')}</td>
                    <td style={{ padding: '6px 8px', textAlign: 'right' }}>{renderEditableCell(item, 'laborUnitCost')}</td>
                    <td style={{ padding: '6px 8px', textAlign: 'right', color: '#7a9ab5' }}>{formatCurrency(item.materialTotal)}</td>
                    <td style={{ padding: '6px 8px', textAlign: 'right', color: '#7a9ab5' }}>{formatCurrency(item.laborTotal)}</td>
                    <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 500, color: '#d4e3f3' }}>{formatCurrency(item.lineTotal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Summary */}
          <div style={{ borderRadius: 8, border: '1px solid #1f3450', backgroundColor: '#131f33', padding: 12 }}>
            {[
              { label: 'Material Subtotal', value: costEstimate.materialSubtotal },
              { label: 'Labor Subtotal', value: costEstimate.laborSubtotal },
            ].map((row) => (
              <div key={row.label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 12, marginBottom: 6 }}>
                <span style={{ color: '#7a9ab5' }}>{row.label}</span>
                <span style={{ fontWeight: 500, color: '#d4e3f3' }}>{formatCurrency(row.value)}</span>
              </div>
            ))}

            <div style={{ borderTop: '1px solid #1f3450', paddingTop: 6, marginBottom: 6 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 12 }}>
                <span style={{ color: '#7a9ab5' }}>Subtotal</span>
                <span style={{ fontWeight: 500, color: '#d4e3f3' }}>{formatCurrency(costEstimate.subtotal)}</span>
              </div>
            </div>

            {[
              { label: `Tax (${formatPercent(costEstimate.taxRate)})`, value: costEstimate.taxAmount },
              { label: `Overhead (${formatPercent(costEstimate.overheadRate)})`, value: costEstimate.overheadAmount },
              { label: `Profit (${formatPercent(costEstimate.profitRate)})`, value: costEstimate.profitAmount },
            ].map((row) => (
              <div key={row.label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 12, marginBottom: 6 }}>
                <span style={{ color: '#7a9ab5' }}>{row.label}</span>
                <span style={{ color: '#7a9ab5' }}>{formatCurrency(row.value)}</span>
              </div>
            ))}

            <div style={{ borderTop: '1px solid #2e5275', paddingTop: 6 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 14, fontWeight: 600, color: '#d4e3f3' }}>Grand Total</span>
                <span style={{ fontSize: 16, fontWeight: 700, color: 'white' }}>{formatCurrency(costEstimate.grandTotal)}</span>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
