import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { plumbingDesignService, PlumbingDesign } from '../../services/plumbingDesigns';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';

const DesignList: React.FC = () => {
  const navigate = useNavigate();
  const [designs, setDesigns] = useState<PlumbingDesign[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    plumbingDesignService.list()
      .then(setDesigns)
      .catch(() => setError('Failed to load designs'))
      .finally(() => setLoading(false));
  }, []);

  const handleNew = async () => {
    try {
      const design = await plumbingDesignService.create({ name: 'New Design' });
      navigate(`/design/${design.id}`);
    } catch {
      setError('Failed to create design');
    }
  };

  const handleDelete = async (e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    if (!window.confirm('Delete this design? This cannot be undone.')) return;
    try {
      await plumbingDesignService.delete(id);
      setDesigns(prev => prev.filter(d => d.id !== id));
    } catch {
      setError('Failed to delete design');
    }
  };

  return (
    <div style={{ padding: '0' }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '1.25rem 1.5rem 1rem',
        borderBottom: '1px solid #dde1e7',
      }}>
        <div>
          <h1 style={{ fontSize: '1.35rem', fontWeight: 700, color: '#0a3370', margin: 0 }}>
            Plumbing Design
          </h1>
          <p style={{ fontSize: '0.8rem', color: '#747678', margin: '2px 0 0' }}>
            Commercial plumbing design &amp; fixture scheduling — Wisconsin SPS 382
          </p>
        </div>
        <button
          onClick={handleNew}
          style={{
            display: 'flex', alignItems: 'center', gap: '6px',
            background: '#F37B03', color: '#fff', border: 'none',
            borderRadius: '6px', padding: '8px 16px',
            fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer',
          }}
        >
          <AddIcon style={{ fontSize: '1rem' }} /> New Design
        </button>
      </div>

      {error && (
        <div style={{ margin: '1rem 1.5rem', padding: '0.75rem 1rem', background: '#fef2f2', color: '#b91c1c', borderRadius: '6px', fontSize: '0.85rem' }}>
          {error}
        </div>
      )}

      {loading ? (
        <div style={{ padding: '3rem', textAlign: 'center', color: '#747678' }}>Loading...</div>
      ) : designs.length === 0 ? (
        <div style={{ padding: '4rem', textAlign: 'center' }}>
          <p style={{ color: '#747678', marginBottom: '1rem' }}>No designs yet. Create your first one to get started.</p>
          <button
            onClick={handleNew}
            style={{
              background: '#0a3370', color: '#fff', border: 'none',
              borderRadius: '6px', padding: '10px 20px',
              fontSize: '0.9rem', fontWeight: 600, cursor: 'pointer',
            }}
          >
            Create Design
          </button>
        </div>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
          <thead>
            <tr style={{ background: '#f5f6f8', borderBottom: '1px solid #dde1e7' }}>
              <th style={thStyle}>Name</th>
              <th style={thStyle}>HUB #</th>
              <th style={thStyle}>Project</th>
              <th style={thStyle}>Created By</th>
              <th style={thStyle}>Last Updated</th>
              <th style={{ ...thStyle, width: 80 }}></th>
            </tr>
          </thead>
          <tbody>
            {designs.map(d => (
              <tr
                key={d.id}
                onClick={() => navigate(`/design/${d.id}`)}
                style={{ borderBottom: '1px solid #eee', cursor: 'pointer' }}
                onMouseEnter={e => (e.currentTarget.style.background = '#f9fafb')}
                onMouseLeave={e => (e.currentTarget.style.background = '')}
              >
                <td style={tdStyle}>
                  <span style={{ fontWeight: 600, color: '#0a3370', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <OpenInNewIcon style={{ fontSize: '0.85rem', opacity: 0.5 }} />
                    {d.name}
                  </span>
                </td>
                <td style={tdStyle}>{d.hub_number || <span style={{ color: '#bbb' }}>—</span>}</td>
                <td style={tdStyle}>
                  {d.project_name
                    ? <span>{d.project_number} — {d.project_name}</span>
                    : <span style={{ color: '#bbb' }}>—</span>}
                </td>
                <td style={tdStyle}>{d.created_by_name}</td>
                <td style={tdStyle}>{new Date(d.updated_at).toLocaleDateString()}</td>
                <td style={tdStyle}>
                  <button
                    onClick={e => handleDelete(e, d.id)}
                    title="Delete"
                    style={{
                      background: 'none', border: 'none', cursor: 'pointer',
                      color: '#999', padding: '4px',
                    }}
                  >
                    <DeleteIcon style={{ fontSize: '1rem' }} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
};

const thStyle: React.CSSProperties = {
  padding: '0.6rem 1rem',
  textAlign: 'left',
  fontWeight: 700,
  fontSize: '0.75rem',
  textTransform: 'uppercase',
  letterSpacing: '0.4px',
  color: '#747678',
  whiteSpace: 'nowrap',
};

const tdStyle: React.CSSProperties = {
  padding: '0.75rem 1rem',
  verticalAlign: 'middle',
};

export default DesignList;
