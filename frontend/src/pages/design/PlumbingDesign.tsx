import React from 'react';

const PlumbingDesign: React.FC = () => {
  return (
    <div style={{ margin: '-1.5rem', overflow: 'hidden' }}>
      <iframe
        src="/plumbing-design.html"
        title="Plumbing Design Tool"
        style={{
          width: '100%',
          height: 'calc(100vh - 64px)',
          border: 'none',
          display: 'block',
        }}
      />
    </div>
  );
};

export default PlumbingDesign;
