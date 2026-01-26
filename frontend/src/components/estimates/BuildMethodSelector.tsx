import React from 'react';

interface BuildMethodSelectorProps {
  onSelectManual: () => void;
  onSelectExcel: () => void;
}

const BuildMethodSelector: React.FC<BuildMethodSelectorProps> = ({
  onSelectManual,
  onSelectExcel,
}) => {
  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '2rem' }}>
      <h2 style={{ textAlign: 'center', marginBottom: '0.5rem' }}>
        How would you like to build this estimate?
      </h2>
      <p style={{ textAlign: 'center', color: 'var(--secondary)', marginBottom: '2rem' }}>
        Choose your preferred method to assemble the estimate breakdown
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
        {/* Manual Build Option */}
        <div
          onClick={onSelectManual}
          style={{
            padding: '2rem',
            border: '2px solid var(--border)',
            borderRadius: '0.75rem',
            cursor: 'pointer',
            transition: 'all 0.2s',
            backgroundColor: 'white',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = 'var(--primary)';
            e.currentTarget.style.boxShadow = '0 4px 12px rgba(37, 99, 235, 0.15)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = 'var(--border)';
            e.currentTarget.style.boxShadow = 'none';
          }}
        >
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🛠️</div>
            <h3 style={{ margin: '0 0 0.5rem 0' }}>Build in App</h3>
            <p style={{ color: 'var(--secondary)', fontSize: '0.875rem', margin: 0 }}>
              Create sections and line items manually using the built-in estimate breakdown editor
            </p>
          </div>

          <ul
            style={{
              marginTop: '1.5rem',
              paddingLeft: '1.25rem',
              fontSize: '0.875rem',
              color: 'var(--secondary)',
            }}
          >
            <li style={{ marginBottom: '0.5rem' }}>Add custom sections (HVAC, Piping, etc.)</li>
            <li style={{ marginBottom: '0.5rem' }}>Enter labor, material, equipment costs</li>
            <li style={{ marginBottom: '0.5rem' }}>Auto-calculate totals with markup</li>
            <li>Full control over line item details</li>
          </ul>

          <div
            style={{
              marginTop: '1.5rem',
              padding: '0.75rem',
              backgroundColor: 'var(--background)',
              borderRadius: '0.5rem',
              textAlign: 'center',
              fontWeight: 600,
              color: 'var(--primary)',
            }}
          >
            Start Building
          </div>
        </div>

        {/* Excel Import Option */}
        <div
          onClick={onSelectExcel}
          style={{
            padding: '2rem',
            border: '2px solid var(--border)',
            borderRadius: '0.75rem',
            cursor: 'pointer',
            transition: 'all 0.2s',
            backgroundColor: 'white',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = 'var(--success)';
            e.currentTarget.style.boxShadow = '0 4px 12px rgba(16, 185, 129, 0.15)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = 'var(--border)';
            e.currentTarget.style.boxShadow = 'none';
          }}
        >
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📊</div>
            <h3 style={{ margin: '0 0 0.5rem 0' }}>Import from Excel</h3>
            <p style={{ color: 'var(--secondary)', fontSize: '0.875rem', margin: 0 }}>
              Upload your Excel bid form and automatically populate the estimate
            </p>
          </div>

          <ul
            style={{
              marginTop: '1.5rem',
              paddingLeft: '1.25rem',
              fontSize: '0.875rem',
              color: 'var(--secondary)',
            }}
          >
            <li style={{ marginBottom: '0.5rem' }}>Upload .xlsm bid form template</li>
            <li style={{ marginBottom: '0.5rem' }}>Auto-extract rates, labor, materials</li>
            <li style={{ marginBottom: '0.5rem' }}>Download, edit in Excel, re-upload</li>
            <li>Values sync automatically on upload</li>
          </ul>

          <div
            style={{
              marginTop: '1.5rem',
              padding: '0.75rem',
              backgroundColor: 'rgba(16, 185, 129, 0.1)',
              borderRadius: '0.5rem',
              textAlign: 'center',
              fontWeight: 600,
              color: 'var(--success)',
            }}
          >
            Upload Excel File
          </div>
        </div>
      </div>

      <p
        style={{
          textAlign: 'center',
          color: 'var(--secondary)',
          fontSize: '0.875rem',
          marginTop: '1.5rem',
        }}
      >
        You can switch methods later or use both - upload a bid form and then edit in the app.
      </p>
    </div>
  );
};

export default BuildMethodSelector;
