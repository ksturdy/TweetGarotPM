# Titan PM Style & Consistency Checklist

When building or modifying any module in Titan PM, verify every item below before considering the work complete. This applies to new pages, new modals, new list views, PDF exports, and any report output.

---

## 1. Page Layout

Use the standard sales-container shell for all list/detail pages:

```tsx
<div className="sales-container">
  <div className="sales-page-header">
    <div className="sales-page-title">
      <h1>Icon Module Name</h1>
      <div className="sales-subtitle">Short description</div>
    </div>
    <div className="sales-header-actions">
      {/* action buttons here */}
    </div>
  </div>
  {/* filter bar, table section, etc. */}
</div>
```

Page title `h1` should use the gradient text style already defined in SalesPipeline.css. Filter bars go inside a flex div with `gap: '1rem'` and `padding: '1rem'`. The table lives inside `.sales-table-section`.

---

## 2. Tables

Use `.sales-table` with `thead` / `tbody` / `tfoot`. Always include:

- **Sortable columns**: `className="sales-sortable"` + sort icon span
- **Column resize handles**: `<div className="col-resize-handle" />`
- **Empty state** (no data): centered row with an SVG icon, bold title, muted subtitle — never just a blank table
- **Footer totals row**: `background: '#f1f5f9'`, `fontWeight: 700`, `borderTop: '2px solid #cbd5e1'`
- **Row click → navigate**: `onClick={() => navigate(...)}` with `cursor: 'pointer'`

---

## 3. Search & Filter Inputs

**Dropdown search** → use `<SearchableSelect>` or `<SearchableMultiSelect>` from `frontend/src/components/`. These render a portal-based dropdown with `placeholder="Type to search (N options)..."`. Do **not** build a custom autocomplete from scratch.

**Text search box** pattern:
```tsx
<div className="to-search-box">
  <svg .../>  {/* search icon */}
  <input type="text" placeholder="Search..." value={q} onChange={e => setQ(e.target.value)} />
</div>
```

**Pill filters** (active/inactive toggle):
```tsx
const pillStyle = (active: boolean): React.CSSProperties => ({
  background: active ? '#002356' : 'white',
  color: active ? 'white' : '#475569',
  border: `1px solid ${active ? '#002356' : '#cbd5e1'}`,
  padding: '0.25rem 0.7rem',
  borderRadius: 999,
  fontSize: '0.75rem',
  fontWeight: 600,
  cursor: 'pointer',
});
```

---

## 4. Buttons

| Variant | Class(es) | When to use |
|---|---|---|
| Primary action | `sales-btn sales-btn-primary` | Main CTA (+ New, Save) |
| Secondary | `sales-btn sales-btn-secondary` | Export, filter, cancel |
| Danger | `btn-danger` | Irreversible deletes |

Never use plain `<button>` without one of these class combinations. Primary uses blue→purple gradient; danger uses red gradient.

---

## 5. Status Badges

All status values must render as a badge pill — never plain text:

```tsx
<span className={`sales-stage-badge ${status.toLowerCase().replace('-', '_')}`}>
  <span className="sales-stage-dot" style={{ background: getStatusColor(status) }} />
  {status}
</span>
```

Colour mapping: Open/Active → `#10b981` green · Pending/Submitted → `#f59e0b` amber · Closed/Rejected → `#6b7280` gray · In-Progress → `#3b82f6` blue · Cancelled → `#6b7280` gray.

---

## 6. Modals

Use the shared modal shell from `Modal.css`:

```tsx
<div className="modal-overlay" onClick={onClose}>
  <div className="modal-container" onClick={e => e.stopPropagation()}>
    <div className="modal-header">
      <h2>Modal Title</h2>
      <button className="modal-close" onClick={onClose}>×</button>
    </div>
    <div className="modal-body">
      {/* form content */}
    </div>
    <div className="modal-footer">
      <button className="btn-secondary" onClick={onClose}>Cancel</button>
      <button className="btn-primary" onClick={onSubmit}>Save</button>
    </div>
  </div>
</div>
```

`modal-container` max-width is 600px by default; override with inline style for wider modals. Always `stopPropagation` on the container click.

---

## 7. Forms

```tsx
<div className="form-group">
  <label className="form-label">Field Name *</label>
  <input className="form-input" type="text" ... />
</div>
```

Use `.form-input` for `input`, `select`, and `textarea`. For textareas add `style={{ resize: 'vertical', minHeight: '100px' }}`. Labels get `.form-label` (600 weight, `#374151`). Required fields show ` *` in the label.

---

## 8. Confirm Dialogs — NEVER use `window.confirm`

Always use the Titan confirm dialog via the `useTitanFeedback` hook:

