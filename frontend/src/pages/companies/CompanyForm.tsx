import React, { useState, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { companiesApi, Company, ProjectCompany } from '../../services/companies';

interface CompanyFormProps {
  projectId: number;
  company?: ProjectCompany | null;
  onClose: () => void;
}

const CompanyForm: React.FC<CompanyFormProps> = ({ projectId, company, onClose }) => {
  const queryClient = useQueryClient();
  const [step, setStep] = useState<'select' | 'create' | 'edit'>('select');
  const [selectedCompanyId, setSelectedCompanyId] = useState<number | null>(null);

  const { data: allCompanies } = useQuery({
    queryKey: ['companies'],
    queryFn: () => companiesApi.getAll().then((res) => res.data),
  });

  const [companyData, setCompanyData] = useState({
    name: '',
    address: '',
    city: '',
    state: '',
    zip: '',
    phone: '',
    email: '',
    website: '',
    notes: '',
  });

  const [projectCompanyData, setProjectCompanyData] = useState({
    role: 'general_contractor',
    isPrimary: false,
    notes: '',
  });

  useEffect(() => {
    if (company) {
      setStep('edit');
      setCompanyData({
        name: company.name,
        address: company.address || '',
        city: company.city || '',
        state: company.state || '',
        zip: company.zip || '',
        phone: company.phone || '',
        email: company.email || '',
        website: company.website || '',
        notes: company.notes || '',
      });
      setProjectCompanyData({
        role: company.role,
        isPrimary: company.is_primary,
        notes: company.project_notes || '',
      });
    }
  }, [company]);

  const createCompanyMutation = useMutation({
    mutationFn: companiesApi.create,
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: ['companies'] });
      return response.data.id;
    },
  });

  const updateCompanyMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<Company> }) =>
      companiesApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['companies'] });
    },
  });

  const addToProjectMutation = useMutation({
    mutationFn: (data: { companyId: number; role: string; isPrimary: boolean; notes: string }) =>
      companiesApi.addToProject(projectId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['companies', 'project', projectId] });
      onClose();
    },
  });

  const updateProjectCompanyMutation = useMutation({
    mutationFn: (data: { role: string; isPrimary: boolean; notes: string }) =>
      companiesApi.updateProjectCompany(company!.project_company_id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['companies', 'project', projectId] });
      onClose();
    },
  });

  const handleCompanyChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setCompanyData((prev) => ({ ...prev, [name]: value }));
  };

  const handleProjectCompanyChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    setProjectCompanyData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (company) {
      // Update existing company and its project relationship
      await updateCompanyMutation.mutateAsync({ id: company.id, data: companyData });
      updateProjectCompanyMutation.mutate(projectCompanyData);
    } else if (step === 'create') {
      // Create new company and add to project
      const newCompany = await createCompanyMutation.mutateAsync(companyData);
      addToProjectMutation.mutate({
        companyId: newCompany.data.id,
        ...projectCompanyData,
      });
    } else {
      // Add existing company to project
      if (selectedCompanyId) {
        addToProjectMutation.mutate({
          companyId: selectedCompanyId,
          ...projectCompanyData,
        });
      }
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
      onClick={onClose}
    >
      <div
        className="card"
        style={{ maxWidth: '600px', width: '100%', maxHeight: '90vh', overflow: 'auto', margin: '1rem' }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 style={{ marginTop: 0 }}>{company ? 'Edit Company' : 'Add Company to Project'}</h2>

        <form onSubmit={handleSubmit}>
          {!company && step === 'select' && (
            <>
              <div className="form-group">
                <label className="form-label">Select Existing Company or Create New</label>
                <select
                  className="form-input"
                  value={selectedCompanyId || ''}
                  onChange={(e) => setSelectedCompanyId(e.target.value ? Number(e.target.value) : null)}
                >
                  <option value="">Select a company...</option>
                  {allCompanies?.map((comp) => (
                    <option key={comp.id} value={comp.id}>
                      {comp.name}
                    </option>
                  ))}
                </select>
              </div>
              <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setStep('create')}
                  style={{ flex: 1 }}
                >
                  Create New Company
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => selectedCompanyId && setStep('edit')}
                  disabled={!selectedCompanyId}
                  style={{ flex: 1 }}
                >
                  Continue with Selected
                </button>
              </div>
            </>
          )}

          {(step === 'create' || step === 'edit' || company) && (
            <>
              {(step === 'create' || company) && (
                <>
                  <div className="form-group">
                    <label className="form-label">Company Name *</label>
                    <input
                      type="text"
                      name="name"
                      className="form-input"
                      value={companyData.name}
                      onChange={handleCompanyChange}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Address</label>
                    <input
                      type="text"
                      name="address"
                      className="form-input"
                      value={companyData.address}
                      onChange={handleCompanyChange}
                    />
                  </div>

                  <div className="form-row">
                    <div className="form-group">
                      <label className="form-label">City</label>
                      <input
                        type="text"
                        name="city"
                        className="form-input"
                        value={companyData.city}
                        onChange={handleCompanyChange}
                      />
                    </div>
                    <div className="form-group" style={{ width: '30%' }}>
                      <label className="form-label">State</label>
                      <input
                        type="text"
                        name="state"
                        className="form-input"
                        value={companyData.state}
                        onChange={handleCompanyChange}
                      />
                    </div>
                    <div className="form-group" style={{ width: '30%' }}>
                      <label className="form-label">ZIP</label>
                      <input
                        type="text"
                        name="zip"
                        className="form-input"
                        value={companyData.zip}
                        onChange={handleCompanyChange}
                      />
                    </div>
                  </div>

                  <div className="form-row">
                    <div className="form-group">
                      <label className="form-label">Phone</label>
                      <input
                        type="tel"
                        name="phone"
                        className="form-input"
                        value={companyData.phone}
                        onChange={handleCompanyChange}
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Email</label>
                      <input
                        type="email"
                        name="email"
                        className="form-input"
                        value={companyData.email}
                        onChange={handleCompanyChange}
                      />
                    </div>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Website</label>
                    <input
                      type="url"
                      name="website"
                      className="form-input"
                      value={companyData.website}
                      onChange={handleCompanyChange}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Company Notes</label>
                    <textarea
                      name="notes"
                      className="form-input"
                      rows={3}
                      value={companyData.notes}
                      onChange={handleCompanyChange}
                    />
                  </div>
                </>
              )}

              <div style={{ borderTop: '1px solid var(--border)', paddingTop: '1rem', marginTop: '1rem' }}>
                <h3 style={{ fontSize: '1.1rem', marginBottom: '1rem' }}>Project Role</h3>

                <div className="form-group">
                  <label className="form-label">Role *</label>
                  <select
                    name="role"
                    className="form-input"
                    value={projectCompanyData.role}
                    onChange={handleProjectCompanyChange}
                    required
                  >
                    <option value="general_contractor">General Contractor</option>
                    <option value="owner">Owner</option>
                    <option value="architect">Architect</option>
                    <option value="engineer">Engineer</option>
                    <option value="subcontractor">Subcontractor</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                <div className="form-group">
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <input
                      type="checkbox"
                      name="isPrimary"
                      checked={projectCompanyData.isPrimary}
                      onChange={handleProjectCompanyChange}
                    />
                    <span>Primary contact for this role</span>
                  </label>
                </div>

                <div className="form-group">
                  <label className="form-label">Project-Specific Notes</label>
                  <textarea
                    name="notes"
                    className="form-input"
                    rows={3}
                    value={projectCompanyData.notes}
                    onChange={handleProjectCompanyChange}
                  />
                </div>
              </div>

              <div className="form-actions">
                <button type="button" className="btn btn-secondary" onClick={onClose}>
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={
                    createCompanyMutation.isPending ||
                    updateCompanyMutation.isPending ||
                    addToProjectMutation.isPending ||
                    updateProjectCompanyMutation.isPending
                  }
                >
                  {company ? 'Update' : 'Add to Project'}
                </button>
              </div>
            </>
          )}

          {step === 'select' && (
            <div className="form-actions">
              <button type="button" className="btn btn-secondary" onClick={onClose}>
                Cancel
              </button>
            </div>
          )}
        </form>
      </div>
    </div>
  );
};

export default CompanyForm;
