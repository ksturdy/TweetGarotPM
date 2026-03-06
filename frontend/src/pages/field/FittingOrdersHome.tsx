import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import AirIcon from '@mui/icons-material/Air';
import PlumbingIcon from '@mui/icons-material/Plumbing';
import WaterDropIcon from '@mui/icons-material/WaterDrop';
import HandymanIcon from '@mui/icons-material/Handyman';

const FittingOrdersHome: React.FC = () => {
  const { projectId } = useParams();
  const navigate = useNavigate();

  const modules = [
    { label: 'Duct Fab', icon: <AirIcon />, path: 'sm-fitting-orders', color: 'orange' },
    { label: 'Piping', icon: <PlumbingIcon />, path: 'piping-fitting-orders', color: 'purple' },
    { label: 'Plumbing', icon: <WaterDropIcon />, path: 'plumbing-fitting-orders', color: 'cyan' },
    { label: 'Sheet Metal', icon: <HandymanIcon />, path: 'sheet-metal-fitting-orders', color: 'amber' },
  ];

  return (
    <div>
      <h1 className="field-page-title">Fitting Orders</h1>
      <p className="field-page-subtitle">Select a fitting type</p>

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

export default FittingOrdersHome;
