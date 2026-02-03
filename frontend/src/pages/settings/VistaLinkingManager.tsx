import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { vistaDataService, VPContract, VPWorkOrder, VPEmployee, VPCustomer, VPVendor, LinkData, EmployeeDuplicate, CustomerDuplicate, ContractDuplicate, DepartmentDuplicate, VendorDuplicate, ImportToTitanResult, LinkDepartmentCodeResult, AutoLinkDepartmentsResult } from '../../services/vistaData';
import { projectsApi } from '../../services/projects';
import { employeesApi } from '../../services/employees';
import { customersApi } from '../../services/customers';
import { departmentsApi } from '../../services/departments';
import '../../styles/SalesPipeline.css';

type TabType = 'contracts' | 'work-orders' | 'vp-employees' | 'vp-customers' | 'vp-vendors' | 'duplicates-employees' | 'duplicates-customers' | 'duplicates-contracts' | 'duplicates-departments' | 'duplicates-vendors';
type FilterType = 'all' | 'unmatched' | 'auto_matched' | 'manual_matched' | 'ignored';

interface LinkModalData {
  type: 'contract' | 'work_order' | 'vp_employee' | 'vp_customer' | 'vp_vendor';
  id: number;
  record: VPContract | VPWorkOrder | VPEmployee | VPCustomer | VPVendor;
}

