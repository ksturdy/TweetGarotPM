import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';

const BuildQuestionnaire: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [expandedSections, setExpandedSections] = useState<{[key: string]: boolean}>({
    overview: true,
    entities: false,
    features: false,
    industry: false,
    workflows: false,
    technical: false,
    deployment: false,
    migration: false,
    support: false,
    success: false,
  });

  const [formData, setFormData] = useState({
    // Project Overview
    companyName: '',
    industry: '',
    businessActivity: '',
    estimatedUsers: '',
    locations: '',
    timeline: '',
    budgetRange: '',
    problemSolving: '',
    businessGoals: ['', '', ''],
    primaryUsers: '',

    // Core Entities
    needUsers: false,
    authMethods: [] as string[],
    userRoles: [] as string[],
    userFields: [] as string[],
    needEmployees: false,
    employeeFields: [] as string[],
    needCustomers: false,
    customerType: '',
    customerFields: [] as string[],
    needVendors: false,
    vendorFields: [] as string[],
    needDepartments: false,
    departmentStructure: '',
    needLocations: false,
    needProductCatalog: false,
    needServiceCatalog: false,

    // Features
    projectMgmtFeatures: [] as string[],
    docMgmtFeatures: [] as string[],
    financialFeatures: [] as string[],
    inventoryFeatures: [] as string[],
    commFeatures: [] as string[],
    workflowFeatures: [] as string[],
    reportingFeatures: [] as string[],
    integrations: [] as string[],

    // Industry Specific
    constructionModules: [] as string[],
    serviceModules: [] as string[],
    crmModules: [] as string[],
    otherIndustryNeeds: '',

    // Workflows
    workflows: [
      { name: '', trigger: '', steps: ['', '', ''], whoInvolved: '', approval: '' }
    ],
    numberingConvention: '',

    // Technical
    accessModel: '',
    mobileRequirements: [] as string[],
    emailNotifications: false,
    customization: [] as string[],

    // Deployment
    hostingPreference: '',
    domainType: '',
    securityRequirements: [] as string[],

    // Migration
    dataToImport: [] as string[],
    sourceSystem: '',
    dataFormat: '',

    // Training
    trainingNeeds: [] as string[],
    usersNeedingTraining: '',
    supportNeeds: [] as string[],

    // Success
    successMetrics: ['', '', ''],
    launchCriteria: ['', '', ''],
    phase2Features: ['', '', ''],

    // Notes
    specialConsiderations: '',
    knownChallenges: '',
    referenceSystems: '',
    dealBreakers: '',
  });

  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleArrayInputChange = (field: string, index: number, value: string) => {
    const newArray = [...(formData[field as keyof typeof formData] as string[])];
    newArray[index] = value;
    setFormData(prev => ({ ...prev, [field]: newArray }));
  };

  const handleCheckboxChange = (field: string, value: string, checked: boolean) => {
    const currentArray = formData[field as keyof typeof formData] as string[];
    if (checked) {
      handleInputChange(field, [...currentArray, value]);
    } else {
      handleInputChange(field, currentArray.filter(item => item !== value));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      await axios.post('/api/questionnaire/submit', {
        formData,
        submittedBy: user?.email || formData.companyName || 'Prospective Customer',
        submittedAt: new Date().toISOString(),
      });

      alert('Questionnaire submitted successfully! We will be in touch soon.');
      navigate('/welcome');
    } catch (error) {
      console.error('Error submitting questionnaire:', error);
      alert('Failed to submit questionnaire. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const SectionHeader: React.FC<{ title: string, section: string }> = ({ title, section }) => (
    <div
      onClick={() => toggleSection(section)}
      style={{
        background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
        color: 'white',
        padding: '16px 24px',
        borderRadius: '8px',
        cursor: 'pointer',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '16px',
        fontWeight: 600,
        fontSize: '18px',
      }}
    >
      <span>{title}</span>
      <span style={{ fontSize: '24px' }}>{expandedSections[section] ? '−' : '+'}</span>
    </div>
  );

  const inputStyle = {
    width: '100%',
    padding: '10px 12px',
    border: '1px solid #ddd',
    borderRadius: '6px',
    fontSize: '14px',
    fontFamily: 'inherit',
  };

  const labelStyle = {
    display: 'block',
    marginBottom: '8px',
    fontWeight: 500,
    color: '#1a1a2e',
  };

  const checkboxGroupStyle = {
    display: 'flex',
    flexWrap: 'wrap' as const,
    gap: '12px',
    marginBottom: '16px',
  };

  const checkboxLabelStyle = {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    cursor: 'pointer',
  };

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '32px 24px' }}>
      <div style={{ marginBottom: '32px' }}>
        <h1 style={{ fontSize: '32px', fontWeight: 700, marginBottom: '8px', color: '#1a1a2e' }}>
          Build Questionnaire
        </h1>
        <p style={{ color: '#5a5a72', fontSize: '16px' }}>
          Help us understand your project requirements to build the perfect solution for you.
        </p>
      </div>

      <form onSubmit={handleSubmit}>
        {/* Project Overview */}
        <SectionHeader title="Project Overview" section="overview" />
        {expandedSections.overview && (
          <div style={{ padding: '24px', background: '#f9fafb', borderRadius: '8px', marginBottom: '24px' }}>
            <div style={{ marginBottom: '20px' }}>
              <label style={labelStyle}>Company Name *</label>
              <input
                type="text"
                required
                value={formData.companyName}
                onChange={(e) => handleInputChange('companyName', e.target.value)}
                style={inputStyle}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
              <div>
                <label style={labelStyle}>Industry/Domain *</label>
                <input
                  type="text"
                  required
                  value={formData.industry}
                  onChange={(e) => handleInputChange('industry', e.target.value)}
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>Primary Business Activity *</label>
                <input
                  type="text"
                  required
                  value={formData.businessActivity}
                  onChange={(e) => handleInputChange('businessActivity', e.target.value)}
                  style={inputStyle}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px', marginBottom: '20px' }}>
              <div>
                <label style={labelStyle}>Estimated Users</label>
                <input
                  type="number"
                  value={formData.estimatedUsers}
                  onChange={(e) => handleInputChange('estimatedUsers', e.target.value)}
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>Number of Locations</label>
                <input
                  type="number"
                  value={formData.locations}
                  onChange={(e) => handleInputChange('locations', e.target.value)}
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>Project Timeline</label>
                <input
                  type="text"
                  placeholder="e.g., 3-6 months"
                  value={formData.timeline}
                  onChange={(e) => handleInputChange('timeline', e.target.value)}
                  style={inputStyle}
                />
              </div>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={labelStyle}>Budget Range</label>
              <input
                type="text"
                placeholder="e.g., $50k-$100k"
                value={formData.budgetRange}
                onChange={(e) => handleInputChange('budgetRange', e.target.value)}
                style={inputStyle}
              />
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={labelStyle}>What problem are we solving? *</label>
              <textarea
                required
                rows={4}
                value={formData.problemSolving}
                onChange={(e) => handleInputChange('problemSolving', e.target.value)}
                style={{ ...inputStyle, resize: 'vertical' as const }}
              />
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={labelStyle}>Top 3 Business Goals</label>
              {formData.businessGoals.map((goal, index) => (
                <input
                  key={index}
                  type="text"
                  placeholder={`Goal ${index + 1}`}
                  value={goal}
                  onChange={(e) => handleArrayInputChange('businessGoals', index, e.target.value)}
                  style={{ ...inputStyle, marginBottom: '8px' }}
                />
              ))}
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={labelStyle}>Who are the primary users? (roles/departments)</label>
              <input
                type="text"
                placeholder="e.g., Project Managers, Estimators, Field Supervisors"
                value={formData.primaryUsers}
                onChange={(e) => handleInputChange('primaryUsers', e.target.value)}
                style={inputStyle}
              />
            </div>
          </div>
        )}

        {/* Core Global Entities */}
        <SectionHeader title="Core Global Entities" section="entities" />
        {expandedSections.entities && (
          <div style={{ padding: '24px', background: '#f9fafb', borderRadius: '8px', marginBottom: '24px' }}>
            <div style={{ marginBottom: '24px' }}>
              <h3 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '12px' }}>Users & Authentication</h3>
              <label style={checkboxLabelStyle}>
                <input
                  type="checkbox"
                  checked={formData.needUsers}
                  onChange={(e) => handleInputChange('needUsers', e.target.checked)}
                />
                <span>Do you need user accounts?</span>
              </label>

              {formData.needUsers && (
                <>
                  <div style={{ marginTop: '16px', marginBottom: '16px' }}>
                    <label style={labelStyle}>Authentication Methods:</label>
                    <div style={checkboxGroupStyle}>
                      {['Email/Password', 'SSO', 'Multi-factor authentication'].map(method => (
                        <label key={method} style={checkboxLabelStyle}>
                          <input
                            type="checkbox"
                            checked={formData.authMethods.includes(method)}
                            onChange={(e) => handleCheckboxChange('authMethods', method, e.target.checked)}
                          />
                          <span>{method}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div style={{ marginBottom: '16px' }}>
                    <label style={labelStyle}>User Roles Needed:</label>
                    <div style={checkboxGroupStyle}>
                      {['Admin', 'Manager', 'Standard User', 'Read-only/Guest'].map(role => (
                        <label key={role} style={checkboxLabelStyle}>
                          <input
                            type="checkbox"
                            checked={formData.userRoles.includes(role)}
                            onChange={(e) => handleCheckboxChange('userRoles', role, e.target.checked)}
                          />
                          <span>{role}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>

            <div style={{ marginBottom: '24px' }}>
              <h3 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '12px' }}>Customers</h3>
              <label style={checkboxLabelStyle}>
                <input
                  type="checkbox"
                  checked={formData.needCustomers}
                  onChange={(e) => handleInputChange('needCustomers', e.target.checked)}
                />
                <span>Do you need a customer database?</span>
              </label>

              {formData.needCustomers && (
                <div style={{ marginTop: '16px' }}>
                  <label style={labelStyle}>Customer Type:</label>
                  <div style={checkboxGroupStyle}>
                    {['B2B (Business)', 'B2C (Individual)', 'Both'].map(type => (
                      <label key={type} style={checkboxLabelStyle}>
                        <input
                          type="radio"
                          name="customerType"
                          value={type}
                          checked={formData.customerType === type}
                          onChange={(e) => handleInputChange('customerType', e.target.value)}
                        />
                        <span>{type}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div style={{ marginBottom: '24px' }}>
              <label style={checkboxLabelStyle}>
                <input
                  type="checkbox"
                  checked={formData.needEmployees}
                  onChange={(e) => handleInputChange('needEmployees', e.target.checked)}
                />
                <span>Do you need an employee database?</span>
              </label>
            </div>

            <div style={{ marginBottom: '24px' }}>
              <label style={checkboxLabelStyle}>
                <input
                  type="checkbox"
                  checked={formData.needVendors}
                  onChange={(e) => handleInputChange('needVendors', e.target.checked)}
                />
                <span>Do you need a vendor/supplier database?</span>
              </label>
            </div>

            <div style={{ marginBottom: '24px' }}>
              <label style={checkboxLabelStyle}>
                <input
                  type="checkbox"
                  checked={formData.needDepartments}
                  onChange={(e) => handleInputChange('needDepartments', e.target.checked)}
                />
                <span>Do you need to track departments/teams?</span>
              </label>
            </div>

            <div style={{ marginBottom: '24px' }}>
              <label style={checkboxLabelStyle}>
                <input
                  type="checkbox"
                  checked={formData.needLocations}
                  onChange={(e) => handleInputChange('needLocations', e.target.checked)}
                />
                <span>Do you need to track multiple locations?</span>
              </label>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <label style={checkboxLabelStyle}>
                <input
                  type="checkbox"
                  checked={formData.needProductCatalog}
                  onChange={(e) => handleInputChange('needProductCatalog', e.target.checked)}
                />
                <span>Product catalog</span>
              </label>
              <label style={checkboxLabelStyle}>
                <input
                  type="checkbox"
                  checked={formData.needServiceCatalog}
                  onChange={(e) => handleInputChange('needServiceCatalog', e.target.checked)}
                />
                <span>Service catalog</span>
              </label>
            </div>
          </div>
        )}

        {/* Feature Modules */}
        <SectionHeader title="Feature Modules" section="features" />
        {expandedSections.features && (
          <div style={{ padding: '24px', background: '#f9fafb', borderRadius: '8px', marginBottom: '24px' }}>
            <div style={{ marginBottom: '20px' }}>
              <label style={labelStyle}>Project Management:</label>
              <div style={checkboxGroupStyle}>
                {['Projects tracking', 'Tasks/To-dos', 'Timeline/Gantt charts', 'Time tracking', 'Resource allocation'].map(feature => (
                  <label key={feature} style={checkboxLabelStyle}>
                    <input
                      type="checkbox"
                      checked={formData.projectMgmtFeatures.includes(feature)}
                      onChange={(e) => handleCheckboxChange('projectMgmtFeatures', feature, e.target.checked)}
                    />
                    <span>{feature}</span>
                  </label>
                ))}
              </div>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={labelStyle}>Document Management:</label>
              <div style={checkboxGroupStyle}>
                {['File uploads/attachments', 'Document categorization', 'Version control', 'Document approval workflow'].map(feature => (
                  <label key={feature} style={checkboxLabelStyle}>
                    <input
                      type="checkbox"
                      checked={formData.docMgmtFeatures.includes(feature)}
                      onChange={(e) => handleCheckboxChange('docMgmtFeatures', feature, e.target.checked)}
                    />
                    <span>{feature}</span>
                  </label>
                ))}
              </div>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={labelStyle}>Financial Management:</label>
              <div style={checkboxGroupStyle}>
                {['Estimates/Quotes', 'Proposals', 'Invoicing', 'Expense tracking', 'Purchase Orders', 'Payment tracking'].map(feature => (
                  <label key={feature} style={checkboxLabelStyle}>
                    <input
                      type="checkbox"
                      checked={formData.financialFeatures.includes(feature)}
                      onChange={(e) => handleCheckboxChange('financialFeatures', feature, e.target.checked)}
                    />
                    <span>{feature}</span>
                  </label>
                ))}
              </div>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={labelStyle}>Communication & Collaboration:</label>
              <div style={checkboxGroupStyle}>
                {['Internal messaging', 'Email notifications', 'Comments/Notes', 'Activity logs', 'Client portal'].map(feature => (
                  <label key={feature} style={checkboxLabelStyle}>
                    <input
                      type="checkbox"
                      checked={formData.commFeatures.includes(feature)}
                      onChange={(e) => handleCheckboxChange('commFeatures', feature, e.target.checked)}
                    />
                    <span>{feature}</span>
                  </label>
                ))}
              </div>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={labelStyle}>Reporting & Analytics:</label>
              <div style={checkboxGroupStyle}>
                {['Dashboard', 'Standard reports', 'Custom report builder', 'Data export (Excel, PDF, CSV)'].map(feature => (
                  <label key={feature} style={checkboxLabelStyle}>
                    <input
                      type="checkbox"
                      checked={formData.reportingFeatures.includes(feature)}
                      onChange={(e) => handleCheckboxChange('reportingFeatures', feature, e.target.checked)}
                    />
                    <span>{feature}</span>
                  </label>
                ))}
              </div>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={labelStyle}>Integrations:</label>
              <div style={checkboxGroupStyle}>
                {['QuickBooks', 'Email (Gmail, Outlook)', 'Calendar sync', 'Payment processing'].map(feature => (
                  <label key={feature} style={checkboxLabelStyle}>
                    <input
                      type="checkbox"
                      checked={formData.integrations.includes(feature)}
                      onChange={(e) => handleCheckboxChange('integrations', feature, e.target.checked)}
                    />
                    <span>{feature}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Industry-Specific Modules */}
        <SectionHeader title="Industry-Specific Modules" section="industry" />
        {expandedSections.industry && (
          <div style={{ padding: '24px', background: '#f9fafb', borderRadius: '8px', marginBottom: '24px' }}>
            <div style={{ marginBottom: '20px' }}>
              <label style={labelStyle}>Construction:</label>
              <div style={checkboxGroupStyle}>
                {['RFIs', 'Submittals', 'Change Orders', 'Daily Reports', 'Schedule of Values', 'Punch Lists', 'Equipment tracking', 'Safety/Inspections'].map(module => (
                  <label key={module} style={checkboxLabelStyle}>
                    <input
                      type="checkbox"
                      checked={formData.constructionModules.includes(module)}
                      onChange={(e) => handleCheckboxChange('constructionModules', module, e.target.checked)}
                    />
                    <span>{module}</span>
                  </label>
                ))}
              </div>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={labelStyle}>Service Business:</label>
              <div style={checkboxGroupStyle}>
                {['Work Orders', 'Service Tickets', 'Dispatch', 'Service Agreements', 'Recurring maintenance'].map(module => (
                  <label key={module} style={checkboxLabelStyle}>
                    <input
                      type="checkbox"
                      checked={formData.serviceModules.includes(module)}
                      onChange={(e) => handleCheckboxChange('serviceModules', module, e.target.checked)}
                    />
                    <span>{module}</span>
                  </label>
                ))}
              </div>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={labelStyle}>Sales/CRM:</label>
              <div style={checkboxGroupStyle}>
                {['Lead tracking', 'Opportunities/Pipeline', 'Sales campaigns', 'Contact management', 'Quote generation'].map(module => (
                  <label key={module} style={checkboxLabelStyle}>
                    <input
                      type="checkbox"
                      checked={formData.crmModules.includes(module)}
                      onChange={(e) => handleCheckboxChange('crmModules', module, e.target.checked)}
                    />
                    <span>{module}</span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label style={labelStyle}>Other Industry-Specific Needs:</label>
              <textarea
                rows={3}
                value={formData.otherIndustryNeeds}
                onChange={(e) => handleInputChange('otherIndustryNeeds', e.target.value)}
                style={{ ...inputStyle, resize: 'vertical' as const }}
                placeholder="Describe any other industry-specific requirements..."
              />
            </div>
          </div>
        )}

        {/* Technical Requirements */}
        <SectionHeader title="Technical Requirements" section="technical" />
        {expandedSections.technical && (
          <div style={{ padding: '24px', background: '#f9fafb', borderRadius: '8px', marginBottom: '24px' }}>
            <div style={{ marginBottom: '20px' }}>
              <label style={labelStyle}>Access Model:</label>
              <div style={checkboxGroupStyle}>
                {['Multi-tenant (isolated data per customer)', 'Single tenant (one company)', 'Role-based permissions'].map(model => (
                  <label key={model} style={checkboxLabelStyle}>
                    <input
                      type="radio"
                      name="accessModel"
                      value={model}
                      checked={formData.accessModel === model}
                      onChange={(e) => handleInputChange('accessModel', e.target.value)}
                    />
                    <span>{model}</span>
                  </label>
                ))}
              </div>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={labelStyle}>Mobile Requirements:</label>
              <div style={checkboxGroupStyle}>
                {['Mobile-friendly web app', 'Native mobile app', 'Offline capability', 'Photo capture', 'GPS/location tracking'].map(req => (
                  <label key={req} style={checkboxLabelStyle}>
                    <input
                      type="checkbox"
                      checked={formData.mobileRequirements.includes(req)}
                      onChange={(e) => handleCheckboxChange('mobileRequirements', req, e.target.checked)}
                    />
                    <span>{req}</span>
                  </label>
                ))}
              </div>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={checkboxLabelStyle}>
                <input
                  type="checkbox"
                  checked={formData.emailNotifications}
                  onChange={(e) => handleInputChange('emailNotifications', e.target.checked)}
                />
                <span>Email notifications needed</span>
              </label>
            </div>

            <div>
              <label style={labelStyle}>Customization Needs:</label>
              <div style={checkboxGroupStyle}>
                {['Custom fields', 'Custom branding', 'Custom workflows', 'Custom reports'].map(custom => (
                  <label key={custom} style={checkboxLabelStyle}>
                    <input
                      type="checkbox"
                      checked={formData.customization.includes(custom)}
                      onChange={(e) => handleCheckboxChange('customization', custom, e.target.checked)}
                    />
                    <span>{custom}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Deployment & Hosting */}
        <SectionHeader title="Deployment & Hosting" section="deployment" />
        {expandedSections.deployment && (
          <div style={{ padding: '24px', background: '#f9fafb', borderRadius: '8px', marginBottom: '24px' }}>
            <div style={{ marginBottom: '20px' }}>
              <label style={labelStyle}>Hosting Preference:</label>
              <div style={checkboxGroupStyle}>
                {['Cloud-hosted (we host it)', "Customer's cloud account", 'On-premise server'].map(pref => (
                  <label key={pref} style={checkboxLabelStyle}>
                    <input
                      type="radio"
                      name="hostingPreference"
                      value={pref}
                      checked={formData.hostingPreference === pref}
                      onChange={(e) => handleInputChange('hostingPreference', e.target.value)}
                    />
                    <span>{pref}</span>
                  </label>
                ))}
              </div>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={labelStyle}>Domain Type:</label>
              <div style={checkboxGroupStyle}>
                {['Subdomain (e.g., customer.yourdomain.com)', 'Custom domain', 'White-label'].map(type => (
                  <label key={type} style={checkboxLabelStyle}>
                    <input
                      type="radio"
                      name="domainType"
                      value={type}
                      checked={formData.domainType === type}
                      onChange={(e) => handleInputChange('domainType', e.target.value)}
                    />
                    <span>{type}</span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label style={labelStyle}>Security Requirements:</label>
              <div style={checkboxGroupStyle}>
                {['SSL/HTTPS', 'Data encryption', 'Regular backups', 'Compliance (HIPAA, SOC2, GDPR)'].map(sec => (
                  <label key={sec} style={checkboxLabelStyle}>
                    <input
                      type="checkbox"
                      checked={formData.securityRequirements.includes(sec)}
                      onChange={(e) => handleCheckboxChange('securityRequirements', sec, e.target.checked)}
                    />
                    <span>{sec}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Data Migration */}
        <SectionHeader title="Data Migration" section="migration" />
        {expandedSections.migration && (
          <div style={{ padding: '24px', background: '#f9fafb', borderRadius: '8px', marginBottom: '24px' }}>
            <div style={{ marginBottom: '20px' }}>
              <label style={labelStyle}>Existing Data to Import:</label>
              <div style={checkboxGroupStyle}>
                {['Customer list', 'Employee list', 'Products/Services', 'Projects/Jobs', 'Financial history', 'Documents/Files'].map(data => (
                  <label key={data} style={checkboxLabelStyle}>
                    <input
                      type="checkbox"
                      checked={formData.dataToImport.includes(data)}
                      onChange={(e) => handleCheckboxChange('dataToImport', data, e.target.checked)}
                    />
                    <span>{data}</span>
                  </label>
                ))}
              </div>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={labelStyle}>Source System:</label>
              <input
                type="text"
                placeholder="e.g., QuickBooks, Excel, Legacy System"
                value={formData.sourceSystem}
                onChange={(e) => handleInputChange('sourceSystem', e.target.value)}
                style={inputStyle}
              />
            </div>

            <div>
              <label style={labelStyle}>Data Format:</label>
              <div style={checkboxGroupStyle}>
                {['Excel/CSV', 'Database export', 'API', 'Manual entry acceptable'].map(format => (
                  <label key={format} style={checkboxLabelStyle}>
                    <input
                      type="radio"
                      name="dataFormat"
                      value={format}
                      checked={formData.dataFormat === format}
                      onChange={(e) => handleInputChange('dataFormat', e.target.value)}
                    />
                    <span>{format}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Training & Support */}
        <SectionHeader title="Training & Support" section="support" />
        {expandedSections.support && (
          <div style={{ padding: '24px', background: '#f9fafb', borderRadius: '8px', marginBottom: '24px' }}>
            <div style={{ marginBottom: '20px' }}>
              <label style={labelStyle}>Training Needs:</label>
              <div style={checkboxGroupStyle}>
                {['Admin training', 'End-user training', 'Video tutorials', 'Written documentation', 'Live training sessions'].map(training => (
                  <label key={training} style={checkboxLabelStyle}>
                    <input
                      type="checkbox"
                      checked={formData.trainingNeeds.includes(training)}
                      onChange={(e) => handleCheckboxChange('trainingNeeds', training, e.target.checked)}
                    />
                    <span>{training}</span>
                  </label>
                ))}
              </div>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={labelStyle}>Number of Users Needing Training:</label>
              <input
                type="number"
                value={formData.usersNeedingTraining}
                onChange={(e) => handleInputChange('usersNeedingTraining', e.target.value)}
                style={inputStyle}
              />
            </div>

            <div>
              <label style={labelStyle}>Ongoing Support Needs:</label>
              <div style={checkboxGroupStyle}>
                {['Email support', 'Phone support', 'Ticketing system', 'Dedicated support contact'].map(support => (
                  <label key={support} style={checkboxLabelStyle}>
                    <input
                      type="checkbox"
                      checked={formData.supportNeeds.includes(support)}
                      onChange={(e) => handleCheckboxChange('supportNeeds', support, e.target.checked)}
                    />
                    <span>{support}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Success Metrics */}
        <SectionHeader title="Success Metrics & Launch" section="success" />
        {expandedSections.success && (
          <div style={{ padding: '24px', background: '#f9fafb', borderRadius: '8px', marginBottom: '24px' }}>
            <div style={{ marginBottom: '20px' }}>
              <label style={labelStyle}>Success Metrics:</label>
              {formData.successMetrics.map((metric, index) => (
                <input
                  key={index}
                  type="text"
                  placeholder={`Success metric ${index + 1}`}
                  value={metric}
                  onChange={(e) => handleArrayInputChange('successMetrics', index, e.target.value)}
                  style={{ ...inputStyle, marginBottom: '8px' }}
                />
              ))}
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={labelStyle}>Launch Criteria (What must work on Day 1):</label>
              {formData.launchCriteria.map((criteria, index) => (
                <input
                  key={index}
                  type="text"
                  placeholder={`Launch requirement ${index + 1}`}
                  value={criteria}
                  onChange={(e) => handleArrayInputChange('launchCriteria', index, e.target.value)}
                  style={{ ...inputStyle, marginBottom: '8px' }}
                />
              ))}
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={labelStyle}>Phase 2+ Features (Can wait):</label>
              {formData.phase2Features.map((feature, index) => (
                <input
                  key={index}
                  type="text"
                  placeholder={`Phase 2 feature ${index + 1}`}
                  value={feature}
                  onChange={(e) => handleArrayInputChange('phase2Features', index, e.target.value)}
                  style={{ ...inputStyle, marginBottom: '8px' }}
                />
              ))}
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={labelStyle}>Special Considerations:</label>
              <textarea
                rows={3}
                value={formData.specialConsiderations}
                onChange={(e) => handleInputChange('specialConsiderations', e.target.value)}
                style={{ ...inputStyle, resize: 'vertical' as const }}
              />
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={labelStyle}>Known Challenges:</label>
              <textarea
                rows={3}
                value={formData.knownChallenges}
                onChange={(e) => handleInputChange('knownChallenges', e.target.value)}
                style={{ ...inputStyle, resize: 'vertical' as const }}
              />
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={labelStyle}>Reference Systems (Any systems you like or want to emulate):</label>
              <textarea
                rows={2}
                value={formData.referenceSystems}
                onChange={(e) => handleInputChange('referenceSystems', e.target.value)}
                style={{ ...inputStyle, resize: 'vertical' as const }}
              />
            </div>

            <div>
              <label style={labelStyle}>Deal Breakers (What absolutely must work):</label>
              <textarea
                rows={2}
                value={formData.dealBreakers}
                onChange={(e) => handleInputChange('dealBreakers', e.target.value)}
                style={{ ...inputStyle, resize: 'vertical' as const }}
              />
            </div>
          </div>
        )}

        {/* Submit Buttons */}
        <div style={{ display: 'flex', gap: '16px', justifyContent: 'center', marginTop: '32px' }}>
          <button
            type="button"
            onClick={() => navigate('/welcome')}
            style={{
              padding: '14px 32px',
              background: '#e5e7eb',
              color: '#1a1a2e',
              border: 'none',
              borderRadius: '8px',
              fontSize: '16px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting}
            style={{
              padding: '14px 32px',
              background: submitting ? '#9ca3af' : 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: '16px',
              fontWeight: 600,
              cursor: submitting ? 'not-allowed' : 'pointer',
              boxShadow: '0 4px 12px rgba(59, 130, 246, 0.3)',
            }}
          >
            {submitting ? 'Submitting...' : 'Submit Questionnaire'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default BuildQuestionnaire;
