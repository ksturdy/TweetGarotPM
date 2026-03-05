import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import AssignmentIcon from '@mui/icons-material/Assignment';
import ReportProblemIcon from '@mui/icons-material/ReportProblem';
import FactCheckIcon from '@mui/icons-material/FactCheck';

const SafetyHome: React.FC = () => {
  const { projectId } = useParams();
  const navigate = useNavigate();

  const modules = [
    { label: 'JSA', icon: <AssignmentIcon />, path: 'safety-jsa', color: 'red' },
    { label: 'Near Miss', icon: <ReportProblemIcon />, path: 'safety-near-miss', color: 'orange' },
    { label: 'Safety Audit', icon: <FactCheckIcon />, path: 'safety-audit', color: 'blue' },
  ];

  return (
    <div>
      <h1 className="field-page-title">Safety</h1>
      <p className="field-page-subtitle">Select a safety module</p>

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

export default SafetyHome;
