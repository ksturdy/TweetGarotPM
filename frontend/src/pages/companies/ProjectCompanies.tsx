import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { companiesApi, ProjectCompany } from '../../services/companies';
import { contactsApi, Contact } from '../../services/contacts';
import { projectsApi } from '../../services/projects';
import CompanyForm from './CompanyForm';
import ContactForm from './ContactForm';

const ProjectCompanies: React.FC = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const queryClient = useQueryClient();
  const [showCompanyForm, setShowCompanyForm] = useState(false);
  const [showContactForm, setShowContactForm] = useState(false);
  const [editingCompany, setEditingCompany] = useState<ProjectCompany | null>(null);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const [selectedCompanyId, setSelectedCompanyId] = useState<number | null>(null);

  const { data: project } = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => projectsApi.getById(Number(projectId)).then((res) => res.data),
  });

  const { data: companies, isLoading: loadingCompanies } = useQuery({
    queryKey: ['companies', 'project', projectId],
    queryFn: () => companiesApi.getByProject(Number(projectId)).then((res) => res.data),
  });

  const { data: contacts, isLoading: loadingContacts } = useQuery({
    queryKey: ['contacts', 'project', projectId],
    queryFn: () => contactsApi.getByProject(Number(projectId)).then((res) => res.data),
  });

  const removeCompanyMutation = useMutation({
    mutationFn: (projectCompanyId: number) => companiesApi.removeFromProject(projectCompanyId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['companies', 'project', projectId] });
      queryClient.invalidateQueries({ queryKey: ['contacts', 'project', projectId] });
    },
  });

  const deleteContactMutation = useMutation({
    mutationFn: (contactId: number) => contactsApi.delete(contactId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contacts', 'project', projectId] });
    },
  });

  const handleRemoveCompany = (projectCompanyId: number, companyName: string) => {
    if (window.confirm(`Remove ${companyName} from this project?`)) {
      removeCompanyMutation.mutate(projectCompanyId);
    }
  };

  const handleDeleteContact = (contactId: number, contactName: string) => {
    if (window.confirm(`Delete contact ${contactName}?`)) {
      deleteContactMutation.mutate(contactId);
    }
  };

  const getRoleLabel = (role: string) => {
    const labels: Record<string, string> = {
      general_contractor: 'General Contractor',
      owner: 'Owner',
      architect: 'Architect',
      engineer: 'Engineer',
      subcontractor: 'Subcontractor',
      other: 'Other',
    };
    return labels[role] || role;
  };

  const groupedContacts = contacts?.reduce((acc, contact) => {
    if (!acc[contact.company_id]) {
      acc[contact.company_id] = [];
    }
    acc[contact.company_id].push(contact);
    return acc;
  }, {} as Record<number, Contact[]>);

  if (loadingCompanies || loadingContacts) {
    return <div className="loading">Loading...</div>;
  }

  return (
    <div>
      <div style={{ marginBottom: '1rem' }}>
        <Link to={`/projects/${projectId}`}>&larr; Back to {project?.name || 'Project'}</Link>
      </div>

      <div className="section-header" style={{ marginBottom: '1.5rem' }}>
        <h1 className="page-title" style={{ margin: 0 }}>Project Companies & Contacts</h1>
        <button
          className="btn btn-primary"
          onClick={() => {
            setEditingCompany(null);
            setShowCompanyForm(true);
          }}
        >
          Add Company
        </button>
      </div>

      {companies && companies.length === 0 ? (
        <div className="card">
          <p style={{ color: 'var(--secondary)', textAlign: 'center', margin: 0 }}>
            No companies added to this project yet.
          </p>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: '1.5rem' }}>
          {companies?.map((company) => (
            <div key={company.id} className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                <div>
                  <h3 style={{ margin: '0 0 0.25rem 0' }}>{company.name}</h3>
                  <span className="badge badge-info">{getRoleLabel(company.role)}</span>
                  {company.is_primary && (
                    <span className="badge badge-success" style={{ marginLeft: '0.5rem' }}>Primary</span>
                  )}
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => {
                      setEditingCompany(company);
                      setShowCompanyForm(true);
                    }}
                  >
                    Edit
                  </button>
                  <button
                    className="btn btn-danger btn-sm"
                    onClick={() => handleRemoveCompany(company.project_company_id, company.name)}
                  >
                    Remove
                  </button>
                </div>
              </div>

              {(company.address || company.phone || company.email) && (
                <div style={{ marginBottom: '1rem', fontSize: '0.875rem', color: 'var(--secondary)' }}>
                  {company.address && <div>{company.address}</div>}
                  {(company.city || company.state || company.zip) && (
                    <div>
                      {company.city && `${company.city}, `}
                      {company.state} {company.zip}
                    </div>
                  )}
                  {company.phone && <div>Phone: {company.phone}</div>}
                  {company.email && <div>Email: {company.email}</div>}
                </div>
              )}

              <div style={{ borderTop: '1px solid var(--border)', paddingTop: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                  <h4 style={{ margin: 0, fontSize: '1rem' }}>Contacts</h4>
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => {
                      setSelectedCompanyId(company.id);
                      setEditingContact(null);
                      setShowContactForm(true);
                    }}
                  >
                    Add Contact
                  </button>
                </div>

                {groupedContacts?.[company.id] && groupedContacts[company.id].length > 0 ? (
                  <div style={{ display: 'grid', gap: '0.75rem' }}>
                    {groupedContacts[company.id].map((contact) => (
                      <div
                        key={contact.id}
                        style={{
                          padding: '0.75rem',
                          backgroundColor: 'var(--background)',
                          borderRadius: '4px',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'flex-start',
                        }}
                      >
                        <div>
                          <div style={{ fontWeight: 500 }}>
                            {contact.first_name} {contact.last_name}
                            {contact.is_primary && (
                              <span className="badge badge-success" style={{ marginLeft: '0.5rem', fontSize: '0.65rem' }}>
                                Primary
                              </span>
                            )}
                          </div>
                          {contact.title && (
                            <div style={{ fontSize: '0.875rem', color: 'var(--secondary)' }}>{contact.title}</div>
                          )}
                          {contact.email && (
                            <div style={{ fontSize: '0.875rem', color: 'var(--secondary)' }}>
                              <a href={`mailto:${contact.email}`}>{contact.email}</a>
                            </div>
                          )}
                          {contact.phone && (
                            <div style={{ fontSize: '0.875rem', color: 'var(--secondary)' }}>
                              Phone: {contact.phone}
                            </div>
                          )}
                          {contact.mobile && (
                            <div style={{ fontSize: '0.875rem', color: 'var(--secondary)' }}>
                              Mobile: {contact.mobile}
                            </div>
                          )}
                        </div>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          <button
                            className="btn btn-secondary btn-sm"
                            style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem' }}
                            onClick={() => {
                              setEditingContact(contact);
                              setSelectedCompanyId(contact.company_id);
                              setShowContactForm(true);
                            }}
                          >
                            Edit
                          </button>
                          <button
                            className="btn btn-danger btn-sm"
                            style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem' }}
                            onClick={() => handleDeleteContact(contact.id, `${contact.first_name} ${contact.last_name}`)}
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p style={{ color: 'var(--secondary)', fontSize: '0.875rem', margin: 0 }}>
                    No contacts added yet.
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {showCompanyForm && (
        <CompanyForm
          projectId={Number(projectId)}
          company={editingCompany}
          onClose={() => {
            setShowCompanyForm(false);
            setEditingCompany(null);
          }}
        />
      )}

      {showContactForm && selectedCompanyId && (
        <ContactForm
          companyId={selectedCompanyId}
          contact={editingContact}
          onClose={() => {
            setShowContactForm(false);
            setEditingContact(null);
            setSelectedCompanyId(null);
          }}
        />
      )}
    </div>
  );
};

export default ProjectCompanies;
