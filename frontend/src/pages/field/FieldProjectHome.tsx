import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import DescriptionIcon from '@mui/icons-material/Description';
import ShoppingCartIcon from '@mui/icons-material/ShoppingCart';
import HealthAndSafetyIcon from '@mui/icons-material/HealthAndSafety';
import BuildIcon from '@mui/icons-material/Build';

const FieldProjectHome: React.FC = () => {
  const { projectId } = useParams();
  const navigate = useNavigate();

  const modules = [
    { label: 'Daily Reports', icon: <DescriptionIcon />, path: 'daily-reports', color: 'blue' },
    { label: 'Field Purchase Orders', icon: <ShoppingCartIcon />, path: 'purchase-orders', color: 'green' },
    { label: 'Fitting Orders', icon: <BuildIcon />, path: 'fitting-orders', color: 'purple' },
    { label: 'Safety', icon: <HealthAndSafetyIcon />, path: 'safety', color: 'red' },
  ];

  return (
    <div>
      <h1 className="field-page-title">Field Tools</h1>
      <p className="field-page-subtitle">Select a module to get started</p>

      <div className="field-tiles">
        {modules.map(mod => (
          <div
            key={mod.path}
            className="field-tile"
            onClick={() => navigate(`/field/projects/${projectId}/${mod.path}`)}
          >
            <div className={`field-tile-icon ${mod.color}`}>
              {mod.icon}
            </div>
            <div className="field-tile-label">{mod.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default FieldProjectHome;
