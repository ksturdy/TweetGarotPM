import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import AssignmentIcon from '@mui/icons-material/Assignment';
import ReportProblemIcon from '@mui/icons-material/ReportProblem';
import VisibilityIcon from '@mui/icons-material/Visibility';

const SafetyHome: React.FC = () => {
  const { projectId } = useParams();
  const navigate = useNavigate();

  const modules = [
    { label: 'Safety Observation', icon: <VisibilityIcon />, path: 'safety-observation', color: 'green', external: 'https://forms.office.com/pages/responsepage.aspx?id=_HPklJrWd0Wg5UW3JIVFlO71YL64s9RGmedH7RU9UnhURVk3NkdLUjVYR05NWjBETkFIUUo2U01XMSQlQCN0PWcu&route=shorturl' },
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
            onClick={() => mod.external ? window.open(mod.external, '_blank') : navigate(`/field/projects/${projectId}/${mod.path}`)}
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
