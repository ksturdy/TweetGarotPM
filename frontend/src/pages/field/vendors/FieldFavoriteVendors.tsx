import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import CloseIcon from '@mui/icons-material/Close';
import PhoneIcon from '@mui/icons-material/Phone';
import EmailIcon from '@mui/icons-material/Email';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import PersonIcon from '@mui/icons-material/Person';
import ContactsIcon from '@mui/icons-material/Contacts';
import { fieldFavoriteVendorsApi, FieldFavoriteVendor } from '../../../services/fieldFavoriteVendors';

interface VendorFormData {
  name: string;
  location: string;
  phone: string;
  contact_name: string;
  email: string;
}

const emptyForm: VendorFormData = { name: '', location: '', phone: '', contact_name: '', email: '' };

const hasContactsApi = 'contacts' in navigator && 'ContactsManager' in window;

const FieldFavoriteVendors: React.FC = () => {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<VendorFormData>(emptyForm);
  const [saving, setSaving] = useState(false);

  const { data: vendors = [], isLoading } = useQuery({
    queryKey: ['field-favorite-vendors'],
    queryFn: async () => {
      const res = await fieldFavoriteVendorsApi.getAll();
      return res.data;
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => fieldFavoriteVendorsApi.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['field-favorite-vendors'] }),
  });

  const openAdd = () => {
    setEditingId(null);
    setForm(emptyForm);
    setShowForm(true);
  };

  const openEdit = (vendor: FieldFavoriteVendor) => {
    setEditingId(vendor.id);
    setForm({
      name: vendor.name || '',
      location: vendor.location || '',
      phone: vendor.phone || '',
      contact_name: vendor.contact_name || '',
      email: vendor.email || '',
    });
    setShowForm(true);
  };

  const handleDelete = (vendor: FieldFavoriteVendor) => {
    if (window.confirm(`Delete "${vendor.name}" from favorites?`)) {
      deleteMutation.mutate(vendor.id);
    }
  };

  const handleSave = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      if (editingId) {
        await fieldFavoriteVendorsApi.update(editingId, form);
      } else {
        await fieldFavoriteVendorsApi.create(form);
      }
      queryClient.invalidateQueries({ queryKey: ['field-favorite-vendors'] });
      setShowForm(false);
      setForm(emptyForm);
      setEditingId(null);
    } catch (err) {
      console.error('Failed to save vendor:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleImportContact = async () => {
    try {
      const nav = navigator as any;
      const props = ['name', 'tel', 'email'];
      // Address support varies by platform — request it but don't fail if unavailable
      const supported = await nav.contacts.getProperties?.();
      if (supported?.includes('address')) props.push('address');

      const contacts = await nav.contacts.select(props, { multiple: false });
      if (contacts && contacts.length > 0) {
        const c = contacts[0];
        const name = c.name?.[0] || '';
        const phone = c.tel?.[0] || '';
        const email = c.email?.[0] || '';
        let location = '';
        if (c.address?.[0]) {
          const addr = c.address[0];
          location = [addr.city, addr.region].filter(Boolean).join(', ');
        }
        setForm({
          name: name || form.name,
          contact_name: name || form.contact_name,
          phone: phone || form.phone,
          email: email || form.email,
          location: location || form.location,
        });
      }
    } catch (err: any) {
      if (err?.name !== 'AbortError') {
        console.error('Contact import failed:', err);
      }
    }
  };

  if (isLoading) {
    return <div className="field-loading">Loading vendors...</div>;
  }

  return (
    <div>
      <h1 className="field-page-title">Favorite Vendors</h1>
      <p className="field-page-subtitle">Your saved vendor contacts for quick access</p>

      {vendors.length === 0 ? (
        <div className="field-empty-state">
          <p>No favorite vendors yet.</p>
          <p style={{ fontSize: 13, color: '#9ca3af' }}>
            Add vendors you use frequently so you can quickly fill in POs and quote requests.
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
          {vendors.map((vendor) => (
            <div key={vendor.id} className="field-card" style={{ padding: '12px 14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ fontSize: 16, fontWeight: 700, color: '#111827' }}>{vendor.name}</div>
                <div style={{ display: 'flex', gap: 4 }}>
                  <button
                    type="button"
                    onClick={() => openEdit(vendor)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: '#6b7280' }}
                  >
                    <EditIcon style={{ fontSize: 18 }} />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(vendor)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: '#ef4444' }}
                  >
                    <DeleteIcon style={{ fontSize: 18 }} />
                  </button>
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3, marginTop: 6 }}>
                {vendor.contact_name && (
                  <div style={{ fontSize: 13, color: '#374151', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <PersonIcon style={{ fontSize: 14, color: '#9ca3af' }} />
                    {vendor.contact_name}
                  </div>
                )}
                {vendor.location && (
                  <div style={{ fontSize: 13, color: '#374151', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <LocationOnIcon style={{ fontSize: 14, color: '#9ca3af' }} />
                    {vendor.location}
                  </div>
                )}
                {vendor.phone && (
                  <div style={{ fontSize: 13, color: '#374151', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <PhoneIcon style={{ fontSize: 14, color: '#9ca3af' }} />
                    <a href={`tel:${vendor.phone}`} style={{ color: '#2563eb', textDecoration: 'none' }}>{vendor.phone}</a>
                  </div>
                )}
                {vendor.email && (
                  <div style={{ fontSize: 13, color: '#374151', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <EmailIcon style={{ fontSize: 14, color: '#9ca3af' }} />
                    <a href={`mailto:${vendor.email}`} style={{ color: '#2563eb', textDecoration: 'none' }}>{vendor.email}</a>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* FAB Add Button */}
      <button
        type="button"
        onClick={openAdd}
        className="field-fab"
      >
        <AddIcon />
      </button>

      {/* Add/Edit Bottom Sheet Modal */}
      {showForm && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.5)',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
          }}
          onClick={() => !saving && setShowForm(false)}
        >
          <div
            style={{
              background: '#fff',
              borderRadius: 16,
              width: '100%',
              maxWidth: 500,
              maxHeight: '85vh',
              overflow: 'auto',
              padding: '16px 16px 24px',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h2 style={{ fontSize: 18, fontWeight: 700, color: '#111827', margin: 0 }}>
                {editingId ? 'Edit Vendor' : 'Add Favorite Vendor'}
              </h2>
              <button
                type="button"
                onClick={() => !saving && setShowForm(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: '#6b7280' }}
              >
                <CloseIcon style={{ fontSize: 22 }} />
              </button>
            </div>

            {hasContactsApi && !editingId && (
              <button
                type="button"
                className="field-btn field-btn-secondary"
                onClick={handleImportContact}
                style={{ width: '100%', marginBottom: 16, justifyContent: 'center' }}
              >
                <ContactsIcon style={{ fontSize: 18, marginRight: 6 }} />
                Import from Contacts
              </button>
            )}

            <div className="field-form-group">
              <label className="field-form-label">Vendor Name *</label>
              <input
                type="text"
                className="field-form-input"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. Ferguson Supply"
                autoFocus
              />
            </div>

            <div className="field-form-group">
              <label className="field-form-label">Contact Name</label>
              <input
                type="text"
                className="field-form-input"
                value={form.contact_name}
                onChange={(e) => setForm({ ...form, contact_name: e.target.value })}
                placeholder="Contact person"
              />
            </div>

            <div className="field-form-group">
              <label className="field-form-label">Location</label>
              <input
                type="text"
                className="field-form-input"
                value={form.location}
                onChange={(e) => setForm({ ...form, location: e.target.value })}
                placeholder="e.g. Milwaukee, WI"
              />
            </div>

            <div className="field-form-group">
              <label className="field-form-label">Phone</label>
              <input
                type="tel"
                className="field-form-input"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="(555) 555-5555"
              />
            </div>

            <div className="field-form-group">
              <label className="field-form-label">Email</label>
              <input
                type="email"
                className="field-form-input"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="vendor@email.com"
              />
            </div>

            <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
              <button
                type="button"
                className="field-btn field-btn-secondary"
                onClick={() => setShowForm(false)}
                disabled={saving}
                style={{ flex: 1 }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="field-btn field-btn-primary"
                onClick={handleSave}
                disabled={saving || !form.name.trim()}
                style={{ flex: 1 }}
              >
                {saving ? 'Saving...' : editingId ? 'Update' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FieldFavoriteVendors;
