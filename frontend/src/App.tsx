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
import BudgetsList from './pages/estimating/BudgetsList';
import CostDatabase from './pages/estimating/CostDatabase';
import AccountManagementList from './pages/accountManagement/AccountManagementList';
import CustomerList from './pages/accountManagement/CustomerList';
import CustomerDetail from './pages/CustomerDetail';

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
                <Route path="/marketing" element={<MarketingList />} />
                <Route path="/marketing/branding" element={<Branding />} />
                <Route path="/estimating" element={<EstimatingDashboard />} />
                <Route path="/estimating/estimates" element={<EstimatesList />} />
                <Route path="/estimating/estimates/new" element={<EstimateNew />} />
                <Route path="/estimating/budgets" element={<BudgetsList />} />
                <Route path="/estimating/cost-database" element={<CostDatabase />} />
                <Route path="/account-management" element={<AccountManagementList />} />
                <Route path="/account-management/customers" element={<CustomerList />} />
                <Route path="/customers/:id" element={<CustomerDetail />} />
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
              </Routes>
            </Layout>
          </PrivateRoute>
        }
      />
    </Routes>
  );
};

export default App;
