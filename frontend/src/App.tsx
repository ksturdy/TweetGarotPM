import React, { useState, useEffect, useRef } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import Layout from './components/common/Layout';
import Login from './pages/Login';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import ResetPasswordPage from './pages/ResetPasswordPage';
import ChangePasswordModal from './components/security/ChangePasswordModal';
import Dashboard from './pages/Dashboard';
// Public pages (signup disabled — imports removed)
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
import DailyReportDetail from './pages/dailyReports/DailyReportDetail';
import ScheduleView from './pages/schedule/ScheduleView';
import GCScheduleView from './pages/schedule/GCScheduleView';
import ProjectWeeklyGoals from './pages/projects/ProjectWeeklyGoals';
import ProjectCompanies from './pages/companies/ProjectCompanies';
import MarketingList from './pages/marketing/MarketingList';
import TemplatesHub from './pages/marketing/TemplatesHub';
import ResumeTemplateList from './pages/marketing/ResumeTemplateList';
import ResumeTemplateForm from './pages/marketing/ResumeTemplateForm';
import Branding from './pages/marketing/Branding';
import CaseStudyList from './pages/marketing/CaseStudyList';
import CaseStudyForm from './pages/marketing/CaseStudyForm';
import CaseStudyDetail from './pages/marketing/CaseStudyDetail';
import CaseStudyImport from './pages/marketing/CaseStudyImport';
import CaseStudyTemplateList from './pages/marketing/CaseStudyTemplateList';
import CaseStudyTemplateForm from './pages/marketing/CaseStudyTemplateForm';
import SellSheetList from './pages/marketing/SellSheetList';
import SellSheetForm from './pages/marketing/SellSheetForm';
import SellSheetDetail from './pages/marketing/SellSheetDetail';
import ServiceOfferingList from './pages/settings/ServiceOfferingList';
import EmployeeResumeList from './pages/hr/EmployeeResumeList';
import EmployeeResumeForm from './pages/hr/EmployeeResumeForm';
import EmployeeResumeImport from './pages/hr/EmployeeResumeImport';
import ProposalTemplateList from './pages/marketing/ProposalTemplateList';
import ProposalTemplateForm from './pages/marketing/ProposalTemplateForm';
import OrgChartList from './pages/marketing/OrgChartList';
import OrgChartDetail from './pages/marketing/OrgChartDetail';
import TradeShowList from './pages/marketing/trade-shows/TradeShowList';
import TradeShowForm from './pages/marketing/trade-shows/TradeShowForm';
import TradeShowDetail from './pages/marketing/trade-shows/TradeShowDetail';
import ProposalList from './pages/marketing/ProposalList';
import ProposalDetail from './pages/marketing/ProposalDetail';
import ProposalWizard from './pages/marketing/ProposalWizard';
import ProjectLocations from './pages/marketing/ProjectLocations';
import CustomerComparison from './pages/marketing/CustomerComparison';
import CustomMaps from './pages/marketing/CustomMaps';
import EstimatingDashboard from './pages/estimating/EstimatingDashboard';
import EstimatesList from './pages/estimating/EstimatesList';
import EstimateNew from './pages/estimating/EstimateNew';
import EstimateDetail from './pages/estimating/EstimateDetail';
import BudgetsList from './pages/estimating/BudgetsList';
import CostDatabase from './pages/estimating/CostDatabase';
import BudgetGenerator from './pages/estimating/BudgetGenerator';
import TakeoffsList from './pages/estimating/TakeoffsList';
import TakeoffForm from './pages/estimating/TakeoffForm';
import TakeoffDetail from './pages/estimating/TakeoffDetail';
import AccountManagementContacts from './pages/accountManagement/AccountManagementContacts';
import CustomerList from './pages/accountManagement/CustomerList';
import VendorList from './pages/accountManagement/VendorList';
import WorkOrderList from './pages/accountManagement/WorkOrderList';
import WorkOrderDetail from './pages/accountManagement/WorkOrderDetail';
import TeamList from './pages/accountManagement/TeamList';
import TeamDetail from './pages/accountManagement/TeamDetail';
import CustomerDetail from './pages/CustomerDetail';
import CustomerContacts from './pages/CustomerContacts';
import CustomerOrgChart from './pages/CustomerOrgChart';
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
import RolesPermissions from './pages/RolesPermissions';
import SecuritySettings from './pages/SecuritySettings';
import ProjectSpecifications from './pages/projects/ProjectSpecifications';
import SpecificationDetail from './pages/projects/SpecificationDetail';
import ProjectDrawings from './pages/projects/ProjectDrawings';
import ProjectCostModel from './pages/projects/ProjectCostModel';
import DrawingDetail from './pages/projects/DrawingDetail';
import ProjectFinancials from './pages/projects/ProjectFinancials';
import CostDrillIn from './pages/projects/CostDrillIn';
import ProjectPerformance from './pages/projects/ProjectPerformance';
import ProjectedRevenue from './pages/projects/ProjectedRevenue';
import LaborForecast from './pages/projects/LaborForecast';
import PhaseSchedule from './pages/projects/PhaseSchedule';
import Stratus from './pages/projects/Stratus';
import FeedbackPage from './pages/FeedbackPage';
import NotificationsPage from './pages/NotificationsPage';
import AdministrationDashboard from './pages/administration/AdministrationDashboard';
import RiskManagementDashboard from './pages/riskManagement/RiskManagementDashboard';
import ContractReviewList from './pages/riskManagement/ContractReviewList';
import ContractReviewUpload from './pages/riskManagement/ContractReviewUpload';
import ContractReviewDetail from './pages/riskManagement/ContractReviewDetail';
import SalesPipeline from './pages/SalesPipeline';
import MobileSales from './pages/MobileSales';
import OpportunitySearch from './pages/OpportunitySearch';
import LeadInboxPage from './pages/LeadInboxPage';
import LeadInboxDetailPage from './pages/LeadInboxDetailPage';
import Campaigns from './pages/Campaigns';
import CampaignCreate from './pages/CampaignCreate';
import CampaignDetail from './pages/CampaignDetail';
import SafetyDashboard from './pages/safety/SafetyDashboard';
import ExecutiveReport from './pages/reports/ExecutiveReport';
import OpportunityProjectedRevenue from './pages/opportunities/OpportunityProjectedRevenue';
import BacklogFitAnalysis from './pages/reports/BacklogFitAnalysis';
import CashFlowReport from './pages/reports/CashFlowReport';
import ScheduledReports from './pages/reports/ScheduledReports';
import BuyoutMetricReport from './pages/reports/BuyoutMetricReport';
import ReportsHub from './pages/reports/ReportsHub';
import WeeklySalesReport from './pages/reports/WeeklySalesReport';
import TenantSettings from './pages/TenantSettings';
// Field module
import FieldLayout from './components/field/FieldLayout';
import FieldDashboard from './pages/field/FieldDashboard';
import FieldProjectHome from './pages/field/FieldProjectHome';
import FittingOrdersHome from './pages/field/FittingOrdersHome';
import SafetyHome from './pages/field/SafetyHome';
import FieldDailyReportList from './pages/field/dailyReports/FieldDailyReportList';
import FieldDailyReportForm from './pages/field/dailyReports/FieldDailyReportForm';
import FieldDailyReportDetail from './pages/field/dailyReports/FieldDailyReportDetail';
import FieldPOList from './pages/field/purchaseOrders/FieldPOList';
import FieldPOForm from './pages/field/purchaseOrders/FieldPOForm';
import FieldPODetail from './pages/field/purchaseOrders/FieldPODetail';
import FieldSmFittingOrderList from './pages/field/fittingOrders/FieldSmFittingOrderList';
import FieldSmFittingOrderForm from './pages/field/fittingOrders/FieldSmFittingOrderForm';
import FieldSmFittingOrderDetail from './pages/field/fittingOrders/FieldSmFittingOrderDetail';
import FieldPipingFittingOrderList from './pages/field/fittingOrders/FieldPipingFittingOrderList';
import FieldPipingFittingOrderForm from './pages/field/fittingOrders/FieldPipingFittingOrderForm';
import FieldPipingFittingOrderDetail from './pages/field/fittingOrders/FieldPipingFittingOrderDetail';
import FieldPlumbingFittingOrderList from './pages/field/fittingOrders/FieldPlumbingFittingOrderList';
import FieldPlumbingFittingOrderForm from './pages/field/fittingOrders/FieldPlumbingFittingOrderForm';
import FieldPlumbingFittingOrderDetail from './pages/field/fittingOrders/FieldPlumbingFittingOrderDetail';
import FieldSheetMetalFittingOrderList from './pages/field/fittingOrders/FieldSheetMetalFittingOrderList';
import FieldSheetMetalFittingOrderForm from './pages/field/fittingOrders/FieldSheetMetalFittingOrderForm';
import FieldSheetMetalFittingOrderDetail from './pages/field/fittingOrders/FieldSheetMetalFittingOrderDetail';
import FieldJSAList from './pages/field/safetyJsa/FieldJSAList';
import FieldJSAForm from './pages/field/safetyJsa/FieldJSAForm';
import FieldJSADetail from './pages/field/safetyJsa/FieldJSADetail';
import FieldNearMissList from './pages/field/nearMiss/FieldNearMissList';
import FieldNearMissForm from './pages/field/nearMiss/FieldNearMissForm';
import FieldNearMissDetail from './pages/field/nearMiss/FieldNearMissDetail';
import ProjectIssueList from './pages/issues/ProjectIssueList';
import ProjectIssueDetail from './pages/issues/ProjectIssueDetail';
import FieldIssueList from './pages/field/issues/FieldIssueList';
import FieldIssueForm from './pages/field/issues/FieldIssueForm';
import FieldIssueDetail from './pages/field/issues/FieldIssueDetail';
import FieldRFIList from './pages/field/rfis/FieldRFIList';
import FieldRFIForm from './pages/field/rfis/FieldRFIForm';
import FieldRFIDetail from './pages/field/rfis/FieldRFIDetail';
import FieldMoreHome from './pages/field/FieldMoreHome';
import FieldFavoriteVendors from './pages/field/vendors/FieldFavoriteVendors';
import VistaDataSettings from './pages/settings/VistaDataSettings';
import VistaLinkingManager from './pages/settings/VistaLinkingManager';
import EstProductSettings from './pages/settings/EstProductSettings';
import BuildQuestionnaire from './pages/BuildQuestionnaire';
// Traceover module (lazy-loaded)
const TraceoverWorkspace = React.lazy(() => import('./modules/traceover/pages/TraceoverWorkspace'));
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

const ForemanRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return <div className="loading">Loading...</div>;
  }

  if (!user) {
    return <Navigate to="/login" />;
  }

  // Foremen can only access the /field routes
  if (user.role === 'foreman') {
    return <Navigate to="/field" />;
  }

  return <>{children}</>;
};

const App: React.FC = () => {
  const { user, passwordExpiresInDays } = useAuth();
  const [showPasswordChangeModal, setShowPasswordChangeModal] = useState(false);
  const [dismissedExpiryWarning, setDismissedExpiryWarning] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    // Initialize based on token existence
    return !!localStorage.getItem('token');
  });
  const prevAuthState = useRef<boolean>(!!localStorage.getItem('token'));

  useEffect(() => {
    console.log(`🏠 App effect running, user changed`);

    // Check if user needs to change password
    if (user && (user as any).forcePasswordChange) {
      setShowPasswordChangeModal(true);
    } else {
      setShowPasswordChangeModal(false);
    }

    // Only update authentication state when it actually changes
    const currentAuthState = !!user;
    if (currentAuthState !== prevAuthState.current) {
      console.log(`🔐 Auth state changing: ${prevAuthState.current} → ${currentAuthState}`);
      prevAuthState.current = currentAuthState;
      setIsAuthenticated(currentAuthState);
    }
  }, [user]);

  return (
    <>
      <Routes>
        {/* Public routes — signup disabled, redirect to login */}
        <Route path="/welcome" element={<Navigate to="/login" />} />
        <Route path="/signup" element={<Navigate to="/login" />} />
        <Route path="/pricing" element={<Navigate to="/login" />} />
        <Route path="/login" element={<Login />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/build-questionnaire" element={<BuildQuestionnaire />} />

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

        {/* Field module - separate mobile layout */}
        <Route
          path="/field"
          element={
            <PrivateRoute>
              <FieldLayout />
            </PrivateRoute>
          }
        >
          <Route index element={<FieldDashboard />} />
          <Route path="projects/:projectId" element={<FieldProjectHome />} />
          <Route path="projects/:projectId/daily-reports" element={<FieldDailyReportList />} />
          <Route path="projects/:projectId/daily-reports/new" element={<FieldDailyReportForm />} />
          <Route path="projects/:projectId/daily-reports/:id" element={<FieldDailyReportDetail />} />
          <Route path="projects/:projectId/daily-reports/:id/edit" element={<FieldDailyReportForm />} />
          <Route path="projects/:projectId/purchase-orders" element={<FieldPOList />} />
          <Route path="projects/:projectId/purchase-orders/new" element={<FieldPOForm />} />
          <Route path="projects/:projectId/purchase-orders/:id" element={<FieldPODetail />} />
          <Route path="projects/:projectId/purchase-orders/:id/edit" element={<FieldPOForm />} />
          <Route path="projects/:projectId/fitting-orders" element={<FittingOrdersHome />} />
          <Route path="projects/:projectId/safety" element={<SafetyHome />} />
          <Route path="projects/:projectId/sm-fitting-orders" element={<FieldSmFittingOrderList />} />
          <Route path="projects/:projectId/sm-fitting-orders/new" element={<FieldSmFittingOrderForm />} />
          <Route path="projects/:projectId/sm-fitting-orders/:id" element={<FieldSmFittingOrderDetail />} />
          <Route path="projects/:projectId/sm-fitting-orders/:id/edit" element={<FieldSmFittingOrderForm />} />
          <Route path="projects/:projectId/piping-fitting-orders" element={<FieldPipingFittingOrderList />} />
          <Route path="projects/:projectId/piping-fitting-orders/new" element={<FieldPipingFittingOrderForm />} />
          <Route path="projects/:projectId/piping-fitting-orders/:id" element={<FieldPipingFittingOrderDetail />} />
          <Route path="projects/:projectId/piping-fitting-orders/:id/edit" element={<FieldPipingFittingOrderForm />} />
          <Route path="projects/:projectId/plumbing-fitting-orders" element={<FieldPlumbingFittingOrderList />} />
          <Route path="projects/:projectId/plumbing-fitting-orders/new" element={<FieldPlumbingFittingOrderForm />} />
          <Route path="projects/:projectId/plumbing-fitting-orders/:id" element={<FieldPlumbingFittingOrderDetail />} />
          <Route path="projects/:projectId/plumbing-fitting-orders/:id/edit" element={<FieldPlumbingFittingOrderForm />} />
          <Route path="projects/:projectId/sheet-metal-fitting-orders" element={<FieldSheetMetalFittingOrderList />} />
          <Route path="projects/:projectId/sheet-metal-fitting-orders/new" element={<FieldSheetMetalFittingOrderForm />} />
          <Route path="projects/:projectId/sheet-metal-fitting-orders/:id" element={<FieldSheetMetalFittingOrderDetail />} />
          <Route path="projects/:projectId/sheet-metal-fitting-orders/:id/edit" element={<FieldSheetMetalFittingOrderForm />} />
          <Route path="projects/:projectId/safety-jsa" element={<FieldJSAList />} />
          <Route path="projects/:projectId/safety-jsa/new" element={<FieldJSAForm />} />
          <Route path="projects/:projectId/safety-jsa/:id" element={<FieldJSADetail />} />
          <Route path="projects/:projectId/safety-jsa/:id/edit" element={<FieldJSAForm />} />
          <Route path="projects/:projectId/safety-near-miss" element={<FieldNearMissList />} />
          <Route path="projects/:projectId/safety-near-miss/new" element={<FieldNearMissForm />} />
          <Route path="projects/:projectId/safety-near-miss/:id" element={<FieldNearMissDetail />} />
          <Route path="projects/:projectId/safety-near-miss/:id/edit" element={<FieldNearMissForm />} />
          <Route path="projects/:projectId/issues" element={<FieldIssueList />} />
          <Route path="projects/:projectId/issues/new" element={<FieldIssueForm />} />
          <Route path="projects/:projectId/issues/:id" element={<FieldIssueDetail />} />
          <Route path="projects/:projectId/issues/:id/edit" element={<FieldIssueForm />} />
          <Route path="projects/:projectId/rfis" element={<FieldRFIList />} />
          <Route path="projects/:projectId/rfis/new" element={<FieldRFIForm />} />
          <Route path="projects/:projectId/rfis/:id" element={<FieldRFIDetail />} />
          <Route path="projects/:projectId/rfis/:id/edit" element={<FieldRFIForm />} />
          <Route path="projects/:projectId/more" element={<FieldMoreHome />} />
          <Route path="projects/:projectId/more/vendors" element={<FieldFavoriteVendors />} />
        </Route>

        {/* Traceover workspace — standalone layout (no main Layout wrapper) */}
        <Route
          path="/estimating/takeoffs/:id/workspace"
          element={
            <PrivateRoute>
              <React.Suspense fallback={<div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center', backgroundColor: '#0a1628', color: '#7a9ab5' }}>Loading workspace...</div>}>
                <TraceoverWorkspace />
              </React.Suspense>
            </PrivateRoute>
          }
        />

        {/* Protected app routes */}
        <Route
          path="/*"
          element={
            <PrivateRoute>
              <ForemanRoute>
              <Layout>
                <Routes>
                  <Route path="/" element={<Dashboard />} />
                <Route path="/sales" element={<SalesPipeline />} />
                <Route path="/sales/mobile" element={<MobileSales />} />
                <Route path="/sales/projected-revenue" element={<OpportunityProjectedRevenue />} />
                <Route path="/sales/opportunity-search" element={<OpportunitySearch />} />
                <Route path="/lead-inbox" element={<LeadInboxPage />} />
                <Route path="/lead-inbox/:id" element={<LeadInboxDetailPage />} />
                <Route path="/campaigns" element={<Campaigns />} />
                <Route path="/campaigns/new" element={<CampaignCreate />} />
                <Route path="/campaigns/:id" element={<CampaignDetail />} />
                <Route path="/marketing" element={<MarketingList />} />
                <Route path="/marketing/templates" element={<TemplatesHub />} />
                <Route path="/resume-templates" element={<ResumeTemplateList />} />
                <Route path="/resume-templates/create" element={<ResumeTemplateForm />} />
                <Route path="/resume-templates/:id" element={<ResumeTemplateForm />} />
                <Route path="/marketing/branding" element={<Branding />} />
                <Route path="/marketing/project-locations" element={<ProjectLocations />} />
                <Route path="/marketing/customer-comparison" element={<CustomerComparison />} />
                <Route path="/marketing/custom-maps" element={<CustomMaps />} />
                <Route path="/marketing/trade-shows" element={<TradeShowList />} />
                <Route path="/marketing/trade-shows/create" element={<TradeShowForm />} />
                <Route path="/marketing/trade-shows/:id" element={<TradeShowDetail />} />
                <Route path="/marketing/trade-shows/:id/edit" element={<TradeShowForm />} />
                <Route path="/case-studies" element={<CaseStudyList />} />
                <Route path="/case-studies/import" element={<CaseStudyImport />} />
                <Route path="/case-studies/create" element={<CaseStudyForm />} />
                <Route path="/case-studies/:id" element={<CaseStudyDetail />} />
                <Route path="/sell-sheets" element={<SellSheetList />} />
                <Route path="/sell-sheets/create" element={<SellSheetForm />} />
                <Route path="/sell-sheets/:id" element={<SellSheetDetail />} />
                <Route path="/sell-sheets/:id/edit" element={<SellSheetForm />} />
                <Route path="/case-study-templates" element={<CaseStudyTemplateList />} />
                <Route path="/case-study-templates/create" element={<CaseStudyTemplateForm />} />
                <Route path="/case-study-templates/:id" element={<CaseStudyTemplateForm />} />
                <Route path="/proposal-templates" element={<ProposalTemplateList />} />
                <Route path="/proposal-templates/create" element={<ProposalTemplateForm />} />
                <Route path="/proposal-templates/:id" element={<ProposalTemplateForm />} />
                <Route path="/proposals" element={<ProposalList />} />
                <Route path="/proposals/create" element={<ProposalWizard />} />
                <Route path="/proposals/:id" element={<ProposalDetail />} />
                <Route path="/org-charts" element={<OrgChartList />} />
                <Route path="/org-charts/:id" element={<OrgChartDetail />} />
                <Route path="/estimating" element={<EstimatesList />} />
                <Route path="/estimating/estimates/new" element={<EstimateNew />} />
                <Route path="/estimating/estimates/:id" element={<EstimateDetail />} />
                <Route path="/estimating/budgets" element={<BudgetsList />} />
                <Route path="/estimating/budgets/:id/edit" element={<BudgetGenerator />} />
                <Route path="/estimating/cost-database" element={<CostDatabase />} />
                <Route path="/estimating/budget-generator" element={<BudgetGenerator />} />
                <Route path="/estimating/takeoffs" element={<TakeoffsList />} />
                <Route path="/estimating/takeoffs/new" element={<TakeoffForm />} />
                <Route path="/estimating/takeoffs/:id" element={<TakeoffDetail />} />
                <Route path="/estimating/takeoffs/:id/edit" element={<TakeoffForm />} />
                <Route path="/account-management" element={<Navigate to="/account-management/customers" />} />
                <Route path="/account-management/contacts" element={<AccountManagementContacts />} />
                <Route path="/account-management/customers" element={<CustomerList />} />
                <Route path="/account-management/vendors" element={<VendorList />} />
                <Route path="/account-management/work-orders" element={<WorkOrderList />} />
                <Route path="/account-management/work-orders/:id" element={<WorkOrderDetail />} />
                <Route path="/account-management/teams" element={<TeamList />} />
                <Route path="/account-management/teams/:id" element={<TeamDetail />} />
                <Route path="/customers/:id" element={<CustomerDetail />} />
                <Route path="/customers/:id/contacts" element={<CustomerContacts />} />
                <Route path="/customers/:id/org-chart" element={<CustomerOrgChart />} />
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
                <Route path="/roles" element={<RolesPermissions />} />
                <Route path="/security" element={<SecuritySettings />} />
                <Route path="/settings" element={<TenantSettings />} />
                <Route path="/settings/vista-data" element={<VistaDataSettings />} />
                <Route path="/settings/vista-data/linking" element={<VistaLinkingManager />} />
                <Route path="/settings/est-products" element={<EstProductSettings />} />
                <Route path="/settings/service-offerings" element={<ServiceOfferingList />} />

                {/* HR Routes */}
                <Route path="/employee-resumes" element={<EmployeeResumeList />} />
                <Route path="/employee-resumes/import" element={<EmployeeResumeImport />} />
                <Route path="/employee-resumes/create" element={<EmployeeResumeForm />} />
                <Route path="/employee-resumes/:id" element={<EmployeeResumeForm />} />

                <Route path="/feedback" element={<FeedbackPage />} />
                <Route path="/notifications" element={<NotificationsPage />} />
                <Route path="/administration" element={<AdministrationDashboard />} />
                <Route path="/risk-management" element={<RiskManagementDashboard />} />
                <Route path="/reports" element={<ReportsHub />} />
                <Route path="/reports/executive-report" element={<ExecutiveReport />} />
                <Route path="/reports/backlog-fit" element={<BacklogFitAnalysis />} />
                <Route path="/reports/cash-flow" element={<CashFlowReport />} />
                <Route path="/reports/scheduled" element={<ScheduledReports />} />
                <Route path="/reports/buyout-metric" element={<BuyoutMetricReport />} />
                <Route path="/reports/weekly-sales" element={<WeeklySalesReport />} />
                <Route path="/executive-report" element={<Navigate to="/reports/executive-report" />} />
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
                <Route path="/projects/:projectId/daily-reports/:id" element={<DailyReportDetail />} />
                <Route path="/projects/:projectId/issues" element={<ProjectIssueList />} />
                <Route path="/projects/:projectId/issues/:id" element={<ProjectIssueDetail />} />
                <Route path="/projects/:projectId/schedule" element={<ScheduleView />} />
                <Route path="/projects/:projectId/gc-schedule" element={<GCScheduleView />} />
                <Route path="/projects/:projectId/phase-schedule" element={<PhaseSchedule />} />
                <Route path="/projects/:projectId/stratus" element={<Stratus />} />
                <Route path="/projects/:projectId/weekly-goals" element={<ProjectWeeklyGoals />} />
                <Route path="/projects/:id/financials" element={<ProjectFinancials />} />
                <Route path="/projects/:id/financials/cost-detail" element={<CostDrillIn />} />
                <Route path="/projects/:id/performance" element={<ProjectPerformance />} />
                <Route path="/projects/:id/specifications" element={<ProjectSpecifications />} />
                <Route path="/projects/:id/specifications/:specId" element={<SpecificationDetail />} />
                <Route path="/projects/:id/drawings" element={<ProjectDrawings />} />
                <Route path="/projects/:id/drawings/:drawingId" element={<DrawingDetail />} />
                <Route path="/projects/:id/cost-model" element={<ProjectCostModel />} />
              </Routes>
            </Layout>
              </ForemanRoute>
          </PrivateRoute>
        }
      />
    </Routes>

      {/* Password expiry warning banner */}
      {user && passwordExpiresInDays !== null && !dismissedExpiryWarning && !showPasswordChangeModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          backgroundColor: '#f59e0b',
          color: '#78350f',
          padding: '0.75rem 1rem',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          gap: '1rem',
          zIndex: 9998,
          fontSize: '0.9rem',
          fontWeight: 500,
        }}>
          <span>Your password expires in {passwordExpiresInDays} day{passwordExpiresInDays !== 1 ? 's' : ''}. Please change it soon.</span>
          <button
            onClick={() => setShowPasswordChangeModal(true)}
            style={{
              background: '#78350f',
              color: '#fff',
              border: 'none',
              borderRadius: '4px',
              padding: '0.25rem 0.75rem',
              cursor: 'pointer',
              fontSize: '0.85rem',
            }}
          >
            Change Now
          </button>
          <button
            onClick={() => setDismissedExpiryWarning(true)}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#78350f',
              cursor: 'pointer',
              fontSize: '1.2rem',
              padding: '0 0.25rem',
              lineHeight: 1,
            }}
          >
            x
          </button>
        </div>
      )}

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
