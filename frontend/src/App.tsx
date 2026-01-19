import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import Layout from './components/common/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
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
import DailyReportList from './pages/dailyReports/DailyReportList';
import ScheduleView from './pages/schedule/ScheduleView';
import ProjectCompanies from './pages/companies/ProjectCompanies';
import MarketingList from './pages/marketing/MarketingList';
import Branding from './pages/marketing/Branding';
import EstimatingDashboard from './pages/estimating/EstimatingDashboard';
import EstimatesList from './pages/estimating/EstimatesList';
import EstimateNew from './pages/estimating/EstimateNew';
import EstimateDetail from './pages/estimating/EstimateDetail';
import BudgetsList from './pages/estimating/BudgetsList';
import CostDatabase from './pages/estimating/CostDatabase';
import AccountManagementList from './pages/accountManagement/AccountManagementList';
import AccountManagementContacts from './pages/accountManagement/AccountManagementContacts';
import CustomerList from './pages/accountManagement/CustomerList';
import VendorList from './pages/accountManagement/VendorList';
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
import ProjectSpecifications from './pages/projects/ProjectSpecifications';
import SpecificationDetail from './pages/projects/SpecificationDetail';
import ProjectDrawings from './pages/projects/ProjectDrawings';
import DrawingDetail from './pages/projects/DrawingDetail';
import FeedbackPage from './pages/FeedbackPage';
import AdministrationDashboard from './pages/administration/AdministrationDashboard';
import RiskManagementDashboard from './pages/riskManagement/RiskManagementDashboard';
import ContractReviewList from './pages/riskManagement/ContractReviewList';
import ContractReviewUpload from './pages/riskManagement/ContractReviewUpload';
import ContractReviewDetail from './pages/riskManagement/ContractReviewDetail';
import SalesPipeline from './pages/SalesPipeline';

const PrivateRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return <div className="loading">Loading...</div>;
  }

  return user ? <>{children}</> : <Navigate to="/login" />;
};

const App: React.FC = () => {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/*"
        element={
          <PrivateRoute>
            <Layout>
              <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/sales" element={<SalesPipeline />} />
                <Route path="/marketing" element={<MarketingList />} />
                <Route path="/marketing/branding" element={<Branding />} />
                <Route path="/estimating" element={<EstimatingDashboard />} />
                <Route path="/estimating/estimates" element={<EstimatesList />} />
                <Route path="/estimating/estimates/new" element={<EstimateNew />} />
                <Route path="/estimating/estimates/:id" element={<EstimateDetail />} />
                <Route path="/estimating/budgets" element={<BudgetsList />} />
                <Route path="/estimating/cost-database" element={<CostDatabase />} />
                <Route path="/account-management" element={<AccountManagementList />} />
                <Route path="/account-management/contacts" element={<AccountManagementContacts />} />
                <Route path="/account-management/customers" element={<CustomerList />} />
                <Route path="/account-management/vendors" element={<VendorList />} />
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
                <Route path="/users" element={<UserManagement />} />
                <Route path="/feedback" element={<FeedbackPage />} />
                <Route path="/administration" element={<AdministrationDashboard />} />
                <Route path="/risk-management" element={<RiskManagementDashboard />} />
                <Route path="/risk-management/contract-reviews" element={<ContractReviewList />} />
                <Route path="/risk-management/contract-reviews/upload" element={<ContractReviewUpload />} />
                <Route path="/risk-management/contract-reviews/:id" element={<ContractReviewDetail />} />
                <Route path="/projects" element={<ProjectList />} />
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
                <Route path="/projects/:projectId/daily-reports" element={<DailyReportList />} />
                <Route path="/projects/:projectId/schedule" element={<ScheduleView />} />
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
  );
};

export default App;
