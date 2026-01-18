import React from 'react';
import { Estimate } from '../../services/estimates';
import { format } from 'date-fns';

interface EstimateProposalPreviewProps {
  estimate: Estimate;
  onClose?: () => void;
}

const EstimateProposalPreview: React.FC<EstimateProposalPreviewProps> = ({ estimate, onClose }) => {
  return (
    <div style={{
      fontFamily: 'Arial, Helvetica, sans-serif',
      color: '#000',
      lineHeight: '1.3',
      fontSize: '10pt',
      maxWidth: '8.5in',
      margin: '0 auto',
      padding: '0.5in',
      backgroundColor: '#fff',
    }}>
      {/* Header with Logo */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: '15px',
        borderBottom: '2px solid #000',
        paddingBottom: '10px',
      }}>
        <div>
          <h1 style={{
            fontSize: '20pt',
            fontWeight: 'bold',
            margin: '0 0 5px 0',
            textTransform: 'uppercase',
          }}>
            Project Estimate Proposal
          </h1>
          <p style={{ fontSize: '11pt', margin: 0 }}>Tweet Garot Mechanical</p>
        </div>
        <div style={{ textAlign: 'right' }}>
          <img
            src="/TweetGarotLogo.png"
            alt="Tweet Garot Mechanical"
            style={{
              width: '120px',
              height: 'auto',
              maxHeight: '60px',
              objectFit: 'contain',
            }}
          />
        </div>
      </div>

      {/* Estimate Info Bar */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr 1fr 1fr',
        gap: '10px',
        marginBottom: '12px',
        padding: '8px',
        backgroundColor: '#f8f8f8',
        border: '1px solid #ddd',
      }}>
        <div>
          <div style={{ fontWeight: 'bold', marginBottom: '2px', fontSize: '10pt' }}>Estimate No.</div>
          <div style={{ color: '#333' }}>{estimate.estimate_number || ''}</div>
        </div>
        <div>
          <div style={{ fontWeight: 'bold', marginBottom: '2px', fontSize: '10pt' }}>Date</div>
          <div style={{ color: '#333' }}>
            {estimate.created_at ? format(new Date(estimate.created_at), 'MMM d, yyyy') : ''}
          </div>
        </div>
        <div>
          <div style={{ fontWeight: 'bold', marginBottom: '2px', fontSize: '10pt' }}>Bid Date</div>
          <div style={{ color: '#333' }}>
            {estimate.bid_date ? format(new Date(estimate.bid_date), 'MMM d, yyyy') : 'TBD'}
          </div>
        </div>
        <div>
          <div style={{ fontWeight: 'bold', marginBottom: '2px', fontSize: '10pt' }}>Status</div>
          <div style={{ color: '#333', textTransform: 'capitalize' }}>{estimate.status || 'draft'}</div>
        </div>
      </div>

      {/* Project Information */}
      <div style={{ marginBottom: '12px' }}>
        <div style={{
          fontSize: '11pt',
          fontWeight: 'bold',
          backgroundColor: '#000',
          color: '#fff',
          padding: '4px 8px',
          marginBottom: '8px',
          textTransform: 'uppercase',
        }}>
          Project Information
        </div>
        <div style={{ border: '1px solid #000', padding: '10px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '8px' }}>
            <div>
              <div style={{ fontWeight: 'bold', fontSize: '9pt', marginBottom: '2px', textTransform: 'uppercase' }}>
                Project Name
              </div>
              <div style={{ fontSize: '10pt', minHeight: '18px', borderBottom: '1px solid #ddd', padding: '2px 0' }}>
                {estimate.project_name || ''}
              </div>
            </div>
            <div>
              <div style={{ fontWeight: 'bold', fontSize: '9pt', marginBottom: '2px', textTransform: 'uppercase' }}>
                Customer
              </div>
              <div style={{ fontSize: '10pt', minHeight: '18px', borderBottom: '1px solid #ddd', padding: '2px 0' }}>
                {estimate.customer_name || ''}
              </div>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px', marginBottom: '8px' }}>
            <div>
              <div style={{ fontWeight: 'bold', fontSize: '9pt', marginBottom: '2px', textTransform: 'uppercase' }}>
                Building Type
              </div>
              <div style={{ fontSize: '10pt', minHeight: '18px', borderBottom: '1px solid #ddd', padding: '2px 0' }}>
                {estimate.building_type || ''}
              </div>
            </div>
            <div>
              <div style={{ fontWeight: 'bold', fontSize: '9pt', marginBottom: '2px', textTransform: 'uppercase' }}>
                Square Footage
              </div>
              <div style={{ fontSize: '10pt', minHeight: '18px', borderBottom: '1px solid #ddd', padding: '2px 0' }}>
                {estimate.square_footage ? Number(estimate.square_footage).toLocaleString() : ''}
              </div>
            </div>
            <div>
              <div style={{ fontWeight: 'bold', fontSize: '9pt', marginBottom: '2px', textTransform: 'uppercase' }}>
                Location
              </div>
              <div style={{ fontSize: '10pt', minHeight: '18px', borderBottom: '1px solid #ddd', padding: '2px 0' }}>
                {estimate.location || ''}
              </div>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div>
              <div style={{ fontWeight: 'bold', fontSize: '9pt', marginBottom: '2px', textTransform: 'uppercase' }}>
                Project Start Date
              </div>
              <div style={{ fontSize: '10pt', minHeight: '18px', borderBottom: '1px solid #ddd', padding: '2px 0' }}>
                {estimate.project_start_date ? format(new Date(estimate.project_start_date), 'MMM d, yyyy') : ''}
              </div>
            </div>
            <div>
              <div style={{ fontWeight: 'bold', fontSize: '9pt', marginBottom: '2px', textTransform: 'uppercase' }}>
                Project Duration
              </div>
              <div style={{ fontSize: '10pt', minHeight: '18px', borderBottom: '1px solid #ddd', padding: '2px 0' }}>
                {estimate.project_duration || ''}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Cost Breakdown */}
      <div style={{ marginBottom: '12px' }}>
        <div style={{
          fontSize: '11pt',
          fontWeight: 'bold',
          backgroundColor: '#000',
          color: '#fff',
          padding: '4px 8px',
          marginBottom: '8px',
          textTransform: 'uppercase',
        }}>
          Cost Breakdown by Section
        </div>
        <div style={{ border: '1px solid #000' }}>
          <table style={{
            width: '100%',
            borderCollapse: 'collapse',
            fontSize: '9pt',
          }}>
            <thead>
              <tr style={{ backgroundColor: '#f0f0f0' }}>
                <th style={{ padding: '6px', textAlign: 'left', border: '1px solid #000', fontWeight: 'bold' }}>Section</th>
                <th style={{ padding: '6px', textAlign: 'right', border: '1px solid #000', fontWeight: 'bold' }}>Labor</th>
                <th style={{ padding: '6px', textAlign: 'right', border: '1px solid #000', fontWeight: 'bold' }}>Material</th>
                <th style={{ padding: '6px', textAlign: 'right', border: '1px solid #000', fontWeight: 'bold' }}>Equipment</th>
                <th style={{ padding: '6px', textAlign: 'right', border: '1px solid #000', fontWeight: 'bold' }}>Subcontractor</th>
                <th style={{ padding: '6px', textAlign: 'right', border: '1px solid #000', fontWeight: 'bold' }}>Total</th>
              </tr>
            </thead>
            <tbody>
              {estimate.sections?.map((section: any, idx: number) => (
                <tr key={idx}>
                  <td style={{ padding: '6px', border: '1px solid #000' }}>{section.section_name}</td>
                  <td style={{ padding: '6px', textAlign: 'right', border: '1px solid #000' }}>
                    ${Number(section.labor_cost || 0).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                  </td>
                  <td style={{ padding: '6px', textAlign: 'right', border: '1px solid #000' }}>
                    ${Number(section.material_cost || 0).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                  </td>
                  <td style={{ padding: '6px', textAlign: 'right', border: '1px solid #000' }}>
                    ${Number(section.equipment_cost || 0).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                  </td>
                  <td style={{ padding: '6px', textAlign: 'right', border: '1px solid #000' }}>
                    ${Number(section.subcontractor_cost || 0).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                  </td>
                  <td style={{ padding: '6px', textAlign: 'right', border: '1px solid #000', fontWeight: 'bold' }}>
                    ${Number(section.total_cost || 0).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Cost Summary */}
      <div style={{ marginBottom: '12px' }}>
        <div style={{
          fontSize: '11pt',
          fontWeight: 'bold',
          backgroundColor: '#000',
          color: '#fff',
          padding: '4px 8px',
          marginBottom: '8px',
          textTransform: 'uppercase',
        }}>
          Cost Summary
        </div>
        <div style={{ border: '1px solid #000', padding: '10px' }}>
          <table style={{ width: '100%', fontSize: '10pt' }}>
            <tbody>
              <tr>
                <td style={{ padding: '4px 0' }}>Labor Cost (incl. burden)</td>
                <td style={{ padding: '4px 0', textAlign: 'right', fontWeight: 'bold' }}>
                  ${Number(estimate.labor_cost || 0).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                </td>
              </tr>
              <tr>
                <td style={{ padding: '4px 0' }}>Material Cost (incl. waste)</td>
                <td style={{ padding: '4px 0', textAlign: 'right', fontWeight: 'bold' }}>
                  ${Number(estimate.material_cost || 0).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                </td>
              </tr>
              <tr>
                <td style={{ padding: '4px 0' }}>Equipment Cost</td>
                <td style={{ padding: '4px 0', textAlign: 'right', fontWeight: 'bold' }}>
                  ${Number(estimate.equipment_cost || 0).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                </td>
              </tr>
              <tr>
                <td style={{ padding: '4px 0' }}>Subcontractor Cost</td>
                <td style={{ padding: '4px 0', textAlign: 'right', fontWeight: 'bold' }}>
                  ${Number(estimate.subcontractor_cost || 0).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                </td>
              </tr>
              <tr>
                <td style={{ padding: '4px 0' }}>Rental Cost</td>
                <td style={{ padding: '4px 0', textAlign: 'right', fontWeight: 'bold' }}>
                  ${Number(estimate.rental_cost || 0).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                </td>
              </tr>
              <tr style={{ borderTop: '1px solid #000' }}>
                <td style={{ padding: '4px 0', fontWeight: 'bold' }}>Subtotal</td>
                <td style={{ padding: '4px 0', textAlign: 'right', fontWeight: 'bold' }}>
                  ${Number(estimate.subtotal || 0).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                </td>
              </tr>
              <tr>
                <td style={{ padding: '4px 0' }}>Overhead ({Number(estimate.overhead_percentage || 0).toFixed(1)}%)</td>
                <td style={{ padding: '4px 0', textAlign: 'right', fontWeight: 'bold' }}>
                  ${Number(estimate.overhead_amount || 0).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                </td>
              </tr>
              <tr>
                <td style={{ padding: '4px 0' }}>Profit ({Number(estimate.profit_percentage || 0).toFixed(1)}%)</td>
                <td style={{ padding: '4px 0', textAlign: 'right', fontWeight: 'bold' }}>
                  ${Number(estimate.profit_amount || 0).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                </td>
              </tr>
              <tr>
                <td style={{ padding: '4px 0' }}>Contingency ({Number(estimate.contingency_percentage || 0).toFixed(1)}%)</td>
                <td style={{ padding: '4px 0', textAlign: 'right', fontWeight: 'bold' }}>
                  ${Number(estimate.contingency_amount || 0).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                </td>
              </tr>
              {Number(estimate.bond_percentage || 0) > 0 && (
                <tr>
                  <td style={{ padding: '4px 0' }}>Bond ({Number(estimate.bond_percentage || 0).toFixed(1)}%)</td>
                  <td style={{ padding: '4px 0', textAlign: 'right', fontWeight: 'bold' }}>
                    ${Number(estimate.bond_amount || 0).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                  </td>
                </tr>
              )}
              <tr style={{ borderTop: '2px solid #000', backgroundColor: '#f0f0f0' }}>
                <td style={{ padding: '8px 0', fontWeight: 'bold', fontSize: '12pt' }}>TOTAL ESTIMATE</td>
                <td style={{ padding: '8px 0', textAlign: 'right', fontWeight: 'bold', fontSize: '12pt' }}>
                  ${Number(estimate.total_cost || 0).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Scope of Work */}
      {estimate.scope_of_work && (
        <div style={{ marginBottom: '12px' }}>
          <div style={{
            fontSize: '11pt',
            fontWeight: 'bold',
            backgroundColor: '#000',
            color: '#fff',
            padding: '4px 8px',
            marginBottom: '8px',
            textTransform: 'uppercase',
          }}>
            Scope of Work
          </div>
          <div style={{ border: '1px solid #000', padding: '10px' }}>
            <div style={{
              fontSize: '10pt',
              whiteSpace: 'pre-wrap',
              wordWrap: 'break-word',
            }}>
              {estimate.scope_of_work}
            </div>
          </div>
        </div>
      )}

      {/* Exclusions */}
      {estimate.exclusions && (
        <div style={{ marginBottom: '12px' }}>
          <div style={{
            fontSize: '11pt',
            fontWeight: 'bold',
            backgroundColor: '#000',
            color: '#fff',
            padding: '4px 8px',
            marginBottom: '8px',
            textTransform: 'uppercase',
          }}>
            Exclusions
          </div>
          <div style={{ border: '1px solid #000', padding: '10px' }}>
            <div style={{
              fontSize: '10pt',
              whiteSpace: 'pre-wrap',
              wordWrap: 'break-word',
            }}>
              {estimate.exclusions}
            </div>
          </div>
        </div>
      )}

      {/* Assumptions */}
      {estimate.assumptions && (
        <div style={{ marginBottom: '12px' }}>
          <div style={{
            fontSize: '11pt',
            fontWeight: 'bold',
            backgroundColor: '#000',
            color: '#fff',
            padding: '4px 8px',
            marginBottom: '8px',
            textTransform: 'uppercase',
          }}>
            Assumptions
          </div>
          <div style={{ border: '1px solid #000', padding: '10px' }}>
            <div style={{
              fontSize: '10pt',
              whiteSpace: 'pre-wrap',
              wordWrap: 'break-word',
            }}>
              {estimate.assumptions}
            </div>
          </div>
        </div>
      )}

      {/* Notes */}
      {estimate.notes && (
        <div style={{ marginBottom: '12px' }}>
          <div style={{
            fontSize: '11pt',
            fontWeight: 'bold',
            backgroundColor: '#000',
            color: '#fff',
            padding: '4px 8px',
            marginBottom: '8px',
            textTransform: 'uppercase',
          }}>
            Notes
          </div>
          <div style={{ border: '1px solid #000', padding: '10px' }}>
            <div style={{
              fontSize: '10pt',
              whiteSpace: 'pre-wrap',
              wordWrap: 'break-word',
            }}>
              {estimate.notes}
            </div>
          </div>
        </div>
      )}

      {/* Prepared By */}
      <div style={{ marginBottom: '12px' }}>
        <div style={{
          fontSize: '11pt',
          fontWeight: 'bold',
          backgroundColor: '#000',
          color: '#fff',
          padding: '4px 8px',
          marginBottom: '8px',
          textTransform: 'uppercase',
        }}>
          Prepared By
        </div>
        <div style={{ border: '1px solid #000', padding: '10px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div>
              <div style={{ fontWeight: 'bold', fontSize: '9pt', marginBottom: '2px', textTransform: 'uppercase' }}>
                Estimator
              </div>
              <div style={{ fontSize: '10pt', minHeight: '18px', borderBottom: '1px solid #ddd', padding: '2px 0' }}>
                {estimate.estimator_name || ''}
              </div>
            </div>
            <div>
              <div style={{ fontWeight: 'bold', fontSize: '9pt', marginBottom: '2px', textTransform: 'uppercase' }}>
                Date Prepared
              </div>
              <div style={{ fontSize: '10pt', minHeight: '18px', borderBottom: '1px solid #ddd', padding: '2px 0' }}>
                {estimate.created_at ? format(new Date(estimate.created_at), 'MMM d, yyyy') : ''}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div style={{
        marginTop: '20px',
        paddingTop: '10px',
        borderTop: '1px solid #ddd',
        fontSize: '9pt',
        color: '#666',
        textAlign: 'center',
      }}>
        <div>Tweet Garot Mechanical | Project Estimate {estimate.estimate_number}</div>
        <div style={{ marginTop: '4px' }}>
          This estimate is valid for 30 days from the date of preparation
        </div>
        <div style={{ marginTop: '4px' }}>
          Generated on {format(new Date(), 'MMM d, yyyy')} at {format(new Date(), 'h:mm a')}
        </div>
      </div>

      {/* Close Button (only if onClose is provided) */}
      {onClose && (
        <div style={{ textAlign: 'center', marginTop: '20px', pageBreakBefore: 'avoid' }}>
          <button
            onClick={onClose}
            style={{
              padding: '10px 20px',
              fontSize: '14px',
              backgroundColor: '#002356',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
            }}
          >
            Close Preview
          </button>
        </div>
      )}
    </div>
  );
};

export default EstimateProposalPreview;