const VistaLinkingManager: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();

  const [activeTab, setActiveTab] = useState<TabType>(
    (searchParams.get('tab') as TabType) || 'contracts'
  );
  const [filter, setFilter] = useState<FilterType>(
    (searchParams.get('filter') as FilterType) || 'unmatched'
  );
  const [search, setSearch] = useState('');
  const [linkModal, setLinkModal] = useState<LinkModalData | null>(null);
  const [linkForm, setLinkForm] = useState<LinkData>({});
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const isAdmin = user?.role === 'admin';

  // Update URL when tab/filter changes
  useEffect(() => {
    setSearchParams({ tab: activeTab, filter });
  }, [activeTab, filter, setSearchParams]);

  // Queries
  const { data: contracts, isLoading: contractsLoading } = useQuery({
    queryKey: ['vista-contracts', filter, search],
    queryFn: () => vistaDataService.getAllContracts({
      link_status: filter === 'all' ? undefined : filter,
      search: search || undefined,
      limit: 5000,
    }),
    enabled: activeTab === 'contracts',
  });

  const { data: workOrders, isLoading: workOrdersLoading } = useQuery({
    queryKey: ['vista-work-orders', filter, search],
    queryFn: () => vistaDataService.getAllWorkOrders({
      link_status: filter === 'all' ? undefined : filter,
      search: search || undefined,
      limit: 5000,
    }),
    enabled: activeTab === 'work-orders',
  });

  const { data: vpEmployees, isLoading: vpEmployeesLoading } = useQuery({
    queryKey: ['vista-vp-employees', filter, search],
    queryFn: () => vistaDataService.getAllVPEmployees({
      link_status: filter === 'all' ? undefined : filter,
      search: search || undefined,
      limit: 5000,
    }),
    enabled: activeTab === 'vp-employees',
  });

  const { data: vpCustomers, isLoading: vpCustomersLoading } = useQuery({
    queryKey: ['vista-vp-customers', filter, search],
    queryFn: () => vistaDataService.getAllVPCustomers({
      link_status: filter === 'all' ? undefined : filter,
      search: search || undefined,
      limit: 5000,
    }),
    enabled: activeTab === 'vp-customers',
  });

  const { data: vpVendors, isLoading: vpVendorsLoading } = useQuery({
    queryKey: ['vista-vp-vendors', filter, search],
    queryFn: () => vistaDataService.getAllVPVendors({
      link_status: filter === 'all' ? undefined : filter,
      search: search || undefined,
      limit: 5000,
    }),
    enabled: activeTab === 'vp-vendors',
  });

  // Duplicates queries
  const { data: employeeDuplicates, isLoading: employeeDuplicatesLoading } = useQuery({
    queryKey: ['vista-employee-duplicates'],
    queryFn: () => vistaDataService.getEmployeeDuplicates(0.5),
    enabled: activeTab === 'duplicates-employees',
  });

  const { data: customerDuplicates, isLoading: customerDuplicatesLoading } = useQuery({
    queryKey: ['vista-customer-duplicates'],
    queryFn: () => vistaDataService.getCustomerDuplicates(0.5),
    enabled: activeTab === 'duplicates-customers',
  });

  const { data: contractDuplicates, isLoading: contractDuplicatesLoading } = useQuery({
    queryKey: ['vista-contract-duplicates'],
    queryFn: () => vistaDataService.getContractDuplicates(0.5),
    enabled: activeTab === 'duplicates-contracts',
  });

  const { data: departmentDuplicates, isLoading: departmentDuplicatesLoading } = useQuery({
    queryKey: ['vista-department-duplicates'],
    queryFn: () => vistaDataService.getDepartmentDuplicates(0.5),
    enabled: activeTab === 'duplicates-departments',
  });

  const { data: vendorDuplicates, isLoading: vendorDuplicatesLoading } = useQuery({
    queryKey: ['vista-vendor-duplicates'],
    queryFn: () => vistaDataService.getVendorDuplicates(0.5),
    enabled: activeTab === 'duplicates-vendors',
  });

  // Reference data for linking
  const { data: projects } = useQuery({
    queryKey: ['projects'],
    queryFn: async () => {
      const response = await projectsApi.getAll();
      return response.data as any[];
    },
  });

  const { data: employees } = useQuery({
    queryKey: ['employees'],
    queryFn: async () => {
      const response = await employeesApi.getAll();
      return (response.data as any).data as any[];
    },
  });

  const { data: customers } = useQuery({
    queryKey: ['customers'],
    queryFn: async () => {
      const data = await customersApi.getAll();
      return data as any[];
    },
  });

  const { data: departments } = useQuery({
    queryKey: ['departments'],
    queryFn: async () => {
      const response = await departmentsApi.getAll();
      return (response.data as any).data as any[];
    },
  });

  // Mutations
  const linkContractMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: LinkData }) =>
      vistaDataService.linkContract(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vista-contracts'] });
      queryClient.invalidateQueries({ queryKey: ['vista-stats'] });
      setLinkModal(null);
      showSuccess('Contract linked successfully');
    },
    onError: (error: any) => {
      showError(error.response?.data?.message || 'Failed to link contract');
    },
  });

  const linkWorkOrderMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: LinkData }) =>
      vistaDataService.linkWorkOrder(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vista-work-orders'] });
      queryClient.invalidateQueries({ queryKey: ['vista-stats'] });
      setLinkModal(null);
      showSuccess('Work order linked successfully');
    },
    onError: (error: any) => {
      showError(error.response?.data?.message || 'Failed to link work order');
    },
  });

  const ignoreContractMutation = useMutation({
    mutationFn: vistaDataService.ignoreContract,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vista-contracts'] });
      queryClient.invalidateQueries({ queryKey: ['vista-stats'] });
      showSuccess('Contract marked as ignored');
    },
  });

  const ignoreWorkOrderMutation = useMutation({
    mutationFn: vistaDataService.ignoreWorkOrder,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vista-work-orders'] });
      queryClient.invalidateQueries({ queryKey: ['vista-stats'] });
      showSuccess('Work order marked as ignored');
    },
  });

  const unlinkContractMutation = useMutation({
    mutationFn: vistaDataService.unlinkContract,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vista-contracts'] });
      queryClient.invalidateQueries({ queryKey: ['vista-stats'] });
      showSuccess('Contract unlinked');
    },
  });

  const unlinkWorkOrderMutation = useMutation({
    mutationFn: vistaDataService.unlinkWorkOrder,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vista-work-orders'] });
      queryClient.invalidateQueries({ queryKey: ['vista-stats'] });
      showSuccess('Work order unlinked');
    },
  });

  // VP Employee mutations
  const linkVPEmployeeMutation = useMutation({
    mutationFn: ({ id, employeeId }: { id: number; employeeId: number }) =>
      vistaDataService.linkVPEmployee(id, employeeId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vista-vp-employees'] });
      queryClient.invalidateQueries({ queryKey: ['vista-employee-duplicates'] });
      queryClient.invalidateQueries({ queryKey: ['vista-stats'] });
      setLinkModal(null);
      showSuccess('VP Employee linked successfully');
    },
    onError: (error: any) => {
      showError(error.response?.data?.message || 'Failed to link VP Employee');
    },
  });

  const unlinkVPEmployeeMutation = useMutation({
    mutationFn: vistaDataService.unlinkVPEmployee,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vista-vp-employees'] });
      queryClient.invalidateQueries({ queryKey: ['vista-stats'] });
      showSuccess('VP Employee unlinked');
    },
  });

  // VP Customer mutations
  const linkVPCustomerMutation = useMutation({
    mutationFn: ({ id, customerId }: { id: number; customerId: number }) =>
      vistaDataService.linkVPCustomer(id, customerId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vista-vp-customers'] });
      queryClient.invalidateQueries({ queryKey: ['vista-customer-duplicates'] });
      queryClient.invalidateQueries({ queryKey: ['vista-stats'] });
      setLinkModal(null);
      showSuccess('VP Customer linked successfully');
    },
    onError: (error: any) => {
      showError(error.response?.data?.message || 'Failed to link VP Customer');
    },
  });

  const unlinkVPCustomerMutation = useMutation({
    mutationFn: vistaDataService.unlinkVPCustomer,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vista-vp-customers'] });
      queryClient.invalidateQueries({ queryKey: ['vista-stats'] });
      showSuccess('VP Customer unlinked');
    },
  });

  // VP Vendor mutations (placeholder - no vendors table yet)
  const linkVPVendorMutation = useMutation({
    mutationFn: ({ id, vendorId }: { id: number; vendorId: number }) =>
      vistaDataService.linkVPVendor(id, vendorId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vista-vp-vendors'] });
      queryClient.invalidateQueries({ queryKey: ['vista-stats'] });
      setLinkModal(null);
      showSuccess('VP Vendor linked successfully');
    },
    onError: (error: any) => {
      showError(error.response?.data?.message || 'Failed to link VP Vendor');
    },
  });

  const unlinkVPVendorMutation = useMutation({
    mutationFn: vistaDataService.unlinkVPVendor,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vista-vp-vendors'] });
      queryClient.invalidateQueries({ queryKey: ['vista-stats'] });
      showSuccess('VP Vendor unlinked');
    },
  });

  // Import to Titan mutations
  const importEmployeesToTitanMutation = useMutation({
    mutationFn: vistaDataService.importUnmatchedEmployeesToTitan,
    onSuccess: (data: ImportToTitanResult) => {
      queryClient.invalidateQueries({ queryKey: ['vista-vp-employees'] });
      queryClient.invalidateQueries({ queryKey: ['vista-employee-duplicates'] });
      queryClient.invalidateQueries({ queryKey: ['vista-stats'] });
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      showSuccess(`Imported ${data.imported} employees to Titan`);
    },
    onError: (error: any) => {
      showError(error.response?.data?.message || 'Failed to import employees');
    },
  });

  const importCustomersToTitanMutation = useMutation({
    mutationFn: vistaDataService.importUnmatchedCustomersToTitan,
    onSuccess: (data: ImportToTitanResult) => {
      queryClient.invalidateQueries({ queryKey: ['vista-vp-customers'] });
      queryClient.invalidateQueries({ queryKey: ['vista-customer-duplicates'] });
      queryClient.invalidateQueries({ queryKey: ['vista-stats'] });
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      showSuccess(`Imported ${data.imported} customers to Titan`);
    },
    onError: (error: any) => {
      showError(error.response?.data?.message || 'Failed to import customers');
    },
  });

  const importVendorsToTitanMutation = useMutation({
    mutationFn: vistaDataService.importUnmatchedVendorsToTitan,
    onSuccess: (data: ImportToTitanResult) => {
      queryClient.invalidateQueries({ queryKey: ['vista-vp-vendors'] });
      queryClient.invalidateQueries({ queryKey: ['vista-vendor-duplicates'] });
      queryClient.invalidateQueries({ queryKey: ['vista-stats'] });
      showSuccess(`Imported ${data.imported} vendors to Titan`);
    },
    onError: (error: any) => {
      showError(error.response?.data?.message || 'Failed to import vendors');
    },
  });

  const importContractsToTitanMutation = useMutation({
    mutationFn: vistaDataService.importUnmatchedContractsToTitan,
    onSuccess: (data: ImportToTitanResult) => {
      queryClient.invalidateQueries({ queryKey: ['vista-contracts'] });
      queryClient.invalidateQueries({ queryKey: ['vista-contract-duplicates'] });
      queryClient.invalidateQueries({ queryKey: ['vista-stats'] });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      showSuccess(`Imported ${data.imported} contracts as Titan projects`);
    },
    onError: (error: any) => {
      showError(error.response?.data?.message || 'Failed to import contracts');
    },
  });

  const importDepartmentsToTitanMutation = useMutation({
    mutationFn: vistaDataService.importUnmatchedDepartmentsToTitan,
    onSuccess: (data: ImportToTitanResult) => {
      queryClient.invalidateQueries({ queryKey: ['vista-department-duplicates'] });
      queryClient.invalidateQueries({ queryKey: ['vista-stats'] });
      queryClient.invalidateQueries({ queryKey: ['departments'] });
      showSuccess(`Imported ${data.imported} departments to Titan`);
    },
    onError: (error: any) => {
      showError(error.response?.data?.message || 'Failed to import departments');
    },
  });

  const linkDepartmentCodeMutation = useMutation({
    mutationFn: ({ departmentCode, departmentId }: { departmentCode: string; departmentId: number }) =>
      vistaDataService.linkDepartmentCode(departmentCode, departmentId),
    onSuccess: (data: LinkDepartmentCodeResult) => {
      queryClient.invalidateQueries({ queryKey: ['vista-department-duplicates'] });
      queryClient.invalidateQueries({ queryKey: ['vista-contracts'] });
      queryClient.invalidateQueries({ queryKey: ['vista-work-orders'] });
      queryClient.invalidateQueries({ queryKey: ['vista-stats'] });
      showSuccess(`Linked department code "${data.department_code}" - updated ${data.contracts_updated} contracts and ${data.work_orders_updated} work orders`);
    },
    onError: (error: any) => {
      showError(error.response?.data?.message || 'Failed to link department code');
    },
  });

  const autoLinkDepartmentsMutation = useMutation({
    mutationFn: vistaDataService.autoLinkExactDepartmentMatches,
    onSuccess: (data: AutoLinkDepartmentsResult) => {
      queryClient.invalidateQueries({ queryKey: ['vista-department-duplicates'] });
      queryClient.invalidateQueries({ queryKey: ['vista-contracts'] });
      queryClient.invalidateQueries({ queryKey: ['vista-work-orders'] });
      queryClient.invalidateQueries({ queryKey: ['vista-stats'] });
      showSuccess(`Auto-linked ${data.codes_linked} department codes - updated ${data.contracts_updated} contracts and ${data.work_orders_updated} work orders`);
    },
    onError: (error: any) => {
      showError(error.response?.data?.message || 'Failed to auto-link departments');
    },
  });

  const showSuccess = (message: string) => {
    setSuccessMessage(message);
    setErrorMessage('');
    setTimeout(() => setSuccessMessage(''), 3000);
  };

  const showError = (message: string) => {
    setErrorMessage(message);
    setSuccessMessage('');
    setTimeout(() => setErrorMessage(''), 5000);
  };

  const openLinkModal = (type: 'contract' | 'work_order' | 'vp_employee' | 'vp_customer' | 'vp_vendor', record: VPContract | VPWorkOrder | VPEmployee | VPCustomer | VPVendor) => {
    setLinkModal({ type, id: record.id, record });
    if (type === 'contract' || type === 'work_order') {
      setLinkForm({
        project_id: (record as VPContract).linked_project_id || undefined,
        employee_id: (record as VPContract | VPWorkOrder).linked_employee_id || undefined,
        customer_id: (record as VPContract | VPWorkOrder).linked_customer_id || undefined,
        department_id: (record as VPContract | VPWorkOrder).linked_department_id || undefined,
      });
    } else if (type === 'vp_employee') {
      setLinkForm({
        employee_id: (record as VPEmployee).linked_employee_id || undefined,
      });
    } else if (type === 'vp_customer') {
      setLinkForm({
        customer_id: (record as VPCustomer).linked_customer_id || undefined,
      });
    }
  };

  const handleLink = () => {
    if (!linkModal) return;

    if (linkModal.type === 'contract') {
      linkContractMutation.mutate({ id: linkModal.id, data: linkForm });
    } else if (linkModal.type === 'work_order') {
      linkWorkOrderMutation.mutate({ id: linkModal.id, data: linkForm });
    } else if (linkModal.type === 'vp_employee' && linkForm.employee_id) {
      linkVPEmployeeMutation.mutate({ id: linkModal.id, employeeId: linkForm.employee_id });
    } else if (linkModal.type === 'vp_customer' && linkForm.customer_id) {
      linkVPCustomerMutation.mutate({ id: linkModal.id, customerId: linkForm.customer_id });
    }
  };

  const formatCurrency = (amount: number | null) => {
    if (amount === null || amount === undefined) return '-';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const getStatusBadge = (status: string) => {
    const colors: Record<string, { bg: string; text: string }> = {
      unmatched: { bg: 'rgba(239, 68, 68, 0.1)', text: '#ef4444' },
      auto_matched: { bg: 'rgba(59, 130, 246, 0.1)', text: '#3b82f6' },
      manual_matched: { bg: 'rgba(16, 185, 129, 0.1)', text: '#10b981' },
      ignored: { bg: 'rgba(107, 114, 128, 0.1)', text: '#6b7280' },
    };
    const style = colors[status] || colors.unmatched;
    return (
      <span style={{
        padding: '4px 8px',
        borderRadius: '4px',
        fontSize: '0.75rem',
        background: style.bg,
        color: style.text,
        textTransform: 'capitalize',
      }}>
        {status.replace('_', ' ')}
      </span>
    );
  };

  if (!isAdmin) {
    return (
      <div className="sales-container">
        <div style={{ textAlign: 'center', padding: '3rem' }}>
          <h2>Access Denied</h2>
          <p style={{ color: 'var(--text-secondary)' }}>Admin privileges required.</p>
        </div>
      </div>
    );
  }

  const isLoading =
    activeTab === 'contracts' ? contractsLoading :
    activeTab === 'work-orders' ? workOrdersLoading :
    activeTab === 'vp-employees' ? vpEmployeesLoading :
    activeTab === 'vp-customers' ? vpCustomersLoading :
    activeTab === 'vp-vendors' ? vpVendorsLoading :
    activeTab === 'duplicates-employees' ? employeeDuplicatesLoading :
    activeTab === 'duplicates-customers' ? customerDuplicatesLoading :
    activeTab === 'duplicates-contracts' ? contractDuplicatesLoading :
    activeTab === 'duplicates-departments' ? departmentDuplicatesLoading :
    activeTab === 'duplicates-vendors' ? vendorDuplicatesLoading :
    false;

  const contractOrWOData = activeTab === 'contracts' ? contracts : workOrders;

  return (
    <div className="sales-container">
      <div className="sales-page-header">
        <div className="sales-page-title">
          <div>
            <h1>Vista Data Linking</h1>
            <div className="sales-subtitle">Link Vista records to Titan entities</div>
          </div>
          <button className="sales-btn" onClick={() => navigate('/settings/vista-data')}>
            Back to Vista Settings
          </button>
        </div>
      </div>

      {/* Messages */}
      {successMessage && (
        <div style={{
          background: 'rgba(16, 185, 129, 0.1)',
          border: '1px solid var(--accent-green)',
          color: 'var(--accent-green)',
          padding: '12px 16px',
          borderRadius: '8px',
          marginBottom: '20px'
        }}>
          {successMessage}
        </div>
      )}
      {errorMessage && (
        <div style={{
          background: 'rgba(239, 68, 68, 0.1)',
          border: '1px solid #ef4444',
          color: '#ef4444',
          padding: '12px 16px',
          borderRadius: '8px',
          marginBottom: '20px'
        }}>
          {errorMessage}
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
        <button
          className={activeTab === 'contracts' ? 'sales-btn-primary' : 'sales-btn'}
          onClick={() => setActiveTab('contracts')}
        >
          Contracts
        </button>
        <button
          className={activeTab === 'work-orders' ? 'sales-btn-primary' : 'sales-btn'}
          onClick={() => setActiveTab('work-orders')}
        >
          Work Orders
        </button>
        <div style={{ borderLeft: '1px solid var(--border-color)', margin: '0 8px' }} />
        <button
          className={activeTab === 'vp-employees' ? 'sales-btn-primary' : 'sales-btn'}
          onClick={() => setActiveTab('vp-employees')}
        >
          VP Employees
        </button>
        <button
          className={activeTab === 'vp-customers' ? 'sales-btn-primary' : 'sales-btn'}
          onClick={() => setActiveTab('vp-customers')}
        >
          VP Customers
        </button>
        <button
          className={activeTab === 'vp-vendors' ? 'sales-btn-primary' : 'sales-btn'}
          onClick={() => setActiveTab('vp-vendors')}
        >
          VP Vendors
        </button>
        <div style={{ borderLeft: '1px solid var(--border-color)', margin: '0 8px' }} />
        <button
          className={activeTab === 'duplicates-employees' ? 'sales-btn-primary' : 'sales-btn'}
          onClick={() => setActiveTab('duplicates-employees')}
          style={{ background: activeTab === 'duplicates-employees' ? undefined : 'rgba(245, 158, 11, 0.1)', borderColor: '#f59e0b' }}
        >
          Employee Matches
        </button>
        <button
          className={activeTab === 'duplicates-customers' ? 'sales-btn-primary' : 'sales-btn'}
          onClick={() => setActiveTab('duplicates-customers')}
          style={{ background: activeTab === 'duplicates-customers' ? undefined : 'rgba(245, 158, 11, 0.1)', borderColor: '#f59e0b' }}
        >
          Customer Matches
        </button>
        <button
          className={activeTab === 'duplicates-contracts' ? 'sales-btn-primary' : 'sales-btn'}
          onClick={() => setActiveTab('duplicates-contracts')}
          style={{ background: activeTab === 'duplicates-contracts' ? undefined : 'rgba(59, 130, 246, 0.1)', borderColor: '#3b82f6' }}
        >
          Contract Matches
        </button>
        <button
          className={activeTab === 'duplicates-departments' ? 'sales-btn-primary' : 'sales-btn'}
          onClick={() => setActiveTab('duplicates-departments')}
          style={{ background: activeTab === 'duplicates-departments' ? undefined : 'rgba(139, 92, 246, 0.1)', borderColor: '#8b5cf6' }}
        >
          Department Matches
        </button>
        <button
          className={activeTab === 'duplicates-vendors' ? 'sales-btn-primary' : 'sales-btn'}
          onClick={() => setActiveTab('duplicates-vendors')}
          style={{ background: activeTab === 'duplicates-vendors' ? undefined : 'rgba(16, 185, 129, 0.1)', borderColor: '#10b981' }}
        >
          Vendor Matches
        </button>
      </div>

      {/* Filters */}
      {!activeTab.startsWith('duplicates') && (
        <div className="sales-chart-card" style={{ marginBottom: '16px' }}>
          <div style={{ display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
            <div>
              <label style={{ fontSize: '0.875rem', marginRight: '8px' }}>Status:</label>
              <select
                value={filter}
                onChange={(e) => setFilter(e.target.value as FilterType)}
                className="sales-input"
                style={{ width: 'auto' }}
              >
                <option value="all">All</option>
                <option value="unmatched">Unmatched</option>
                <option value="auto_matched">Auto Matched</option>
                <option value="manual_matched">Manual Matched</option>
                <option value="ignored">Ignored</option>
              </select>
            </div>
            <div style={{ flex: 1 }}>
              <input
                type="text"
                placeholder="Search by number, description, or customer..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="sales-input"
                style={{ width: '100%', maxWidth: '400px' }}
              />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
                Showing {
                  activeTab === 'contracts' ? contracts?.length || 0 :
                  activeTab === 'work-orders' ? workOrders?.length || 0 :
                  activeTab === 'vp-employees' ? vpEmployees?.length || 0 :
                  activeTab === 'vp-customers' ? vpCustomers?.length || 0 :
                  activeTab === 'vp-vendors' ? vpVendors?.length || 0 : 0
                } records
              </div>
              {activeTab === 'vp-employees' && filter === 'unmatched' && vpEmployees && vpEmployees.length > 0 && (
                <button
                  className="sales-btn-primary"
                  style={{ background: '#10b981', padding: '6px 12px', fontSize: '0.875rem' }}
                  onClick={() => {
                    if (window.confirm(`This will create ${vpEmployees.length} new Titan employees from the unmatched VP employees. Continue?`)) {
                      importEmployeesToTitanMutation.mutate();
                    }
                  }}
                  disabled={importEmployeesToTitanMutation.isPending}
                >
                  {importEmployeesToTitanMutation.isPending ? 'Importing...' : `Import All ${vpEmployees.length} to Titan`}
                </button>
              )}
              {activeTab === 'vp-customers' && filter === 'unmatched' && vpCustomers && vpCustomers.length > 0 && (
                <button
                  className="sales-btn-primary"
                  style={{ background: '#10b981', padding: '6px 12px', fontSize: '0.875rem' }}
                  onClick={() => {
                    if (window.confirm(`This will create ${vpCustomers.length} new Titan customers from the unmatched VP customers. Continue?`)) {
                      importCustomersToTitanMutation.mutate();
                    }
                  }}
                  disabled={importCustomersToTitanMutation.isPending}
                >
                  {importCustomersToTitanMutation.isPending ? 'Importing...' : `Import All ${vpCustomers.length} to Titan`}
                </button>
              )}
              {activeTab === 'vp-vendors' && filter === 'unmatched' && vpVendors && vpVendors.length > 0 && (
                <button
                  className="sales-btn-primary"
                  style={{ background: '#10b981', padding: '6px 12px', fontSize: '0.875rem' }}
                  onClick={() => {
                    if (window.confirm(`This will create ${vpVendors.length} new Titan vendors from the unmatched VP vendors. Continue?`)) {
                      importVendorsToTitanMutation.mutate();
                    }
                  }}
                  disabled={importVendorsToTitanMutation.isPending}
                >
                  {importVendorsToTitanMutation.isPending ? 'Importing...' : `Import All ${vpVendors.length} to Titan`}
                </button>
              )}
              {activeTab === 'contracts' && filter === 'unmatched' && contracts && contracts.length > 0 && (
                <button
                  className="sales-btn-primary"
                  style={{ background: '#3b82f6', padding: '6px 12px', fontSize: '0.875rem' }}
                  onClick={() => {
                    if (window.confirm(`This will create ${contracts.length} new Titan projects from the unmatched VP contracts. Continue?`)) {
                      importContractsToTitanMutation.mutate();
                    }
                  }}
                  disabled={importContractsToTitanMutation.isPending}
                >
                  {importContractsToTitanMutation.isPending ? 'Importing...' : `Import All ${contracts.length} as Projects`}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Duplicates Info Bar */}
      {activeTab.startsWith('duplicates') && (
        <div className="sales-chart-card" style={{ marginBottom: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
            <div style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
              Found {
                activeTab === 'duplicates-employees' ? employeeDuplicates?.length || 0 :
                activeTab === 'duplicates-customers' ? customerDuplicates?.length || 0 :
                activeTab === 'duplicates-contracts' ? contractDuplicates?.length || 0 :
                activeTab === 'duplicates-departments' ? departmentDuplicates?.length || 0 :
                activeTab === 'duplicates-vendors' ? vendorDuplicates?.length || 0 : 0
              } {activeTab === 'duplicates-departments' ? 'VP department codes' : 'unlinked VP records'} with potential Titan matches
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              {activeTab === 'duplicates-employees' && (
                <button
                  className="sales-btn-primary"
                  style={{ background: '#10b981' }}
                  onClick={() => {
                    if (window.confirm('This will create new Titan employees for ALL unmatched VP employees. Continue?')) {
                      importEmployeesToTitanMutation.mutate();
                    }
                  }}
                  disabled={importEmployeesToTitanMutation.isPending || !vpEmployees?.filter((e: VPEmployee) => e.link_status === 'unmatched').length}
                >
                  {importEmployeesToTitanMutation.isPending ? 'Importing...' : 'Import All Unmatched to Titan'}
                </button>
              )}
              {activeTab === 'duplicates-customers' && (
                <button
                  className="sales-btn-primary"
                  style={{ background: '#10b981' }}
                  onClick={() => {
                    if (window.confirm('This will create new Titan customers for ALL unmatched VP customers. Continue?')) {
                      importCustomersToTitanMutation.mutate();
                    }
                  }}
                  disabled={importCustomersToTitanMutation.isPending || !vpCustomers?.filter((c: VPCustomer) => c.link_status === 'unmatched').length}
                >
                  {importCustomersToTitanMutation.isPending ? 'Importing...' : 'Import All Unmatched to Titan'}
                </button>
              )}
              {activeTab === 'duplicates-contracts' && (
                <button
                  className="sales-btn-primary"
                  style={{ background: '#3b82f6' }}
                  onClick={() => {
                    if (window.confirm('This will create new Titan projects for ALL unmatched VP contracts. Continue?')) {
                      importContractsToTitanMutation.mutate();
                    }
                  }}
                  disabled={importContractsToTitanMutation.isPending}
                >
                  {importContractsToTitanMutation.isPending ? 'Importing...' : 'Import All Unmatched as Projects'}
                </button>
              )}
              {activeTab === 'duplicates-departments' && (
                <>
                  <button
                    className="sales-btn-primary"
                    style={{ background: '#10b981' }}
                    onClick={() => {
                      if (window.confirm('This will auto-link all department codes that have exact (100%) matches to Titan departments. Continue?')) {
                        autoLinkDepartmentsMutation.mutate();
                      }
                    }}
                    disabled={autoLinkDepartmentsMutation.isPending}
                  >
                    {autoLinkDepartmentsMutation.isPending ? 'Linking...' : 'Auto-Link 100% Matches'}
                  </button>
                  <button
                    className="sales-btn-primary"
                    style={{ background: '#8b5cf6' }}
                    onClick={() => {
                      if (window.confirm('This will create new Titan departments for ALL unmatched VP department codes. Continue?')) {
                        importDepartmentsToTitanMutation.mutate();
                      }
                    }}
                    disabled={importDepartmentsToTitanMutation.isPending}
                  >
                    {importDepartmentsToTitanMutation.isPending ? 'Importing...' : 'Import All Unmatched Departments'}
                  </button>
                </>
              )}
              {activeTab === 'duplicates-vendors' && (
                <button
                  className="sales-btn-primary"
                  style={{ background: '#10b981' }}
                  onClick={() => {
                    if (window.confirm('This will create new Titan vendors for ALL unmatched VP vendors. Continue?')) {
                      importVendorsToTitanMutation.mutate();
                    }
                  }}
                  disabled={importVendorsToTitanMutation.isPending}
                >
                  {importVendorsToTitanMutation.isPending ? 'Importing...' : 'Import All Unmatched to Titan'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="sales-chart-card">
        {isLoading ? (
          <div style={{ textAlign: 'center', padding: '2rem' }}>Loading...</div>
        ) : (activeTab === 'contracts' || activeTab === 'work-orders') ? (
          // Contracts and Work Orders Table
          contractOrWOData && contractOrWOData.length > 0 ? (
            <div style={{ overflowX: 'auto' }}>
              <table className="sales-table">
                <thead>
                  <tr>
                    <th>{activeTab === 'contracts' ? 'Contract #' : 'WO #'}</th>
                    <th>Description</th>
                    <th>Customer</th>
                    <th>PM</th>
                    <th>Amount</th>
                    <th>Status</th>
                    <th>Links</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {contractOrWOData.map((record: VPContract | VPWorkOrder) => {
                    const isContract = activeTab === 'contracts';
                    const contract = record as VPContract;
                    const workOrder = record as VPWorkOrder;
                    const number = isContract ? contract.contract_number : workOrder.work_order_number;
                    const amount = record.contract_amount;
                    const hasLinks = record.linked_employee_id || record.linked_customer_id || record.linked_department_id ||
                      (isContract && contract.linked_project_id);

                    return (
                      <tr key={record.id}>
                        <td style={{ fontWeight: 500 }}>{number}</td>
                        <td style={{ maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {record.description || '-'}
                        </td>
                        <td>{record.customer_name || '-'}</td>
                        <td>{record.project_manager_name || record.employee_number || '-'}</td>
                        <td>{formatCurrency(amount)}</td>
                        <td>{getStatusBadge(record.link_status)}</td>
                        <td style={{ fontSize: '0.8rem' }}>
                          {hasLinks ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                              {isContract && contract.linked_project_name && (
                                <span>Project: {contract.linked_project_name}</span>
                              )}
                              {record.linked_employee_name && (
                                <span>Employee: {record.linked_employee_name}</span>
                              )}
                              {record.linked_customer_facility && (
                                <span>Customer: {record.linked_customer_facility}</span>
                              )}
                            </div>
                          ) : (
                            <span style={{ color: 'var(--text-secondary)' }}>No links</span>
                          )}
                        </td>
                        <td>
                          <div style={{ display: 'flex', gap: '4px' }}>
                            <button
                              className="sales-btn"
                              style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                              onClick={() => openLinkModal(isContract ? 'contract' : 'work_order', record)}
                            >
                              {hasLinks ? 'Edit' : 'Link'}
                            </button>
                            {record.link_status !== 'ignored' && (
                              <button
                                className="sales-btn"
                                style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                                onClick={() => isContract
                                  ? ignoreContractMutation.mutate(record.id)
                                  : ignoreWorkOrderMutation.mutate(record.id)
                                }
                              >
                                Ignore
                              </button>
                            )}
                            {hasLinks && (
                              <button
                                className="sales-btn"
                                style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                                onClick={() => isContract
                                  ? unlinkContractMutation.mutate(record.id)
                                  : unlinkWorkOrderMutation.mutate(record.id)
                                }
                              >
                                Unlink
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>
              No records found matching your filters.
            </div>
          )
        ) : activeTab === 'vp-employees' ? (
          // VP Employees Table
          vpEmployees && vpEmployees.length > 0 ? (
            <div style={{ overflowX: 'auto' }}>
              <table className="sales-table">
                <thead>
                  <tr>
                    <th>Employee #</th>
                    <th>Name</th>
                    <th>Hire Date</th>
                    <th>Active</th>
                    <th>Status</th>
                    <th>Linked To</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {vpEmployees.map((emp: VPEmployee) => (
                    <tr key={emp.id}>
                      <td style={{ fontWeight: 500 }}>{emp.employee_number}</td>
                      <td>{emp.first_name} {emp.last_name}</td>
                      <td>{emp.hire_date ? new Date(emp.hire_date).toLocaleDateString() : '-'}</td>
                      <td>{emp.active ? 'Yes' : 'No'}</td>
                      <td>{getStatusBadge(emp.link_status)}</td>
                      <td style={{ fontSize: '0.8rem' }}>
                        {emp.linked_employee_name ? (
                          <span>Titan: {emp.linked_employee_name}</span>
                        ) : (
                          <span style={{ color: 'var(--text-secondary)' }}>Not linked</span>
                        )}
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '4px' }}>
                          <button
                            className="sales-btn"
                            style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                            onClick={() => openLinkModal('vp_employee', emp)}
                          >
                            {emp.linked_employee_id ? 'Edit' : 'Link'}
                          </button>
                          {emp.linked_employee_id && (
                            <button
                              className="sales-btn"
                              style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                              onClick={() => unlinkVPEmployeeMutation.mutate(emp.id)}
                            >
                              Unlink
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>
              No VP employees found matching your filters.
            </div>
          )
        ) : activeTab === 'vp-customers' ? (
          // VP Customers Table
          vpCustomers && vpCustomers.length > 0 ? (
            <div style={{ overflowX: 'auto' }}>
              <table className="sales-table">
                <thead>
                  <tr>
                    <th>Customer #</th>
                    <th>Name</th>
                    <th>City</th>
                    <th>State</th>
                    <th>Active</th>
                    <th>Status</th>
                    <th>Linked To</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {vpCustomers.map((cust: VPCustomer) => (
                    <tr key={cust.id}>
                      <td style={{ fontWeight: 500 }}>{cust.customer_number}</td>
                      <td>{cust.name || '-'}</td>
                      <td>{cust.city || '-'}</td>
                      <td>{cust.state || '-'}</td>
                      <td>{cust.active ? 'Yes' : 'No'}</td>
                      <td>{getStatusBadge(cust.link_status)}</td>
                      <td style={{ fontSize: '0.8rem' }}>
                        {cust.linked_customer_owner ? (
                          <span>Titan: {cust.linked_customer_owner}{cust.linked_customer_facility ? ` - ${cust.linked_customer_facility}` : ''}</span>
                        ) : (
                          <span style={{ color: 'var(--text-secondary)' }}>Not linked</span>
                        )}
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '4px' }}>
                          <button
                            className="sales-btn"
                            style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                            onClick={() => openLinkModal('vp_customer', cust)}
                          >
                            {cust.linked_customer_id ? 'Edit' : 'Link'}
                          </button>
                          {cust.linked_customer_id && (
                            <button
                              className="sales-btn"
                              style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                              onClick={() => unlinkVPCustomerMutation.mutate(cust.id)}
                            >
                              Unlink
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>
              No VP customers found matching your filters.
            </div>
          )
        ) : activeTab === 'vp-vendors' ? (
          // VP Vendors Table (view-only for now, no linking target)
          vpVendors && vpVendors.length > 0 ? (
            <div style={{ overflowX: 'auto' }}>
              <table className="sales-table">
                <thead>
                  <tr>
                    <th>Vendor #</th>
                    <th>Name</th>
                    <th>Address</th>
                    <th>City</th>
                    <th>State</th>
                    <th>Active</th>
                  </tr>
                </thead>
                <tbody>
                  {vpVendors.map((vendor: VPVendor) => (
                    <tr key={vendor.id}>
                      <td style={{ fontWeight: 500 }}>{vendor.vendor_number}</td>
                      <td>{vendor.name || '-'}</td>
                      <td>{vendor.address || '-'}</td>
                      <td>{vendor.city || '-'}</td>
                      <td>{vendor.state || '-'}</td>
                      <td>{vendor.active ? 'Yes' : 'No'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>
              No VP vendors found matching your filters.
            </div>
          )
        ) : activeTab === 'duplicates-employees' ? (
          // Employee Duplicates Report
          <div>
            <div style={{ marginBottom: '16px', padding: '12px', background: 'rgba(245, 158, 11, 0.1)', borderRadius: '8px', border: '1px solid rgba(245, 158, 11, 0.3)' }}>
              <strong style={{ color: '#f59e0b' }}>Similarity Report:</strong>
              <span style={{ color: 'var(--text-secondary)', marginLeft: '8px' }}>
                Shows unlinked VP Employees that have similar names to Titan Employees. Click "Link" to create the connection.
              </span>
            </div>
            {employeeDuplicates && employeeDuplicates.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {employeeDuplicates.map((dup: EmployeeDuplicate) => (
                  <div key={dup.vp_id} style={{
                    border: '1px solid var(--border-color)',
                    borderRadius: '8px',
                    padding: '16px',
                    background: 'var(--card-bg)'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: '1rem' }}>
                          VP #{dup.vp_employee_number}: {dup.vp_name}
                        </div>
                        <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                          {dup.vp_active ? 'Active' : 'Inactive'}
                        </div>
                      </div>
                      <span style={{
                        padding: '4px 8px',
                        borderRadius: '4px',
                        fontSize: '0.75rem',
                        background: 'rgba(239, 68, 68, 0.1)',
                        color: '#ef4444'
                      }}>
                        Unlinked
                      </span>
                    </div>
                    <div style={{ fontSize: '0.875rem', marginBottom: '8px', fontWeight: 500 }}>
                      Potential Titan Matches:
                    </div>
                    <table className="sales-table" style={{ fontSize: '0.875rem' }}>
                      <thead>
                        <tr>
                          <th>Similarity</th>
                          <th>Titan Employee</th>
                          <th>Employee #</th>
                          <th>Match Type</th>
                          <th>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {dup.potential_matches.map((match, idx) => (
                          <tr key={idx}>
                            <td>
                              <span style={{
                                padding: '2px 8px',
                                borderRadius: '4px',
                                fontSize: '0.75rem',
                                fontWeight: 600,
                                background: match.similarity >= 0.8 ? 'rgba(16, 185, 129, 0.2)' :
                                           match.similarity >= 0.6 ? 'rgba(245, 158, 11, 0.2)' : 'rgba(239, 68, 68, 0.1)',
                                color: match.similarity >= 0.8 ? '#10b981' :
                                       match.similarity >= 0.6 ? '#f59e0b' : '#ef4444'
                              }}>
                                {Math.round(match.similarity * 100)}%
                              </span>
                            </td>
                            <td style={{ fontWeight: 500 }}>{match.titan_name}</td>
                            <td>{match.titan_employee_number || '-'}</td>
                            <td>
                              {match.last_name_match && (
                                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                                  Last name match
                                </span>
                              )}
                            </td>
                            <td>
                              <button
                                className="sales-btn-primary"
                                style={{ padding: '4px 12px', fontSize: '0.75rem' }}
                                onClick={() => {
                                  linkVPEmployeeMutation.mutate({ id: dup.vp_id, employeeId: match.titan_id });
                                }}
                                disabled={linkVPEmployeeMutation.isPending}
                              >
                                Link
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>
                No potential employee matches found. All VP employees may already be linked, or there are no similar names in Titan.
              </div>
            )}
          </div>
        ) : activeTab === 'duplicates-customers' ? (
          // Customer Duplicates Report
          <div>
            <div style={{ marginBottom: '16px', padding: '12px', background: 'rgba(245, 158, 11, 0.1)', borderRadius: '8px', border: '1px solid rgba(245, 158, 11, 0.3)' }}>
              <strong style={{ color: '#f59e0b' }}>Similarity Report:</strong>
              <span style={{ color: 'var(--text-secondary)', marginLeft: '8px' }}>
                Shows unlinked VP Customers that have similar names to Titan Customers. Click "Link" to create the connection.
              </span>
            </div>
            {customerDuplicates && customerDuplicates.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {customerDuplicates.map((dup: CustomerDuplicate) => (
                  <div key={dup.vp_id} style={{
                    border: '1px solid var(--border-color)',
                    borderRadius: '8px',
                    padding: '16px',
                    background: 'var(--card-bg)'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: '1rem' }}>
                          VP #{dup.vp_customer_number}: {dup.vp_name}
                        </div>
                        <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                          {dup.vp_location || 'No location'} | {dup.vp_active ? 'Active' : 'Inactive'}
                        </div>
                      </div>
                      <span style={{
                        padding: '4px 8px',
                        borderRadius: '4px',
                        fontSize: '0.75rem',
                        background: 'rgba(239, 68, 68, 0.1)',
                        color: '#ef4444'
                      }}>
                        Unlinked
                      </span>
                    </div>
                    <div style={{ fontSize: '0.875rem', marginBottom: '8px', fontWeight: 500 }}>
                      Potential Titan Matches:
                    </div>
                    <table className="sales-table" style={{ fontSize: '0.875rem' }}>
                      <thead>
                        <tr>
                          <th>Similarity</th>
                          <th>Titan Customer</th>
                          <th>Facility</th>
                          <th>Location</th>
                          <th>Matched On</th>
                          <th>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {dup.potential_matches.map((match, idx) => (
                          <tr key={idx}>
                            <td>
                              <span style={{
                                padding: '2px 8px',
                                borderRadius: '4px',
                                fontSize: '0.75rem',
                                fontWeight: 600,
                                background: match.similarity >= 0.8 ? 'rgba(16, 185, 129, 0.2)' :
                                           match.similarity >= 0.6 ? 'rgba(245, 158, 11, 0.2)' : 'rgba(239, 68, 68, 0.1)',
                                color: match.similarity >= 0.8 ? '#10b981' :
                                       match.similarity >= 0.6 ? '#f59e0b' : '#ef4444'
                              }}>
                                {Math.round(match.similarity * 100)}%
                              </span>
                            </td>
                            <td style={{ fontWeight: 500 }}>{match.titan_owner || '-'}</td>
                            <td>{match.titan_facility || '-'}</td>
                            <td>{match.titan_location || '-'}</td>
                            <td>
                              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                                {match.matched_on === 'owner' ? 'Owner name' : 'Facility name'}
                                {match.location_match && ' + Location'}
                              </span>
                            </td>
                            <td>
                              <button
                                className="sales-btn-primary"
                                style={{ padding: '4px 12px', fontSize: '0.75rem' }}
                                onClick={() => {
                                  linkVPCustomerMutation.mutate({ id: dup.vp_id, customerId: match.titan_id });
                                }}
                                disabled={linkVPCustomerMutation.isPending}
                              >
                                Link
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>
                No potential customer matches found. All VP customers may already be linked, or there are no similar names in Titan.
              </div>
            )}
          </div>
        ) : activeTab === 'duplicates-contracts' ? (
          // Contract Duplicates Report (VP Contracts -> Titan Projects)
          <div>
            <div style={{ marginBottom: '16px', padding: '12px', background: 'rgba(59, 130, 246, 0.1)', borderRadius: '8px', border: '1px solid rgba(59, 130, 246, 0.3)' }}>
              <strong style={{ color: '#3b82f6' }}>Contract to Project Matching:</strong>
              <span style={{ color: 'var(--text-secondary)', marginLeft: '8px' }}>
                Shows unlinked VP Contracts that may match Titan Projects by contract number or description. Click "Link" to create the connection.
              </span>
            </div>
            {contractDuplicates && contractDuplicates.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {contractDuplicates.map((dup: ContractDuplicate) => (
                  <div key={dup.vp_id} style={{
                    border: '1px solid var(--border-color)',
                    borderRadius: '8px',
                    padding: '16px',
                    background: 'var(--card-bg)'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: '1rem' }}>
                          VP Contract: {dup.vp_contract_number}
                        </div>
                        <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                          {dup.vp_description || 'No description'} | Customer: {dup.vp_customer || 'N/A'}
                        </div>
                        {dup.vp_amount && (
                          <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                            Amount: {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(dup.vp_amount)}
                          </div>
                        )}
                      </div>
                      <span style={{
                        padding: '4px 8px',
                        borderRadius: '4px',
                        fontSize: '0.75rem',
                        background: 'rgba(239, 68, 68, 0.1)',
                        color: '#ef4444'
                      }}>
                        Unlinked
                      </span>
                    </div>
                    <div style={{ fontSize: '0.875rem', marginBottom: '8px', fontWeight: 500 }}>
                      Potential Titan Projects:
                    </div>
                    <table className="sales-table" style={{ fontSize: '0.875rem' }}>
                      <thead>
                        <tr>
                          <th>Similarity</th>
                          <th>Project #</th>
                          <th>Project Name</th>
                          <th>Customer</th>
                          <th>Match Type</th>
                          <th>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {dup.potential_matches.map((match, idx) => (
                          <tr key={idx}>
                            <td>
                              <span style={{
                                padding: '2px 8px',
                                borderRadius: '4px',
                                fontSize: '0.75rem',
                                fontWeight: 600,
                                background: match.similarity >= 0.8 ? 'rgba(16, 185, 129, 0.2)' :
                                           match.similarity >= 0.6 ? 'rgba(245, 158, 11, 0.2)' : 'rgba(239, 68, 68, 0.1)',
                                color: match.similarity >= 0.8 ? '#10b981' :
                                       match.similarity >= 0.6 ? '#f59e0b' : '#ef4444'
                              }}>
                                {Math.round(match.similarity * 100)}%
                              </span>
                            </td>
                            <td style={{ fontWeight: 500 }}>{match.titan_number || '-'}</td>
                            <td>{match.titan_name || '-'}</td>
                            <td>{match.titan_customer || '-'}</td>
                            <td>
                              {match.exact_number_match && (
                                <span style={{ fontSize: '0.75rem', color: '#10b981', fontWeight: 600 }}>
                                  Exact # match
                                </span>
                              )}
                            </td>
                            <td>
                              <button
                                className="sales-btn-primary"
                                style={{ padding: '4px 12px', fontSize: '0.75rem' }}
                                onClick={() => {
                                  linkContractMutation.mutate({ id: dup.vp_id, data: { project_id: match.titan_id } });
                                }}
                                disabled={linkContractMutation.isPending}
                              >
                                Link
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>
                No potential contract matches found. All VP contracts may already be linked to projects, or there are no similar projects in Titan.
              </div>
            )}
          </div>
        ) : activeTab === 'duplicates-departments' ? (
          // Department Duplicates Report
          <div>
            <div style={{ marginBottom: '16px', padding: '12px', background: 'rgba(139, 92, 246, 0.1)', borderRadius: '8px', border: '1px solid rgba(139, 92, 246, 0.3)' }}>
              <strong style={{ color: '#8b5cf6' }}>Department Code Matching:</strong>
              <span style={{ color: 'var(--text-secondary)', marginLeft: '8px' }}>
                Shows VP department codes from Contracts and Work Orders that may match Titan Departments. Creating a match helps with auto-linking.
              </span>
            </div>
            {departmentDuplicates && departmentDuplicates.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {departmentDuplicates.map((dup: DepartmentDuplicate) => (
                  <div key={dup.vp_department_code} style={{
                    border: '1px solid var(--border-color)',
                    borderRadius: '8px',
                    padding: '16px',
                    background: 'var(--card-bg)'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: '1rem' }}>
                          VP Department Code: {dup.vp_department_code}
                        </div>
                        <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                          Used in {dup.usage_count.contracts} contracts and {dup.usage_count.work_orders} work orders
                        </div>
                      </div>
                    </div>
                    <div style={{ fontSize: '0.875rem', marginBottom: '8px', fontWeight: 500 }}>
                      Potential Titan Departments:
                    </div>
                    <table className="sales-table" style={{ fontSize: '0.875rem' }}>
                      <thead>
                        <tr>
                          <th>Similarity</th>
                          <th>Dept Number</th>
                          <th>Department Name</th>
                          <th>Match Type</th>
                          <th>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {dup.potential_matches.map((match, idx) => (
                          <tr key={idx}>
                            <td>
                              <span style={{
                                padding: '2px 8px',
                                borderRadius: '4px',
                                fontSize: '0.75rem',
                                fontWeight: 600,
                                background: match.similarity >= 0.8 ? 'rgba(16, 185, 129, 0.2)' :
                                           match.similarity >= 0.6 ? 'rgba(245, 158, 11, 0.2)' : 'rgba(239, 68, 68, 0.1)',
                                color: match.similarity >= 0.8 ? '#10b981' :
                                       match.similarity >= 0.6 ? '#f59e0b' : '#ef4444'
                              }}>
                                {Math.round(match.similarity * 100)}%
                              </span>
                            </td>
                            <td style={{ fontWeight: 500 }}>{match.titan_number || '-'}</td>
                            <td>{match.titan_name || '-'}</td>
                            <td>
                              {match.exact_match && (
                                <span style={{ fontSize: '0.75rem', color: '#10b981', fontWeight: 600 }}>
                                  Exact match
                                </span>
                              )}
                            </td>
                            <td>
                              <button
                                className="sales-btn-primary"
                                style={{ padding: '4px 12px', fontSize: '0.75rem' }}
                                onClick={() => {
                                  linkDepartmentCodeMutation.mutate({
                                    departmentCode: dup.vp_department_code,
                                    departmentId: match.titan_id
                                  });
                                }}
                                disabled={linkDepartmentCodeMutation.isPending}
                              >
                                Link
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>
                No department code matches found. All VP department codes already exist in Titan, or there are no matching departments.
              </div>
            )}
          </div>
        ) : activeTab === 'duplicates-vendors' ? (
          // Vendor Duplicates Report
          <div>
            <div style={{ marginBottom: '16px', padding: '12px', background: 'rgba(16, 185, 129, 0.1)', borderRadius: '8px', border: '1px solid rgba(16, 185, 129, 0.3)' }}>
              <strong style={{ color: '#10b981' }}>Vendor Matching:</strong>
              <span style={{ color: 'var(--text-secondary)', marginLeft: '8px' }}>
                Shows unlinked VP Vendors that have similar names to Titan Vendors. Click "Link" to create the connection.
              </span>
            </div>
            {vendorDuplicates && vendorDuplicates.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {vendorDuplicates.map((dup: VendorDuplicate) => (
                  <div key={dup.vp_id} style={{
                    border: '1px solid var(--border-color)',
                    borderRadius: '8px',
                    padding: '16px',
                    background: 'var(--card-bg)'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: '1rem' }}>
                          VP #{dup.vp_vendor_number}: {dup.vp_name}
                        </div>
                        <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                          {dup.vp_location || 'No location'} | {dup.vp_active ? 'Active' : 'Inactive'}
                        </div>
                      </div>
                      <span style={{
                        padding: '4px 8px',
                        borderRadius: '4px',
                        fontSize: '0.75rem',
                        background: 'rgba(239, 68, 68, 0.1)',
                        color: '#ef4444'
                      }}>
                        Unlinked
                      </span>
                    </div>
                    <div style={{ fontSize: '0.875rem', marginBottom: '8px', fontWeight: 500 }}>
                      Potential Titan Vendors:
                    </div>
                    <table className="sales-table" style={{ fontSize: '0.875rem' }}>
                      <thead>
                        <tr>
                          <th>Similarity</th>
                          <th>Vendor Name</th>
                          <th>Company Name</th>
                          <th>Location</th>
                          <th>Matched On</th>
                          <th>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {dup.potential_matches.map((match, idx) => (
                          <tr key={idx}>
                            <td>
                              <span style={{
                                padding: '2px 8px',
                                borderRadius: '4px',
                                fontSize: '0.75rem',
                                fontWeight: 600,
                                background: match.similarity >= 0.8 ? 'rgba(16, 185, 129, 0.2)' :
                                           match.similarity >= 0.6 ? 'rgba(245, 158, 11, 0.2)' : 'rgba(239, 68, 68, 0.1)',
                                color: match.similarity >= 0.8 ? '#10b981' :
                                       match.similarity >= 0.6 ? '#f59e0b' : '#ef4444'
                              }}>
                                {Math.round(match.similarity * 100)}%
                              </span>
                            </td>
                            <td style={{ fontWeight: 500 }}>{match.titan_vendor_name || '-'}</td>
                            <td>{match.titan_company_name || '-'}</td>
                            <td>{match.titan_location || '-'}</td>
                            <td>
                              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                                {match.matched_on === 'vendor_name' ? 'Vendor name' : 'Company name'}
                                {match.location_match && ' + Location'}
                              </span>
                            </td>
                            <td>
                              <button
                                className="sales-btn-primary"
                                style={{ padding: '4px 12px', fontSize: '0.75rem' }}
                                onClick={() => {
                                  linkVPVendorMutation.mutate({ id: dup.vp_id, vendorId: match.titan_id });
                                }}
                                disabled={linkVPVendorMutation.isPending}
                              >
                                Link
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>
                No potential vendor matches found. All VP vendors may already be linked, or there are no similar vendors in Titan.
              </div>
            )}
          </div>
        ) : null}
      </div>

      {/* Link Modal */}
      {linkModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
        }}>
          <div style={{
            background: 'var(--card-bg)',
            borderRadius: '12px',
            padding: '24px',
            width: '500px',
            maxHeight: '80vh',
            overflow: 'auto',
          }}>
            <h3 style={{ marginBottom: '16px' }}>
              Link {linkModal.type === 'contract' ? 'Contract' :
                    linkModal.type === 'work_order' ? 'Work Order' :
                    linkModal.type === 'vp_employee' ? 'VP Employee' :
                    linkModal.type === 'vp_customer' ? 'VP Customer' : 'Record'}
            </h3>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '16px', fontSize: '0.875rem' }}>
              {linkModal.type === 'contract'
                ? `${(linkModal.record as VPContract).contract_number}: ${(linkModal.record as VPContract).description || 'No description'}`
                : linkModal.type === 'work_order'
                ? `${(linkModal.record as VPWorkOrder).work_order_number}: ${(linkModal.record as VPWorkOrder).description || 'No description'}`
                : linkModal.type === 'vp_employee'
                ? `#${(linkModal.record as VPEmployee).employee_number}: ${(linkModal.record as VPEmployee).first_name} ${(linkModal.record as VPEmployee).last_name}`
                : linkModal.type === 'vp_customer'
                ? `#${(linkModal.record as VPCustomer).customer_number}: ${(linkModal.record as VPCustomer).name}`
                : ''
              }
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Contract/Work Order linking fields */}
              {(linkModal.type === 'contract' || linkModal.type === 'work_order') && (
                <>
                  {linkModal.type === 'contract' && (
                    <div>
                      <label style={{ display: 'block', marginBottom: '4px', fontWeight: 500 }}>Project</label>
                      <select
                        value={linkForm.project_id || ''}
                        onChange={(e) => setLinkForm({ ...linkForm, project_id: e.target.value ? Number(e.target.value) : undefined })}
                        className="sales-input"
                        style={{ width: '100%' }}
                      >
                        <option value="">-- Select Project --</option>
                        {projects?.map((p: any) => (
                          <option key={p.id} value={p.id}>{p.number} - {p.name}</option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div>
                    <label style={{ display: 'block', marginBottom: '4px', fontWeight: 500 }}>Employee (PM)</label>
                    <select
                      value={linkForm.employee_id || ''}
                      onChange={(e) => setLinkForm({ ...linkForm, employee_id: e.target.value ? Number(e.target.value) : undefined })}
                      className="sales-input"
                      style={{ width: '100%' }}
                    >
                      <option value="">-- Select Employee --</option>
                      {employees?.map((e: any) => (
                        <option key={e.id} value={e.id}>
                          {e.first_name} {e.last_name} {e.employee_number ? `(${e.employee_number})` : ''}
                        </option>
                      ))}
                    </select>
                    {(linkModal.record as VPContract | VPWorkOrder).employee_number && (
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                        Vista Employee #: {(linkModal.record as VPContract | VPWorkOrder).employee_number}
                      </div>
                    )}
                  </div>

                  <div>
                    <label style={{ display: 'block', marginBottom: '4px', fontWeight: 500 }}>Customer</label>
                    <select
                      value={linkForm.customer_id || ''}
                      onChange={(e) => setLinkForm({ ...linkForm, customer_id: e.target.value ? Number(e.target.value) : undefined })}
                      className="sales-input"
                      style={{ width: '100%' }}
                    >
                      <option value="">-- Select Customer --</option>
                      {customers?.map((c: any) => (
                        <option key={c.id} value={c.id}>{c.customer_owner} - {c.customer_facility}</option>
                      ))}
                    </select>
                    {(linkModal.record as VPContract | VPWorkOrder).customer_name && (
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                        Vista Customer: {(linkModal.record as VPContract | VPWorkOrder).customer_name}
                      </div>
                    )}
                  </div>

                  <div>
                    <label style={{ display: 'block', marginBottom: '4px', fontWeight: 500 }}>Department</label>
                    <select
                      value={linkForm.department_id || ''}
                      onChange={(e) => setLinkForm({ ...linkForm, department_id: e.target.value ? Number(e.target.value) : undefined })}
                      className="sales-input"
                      style={{ width: '100%' }}
                    >
                      <option value="">-- Select Department --</option>
                      {departments?.map((d: any) => (
                        <option key={d.id} value={d.id}>
                          {d.department_number ? `${d.department_number} - ` : ''}{d.name}
                        </option>
                      ))}
                    </select>
                    {(linkModal.record as VPContract | VPWorkOrder).department_code && (
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                        Vista Department: {(linkModal.record as VPContract | VPWorkOrder).department_code}
                      </div>
                    )}
                  </div>
                </>
              )}

              {/* VP Employee linking field */}
              {linkModal.type === 'vp_employee' && (
                <div>
                  <label style={{ display: 'block', marginBottom: '4px', fontWeight: 500 }}>Link to Titan Employee</label>
                  <select
                    value={linkForm.employee_id || ''}
                    onChange={(e) => setLinkForm({ ...linkForm, employee_id: e.target.value ? Number(e.target.value) : undefined })}
                    className="sales-input"
                    style={{ width: '100%' }}
                  >
                    <option value="">-- Select Titan Employee --</option>
                    {employees?.map((e: any) => (
                      <option key={e.id} value={e.id}>
                        {e.first_name} {e.last_name} {e.employee_number ? `(#${e.employee_number})` : ''}
                      </option>
                    ))}
                  </select>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '8px' }}>
                    <strong>Vista Employee:</strong> #{(linkModal.record as VPEmployee).employee_number} - {(linkModal.record as VPEmployee).first_name} {(linkModal.record as VPEmployee).last_name}
                  </div>
                </div>
              )}

              {/* VP Customer linking field */}
              {linkModal.type === 'vp_customer' && (
                <div>
                  <label style={{ display: 'block', marginBottom: '4px', fontWeight: 500 }}>Link to Titan Customer</label>
                  <select
                    value={linkForm.customer_id || ''}
                    onChange={(e) => setLinkForm({ ...linkForm, customer_id: e.target.value ? Number(e.target.value) : undefined })}
                    className="sales-input"
                    style={{ width: '100%' }}
                  >
                    <option value="">-- Select Titan Customer --</option>
                    {customers?.map((c: any) => (
                      <option key={c.id} value={c.id}>{c.customer_owner} - {c.customer_facility}</option>
                    ))}
                  </select>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '8px' }}>
                    <strong>Vista Customer:</strong> #{(linkModal.record as VPCustomer).customer_number} - {(linkModal.record as VPCustomer).name}
                    {(linkModal.record as VPCustomer).city && `, ${(linkModal.record as VPCustomer).city}`}
                    {(linkModal.record as VPCustomer).state && `, ${(linkModal.record as VPCustomer).state}`}
                  </div>
                </div>
              )}
            </div>

            <div style={{ display: 'flex', gap: '12px', marginTop: '24px', justifyContent: 'flex-end' }}>
              <button className="sales-btn" onClick={() => setLinkModal(null)}>
                Cancel
              </button>
              <button
                className="sales-btn-primary"
                onClick={handleLink}
                disabled={
                  linkContractMutation.isPending ||
                  linkWorkOrderMutation.isPending ||
                  linkVPEmployeeMutation.isPending ||
                  linkVPCustomerMutation.isPending
                }
              >
                {(linkContractMutation.isPending ||
                  linkWorkOrderMutation.isPending ||
                  linkVPEmployeeMutation.isPending ||
                  linkVPCustomerMutation.isPending) ? 'Saving...' : 'Save Link'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default VistaLinkingManager;
