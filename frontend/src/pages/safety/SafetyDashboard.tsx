import React from 'react';
import './SafetyDashboard.css';

const SafetyDashboard: React.FC = () => {
  const handleOpenSharePoint = () => {
    window.open('https://tweetgarot.sharepoint.com/sites/safety', '_blank');
  };

  const handleOpenIncidentReport = () => {
    window.open('https://tweetgarot.sharepoint.com/sites/Safety/Shared%20Documents/Forms/AllItems.aspx?id=%2Fsites%2FSafety%2FShared%20Documents%2FIncident%20Report%20Form%20Fillable%2Epdf&parent=%2Fsites%2FSafety%2FShared%20Documents', '_blank');
  };

  const safetyResources = [
    { name: 'Safety Manual', icon: '📖', description: 'Company safety policies and procedures' },
    { name: 'OSHA Guidelines', icon: '📋', description: 'Federal safety regulations and compliance' },
    { name: 'PPE Requirements', icon: '🦺', description: 'Personal protective equipment standards' },
    { name: 'Emergency Procedures', icon: '🚨', description: 'Emergency response protocols' },
  ];

  const safetyStats = [
    { label: 'Days Without Incident', value: '127', icon: '✅', color: '#10B981' },
    { label: 'Safety Training Completed', value: '98%', icon: '📚', color: '#3B82F6' },
    { label: 'Open Safety Reports', value: '3', icon: '📝', color: '#F59E0B' },
    { label: 'Inspections This Month', value: '12', icon: '🔍', color: '#8B5CF6' },
  ];

  return (
    <div className="safety-dashboard">
      <div className="safety-header">
        <div className="safety-header-content">
          <div className="safety-icon-large">🦺</div>
          <div>
            <h1>Safety Management</h1>
            <p>Keeping our team safe, every day</p>
          </div>
        </div>
        <button className="btn-sharepoint" onClick={handleOpenSharePoint}>
          <span className="sharepoint-icon">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/>
            </svg>
          </span>
          Open Safety SharePoint Portal
          <span className="external-icon">↗</span>
        </button>
      </div>

      <div className="safety-alert">
        <div className="alert-icon">⚠️</div>
        <div className="alert-content">
          <strong>Safety First!</strong>
          <span>Remember: All incidents, near-misses, and safety concerns must be reported immediately.</span>
        </div>
      </div>

      <div className="safety-stats-grid">
        {safetyStats.map((stat) => (
          <div key={stat.label} className="safety-stat-card">
            <div className="stat-icon" style={{ backgroundColor: `${stat.color}20`, color: stat.color }}>
              {stat.icon}
            </div>
            <div className="stat-value" style={{ color: stat.color }}>{stat.value}</div>
            <div className="stat-label">{stat.label}</div>
          </div>
        ))}
      </div>

      <div className="safety-content-grid">
        <div className="card safety-resources-card">
          <h2>
            <span className="card-icon">📚</span>
            Safety Resources
          </h2>
          <div className="resources-list">
            {safetyResources.map((resource) => (
              <div key={resource.name} className="resource-item" onClick={handleOpenSharePoint}>
                <div className="resource-icon">{resource.icon}</div>
                <div className="resource-info">
                  <div className="resource-name">{resource.name}</div>
                  <div className="resource-desc">{resource.description}</div>
                </div>
                <div className="resource-arrow">→</div>
              </div>
            ))}
          </div>
        </div>

        <div className="card safety-actions-card">
          <h2>
            <span className="card-icon">⚡</span>
            Quick Actions
          </h2>
          <div className="actions-list">
            <button className="action-btn action-btn-danger" onClick={handleOpenIncidentReport}>
              <span className="action-icon">🚨</span>
              Report an Incident
            </button>
            <button className="action-btn action-btn-warning" onClick={handleOpenSharePoint}>
              <span className="action-icon">⚠️</span>
              Report Near-Miss
            </button>
            <button className="action-btn action-btn-primary" onClick={handleOpenSharePoint}>
              <span className="action-icon">📝</span>
              Submit Safety Observation
            </button>
            <button className="action-btn action-btn-secondary" onClick={handleOpenSharePoint}>
              <span className="action-icon">📋</span>
              View Safety Forms
            </button>
          </div>
        </div>

        <div className="card safety-training-card">
          <h2>
            <span className="card-icon">🎓</span>
            Training & Certifications
          </h2>
          <div className="training-list">
            <div className="training-item">
              <div className="training-status status-complete">✓</div>
              <div className="training-info">
                <div className="training-name">OSHA 10-Hour Construction</div>
                <div className="training-date">Completed: Jan 15, 2026</div>
              </div>
            </div>
            <div className="training-item">
              <div className="training-status status-complete">✓</div>
              <div className="training-info">
                <div className="training-name">First Aid/CPR Certification</div>
                <div className="training-date">Expires: Jun 30, 2026</div>
              </div>
            </div>
            <div className="training-item">
              <div className="training-status status-pending">!</div>
              <div className="training-info">
                <div className="training-name">Confined Space Entry</div>
                <div className="training-date">Due: Feb 1, 2026</div>
              </div>
            </div>
            <div className="training-item">
              <div className="training-status status-complete">✓</div>
              <div className="training-info">
                <div className="training-name">Fall Protection</div>
                <div className="training-date">Completed: Dec 10, 2025</div>
              </div>
            </div>
          </div>
          <button className="btn btn-secondary" onClick={handleOpenSharePoint} style={{ marginTop: '1rem', width: '100%' }}>
            View All Training →
          </button>
        </div>

        <div className="card safety-contacts-card">
          <h2>
            <span className="card-icon">📞</span>
            Emergency Contacts
          </h2>
          <div className="contacts-list">
            <div className="contact-item contact-emergency">
              <div className="contact-icon">🚑</div>
              <div className="contact-info">
                <div className="contact-name">Emergency Services</div>
                <div className="contact-number">911</div>
              </div>
            </div>
            <div className="contact-item">
              <div className="contact-icon">🦺</div>
              <div className="contact-info">
                <div className="contact-name">Safety Director</div>
                <div className="contact-number">(317) 555-0150</div>
              </div>
            </div>
            <div className="contact-item">
              <div className="contact-icon">🏢</div>
              <div className="contact-info">
                <div className="contact-name">Main Office</div>
                <div className="contact-number">(317) 555-0100</div>
              </div>
            </div>
            <div className="contact-item">
              <div className="contact-icon">☠️</div>
              <div className="contact-info">
                <div className="contact-name">Poison Control</div>
                <div className="contact-number">1-800-222-1222</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SafetyDashboard;
