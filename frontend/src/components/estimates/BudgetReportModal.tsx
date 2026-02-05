import React from 'react';
import { GeneratedBudget, SimilarProject } from '../../services/budgetGenerator';
import BudgetReportPreview from './BudgetReportPreview';

interface BudgetReportModalProps {
  budget: GeneratedBudget;
  comparableProjects: SimilarProject[];
  editableValues: {
    overheadPercent: number;
    profitPercent: number;
    contingencyPercent: number;
  };
  bidType?: string;
  scope?: string;
  isOpen: boolean;
  onClose: () => void;
}

const BudgetReportModal: React.FC<BudgetReportModalProps> = ({
  budget,
  comparableProjects,
  editableValues,
  bidType,
  scope,
  isOpen,
  onClose,
}) => {
  if (!isOpen) return null;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div
      className="budget-report-modal-overlay"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        zIndex: 9999,
        overflow: 'auto',
      }}
      onClick={onClose}
    >
      <div
        className="budget-report-modal-container"
        style={{
          position: 'relative',
          margin: '20px auto',
          maxWidth: '900px',
          backgroundColor: '#fff',
          boxShadow: '0 10px 40px rgba(0, 0, 0, 0.3)',
          borderRadius: '8px',
          overflow: 'hidden',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Action Buttons (hide when printing) */}
        <div
          style={{
            position: 'sticky',
            top: 0,
            backgroundColor: '#002356',
            padding: '12px 20px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            zIndex: 10,
          }}
          className="no-print"
        >
          <h2 style={{ color: '#fff', margin: 0, fontSize: '18px', fontWeight: '600' }}>
            Budget Report Preview
          </h2>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              onClick={handlePrint}
              style={{
                padding: '8px 20px',
                fontSize: '14px',
                backgroundColor: '#fff',
                color: '#002356',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontWeight: '600',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <span style={{ fontSize: '16px' }}>🖨️</span>
              Print / Save PDF
            </button>
            <button
              onClick={onClose}
              style={{
                padding: '8px 20px',
                fontSize: '14px',
                backgroundColor: '#dc3545',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontWeight: '600',
              }}
            >
              Close
            </button>
          </div>
        </div>

        {/* Preview Content */}
        <div id="budget-report-print">
          <BudgetReportPreview
            budget={budget}
            comparableProjects={comparableProjects}
            editableValues={editableValues}
            bidType={bidType}
            scope={scope}
          />
        </div>
      </div>

      {/* Print Styles */}
      <style>{`
        @media print {
          /* Hide non-printable elements */
          .no-print {
            display: none !important;
          }

          /* Reset body */
          body {
            margin: 0;
            padding: 0;
          }

          /* Hide sidebar, header, and other app elements */
          .sidebar,
          .app-header,
          .layout-header,
          nav,
          header,
          .budget-generator,
          .budget-form-column {
            display: none !important;
          }

          /* Make modal take full page */
          .budget-report-modal-overlay {
            position: absolute !important;
            top: 0 !important;
            left: 0 !important;
            right: 0 !important;
            bottom: auto !important;
            background: white !important;
            overflow: visible !important;
            z-index: 999999 !important;
          }

          .budget-report-modal-container {
            margin: 0 !important;
            max-width: 100% !important;
            width: 100% !important;
            box-shadow: none !important;
            border-radius: 0 !important;
            overflow: visible !important;
          }

          #budget-report-print {
            width: 100% !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            color-adjust: exact !important;
          }

          /* Force background colors to print */
          #budget-report-print * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            color-adjust: exact !important;
          }
        }
      `}</style>
    </div>
  );
};

export default BudgetReportModal;
