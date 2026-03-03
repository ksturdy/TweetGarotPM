import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import DescriptionIcon from '@mui/icons-material/Description';
import ShoppingCartIcon from '@mui/icons-material/ShoppingCart';
import HealthAndSafetyIcon from '@mui/icons-material/HealthAndSafety';
import AirIcon from '@mui/icons-material/Air';
import PlumbingIcon from '@mui/icons-material/Plumbing';
import WaterDropIcon from '@mui/icons-material/WaterDrop';

const FieldProjectHome: React.FC = () => {
  const { projectId } = useParams();
  const navigate = useNavigate();

  const modules = [
    { label: 'Daily Reports', icon: <DescriptionIcon />, path: 'daily-reports', color: 'blue' },
    { label: 'Purchase Orders', icon: <ShoppingCartIcon />, path: 'purchase-orders', color: 'green' },
    { label: 'SM Fitting', icon: <AirIcon />, path: 'sm-fitting-orders', color: 'orange' },
    { label: 'Piping Fitting', icon: <PlumbingIcon />, path: 'piping-fitting-orders', color: 'purple' },
    { label: 'Plumbing Fitting', icon: <WaterDropIcon />, path: 'plumbing-fitting-orders', color: 'cyan' },
    { label: 'Safety JSA', icon: <HealthAndSafetyIcon />, path: 'safety-jsa', color: 'red' },
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
