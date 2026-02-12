import React, { useState, useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import Layout from './components/common/Layout';
import Login from './pages/Login';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import ResetPasswordPage from './pages/ResetPasswordPage';
import ChangePasswordModal from './components/security/ChangePasswordModal';
import Dashboard from './pages/Dashboard';
// Public pages
import LandingPage from './pages/public/LandingPage';
import SignupPage from './pages/public/SignupPage';
import PricingPage from './pages/public/PricingPage';
import ProjectList from './pages/projects/ProjectList';
import ProjectForm from './pages/projects/ProjectForm';
import ProjectDetail from './pages/projects/ProjectDetail';
import RFIList from './pages/rfis/RFIList';
import RFIForm from './pages/rfis/RFIForm';
import RFIDetail from './pages/rfis/RFIDetail';
import RFIEdit from './pages/rfis/RFIEdit';
import SubmittalList from './pages/submittals/SubmittalList';
import SubmittalForm from './pages/submittals/SubmittalForm';
import SubmittalDetail from './pages/submittals/SubmittalDetail';
import ChangeOrderList from './pages/changeOrders/ChangeOrderList';
import ChangeOrderForm from './pages/changeOrders/ChangeOrderForm';
import ChangeOrderDetail from './pages/changeOrders/ChangeOrderDetail';
import DailyReportList from './pages/dailyReports/DailyReportList';
import ScheduleView from './pages/schedule/ScheduleView';
import ProjectCompanies from './pages/companies/ProjectCompanies';
import MarketingList from './pages/marketing/MarketingList';
import CaseStudyList from './pages/marketing/CaseStudyList';
import CaseStudyForm from './pages/marketing/CaseStudyForm';
import CaseStudyDetail from './pages/marketing/CaseStudyDetail';
import CaseStudyTemplateList from './pages/marketing/CaseStudyTemplateList';
import CaseStudyTemplateForm from './pages/marketing/CaseStudyTemplateForm';
import ServiceOfferingList from './pages/settings/ServiceOfferingList';
import EmployeeResumeList from './pages/hr/EmployeeResumeList';
import EmployeeResumeForm from './pages/hr/EmployeeResumeForm';
import ProposalTemplateList from './pages/marketing/ProposalTemplateList';
import ProposalTemplateForm from './pages/marketing/ProposalTemplateForm';
import ProposalList from './pages/marketing/ProposalList';
import ProposalDetail from './pages/marketing/ProposalDetail';
import ProposalWizard from './pages/marketing/ProposalWizard';
import EstimatingDashboard from './pages/estimating/EstimatingDashboard';
import EstimatesList from './pages/estimating/EstimatesList';
import EstimateNew from './pages/estimating/EstimateNew';
import EstimateDetail from './pages/estimating/EstimateDetail';
import BudgetsList from './pages/estimating/BudgetsList';
import CostDatabase from './pages/estimating/CostDatabase';
import BudgetGenerator from './pages/estimating/BudgetGenerator';
import AccountManagementList from './pages/accountManagement/AccountManagementList';
import AccountManagementContacts from './pages/accountManagement/AccountManagementContacts';
import CustomerList from './pages/accountManagement/CustomerList';
import VendorList from './pages/accountManagement/VendorList';
import WorkOrderList from './pages/accountManagement/WorkOrderList';
import WorkOrderDetail from './pages/accountManagement/WorkOrderDetail';
import TeamList from './pages/accountManagement/TeamList';
import TeamDetail from './pages/accountManagement/TeamDetail';
import CustomerDetail from './pages/CustomerDetail';
import CustomerContacts from './pages/CustomerContacts';
import CustomerProjects from './pages/CustomerProjects';
import CustomerEstimates from './pages/CustomerEstimates';
import CustomerTouchpoints from './pages/CustomerTouchpoints';
import HRDashboard from './pages/hr/HRDashboard';
import EmployeeList from './pages/hr/EmployeeList';
import EmployeeDetail from './pages/hr/EmployeeDetail';
import EmployeeForm from './pages/hr/EmployeeForm';
import DepartmentList from './pages/hr/DepartmentList';
import LocationList from './pages/hr/LocationList';
import UserManagement from './pages/UserManagement';
import SecuritySettings from './pages/SecuritySettings';
import ProjectSpecifications from './pages/projects/ProjectSpecifications';
import SpecificationDetail from './pages/projects/SpecificationDetail';
import ProjectDrawings from './pages/projects/ProjectDrawings';
import DrawingDetail from './pages/projects/DrawingDetail';
import ProjectFinancials from './pages/projects/ProjectFinancials';
import ProjectedRevenue from './pages/projects/ProjectedRevenue';
import LaborForecast from './pages/projects/LaborForecast';
import FeedbackPage from './pages/FeedbackPage';
import AdministrationDashboard from './pages/administration/AdministrationDashboard';
import RiskManagementDashboard from './pages/riskManagement/RiskManagementDashboard';
import ContractReviewList from './pages/riskManagement/ContractReviewList';
import ContractReviewUpload from './pages/riskManagement/ContractReviewUpload';
import ContractReviewDetail from './pages/riskManagement/ContractReviewDetail';
import SalesPipeline from './pages/SalesPipeline';
import MobileSales from './pages/MobileSales';
import Campaigns from './pages/Campaigns';
import CampaignCreate from './pages/CampaignCreate';
import CampaignDetail from './pages/CampaignDetail';
import SafetyDashboard from './pages/safety/SafetyDashboard';
import TenantSettings from './pages/TenantSettings';
import VistaDataSettings from './pages/settings/VistaDataSettings';
import VistaLinkingManager from './pages/settings/VistaLinkingManager';
// Platform Admin pages
import PlatformDashboard from './pages/platform/PlatformDashboard';
import TenantList from './pages/platform/TenantList';

const PrivateRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return <div className="loading">Loading...</div>;
  }

  return user ? <>{children}</> : <Navigate to="/login" />;
};

const PlatformAdminRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return <div className="loading">Loading...</div>;
  }

  if (!user) {
    return <Navigate to="/login" />;
  }

  if (!(user as any).isPlatformAdmin) {
    return <Navigate to="/" />;
  }

  return <>{children}</>;
};

const App: React.FC = () => {
  const { user } = useAuth();
  const [showPasswordChangeModal, setShowPasswordChangeModal] = useState(false);

  useEffect(() => {
    // Check if user needs to change password
    if (user && (user as any).forcePasswordChange) {
      setShowPasswordChangeModal(true);
    } else {
      setShowPasswordChangeModal(false);
    }
  }, [user]);

  return (
    <>
      <Routes>
        {/* Public routes */}
        <Route path="/welcome" element={<LandingPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route path="/pricing" element={<PricingPage />} />
        <Route path="/login" element={<Login />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />

        {/* Platform Admin routes */}
        <Route
          path="/platform"
          element={
            <PlatformAdminRoute>
              <PlatformDashboard />
            </PlatformAdminRoute>
          }
        />
        <Route
          path="/platform/tenants"
          element={
            <PlatformAdminRoute>
              <TenantList />
            </PlatformAdminRoute>
          }
        />
        <Route
          path="/platform/tenants/:id"
          element={
            <PlatformAdminRoute>
              <TenantList />
            </PlatformAdminRoute>
          }
        />

        {/* Protected app routes */}
        <Route
          path="/*"
          element={
            <PrivateRoute>
              <Layout>
                <Routes>
                  <Route path="/" element={<Dashboard />} />
                <Route path="/sales" element={<SalesPipeline />} />
                <Route path="/sales/mobile" element={<MobileSales />} />
                <Route path="/campaigns" element={<Campaigns />} />
                <Route path="/campaigns/new" element={<CampaignCreate />} />
                <Route path="/campaigns/:id" element={<CampaignDetail />} />
                <Route path="/marketing" element={<MarketingList />} />
                <Route path="/case-studies" element={<CaseStudyList />} />
                <Route path="/case-studies/create" element={<CaseStudyForm />} />
                <Route path="/case-studies/:id" element={<CaseStudyDetail />} />
                <Route path="/case-study-templates" element={<CaseStudyTemplateList />} />
                <Route path="/case-study-templates/create" element={<CaseStudyTemplateForm />} />
                <Route path="/case-study-templates/:id" element={<CaseStudyTemplateForm />} />
                <Route path="/proposal-templates" element={<ProposalTemplateList />} />
                <Route path="/proposal-templates/create" element={<ProposalTemplateForm />} />
                <Route path="/proposal-templates/:id" element={<ProposalTemplateForm />} />
                <Route path="/proposals" element={<ProposalList />} />
                <Route path="/proposals/create" element={<ProposalWizard />} />
                <Route path="/proposals/:id" element={<ProposalDetail />} />
                <Route path="/estimating" element={<EstimatesList />} />
                <Route path="/estimating/estimates/new" element={<EstimateNew />} />
                <Route path="/estimating/estimates/:id" element={<EstimateDetail />} />
                <Route path="/estimating/budgets" element={<BudgetsList />} />
                <Route path="/estimating/budgets/:id/edit" element={<BudgetGenerator />} />
                <Route path="/estimating/cost-database" element={<CostDatabase />} />
                <Route path="/estimating/budget-generator" element={<BudgetGenerator />} />
                <Route path="/account-management" element={<AccountManagementList />} />
                <Route path="/account-management/contacts" element={<AccountManagementContacts />} />
                <Route path="/account-management/customers" element={<CustomerList />} />
                <Route path="/account-management/vendors" element={<VendorList />} />
                <Route path="/account-management/work-orders" element={<WorkOrderList />} />
                <Route path="/account-management/work-orders/:id" element={<WorkOrderDetail />} />
                <Route path="/account-management/teams" element={<TeamList />} />
                <Route path="/account-management/teams/:id" element={<TeamDetail />} />
                <Route path="/customers/:id" element={<CustomerDetail />} />
                <Route path="/customers/:id/contacts" element={<CustomerContacts />} />
                <Route path="/customers/:id/projects" element={<CustomerProjects />} />
                <Route path="/customers/:id/estimates" element={<CustomerEstimates />} />
                <Route path="/customers/:id/touchpoints" element={<CustomerTouchpoints />} />
                <Route path="/hr" element={<HRDashboard />} />
                <Route path="/hr/employees" element={<EmployeeList />} />
                <Route path="/hr/employees/new" element={<EmployeeForm />} />
                <Route path="/hr/employees/:id" element={<EmployeeDetail />} />
                <Route path="/hr/employees/:id/edit" element={<EmployeeDetail />} />
                <Route path="/hr/departments" element={<DepartmentList />} />
                <Route path="/hr/locations" element={<LocationList />} />
                <Route path="/safety" element={<SafetyDashboard />} />
                <Route path="/users" element={<UserManagement />} />
                <Route path="/security" element={<SecuritySettings />} />
                <Route path="/settings" element={<TenantSettings />} />
                <Route path="/settings/vista-data" element={<VistaDataSettings />} />
                <Route path="/settings/vista-data/linking" element={<VistaLinkingManager />} />
                <Route path="/settings/service-offerings" element={<ServiceOfferingList />} />

                {/* HR Routes */}
                <Route path="/employee-resumes" element={<EmployeeResumeList />} />
                <Route path="/employee-resumes/create" element={<EmployeeResumeForm />} />
                <Route path="/employee-resumes/:id" element={<EmployeeResumeForm />} />

                <Route path="/feedback" element={<FeedbackPage />} />
                <Route path="/administration" element={<AdministrationDashboard />} />
                <Route path="/risk-management" element={<RiskManagementDashboard />} />
                <Route path="/risk-management/contract-reviews" element={<ContractReviewList />} />
                <Route path="/risk-management/contract-reviews/upload" element={<ContractReviewUpload />} />
                <Route path="/risk-management/contract-reviews/:id" element={<ContractReviewDetail />} />
                <Route path="/projects" element={<ProjectList />} />
                <Route path="/projects/projected-revenue" element={<ProjectedRevenue />} />
                <Route path="/projects/labor-forecast" element={<LaborForecast />} />
                <Route path="/projects/new" element={<ProjectForm />} />
                <Route path="/projects/:id" element={<ProjectDetail />} />
                <Route path="/projects/:projectId/companies" element={<ProjectCompanies />} />
                <Route path="/projects/:projectId/rfis" element={<RFIList />} />
                <Route path="/projects/:projectId/rfis/new" element={<RFIForm />} />
                <Route path="/projects/:projectId/rfis/:id/edit" element={<RFIEdit />} />
                <Route path="/projects/:projectId/rfis/:id" element={<RFIDetail />} />
                <Route path="/projects/:projectId/submittals" element={<SubmittalList />} />
                <Route path="/projects/:projectId/submittals/new" element={<SubmittalForm />} />
                <Route path="/projects/:projectId/submittals/:id" element={<SubmittalDetail />} />
                <Route path="/projects/:projectId/change-orders" element={<ChangeOrderList />} />
                <Route path="/projects/:projectId/change-orders/new" element={<ChangeOrderForm />} />
                <Route path="/projects/:projectId/change-orders/:id" element={<ChangeOrderDetail />} />
                <Route path="/projects/:projectId/change-orders/:id/edit" element={<ChangeOrderForm />} />
                <Route path="/projects/:projectId/daily-reports" element={<DailyReportList />} />
                <Route path="/projects/:projectId/schedule" element={<ScheduleView />} />
                <Route path="/projects/:id/financials" element={<ProjectFinancials />} />
                <Route path="/projects/:id/specifications" element={<ProjectSpecifications />} />
                <Route path="/projects/:id/specifications/:specId" element={<SpecificationDetail />} />
                <Route path="/projects/:id/drawings" element={<ProjectDrawings />} />
                <Route path="/projects/:id/drawings/:drawingId" element={<DrawingDetail />} />
              </Routes>
            </Layout>
          </PrivateRoute>
        }
      />
    </Routes>

      {/* Force password change modal */}
      {user && (
        <ChangePasswordModal
          isOpen={showPasswordChangeModal}
          onClose={() => {
            // Force refresh to get updated user state
            window.location.reload();
          }}
          forceChange={true}
        />
      )}
    </>
  );
};

export default App;
