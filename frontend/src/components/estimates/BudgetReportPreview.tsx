import React from 'react';
import { format } from 'date-fns';
import { GeneratedBudget, SimilarProject } from '../../services/budgetGenerator';

interface BudgetReportPreviewProps {
  budget: GeneratedBudget;
  comparableProjects: SimilarProject[];
  editableValues: {
    overheadPercent: number;
    profitPercent: number;
    contingencyPercent: number;
  };
  bidType?: string;
  scope?: string;
}

const BudgetReportPreview: React.FC<BudgetReportPreviewProps> = ({
  budget,
  comparableProjects,
  editableValues,
  bidType,
  scope,
}) => {
  const formatCurrency = (value: number | undefined | null) => {
    if (value === undefined || value === null) return '$0';
    return '$' + Math.round(value).toLocaleString();
  };

  const formatNumber = (value: number | undefined | null) => {
    if (value === undefined || value === null) return '0';
    return Math.round(value).toLocaleString();
  };

  const getConfidenceLabel = (level: string) => {
    const labels: { [key: string]: string } = {
      high: 'HIGH',
      medium: 'MEDIUM',
      low: 'LOW'
    };
    return labels[level] || 'MEDIUM';
  };

  return (
    <div style={{
      fontFamily: 'Arial, Helvetica, sans-serif',
      color: '#000',
      lineHeight: '1.4',
      fontSize: '10pt',
      maxWidth: '8.5in',
      margin: '0 auto',
      padding: '0.5in',
      backgroundColor: '#fff',
    }}>
      {/* Cover Page / Header */}
      <div style={{
        marginBottom: '30px',
        paddingBottom: '20px',
        borderBottom: '3px solid #002356',
      }}>
        {/* Logo and Company Header */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: '30px',
        }}>
          <div>
            <img
              src="/TweetGarotLogo.png"
              alt="Tweet Garot Mechanical"
              style={{
                width: '180px',
                height: 'auto',
                maxHeight: '80px',
                objectFit: 'contain',
              }}
            />
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '9pt', color: '#666' }}>
              Generated: {format(new Date(), 'MMMM d, yyyy')}
            </div>
            <div style={{ fontSize: '9pt', color: '#666' }}>
              Report ID: BUD-{format(new Date(), 'yyyyMMdd-HHmm')}
            </div>
          </div>
        </div>

        {/* Report Title */}
        <div style={{ textAlign: 'center', marginBottom: '30px' }}>
          <h1 style={{
            fontSize: '24pt',
            fontWeight: 'bold',
            color: '#002356',
            margin: '0 0 10px 0',
            textTransform: 'uppercase',
            letterSpacing: '2px',
          }}>
            Budget Estimate Report
          </h1>
          <div style={{
            fontSize: '14pt',
            color: '#333',
            fontWeight: '600',
          }}>
            {budget.summary.projectName}
          </div>
        </div>

        {/* Project Quick Info */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: '15px',
          padding: '15px',
          backgroundColor: '#f8f9fa',
          border: '1px solid #e5e7eb',
          borderRadius: '4px',
        }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '9pt', color: '#666', textTransform: 'uppercase', marginBottom: '4px' }}>
              Building Type
            </div>
            <div style={{ fontSize: '11pt', fontWeight: '600', color: '#002356' }}>
              {budget.summary.buildingType}
            </div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '9pt', color: '#666', textTransform: 'uppercase', marginBottom: '4px' }}>
              Project Type
            </div>
            <div style={{ fontSize: '11pt', fontWeight: '600', color: '#002356' }}>
              {budget.summary.projectType}
            </div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '9pt', color: '#666', textTransform: 'uppercase', marginBottom: '4px' }}>
              Square Footage
            </div>
            <div style={{ fontSize: '11pt', fontWeight: '600', color: '#002356' }}>
              {formatNumber(budget.summary.squareFootage)} SF
            </div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '9pt', color: '#666', textTransform: 'uppercase', marginBottom: '4px' }}>
              Confidence Level
            </div>
            <div style={{
              fontSize: '11pt',
              fontWeight: '700',
              color: budget.summary.confidenceLevel === 'high' ? '#16a34a' :
                     budget.summary.confidenceLevel === 'medium' ? '#ca8a04' : '#dc2626',
            }}>
              {getConfidenceLabel(budget.summary.confidenceLevel)}
            </div>
          </div>
        </div>
      </div>

      {/* Executive Summary */}
      <div style={{ marginBottom: '25px', pageBreakInside: 'avoid' }}>
        <div style={{
          fontSize: '12pt',
          fontWeight: 'bold',
          backgroundColor: '#002356',
          color: '#fff',
          padding: '8px 12px',
          marginBottom: '12px',
          textTransform: 'uppercase',
          letterSpacing: '1px',
        }}>
          Executive Summary
        </div>

        {/* Total Cost Highlight */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '2fr 1fr 1fr',
          gap: '15px',
          marginBottom: '15px',
        }}>
          <div style={{
            padding: '20px',
            backgroundColor: '#002356',
            color: '#fff',
            borderRadius: '4px',
            textAlign: 'center',
          }}>
            <div style={{ fontSize: '10pt', opacity: 0.8, marginBottom: '5px', textTransform: 'uppercase' }}>
              Estimated Total Cost
            </div>
            <div style={{ fontSize: '24pt', fontWeight: '700' }}>
              {formatCurrency(budget.summary.estimatedTotalCost)}
            </div>
          </div>
          <div style={{
            padding: '20px',
            backgroundColor: '#f8f9fa',
            border: '1px solid #e5e7eb',
            borderRadius: '4px',
            textAlign: 'center',
          }}>
            <div style={{ fontSize: '10pt', color: '#666', marginBottom: '5px', textTransform: 'uppercase' }}>
              Cost Per SF
            </div>
            <div style={{ fontSize: '18pt', fontWeight: '700', color: '#002356' }}>
              ${(budget.summary.costPerSquareFoot || 0).toFixed(2)}
            </div>
          </div>
          <div style={{
            padding: '20px',
            backgroundColor: '#f8f9fa',
            border: '1px solid #e5e7eb',
            borderRadius: '4px',
            textAlign: 'center',
          }}>
            <div style={{ fontSize: '10pt', color: '#666', marginBottom: '5px', textTransform: 'uppercase' }}>
              Direct Costs
            </div>
            <div style={{ fontSize: '18pt', fontWeight: '700', color: '#002356' }}>
              {formatCurrency(budget.totals.directCostSubtotal)}
            </div>
          </div>
        </div>

        {/* Methodology */}
        <div style={{
          padding: '12px',
          backgroundColor: '#f8f9fa',
          border: '1px solid #e5e7eb',
          borderRadius: '4px',
          fontSize: '10pt',
          lineHeight: '1.5',
        }}>
          <strong style={{ color: '#002356' }}>Methodology:</strong> {budget.summary.methodology}
        </div>

        {scope && (
          <div style={{
            padding: '12px',
            backgroundColor: '#fffbeb',
            border: '1px solid #fde68a',
            borderRadius: '4px',
            fontSize: '10pt',
            lineHeight: '1.5',
            marginTop: '10px',
          }}>
            <strong style={{ color: '#92400e' }}>Scope Notes:</strong> {scope}
          </div>
        )}
      </div>

      {/* Cost Summary Table */}
      <div style={{ marginBottom: '25px', pageBreakInside: 'avoid' }}>
        <div style={{
          fontSize: '12pt',
          fontWeight: 'bold',
          backgroundColor: '#002356',
          color: '#fff',
          padding: '8px 12px',
          marginBottom: '12px',
          textTransform: 'uppercase',
          letterSpacing: '1px',
        }}>
          Cost Summary
        </div>

        <table style={{
          width: '100%',
          borderCollapse: 'collapse',
          fontSize: '10pt',
        }}>
          <thead>
            <tr style={{ backgroundColor: '#f3f4f6' }}>
              <th style={{ padding: '10px 12px', textAlign: 'left', borderBottom: '2px solid #002356', fontWeight: '600' }}>
                Category
              </th>
              <th style={{ padding: '10px 12px', textAlign: 'right', borderBottom: '2px solid #002356', fontWeight: '600' }}>
                Amount
              </th>
              <th style={{ padding: '10px 12px', textAlign: 'right', borderBottom: '2px solid #002356', fontWeight: '600' }}>
                % of Total
              </th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style={{ padding: '8px 12px', borderBottom: '1px solid #e5e7eb' }}>Labor</td>
              <td style={{ padding: '8px 12px', textAlign: 'right', borderBottom: '1px solid #e5e7eb' }}>
                {formatCurrency(budget.totals.laborSubtotal)}
              </td>
              <td style={{ padding: '8px 12px', textAlign: 'right', borderBottom: '1px solid #e5e7eb' }}>
                {((budget.totals.laborSubtotal / budget.totals.grandTotal) * 100).toFixed(1)}%
              </td>
            </tr>
            <tr>
              <td style={{ padding: '8px 12px', borderBottom: '1px solid #e5e7eb' }}>Material</td>
              <td style={{ padding: '8px 12px', textAlign: 'right', borderBottom: '1px solid #e5e7eb' }}>
                {formatCurrency(budget.totals.materialSubtotal)}
              </td>
              <td style={{ padding: '8px 12px', textAlign: 'right', borderBottom: '1px solid #e5e7eb' }}>
                {((budget.totals.materialSubtotal / budget.totals.grandTotal) * 100).toFixed(1)}%
              </td>
            </tr>
            <tr>
              <td style={{ padding: '8px 12px', borderBottom: '1px solid #e5e7eb' }}>Equipment</td>
              <td style={{ padding: '8px 12px', textAlign: 'right', borderBottom: '1px solid #e5e7eb' }}>
                {formatCurrency(budget.totals.equipmentSubtotal)}
              </td>
              <td style={{ padding: '8px 12px', textAlign: 'right', borderBottom: '1px solid #e5e7eb' }}>
                {((budget.totals.equipmentSubtotal / budget.totals.grandTotal) * 100).toFixed(1)}%
              </td>
            </tr>
            <tr>
              <td style={{ padding: '8px 12px', borderBottom: '1px solid #e5e7eb' }}>Subcontract</td>
              <td style={{ padding: '8px 12px', textAlign: 'right', borderBottom: '1px solid #e5e7eb' }}>
                {formatCurrency(budget.totals.subcontractSubtotal)}
              </td>
              <td style={{ padding: '8px 12px', textAlign: 'right', borderBottom: '1px solid #e5e7eb' }}>
                {((budget.totals.subcontractSubtotal / budget.totals.grandTotal) * 100).toFixed(1)}%
              </td>
            </tr>
            <tr style={{ backgroundColor: '#f8f9fa', fontWeight: '600' }}>
              <td style={{ padding: '10px 12px', borderBottom: '2px solid #002356' }}>Direct Cost Subtotal</td>
              <td style={{ padding: '10px 12px', textAlign: 'right', borderBottom: '2px solid #002356' }}>
                {formatCurrency(budget.totals.directCostSubtotal)}
              </td>
              <td style={{ padding: '10px 12px', textAlign: 'right', borderBottom: '2px solid #002356' }}>
                {((budget.totals.directCostSubtotal / budget.totals.grandTotal) * 100).toFixed(1)}%
              </td>
            </tr>
            <tr>
              <td style={{ padding: '8px 12px', borderBottom: '1px solid #e5e7eb' }}>
                Overhead ({editableValues.overheadPercent}%)
              </td>
              <td style={{ padding: '8px 12px', textAlign: 'right', borderBottom: '1px solid #e5e7eb' }}>
                {formatCurrency(budget.totals.overhead)}
              </td>
              <td style={{ padding: '8px 12px', textAlign: 'right', borderBottom: '1px solid #e5e7eb' }}>
                {((budget.totals.overhead / budget.totals.grandTotal) * 100).toFixed(1)}%
              </td>
            </tr>
            <tr>
              <td style={{ padding: '8px 12px', borderBottom: '1px solid #e5e7eb' }}>
                Profit ({editableValues.profitPercent}%)
              </td>
              <td style={{ padding: '8px 12px', textAlign: 'right', borderBottom: '1px solid #e5e7eb' }}>
                {formatCurrency(budget.totals.profit)}
              </td>
              <td style={{ padding: '8px 12px', textAlign: 'right', borderBottom: '1px solid #e5e7eb' }}>
                {((budget.totals.profit / budget.totals.grandTotal) * 100).toFixed(1)}%
              </td>
            </tr>
            <tr>
              <td style={{ padding: '8px 12px', borderBottom: '1px solid #e5e7eb' }}>
                Contingency ({editableValues.contingencyPercent}%)
              </td>
              <td style={{ padding: '8px 12px', textAlign: 'right', borderBottom: '1px solid #e5e7eb' }}>
                {formatCurrency(budget.totals.contingency)}
              </td>
              <td style={{ padding: '8px 12px', textAlign: 'right', borderBottom: '1px solid #e5e7eb' }}>
                {((budget.totals.contingency / budget.totals.grandTotal) * 100).toFixed(1)}%
              </td>
            </tr>
            <tr style={{ backgroundColor: '#002356', color: '#fff', fontWeight: '700' }}>
              <td style={{ padding: '12px', fontSize: '11pt' }}>GRAND TOTAL</td>
              <td style={{ padding: '12px', textAlign: 'right', fontSize: '11pt' }}>
                {formatCurrency(budget.totals.grandTotal)}
              </td>
              <td style={{ padding: '12px', textAlign: 'right', fontSize: '11pt' }}>100%</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Section Breakdown */}
      <div style={{ marginBottom: '25px' }}>
        <div style={{
          fontSize: '12pt',
          fontWeight: 'bold',
          backgroundColor: '#002356',
          color: '#fff',
          padding: '8px 12px',
          marginBottom: '12px',
          textTransform: 'uppercase',
          letterSpacing: '1px',
        }}>
          Detailed Cost Breakdown by Section
        </div>

        {budget.sections.map((section, index) => (
          <div key={index} style={{ marginBottom: '15px', pageBreakInside: 'avoid' }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '8px 12px',
              backgroundColor: '#f3f4f6',
              borderBottom: '2px solid #002356',
              fontWeight: '600',
            }}>
              <span>{section.name}</span>
              <span style={{ color: '#002356' }}>{formatCurrency(section.subtotal)}</span>
            </div>

            {section.items.length > 0 && (
              <table style={{
                width: '100%',
                borderCollapse: 'collapse',
                fontSize: '9pt',
              }}>
                <thead>
                  <tr style={{ backgroundColor: '#fafafa' }}>
                    <th style={{ padding: '6px 10px', textAlign: 'left', borderBottom: '1px solid #e5e7eb', fontWeight: '600', width: '40%' }}>
                      Description
                    </th>
                    <th style={{ padding: '6px 10px', textAlign: 'right', borderBottom: '1px solid #e5e7eb', fontWeight: '600' }}>
                      Qty
                    </th>
                    <th style={{ padding: '6px 10px', textAlign: 'right', borderBottom: '1px solid #e5e7eb', fontWeight: '600' }}>
                      Labor
                    </th>
                    <th style={{ padding: '6px 10px', textAlign: 'right', borderBottom: '1px solid #e5e7eb', fontWeight: '600' }}>
                      Material
                    </th>
                    <th style={{ padding: '6px 10px', textAlign: 'right', borderBottom: '1px solid #e5e7eb', fontWeight: '600' }}>
                      Total
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {section.items.map((item, itemIndex) => (
                    <tr key={itemIndex}>
                      <td style={{ padding: '5px 10px', borderBottom: '1px solid #f3f4f6' }}>
                        {item.description}
                      </td>
                      <td style={{ padding: '5px 10px', textAlign: 'right', borderBottom: '1px solid #f3f4f6' }}>
                        {item.quantity ? `${formatNumber(item.quantity)} ${item.unit || ''}` : '-'}
                      </td>
                      <td style={{ padding: '5px 10px', textAlign: 'right', borderBottom: '1px solid #f3f4f6' }}>
                        {formatCurrency(item.laborCost)}
                      </td>
                      <td style={{ padding: '5px 10px', textAlign: 'right', borderBottom: '1px solid #f3f4f6' }}>
                        {formatCurrency(item.materialCost)}
                      </td>
                      <td style={{ padding: '5px 10px', textAlign: 'right', borderBottom: '1px solid #f3f4f6', fontWeight: '600' }}>
                        {formatCurrency(item.totalCost)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        ))}
      </div>

      {/* Comparable Projects */}
      {comparableProjects.length > 0 && (
        <div style={{ marginBottom: '25px', pageBreakInside: 'avoid' }}>
          <div style={{
            fontSize: '12pt',
            fontWeight: 'bold',
            backgroundColor: '#002356',
            color: '#fff',
            padding: '8px 12px',
            marginBottom: '12px',
            textTransform: 'uppercase',
            letterSpacing: '1px',
          }}>
            Comparable Historical Projects
          </div>

          <table style={{
            width: '100%',
            borderCollapse: 'collapse',
            fontSize: '10pt',
          }}>
            <thead>
              <tr style={{ backgroundColor: '#f3f4f6' }}>
                <th style={{ padding: '10px 12px', textAlign: 'left', borderBottom: '2px solid #002356', fontWeight: '600' }}>
                  Project Name
                </th>
                <th style={{ padding: '10px 12px', textAlign: 'right', borderBottom: '2px solid #002356', fontWeight: '600' }}>
                  Square Footage
                </th>
                <th style={{ padding: '10px 12px', textAlign: 'right', borderBottom: '2px solid #002356', fontWeight: '600' }}>
                  Total Cost
                </th>
                <th style={{ padding: '10px 12px', textAlign: 'right', borderBottom: '2px solid #002356', fontWeight: '600' }}>
                  Cost/SF
                </th>
                <th style={{ padding: '10px 12px', textAlign: 'center', borderBottom: '2px solid #002356', fontWeight: '600' }}>
                  Match Score
                </th>
              </tr>
            </thead>
            <tbody>
              {comparableProjects.slice(0, 5).map((project, index) => (
                <tr key={project.id || index}>
                  <td style={{ padding: '8px 12px', borderBottom: '1px solid #e5e7eb' }}>
                    {project.name}
                  </td>
                  <td style={{ padding: '8px 12px', textAlign: 'right', borderBottom: '1px solid #e5e7eb' }}>
                    {formatNumber(project.sqft)} SF
                  </td>
                  <td style={{ padding: '8px 12px', textAlign: 'right', borderBottom: '1px solid #e5e7eb' }}>
                    {formatCurrency(project.totalCost)}
                  </td>
                  <td style={{ padding: '8px 12px', textAlign: 'right', borderBottom: '1px solid #e5e7eb' }}>
                    ${(project.costPerSqft || 0).toFixed(2)}
                  </td>
                  <td style={{ padding: '8px 12px', textAlign: 'center', borderBottom: '1px solid #e5e7eb' }}>
                    <span style={{
                      display: 'inline-block',
                      padding: '2px 8px',
                      backgroundColor: project.similarityScore >= 80 ? '#dcfce7' :
                                       project.similarityScore >= 60 ? '#fef3c7' : '#fee2e2',
                      color: project.similarityScore >= 80 ? '#166534' :
                             project.similarityScore >= 60 ? '#92400e' : '#991b1b',
                      borderRadius: '12px',
                      fontWeight: '600',
                      fontSize: '9pt',
                    }}>
                      {project.similarityScore}%
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Assumptions & Risks */}
      <div style={{ marginBottom: '25px', pageBreakInside: 'avoid' }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '20px',
        }}>
          {/* Assumptions */}
          <div>
            <div style={{
              fontSize: '12pt',
              fontWeight: 'bold',
              backgroundColor: '#002356',
              color: '#fff',
              padding: '8px 12px',
              marginBottom: '12px',
              textTransform: 'uppercase',
              letterSpacing: '1px',
            }}>
              Key Assumptions
            </div>
            <ul style={{
              margin: 0,
              paddingLeft: '20px',
              fontSize: '9pt',
              lineHeight: '1.6',
            }}>
              {budget.assumptions.map((assumption, index) => (
                <li key={index} style={{ marginBottom: '6px' }}>{assumption}</li>
              ))}
            </ul>
          </div>

          {/* Risks */}
          <div>
            <div style={{
              fontSize: '12pt',
              fontWeight: 'bold',
              backgroundColor: '#dc2626',
              color: '#fff',
              padding: '8px 12px',
              marginBottom: '12px',
              textTransform: 'uppercase',
              letterSpacing: '1px',
            }}>
              Potential Risks
            </div>
            <ul style={{
              margin: 0,
              paddingLeft: '20px',
              fontSize: '9pt',
              lineHeight: '1.6',
            }}>
              {budget.risks.map((risk, index) => (
                <li key={index} style={{ marginBottom: '6px' }}>{risk}</li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* Disclaimer */}
      <div style={{
        padding: '12px',
        backgroundColor: '#f8f9fa',
        border: '1px solid #e5e7eb',
        borderRadius: '4px',
        fontSize: '8pt',
        color: '#666',
        lineHeight: '1.5',
        marginBottom: '20px',
      }}>
        <strong>Disclaimer:</strong> This budget estimate is based on historical project data and AI-powered analysis.
        Actual costs may vary based on market conditions, project-specific requirements, and other factors.
        This estimate should be used for planning purposes only and does not constitute a formal bid or proposal.
      </div>

      {/* Footer */}
      <div style={{
        marginTop: '30px',
        paddingTop: '15px',
        borderTop: '2px solid #002356',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        fontSize: '9pt',
        color: '#666',
      }}>
        <div>
          <div style={{ fontWeight: '600', color: '#002356' }}>Tweet Garot Mechanical</div>
          <div>HVAC | Plumbing | Process Piping</div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div>Budget Estimate Report</div>
          <div>{budget.summary.projectName}</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div>Generated: {format(new Date(), 'MMM d, yyyy')}</div>
          <div>{format(new Date(), 'h:mm a')}</div>
        </div>
      </div>

      {/* Page Number Placeholder for Print */}
      <div style={{
        textAlign: 'center',
        fontSize: '8pt',
        color: '#999',
        marginTop: '20px',
      }}>
        CONFIDENTIAL - For Internal Use Only
      </div>
    </div>
  );
};

export default BudgetReportPreview;
