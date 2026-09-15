import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import AssignmentIcon from '@mui/icons-material/Assignment';
import ReportProblemIcon from '@mui/icons-material/ReportProblem';
import VisibilityIcon from '@mui/icons-material/Visibility';

const SafetyHome: React.FC = () => {
  const { projectId } = useParams();
  const navigate = useNavigate();

  const modules = [
    { label: 'Safety Observation', icon: <VisibilityIcon />, path: 'safety-observations', color: 'green' },
    { label: 'JSA (Job Safety Analysis)', icon: <AssignmentIcon />, path: 'safety-jsa', color: 'red' },
    { label: 'Near Miss', icon: <ReportProblemIcon />, path: 'safety-near-miss', color: 'orange' },
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