```tsx
import { useTitanFeedback } from '../../context/TitanFeedbackContext';

const { confirm } = useTitanFeedback();

const ok = await confirm({
  title: 'Delete Item?',
  message: 'This action cannot be undone.',
  confirmText: 'Delete',
  cancelText: 'Cancel',
  danger: true,   // red button for destructive actions
});
if (!ok) return;
```

---

## 9. Toasts — NEVER use `alert()`

Use `useTitanFeedback` for all user feedback:

```tsx
const { toast } = useTitanFeedback();
// or combined:
const { confirm, toast } = useTitanFeedback();

toast.success('Saved successfully');
toast.error('Something went wrong');
toast.warning('Check your input');
toast.info('Data refreshed');
```

Errors stay visible 6 s; success/warning/info stay 4 s.

---

## 10. Loading & Empty States

**Loading** — wrap the whole page return:
```tsx
if (isLoading) return (
  <div className="sales-container">
    <div style={{ textAlign: 'center', padding: '40px' }}>Loading...</div>
  </div>
);
```

**Empty state inside a table** — single `colSpan` row with icon + title + subtitle:
```tsx
<tr>
  <td colSpan={N} style={{ textAlign: 'center', padding: '40px' }}>
    <svg className="mx-auto h-12 w-12 text-gray-400" ... />
    <h3 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '8px' }}>No items found</h3>
    <p style={{ color: '#6b7280', fontSize: '14px' }}>Try adjusting your filters</p>
  </td>
</tr>
```

**Empty state in a card/list view** — use `.field-empty` + `.field-empty-title` + `.field-empty-text`.

---

## 11. Tenant Logo in PDFs and Reports ← ALWAYS REQUIRED

Every PDF export and every printable/on-screen report **must** include the tenant logo. This is frequently forgotten — make it the first thing you wire up when adding PDF or report output.

### Pattern for PDF generation (jsPDF / pdfmake):
```tsx
// At the top of the component or export function:
const { tenant } = useAuth();
const logoUrl = tenant?.settings?.branding?.logo_url ? '/api/tenant/logo' : undefined;

// Load as data URL before building the PDF:
let logoDataUrl: string | undefined;
if (logoUrl) {
  try { logoDataUrl = await loadImageAsDataUrl(logoUrl); } catch { /* skip */ }
}

// Pass into the PDF builder function:
await generateMyModulePdf(data, logoDataUrl);
```

### Pattern for on-screen previews / print layouts:
```tsx
const { tenant } = useAuth();
const logoUrl = tenant?.settings?.branding?.logo_url ? '/api/tenant/logo' : undefined;

// In JSX header:
{logoUrl && (
  <img
    src={logoUrl}
    alt="Company Logo"
    style={{ width: 140, height: 'auto', maxHeight: 60, objectFit: 'contain' }}
  />
)}
```

Use `/api/tenant/logo` (the API proxy route) — **not** the raw R2/CDN URL — to avoid CORS issues during PDF canvas rendering.

### Placement in document:
- **Header**: top-right or top-left of the first page alongside company name / project number
- **Footer**: bottom of each page at reduced size (≈ 80px wide) if the document is multi-page
- **Print preview**: match whatever the PDF does so the preview matches the output

---

## 12. Colour & Brand Constants

```
Primary blue:   #1a56db   (--primary)
Danger red:     #ef4444   (--danger)
Success green:  #10b981   (--success)
Warning amber:  #f59e0b   (--warning)
Muted gray:     #6b7280   (--secondary)
Dark navy:      #002356   (pill active, headers)

Gradient – blue/purple:  linear-gradient(135deg, #3b82f6, #8b5cf6)
Gradient – green/cyan:   linear-gradient(135deg, #10b981, #06b6d4)
Gradient – amber/rose:   linear-gradient(135deg, #f59e0b, #f43f5e)
```

---

## Quick Pre-Ship Checklist

Before marking any module complete, run through this list:

- [ ] Page uses `.sales-container` / `.sales-page-header` layout
- [ ] `window.confirm` replaced with `useTitanFeedback().confirm`
- [ ] `alert()` replaced with `useTitanFeedback().toast`
- [ ] Dropdowns use `<SearchableSelect>` (not a bare `<select>` for large lists)
- [ ] Status values render as `.sales-stage-badge` pills
- [ ] Empty state shows icon + title + subtitle (not a blank area)
- [ ] Buttons use `sales-btn-primary` / `sales-btn-secondary` / `btn-danger`
- [ ] Modals use the `modal-overlay` / `modal-container` shell
- [ ] **Every PDF export includes the tenant logo via `/api/tenant/logo`**
- [ ] **Every on-screen report preview includes the tenant logo**
