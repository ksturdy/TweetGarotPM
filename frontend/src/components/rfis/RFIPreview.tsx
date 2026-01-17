import React from 'react';
import { RFI } from '../../services/rfis';
import { format } from 'date-fns';

interface RFIPreviewProps {
  rfi: RFI;
  onClose?: () => void;
}

const RFIPreview: React.FC<RFIPreviewProps> = ({ rfi, onClose }) => {
  const checkbox = (checked: boolean) => (checked ? '☑' : '☐');

  const disciplineLabel = (discipline: string | null, disciplineOther: string | null) => {
    if (!discipline) return '';
    if (discipline === 'other') return disciplineOther || 'Other';
    return discipline.charAt(0).toUpperCase() + discipline.slice(1);
  };

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
            Request for Information
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

      {/* RFI Info Bar */}
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
          <div style={{ fontWeight: 'bold', marginBottom: '2px', fontSize: '10pt' }}>RFI No.</div>
          <div style={{ color: '#333' }}>#{rfi.number || ''}</div>
        </div>
        <div>
          <div style={{ fontWeight: 'bold', marginBottom: '2px', fontSize: '10pt' }}>Date Submitted</div>
          <div style={{ color: '#333' }}>
            {rfi.created_at ? format(new Date(rfi.created_at), 'MMM d, yyyy') : ''}
          </div>
        </div>
        <div>
          <div style={{ fontWeight: 'bold', marginBottom: '2px', fontSize: '10pt' }}>Response Due</div>
          <div style={{ color: '#333' }}>
            {rfi.due_date ? format(new Date(rfi.due_date), 'MMM d, yyyy') : ''}
          </div>
        </div>
        <div>
          <div style={{ fontWeight: 'bold', marginBottom: '2px', fontSize: '10pt' }}>Priority</div>
          <div style={{ color: '#333' }}>
            <span style={{ fontSize: '12pt' }}>{checkbox(rfi.priority === 'urgent')}</span> Urgent{' '}
            <span style={{ fontSize: '12pt', marginLeft: '8px' }}>{checkbox(rfi.priority !== 'urgent')}</span> Standard
          </div>
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
                {rfi.project_name || ''}
              </div>
            </div>
            <div>
              <div style={{ fontWeight: 'bold', fontSize: '9pt', marginBottom: '2px', textTransform: 'uppercase' }}>
                Project No.
              </div>
              <div style={{ fontSize: '10pt', minHeight: '18px', borderBottom: '1px solid #ddd', padding: '2px 0' }}>
                {rfi.project_number || ''}
              </div>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div>
              <div style={{ fontWeight: 'bold', fontSize: '9pt', marginBottom: '2px', textTransform: 'uppercase' }}>
                General Contractor
              </div>
              <div style={{ fontSize: '10pt', minHeight: '18px', borderBottom: '1px solid #ddd', padding: '2px 0' }}>
                {rfi.recipient_company_name || ''}
              </div>
            </div>
            <div>
              <div style={{ fontWeight: 'bold', fontSize: '9pt', marginBottom: '2px', textTransform: 'uppercase' }}>
                GC Project Manager
              </div>
              <div style={{ fontSize: '10pt', minHeight: '18px', borderBottom: '1px solid #ddd', padding: '2px 0' }}>
                {rfi.recipient_contact_name || ''}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Mechanical Contractor */}
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
          Mechanical Contractor
        </div>
        <div style={{ border: '1px solid #000', padding: '10px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '8px' }}>
            <div>
              <div style={{ fontWeight: 'bold', fontSize: '9pt', marginBottom: '2px', textTransform: 'uppercase' }}>
                Company
              </div>
              <div style={{ fontSize: '10pt', minHeight: '18px', borderBottom: '1px solid #ddd', padding: '2px 0' }}>
                Tweet Garot Mechanical
              </div>
            </div>
            <div>
              <div style={{ fontWeight: 'bold', fontSize: '9pt', marginBottom: '2px', textTransform: 'uppercase' }}>
                Submitted By
              </div>
              <div style={{ fontSize: '10pt', minHeight: '18px', borderBottom: '1px solid #ddd', padding: '2px 0' }}>
                {rfi.created_by_name || ''}
              </div>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div>
              <div style={{ fontWeight: 'bold', fontSize: '9pt', marginBottom: '2px', textTransform: 'uppercase' }}>
                Phone
              </div>
              <div style={{ fontSize: '10pt', minHeight: '18px', borderBottom: '1px solid #ddd', padding: '2px 0' }}>
                {rfi.recipient_contact_phone || ''}
              </div>
            </div>
            <div>
              <div style={{ fontWeight: 'bold', fontSize: '9pt', marginBottom: '2px', textTransform: 'uppercase' }}>
                Email
              </div>
              <div style={{ fontSize: '10pt', minHeight: '18px', borderBottom: '1px solid #ddd', padding: '2px 0' }}>
                {rfi.recipient_contact_email || ''}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Reference Information */}
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
          Reference Information
        </div>
        <div style={{ border: '1px solid #000', padding: '10px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px', marginBottom: '8px' }}>
            <div>
              <div style={{ fontWeight: 'bold', fontSize: '9pt', marginBottom: '2px', textTransform: 'uppercase' }}>
                Spec Section(s)
              </div>
              <div style={{ fontSize: '10pt', minHeight: '18px', borderBottom: '1px solid #ddd', padding: '2px 0' }}>
                {rfi.spec_section || ''}
              </div>
            </div>
            <div>
              <div style={{ fontWeight: 'bold', fontSize: '9pt', marginBottom: '2px', textTransform: 'uppercase' }}>
                Drawing Sheet(s)
              </div>
              <div style={{ fontSize: '10pt', minHeight: '18px', borderBottom: '1px solid #ddd', padding: '2px 0' }}>
                {rfi.drawing_sheet || ''}
              </div>
            </div>
            <div>
              <div style={{ fontWeight: 'bold', fontSize: '9pt', marginBottom: '2px', textTransform: 'uppercase' }}>
                Detail/Grid Ref
              </div>
              <div style={{ fontSize: '10pt', minHeight: '18px', borderBottom: '1px solid #ddd', padding: '2px 0' }}>
                {rfi.detail_grid_ref || ''}
              </div>
            </div>
          </div>
          <div>
            <div style={{ fontWeight: 'bold', fontSize: '9pt', marginBottom: '4px', textTransform: 'uppercase' }}>
              Discipline
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ fontSize: '12pt' }}>{checkbox(rfi.discipline === 'plumbing')}</span> Plumbing
              </div>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ fontSize: '12pt' }}>{checkbox(rfi.discipline === 'hvac')}</span> HVAC
              </div>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ fontSize: '12pt' }}>{checkbox(rfi.discipline === 'piping')}</span> Piping
              </div>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ fontSize: '12pt' }}>{checkbox(rfi.discipline === 'equipment')}</span> Equipment
              </div>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ fontSize: '12pt' }}>{checkbox(rfi.discipline === 'controls')}</span> Controls
              </div>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ fontSize: '12pt' }}>{checkbox(rfi.discipline === 'other')}</span> Other: {rfi.discipline_other || ''}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Question / Request for Clarification */}
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
          Question / Request for Clarification
        </div>
        <div style={{ border: '1px solid #000', padding: '10px' }}>
          <div style={{ marginBottom: '8px' }}>
            <div style={{ fontWeight: 'bold', fontSize: '9pt', marginBottom: '2px', textTransform: 'uppercase' }}>
              Subject
            </div>
            <div style={{ fontSize: '10pt', minHeight: '18px', borderBottom: '1px solid #ddd', padding: '2px 0', fontWeight: '600' }}>
              {rfi.subject || ''}
            </div>
          </div>
          <div>
            <div style={{ fontWeight: 'bold', fontSize: '9pt', marginBottom: '2px', textTransform: 'uppercase' }}>
              Question
            </div>
            <div style={{
              fontSize: '10pt',
              minHeight: '60px',
              border: '1px solid #ddd',
              padding: '4px',
              whiteSpace: 'pre-wrap',
              wordWrap: 'break-word',
            }}>
              {rfi.question || ''}
            </div>
          </div>
        </div>
      </div>

      {/* Suggested Solution */}
      {rfi.suggested_solution && (
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
            Suggested Solution (If Applicable)
          </div>
          <div style={{ border: '1px solid #000', padding: '10px' }}>
            <div style={{
              fontSize: '10pt',
              minHeight: '60px',
              border: '1px solid #ddd',
              padding: '4px',
              whiteSpace: 'pre-wrap',
              wordWrap: 'break-word',
            }}>
              {rfi.suggested_solution}
            </div>
          </div>
        </div>
      )}

      {/* Impact If Not Resolved */}
      {(rfi.schedule_impact || rfi.cost_impact || rfi.affects_other_trades) && (
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
            Impact If Not Resolved
          </div>
          <div style={{ border: '1px solid #000', padding: '10px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
              <div>
                <div style={{ fontWeight: 'bold', fontSize: '9pt', marginBottom: '4px', textTransform: 'uppercase' }}>
                  Schedule Impact
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                    <span style={{ fontSize: '12pt' }}>{checkbox(rfi.schedule_impact === true)}</span> Yes
                  </div>
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                    <span style={{ fontSize: '12pt' }}>{checkbox(rfi.schedule_impact === false)}</span> No
                  </div>
                </div>
                {rfi.schedule_impact_days && (
                  <div style={{ marginTop: '4px', fontSize: '10pt' }}>Days: {rfi.schedule_impact_days}</div>
                )}
              </div>
              <div>
                <div style={{ fontWeight: 'bold', fontSize: '9pt', marginBottom: '4px', textTransform: 'uppercase' }}>
                  Cost Impact
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                    <span style={{ fontSize: '12pt' }}>{checkbox(rfi.cost_impact === true)}</span> Yes
                  </div>
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                    <span style={{ fontSize: '12pt' }}>{checkbox(rfi.cost_impact === false)}</span> No
                  </div>
                </div>
                {rfi.cost_impact_amount && (
                  <div style={{ marginTop: '4px', fontSize: '10pt' }}>
                    Amount: ${Number(rfi.cost_impact_amount).toLocaleString('en-US', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2
                    })}
                  </div>
                )}
              </div>
              <div>
                <div style={{ fontWeight: 'bold', fontSize: '9pt', marginBottom: '4px', textTransform: 'uppercase' }}>
                  Affects Other Trades
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                    <span style={{ fontSize: '12pt' }}>{checkbox(rfi.affects_other_trades === true)}</span> Yes
                  </div>
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                    <span style={{ fontSize: '12pt' }}>{checkbox(rfi.affects_other_trades === false)}</span> No
                  </div>
                </div>
                {rfi.affected_trades && (
                  <div style={{ marginTop: '4px', fontSize: '10pt' }}>{rfi.affected_trades}</div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Attachments */}
      {(rfi.has_sketches || rfi.has_photos || rfi.has_spec_pages || rfi.has_shop_drawings || rfi.attachment_notes) && (
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
            Attachments
          </div>
          <div style={{ border: '1px solid #000', padding: '10px' }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ fontSize: '12pt' }}>{checkbox(rfi.has_sketches)}</span> Sketches/Markups
              </div>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ fontSize: '12pt' }}>{checkbox(rfi.has_photos)}</span> Photos
              </div>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ fontSize: '12pt' }}>{checkbox(rfi.has_spec_pages)}</span> Spec Pages
              </div>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ fontSize: '12pt' }}>{checkbox(rfi.has_shop_drawings)}</span> Shop Drawings
              </div>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ fontSize: '12pt' }}>{checkbox(!!rfi.attachment_notes)}</span> Other
              </div>
            </div>
            {rfi.attachment_notes && (
              <div style={{ marginTop: '6px', fontSize: '10pt', fontStyle: 'italic' }}>
                {rfi.attachment_notes}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Response Section */}
      {rfi.response ? (
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
            Response (To be completed by Architect/Engineer/GC)
          </div>
          <div style={{ border: '1px solid #000', padding: '10px', backgroundColor: '#f9f9f9' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '8px' }}>
              <div>
                <div style={{ fontWeight: 'bold', fontSize: '9pt', marginBottom: '2px', textTransform: 'uppercase' }}>
                  Response Date
                </div>
                <div style={{ fontSize: '10pt', minHeight: '18px', borderBottom: '1px solid #ddd', padding: '2px 0' }}>
                  {rfi.responded_at ? format(new Date(rfi.responded_at), 'MMM d, yyyy') : ''}
                </div>
              </div>
              <div>
                <div style={{ fontWeight: 'bold', fontSize: '9pt', marginBottom: '2px', textTransform: 'uppercase' }}>
                  Responded By
                </div>
                <div style={{ fontSize: '10pt', minHeight: '18px', borderBottom: '1px solid #ddd', padding: '2px 0' }}>
                  {rfi.responded_by_name || ''}
                </div>
              </div>
            </div>
            <div style={{ marginBottom: '8px' }}>
              <div style={{ fontWeight: 'bold', fontSize: '9pt', marginBottom: '2px', textTransform: 'uppercase' }}>
                Response / Direction
              </div>
              <div style={{
                fontSize: '10pt',
                minHeight: '60px',
                border: '1px solid #ddd',
                padding: '4px',
                whiteSpace: 'pre-wrap',
                wordWrap: 'break-word',
              }}>
                {rfi.response}
              </div>
            </div>
            <div>
              <div style={{ fontWeight: 'bold', fontSize: '9pt', marginBottom: '4px', textTransform: 'uppercase' }}>
                Response Classification
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                  <span style={{ fontSize: '12pt' }}>{checkbox(rfi.response_classification === 'clarification_only')}</span> Clarification Only - No Action Required
                </div>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                  <span style={{ fontSize: '12pt' }}>{checkbox(rfi.response_classification === 'submit_cor')}</span> Submit COR
                </div>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                  <span style={{ fontSize: '12pt' }}>{checkbox(rfi.response_classification === 'proceed_suggested')}</span> Proceed as Suggested
                </div>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                  <span style={{ fontSize: '12pt' }}>{checkbox(rfi.response_classification === 'see_attached')}</span> See Attached
                </div>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                  <span style={{ fontSize: '12pt' }}>{checkbox(rfi.response_classification === 'refer_to')}</span> Refer to: {rfi.response_reference || '__________'}
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
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
            Response (To be completed by Architect/Engineer/GC)
          </div>
          <div style={{ border: '1px solid #000', padding: '10px', backgroundColor: '#f9f9f9' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '8px' }}>
              <div>
                <div style={{ fontWeight: 'bold', fontSize: '9pt', marginBottom: '2px', textTransform: 'uppercase' }}>
                  Response Date
                </div>
                <div style={{ fontSize: '10pt', minHeight: '18px', borderBottom: '1px solid #ddd', padding: '2px 0' }}>
                </div>
              </div>
              <div>
                <div style={{ fontWeight: 'bold', fontSize: '9pt', marginBottom: '2px', textTransform: 'uppercase' }}>
                  Responded By
                </div>
                <div style={{ fontSize: '10pt', minHeight: '18px', borderBottom: '1px solid #ddd', padding: '2px 0' }}>
                </div>
              </div>
            </div>
            <div style={{ marginBottom: '8px' }}>
              <div style={{ fontWeight: 'bold', fontSize: '9pt', marginBottom: '2px', textTransform: 'uppercase' }}>
                Response / Direction
              </div>
              <div style={{
                fontSize: '10pt',
                minHeight: '80px',
                border: '1px solid #ddd',
                padding: '4px',
              }}>
              </div>
            </div>
            <div>
              <div style={{ fontWeight: 'bold', fontSize: '9pt', marginBottom: '4px', textTransform: 'uppercase' }}>
                Response Classification
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                  <span style={{ fontSize: '12pt' }}>☐</span> Clarification Only - No Action Required
                </div>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                  <span style={{ fontSize: '12pt' }}>☐</span> Submit COR
                </div>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                  <span style={{ fontSize: '12pt' }}>☐</span> Proceed as Suggested
                </div>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                  <span style={{ fontSize: '12pt' }}>☐</span> See Attached
                </div>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                  <span style={{ fontSize: '12pt' }}>☐</span> Refer to: __________
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Distribution */}
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
          Distribution
        </div>
        <div style={{ border: '1px solid #000', padding: '10px' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ fontSize: '12pt' }}>{checkbox(!!rfi.recipient_company_name)}</span> {rfi.recipient_company_name || 'Architect'}
            </div>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ fontSize: '12pt' }}>☐</span> Owner
            </div>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ fontSize: '12pt' }}>☐</span> Consultant
            </div>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ fontSize: '12pt' }}>☐</span> File
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
        <div>Tweet Garot Mechanical | Request for Information #{rfi.number}</div>
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

export default RFIPreview;
