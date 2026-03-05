import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import ContactsIcon from '@mui/icons-material/Contacts';

const FieldMoreHome: React.FC = () => {
  const { projectId } = useParams();
  const navigate = useNavigate();

  const modules = [
    { label: 'Favorite Vendors', icon: <ContactsIcon />, path: 'more/vendors', color: 'blue' },
  ];

  return (
    <div>
      <h1 className="field-page-title">More Tools</h1>
      <p className="field-page-subtitle">Additional field tools</p>

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

export default FieldMoreHome;
