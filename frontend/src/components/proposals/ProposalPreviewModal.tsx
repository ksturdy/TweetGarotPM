import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom';
import { Proposal, proposalsApi } from '../../services/proposals';
import { CaseStudy, CaseStudyImage, caseStudiesApi } from '../../services/caseStudies';
import { CaseStudyTemplate, caseStudyTemplatesApi } from '../../services/caseStudyTemplates';
import CaseStudyPreview from '../caseStudies/CaseStudyPreview';

interface FullCaseStudy {
  caseStudy: CaseStudy & { images?: CaseStudyImage[] };
  template: CaseStudyTemplate | null;
}

interface ProposalPreviewModalProps {
  proposal: Proposal;
  isOpen: boolean;
  onClose: () => void;
}

const ProposalPreviewModal: React.FC<ProposalPreviewModalProps> = ({
  proposal,
  isOpen,
  onClose,
}) => {
  const [fullCaseStudies, setFullCaseStudies] = useState<FullCaseStudy[]>([]);
  const [loadingCs, setLoadingCs] = useState(false);

  // Load full case study data when modal opens
  useEffect(() => {
    if (!isOpen || !proposal.case_studies?.length) {
      setFullCaseStudies([]);
      return;
    }

    let cancelled = false;
    setLoadingCs(true);

    Promise.all(
      proposal.case_studies.map(async (cs: any) => {
        const response = await caseStudiesApi.getById(cs.id);
        const fullCs = response.data;
        let template: CaseStudyTemplate | null = null;
        if (fullCs.template_id) {
          try {
            const tplResponse = await caseStudyTemplatesApi.getById(fullCs.template_id);
            template = tplResponse.data;
          } catch { /* template optional */ }
        }
        return { caseStudy: fullCs, template };
      })
    ).then((results) => {
      if (!cancelled) {
        setFullCaseStudies(results);
        setLoadingCs(false);
      }
    }).catch(() => {
      if (!cancelled) setLoadingCs(false);
    });

    return () => { cancelled = true; };
  }, [isOpen, proposal.case_studies]);

  if (!isOpen) return null;

  const handlePrint = () => {
    const printRoot = document.querySelector('.print-root');
    if (!printRoot) return;
    const iframe = document.createElement('iframe');
    iframe.style.position = 'absolute';
    iframe.style.top = '-10000px';
    iframe.style.left = '-10000px';
    iframe.style.width = '900px';
    document.body.appendChild(iframe);
    const doc = iframe.contentDocument || iframe.contentWindow?.document;
    if (!doc) return;
    doc.open();
    doc.write(`<!DOCTYPE html><html><head><title>Proposal - Print</title>
      <style>
        @page { margin: 0.3in; }
        body { margin: 0; padding: 0; }
        .no-print { display: none !important; }
        img { max-width: 100%; }
        .case-study-hero {
          height: auto !important;
          min-height: 160px;
          overflow: visible !important;
        }
      </style>
      </head><body>${printRoot.innerHTML}</body></html>`);
    doc.close();
    // Wait for images to load before printing
    const images = doc.querySelectorAll('img');
    let loaded = 0;
    const total = images.length;
    const triggerPrint = () => {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
      setTimeout(() => document.body.removeChild(iframe), 1000);
    };
    if (total === 0) {
      triggerPrint();
    } else {
      const onLoad = () => {
        loaded++;
        if (loaded >= total) triggerPrint();
      };
      images.forEach(img => {
        if (img.complete) { onLoad(); }
        else { img.onload = onLoad; img.onerror = onLoad; }
      });
      // Fallback timeout in case images stall
      setTimeout(triggerPrint, 3000);
    }
  };

  const handleDownloadPdf = async () => {
    try {
      const response = await proposalsApi.downloadPdf(proposal.id);
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Proposal-${(proposal.proposal_number || proposal.title).replace(/[^a-zA-Z0-9]/g, '-')}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error downloading PDF:', error);
      alert('Failed to download PDF. Please try Print / PDF instead.');
    }
  };

  const formatCurrency = (amount: number | string | undefined) => {
    if (!amount) return '';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(Number(amount));
  };

  const formatDate = (dateString: string | undefined) => {
    if (!dateString) return '';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const sections = proposal.sections || [];
  const serviceOfferings = proposal.service_offerings || [];
  const resumes = (proposal.resumes || []) as any[];

  const primaryColor = '#1e3a5f';
  const accentColor = '#3b82f6';

  const sectionHeadingStyle: React.CSSProperties = {
    fontSize: '14pt',
    fontWeight: 700,
    color: primaryColor,
    borderBottom: '2px solid #e5e7eb',
    paddingBottom: '6px',
    marginBottom: '10px',
  };

  return ReactDOM.createPortal(
    <div
      className="print-overlay"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        zIndex: 9999,
        overflow: 'auto',
      }}
      onClick={onClose}
    >
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { margin: 0; padding: 0; }
          body > *:not(.print-overlay) { display: none !important; }
          .print-overlay {
            position: static !important;
            overflow: visible !important;
            background: transparent !important;
          }
          .print-root {
            margin: 0 !important;
            max-width: none !important;
            box-shadow: none !important;
          }
        }
      `}</style>

      <div
        className="print-root"
        style={{
          position: 'relative',
          margin: '20px auto',
          maxWidth: '900px',
          backgroundColor: '#fff',
          boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Action Bar */}
        <div
          className="no-print"
          style={{
            position: 'sticky',
            top: 0,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '12px 20px',
            backgroundColor: primaryColor,
            color: 'white',
            zIndex: 10,
          }}
        >
          <span style={{ fontWeight: 600 }}>Proposal Preview</span>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={handlePrint}
              style={{
                padding: '6px 16px',
                backgroundColor: 'white',
                color: primaryColor,
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontWeight: 600,
                fontSize: '0.875rem',
              }}
            >
              Print / PDF
            </button>
            <button
              onClick={handleDownloadPdf}
              style={{
                padding: '6px 16px',
                backgroundColor: 'rgba(255,255,255,0.2)',
                color: 'white',
                border: '1px solid rgba(255,255,255,0.4)',
                borderRadius: '4px',
                cursor: 'pointer',
                fontWeight: 600,
                fontSize: '0.875rem',
              }}
            >
              Download PDF
            </button>
            <button
              onClick={onClose}
              style={{
                padding: '6px 16px',
                backgroundColor: 'transparent',
                color: 'white',
                border: '1px solid rgba(255,255,255,0.4)',
                borderRadius: '4px',
                cursor: 'pointer',
                fontWeight: 600,
                fontSize: '0.875rem',
              }}
            >
              Close
            </button>
          </div>
        </div>

        {/* Proposal Content */}
        <div style={{ padding: '40px' }}>
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', paddingBottom: '16px', borderBottom: `3px solid ${primaryColor}`, marginBottom: '24px' }}>
            <div>
              <div style={{ fontSize: '12pt', color: primaryColor, fontWeight: 700 }}>{proposal.proposal_number}</div>
              <div style={{ fontSize: '20pt', fontWeight: 700, color: primaryColor, marginTop: '4px' }}>{proposal.title}</div>
              <div style={{ fontSize: '10pt', color: '#6b7280', marginTop: '4px' }}>
                Prepared {formatDate(proposal.created_at)}
                {proposal.valid_until ? ` \u00b7 Valid until ${formatDate(proposal.valid_until)}` : ''}
              </div>
            </div>
          </div>

          {/* Info Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '24px' }}>
            <div style={{ padding: '16px', background: '#f8fafc', borderRadius: '6px', borderLeft: `4px solid ${accentColor}` }}>
              <div style={{ fontSize: '9pt', fontWeight: 700, color: accentColor, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>Prepared For</div>
              {proposal.customer_name && <div style={{ fontSize: '11pt', fontWeight: 600, marginBottom: '4px' }}>{proposal.customer_name}</div>}
              {(proposal as any).customer_owner && <div style={{ fontSize: '10pt', marginBottom: '4px' }}>{(proposal as any).customer_owner}</div>}
              {(proposal as any).customer_address && <div style={{ fontSize: '10pt', color: '#6b7280' }}>{(proposal as any).customer_address}</div>}
            </div>
            <div style={{ padding: '16px', background: '#f8fafc', borderRadius: '6px', borderLeft: `4px solid ${accentColor}` }}>
              <div style={{ fontSize: '9pt', fontWeight: 700, color: accentColor, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>Project Details</div>
              {proposal.project_name && <div style={{ fontSize: '10pt', marginBottom: '4px' }}><strong>Project:</strong> {proposal.project_name}</div>}
              {proposal.project_location && <div style={{ fontSize: '10pt', marginBottom: '4px' }}><strong>Location:</strong> {proposal.project_location}</div>}
              {proposal.total_amount && <div style={{ fontSize: '10pt', marginBottom: '4px' }}><strong>Total Amount:</strong> {formatCurrency(proposal.total_amount)}</div>}
              {proposal.payment_terms && <div style={{ fontSize: '10pt', marginBottom: '4px' }}><strong>Payment Terms:</strong> {proposal.payment_terms}</div>}
            </div>
          </div>

          {/* Content Sections */}
          {renderPreviewSection('Executive Summary', proposal.executive_summary, sectionHeadingStyle)}
          {renderPreviewSection('Company Overview', proposal.company_overview, sectionHeadingStyle)}
          {renderPreviewSection('Scope of Work', proposal.scope_of_work, sectionHeadingStyle)}
          {renderPreviewSection('Approach & Methodology', proposal.approach_and_methodology, sectionHeadingStyle)}

          {/* Template Sections */}
          {sections
            .sort((a, b) => a.display_order - b.display_order)
            .map((s, i) => (
              <div key={i}>{renderPreviewSection(s.title, s.content, sectionHeadingStyle)}</div>
            ))}

          {/* Service Offerings */}
          {serviceOfferings.length > 0 && (
            <div style={{ marginBottom: '20px' }}>
              <h2 style={sectionHeadingStyle}>Service Offerings</h2>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                {serviceOfferings
                  .sort((a, b) => a.display_order - b.display_order)
                  .map((so) => (
                    <div key={so.id} style={{ padding: '10px 14px', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '6px' }}>
                      <div style={{ fontSize: '11pt', fontWeight: 600, color: '#1e40af' }}>{so.name}</div>
                      {so.category && <div style={{ fontSize: '9pt', color: '#6b7280' }}>{so.category}</div>}
                      {(so.custom_description || so.description) && (
                        <div style={{ fontSize: '9pt', color: '#4b5563', marginTop: '4px' }}>{so.custom_description || so.description}</div>
                      )}
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* Team Resumes */}
          {resumes.length > 0 && (
            <div style={{ marginBottom: '20px' }}>
              <h2 style={sectionHeadingStyle}>Key Personnel</h2>
              {resumes
                .sort((a: any, b: any) => a.display_order - b.display_order)
                .map((r: any) => (
                  <div key={r.id} style={{ padding: '12px 16px', background: '#f9fafb', borderRadius: '6px', marginBottom: '8px', borderLeft: `3px solid ${accentColor}` }}>
                    <div style={{ fontSize: '11pt', fontWeight: 600 }}>{r.employee_name}</div>
                    <div style={{ fontSize: '9pt', color: '#6b7280', marginTop: '2px' }}>
                      {r.job_title}{r.role_on_project ? ` | Role: ${r.role_on_project}` : ''}
                    </div>
                    {r.summary && <div style={{ fontSize: '9pt', color: '#4b5563', marginTop: '4px' }}>{r.summary}</div>}
                  </div>
                ))}
            </div>
          )}

          {/* Terms & Conditions */}
          {renderPreviewSection('Terms & Conditions', proposal.terms_and_conditions, sectionHeadingStyle)}

          {/* Footer */}
          <div style={{ marginTop: '30px', paddingTop: '12px', borderTop: `2px solid ${primaryColor}`, fontSize: '9pt', color: '#6b7280', display: 'flex', justifyContent: 'space-between' }}>
            <span>{proposal.proposal_number} &middot; Version {proposal.version_number}</span>
            <span>Prepared by {proposal.created_by_name || ''}</span>
          </div>
        </div>

        {/* Attached Case Study Pages (actual published case studies) */}
        {fullCaseStudies.map(({ caseStudy, template }, index) => (
          <div key={caseStudy.id} style={{ borderTop: '4px solid #e5e7eb', marginTop: index === 0 ? 0 : undefined }}>
            <CaseStudyPreview caseStudy={caseStudy} template={template} />
          </div>
        ))}
        {loadingCs && (
          <div style={{ padding: '40px', textAlign: 'center', color: '#6b7280' }}>
            Loading case studies...
          </div>
        )}
      </div>
    </div>,
    document.body
  );
};

function renderPreviewSection(title: string, content: string | undefined, headingStyle: React.CSSProperties) {
  if (!content) return null;
  return (
    <div style={{ marginBottom: '20px' }}>
      <h2 style={headingStyle}>{title}</h2>
      <div style={{ fontSize: '10.5pt', lineHeight: '1.6', color: '#374151', whiteSpace: 'pre-wrap' }}>{content}</div>
    </div>
  );
}

export default ProposalPreviewModal;
