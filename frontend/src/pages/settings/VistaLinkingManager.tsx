import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { vistaDataService, VPContract, VPWorkOrder, VPEmployee, VPCustomer, VPVendor, LinkData, EmployeeDuplicate, CustomerDuplicate, ContractDuplicate, DepartmentDuplicate, VendorDuplicate, ImportToTitanResult, LinkDepartmentCodeResult, AutoLinkDepartmentsResult, AutoLinkCustomersResult, AutoLinkVendorsResult, VPStats, TitanOnlyProject, TitanOnlyEmployee, TitanOnlyCustomer, TitanOnlyVendor, TitanDuplicate } from '../../services/vistaData';
import { projectsApi } from '../../services/projects';
import { employeesApi } from '../../services/employees';
import { customersApi } from '../../services/customers';
import { departmentsApi } from '../../services/departments';
import '../../styles/SalesPipeline.css';

type EntityType = 'contracts' | 'work-orders' | 'employees' | 'customers' | 'vendors' | 'departments' | 'facilities';
type FilterType = 'all' | 'unmatched' | 'auto_matched' | 'manual_matched' | 'ignored' | 'titan_only';
type ViewMode = 'matches' | 'data';

interface LinkModalData {
  type: 'contract' | 'work_order' | 'vp_employee' | 'vp_customer' | 'vp_vendor';
  id: number;
  record: VPContract | VPWorkOrder | VPEmployee | VPCustomer | VPVendor;
}

interface EntityCardProps {
  title: string;
  icon: string;
  color: string;
  stats: {
    vistaCount: number;
    titanCount: number;
    linked: number;
    vistaUnlinked: number;
    titanUnlinked: number;
    potentialMatches?: number;
  };
  vistaLabel?: string;
  titanLabel?: string;
  isExpanded: boolean;
  isLoading: boolean;
  onToggle: () => void;
  actions?: React.ReactNode;
}

const EntityCard: React.FC<EntityCardProps> = ({
  title, icon, color, stats, vistaLabel = 'Vista', titanLabel = 'Titan', isExpanded, isLoading, onToggle, actions
}) => (
  <div
    style={{
      border: `2px solid ${isExpanded ? color : 'var(--border-color)'}`,
      borderRadius: '12px',
      background: isExpanded ? `${color}08` : 'var(--card-bg)',
      cursor: 'pointer',
      transition: 'all 0.2s ease',
    }}
  >
    <div
      onClick={onToggle}
      style={{
        padding: '16px',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '1.5rem' }}>{icon}</span>
          <span style={{ fontWeight: 600, fontSize: '1.1rem' }}>{title}</span>
        </div>
        <span style={{
          transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
          transition: 'transform 0.2s ease',
          fontSize: '1.25rem',
          color: 'var(--text-secondary)',
        }}>
          ▼
        </span>
      </div>

      {isLoading ? (
        <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Loading...</div>
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          {/* Vista side */}
          <div style={{
            background: 'rgba(99, 102, 241, 0.1)',
            borderRadius: '8px',
            padding: '8px 12px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            minWidth: '70px',
          }}>
            <span style={{ fontSize: '1.25rem', fontWeight: 700, color: '#6366f1' }}>{stats.vistaCount.toLocaleString()}</span>
            <span style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>{vistaLabel}</span>
          </div>

          {/* Arrow and linked count */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ color: 'var(--text-secondary)', fontSize: '1.25rem' }}>→</span>
            <div style={{
              background: stats.linked > 0 ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
              borderRadius: '8px',
              padding: '8px 12px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              minWidth: '70px',
            }}>
              <span style={{ fontSize: '1.25rem', fontWeight: 700, color: stats.linked > 0 ? '#10b981' : '#ef4444' }}>{stats.linked.toLocaleString()}</span>
              <span style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Linked</span>
            </div>
            <span style={{ color: 'var(--text-secondary)', fontSize: '1.25rem' }}>←</span>
          </div>

          {/* Titan side */}
          <div style={{
            background: 'rgba(245, 158, 11, 0.1)',
            borderRadius: '8px',
            padding: '8px 12px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            minWidth: '70px',
          }}>
            <span style={{ fontSize: '1.25rem', fontWeight: 700, color: '#f59e0b' }}>{stats.titanCount.toLocaleString()}</span>
            <span style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>{titanLabel}</span>
          </div>

          {/* Unlinked counts */}
          {(stats.vistaUnlinked > 0 || stats.titanUnlinked > 0) && (
            <div style={{
              marginLeft: '8px',
              display: 'flex',
              flexDirection: 'column',
              gap: '2px',
              fontSize: '0.75rem',
            }}>
              {stats.vistaUnlinked > 0 && (
                <span style={{ color: '#ef4444' }}>
                  {stats.vistaUnlinked.toLocaleString()} {vistaLabel} unlinked
                </span>
              )}
              {stats.titanUnlinked > 0 && (
                <span style={{ color: '#f59e0b' }}>
                  {stats.titanUnlinked.toLocaleString()} {titanLabel} unlinked
                </span>
              )}
            </div>
          )}

          {/* Potential matches */}
          {stats.potentialMatches !== undefined && stats.potentialMatches > 0 && (
            <div style={{
              marginLeft: 'auto',
              background: 'rgba(245, 158, 11, 0.2)',
              borderRadius: '8px',
              padding: '6px 10px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}>
              <span style={{ fontSize: '1rem', fontWeight: 700, color: '#f59e0b' }}>{stats.potentialMatches}</span>
              <span style={{ fontSize: '0.7rem', color: '#f59e0b', textTransform: 'uppercase' }}>Matches</span>
            </div>
          )}
        </div>
      )}
    </div>

    {actions && (
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          padding: '12px 16px',
          borderTop: '1px solid var(--border-color)',
          display: 'flex',
          gap: '8px',
          flexWrap: 'wrap',
        }}
      >
        {actions}
      </div>
    )}
  </div>
);

const VistaLinkingManager: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();

  const [expandedEntity, setExpandedEntity] = useState<EntityType | null>(
    (searchParams.get('entity') as EntityType) || null
  );
  const [viewMode, setViewMode] = useState<ViewMode>('matches');
  const [filter, setFilter] = useState<FilterType>('unmatched');
  const [search, setSearch] = useState('');
  const [linkModal, setLinkModal] = useState<LinkModalData | null>(null);
  const [linkForm, setLinkForm] = useState<LinkData>({});
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const isAdmin = user?.role === 'admin';

  // Update URL when entity changes
  useEffect(() => {
    if (expandedEntity) {
      setSearchParams({ entity: expandedEntity });
    } else {
      setSearchParams({});
    }
  }, [expandedEntity, setSearchParams]);

  // Stats query
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['vista-stats'],
    queryFn: vistaDataService.getStats,
  });

  // Data queries - only fetch when entity is expanded
  const { data: contracts, isLoading: contractsLoading } = useQuery({
    queryKey: ['vista-contracts', filter, search],
    queryFn: () => vistaDataService.getAllContracts({
      link_status: filter === 'all' ? undefined : filter,
      search: search || undefined,
      limit: 5000,
    }),
    enabled: expandedEntity === 'contracts' && viewMode === 'data',
  });

  const { data: workOrders, isLoading: workOrdersLoading } = useQuery({
    queryKey: ['vista-work-orders', filter, search],
    queryFn: () => vistaDataService.getAllWorkOrders({
      link_status: filter === 'all' ? undefined : filter,
      search: search || undefined,
      limit: 5000,
    }),
    enabled: expandedEntity === 'work-orders' && viewMode === 'data',
  });

  const { data: vpEmployees, isLoading: vpEmployeesLoading } = useQuery({
    queryKey: ['vista-vp-employees', filter, search],
    queryFn: () => vistaDataService.getAllVPEmployees({
      link_status: filter === 'all' ? undefined : filter,
      search: search || undefined,
      limit: 5000,
    }),
    enabled: expandedEntity === 'employees' && viewMode === 'data',
  });

  const { data: vpCustomers, isLoading: vpCustomersLoading } = useQuery({
    queryKey: ['vista-vp-customers', filter, search],
    queryFn: () => vistaDataService.getAllVPCustomers({
      link_status: filter === 'all' ? undefined : filter,
      search: search || undefined,
      limit: 5000,
    }),
    enabled: expandedEntity === 'customers' && viewMode === 'data',
  });

  const { data: vpVendors, isLoading: vpVendorsLoading } = useQuery({
    queryKey: ['vista-vp-vendors', filter, search],
    queryFn: () => vistaDataService.getAllVPVendors({
      link_status: filter === 'all' ? undefined : filter,
      search: search || undefined,
      limit: 5000,
    }),
    enabled: expandedEntity === 'vendors' && viewMode === 'data',
  });

  // Duplicates queries - fetch when entity is expanded for matches view
  const { data: contractDuplicates, isLoading: contractDuplicatesLoading } = useQuery({
    queryKey: ['vista-contract-duplicates'],
    queryFn: () => vistaDataService.getContractDuplicates(0.5),
    enabled: expandedEntity === 'contracts' && viewMode === 'matches',
  });

  const { data: employeeDuplicates, isLoading: employeeDuplicatesLoading } = useQuery({
    queryKey: ['vista-employee-duplicates'],
    queryFn: () => vistaDataService.getEmployeeDuplicates(0.5),
    enabled: expandedEntity === 'employees' && viewMode === 'matches',
  });

  const { data: customerDuplicates, isLoading: customerDuplicatesLoading } = useQuery({
    queryKey: ['vista-customer-duplicates'],
    queryFn: () => vistaDataService.getCustomerDuplicates(0.5),
    enabled: expandedEntity === 'customers' && viewMode === 'matches',
  });

  const { data: vendorDuplicates, isLoading: vendorDuplicatesLoading } = useQuery({
    queryKey: ['vista-vendor-duplicates'],
    queryFn: () => vistaDataService.getVendorDuplicates(0.5),
    enabled: expandedEntity === 'vendors' && viewMode === 'matches',
  });

  const { data: departmentDuplicates, isLoading: departmentDuplicatesLoading } = useQuery({
    queryKey: ['vista-department-duplicates'],
    queryFn: () => vistaDataService.getDepartmentDuplicates(0.5),
    enabled: expandedEntity === 'departments',
  });

  // Titan-only queries - records in Titan not linked to Vista
  const { data: titanOnlyProjects, isLoading: titanOnlyProjectsLoading } = useQuery({
    queryKey: ['titan-only-projects'],
    queryFn: () => vistaDataService.getTitanOnlyProjects(),
    enabled: expandedEntity === 'contracts' && filter === 'titan_only',
  });

  const { data: titanOnlyEmployees, isLoading: titanOnlyEmployeesLoading } = useQuery({
    queryKey: ['titan-only-employees'],
    queryFn: () => vistaDataService.getTitanOnlyEmployees(),
    enabled: expandedEntity === 'employees' && filter === 'titan_only',
  });

  const { data: titanOnlyCustomers, isLoading: titanOnlyCustomersLoading } = useQuery({
    queryKey: ['titan-only-customers'],
    queryFn: () => vistaDataService.getTitanOnlyCustomers(),
    enabled: expandedEntity === 'customers' && filter === 'titan_only',
  });

  const { data: titanOnlyVendors, isLoading: titanOnlyVendorsLoading } = useQuery({
    queryKey: ['titan-only-vendors'],
    queryFn: () => vistaDataService.getTitanOnlyVendors(),
    enabled: expandedEntity === 'vendors' && filter === 'titan_only',
  });

  // Reference data for linking
  const { data: projects } = useQuery({
    queryKey: ['projects'],
    queryFn: async () => {
      const response = await projectsApi.getAll();
      return response.data as any[];
    },
    enabled: expandedEntity === 'contracts',
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

  // === MUTATIONS ===

  // Contract mutations
  const linkContractMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: LinkData }) =>
      vistaDataService.linkContract(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vista-contracts'] });
      queryClient.invalidateQueries({ queryKey: ['vista-contract-duplicates'] });
      queryClient.invalidateQueries({ queryKey: ['vista-stats'] });
      setLinkModal(null);
      showSuccess('Contract linked successfully');
    },
    onError: (error: any) => {
      showError(error.response?.data?.message || 'Failed to link contract');
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

  const ignoreContractMutation = useMutation({
    mutationFn: vistaDataService.ignoreContract,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vista-contracts'] });
      queryClient.invalidateQueries({ queryKey: ['vista-stats'] });
      showSuccess('Contract marked as ignored');
    },
  });

  // Work Order mutations
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

  const unlinkWorkOrderMutation = useMutation({
    mutationFn: vistaDataService.unlinkWorkOrder,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vista-work-orders'] });
      queryClient.invalidateQueries({ queryKey: ['vista-stats'] });
      showSuccess('Work order unlinked');
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

  // Employee mutations
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

  // Customer mutations
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

  // Vendor mutations
  const linkVPVendorMutation = useMutation({
    mutationFn: ({ id, vendorId }: { id: number; vendorId: number }) =>
      vistaDataService.linkVPVendor(id, vendorId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vista-vp-vendors'] });
      queryClient.invalidateQueries({ queryKey: ['vista-vendor-duplicates'] });
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

  // Import mutations
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

  const importWorkOrdersToTitanMutation = useMutation({
    mutationFn: vistaDataService.importUnmatchedWorkOrdersToTitan,
    onSuccess: (data: ImportToTitanResult) => {
      queryClient.invalidateQueries({ queryKey: ['vista-work-orders'] });
      queryClient.invalidateQueries({ queryKey: ['vista-stats'] });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      showSuccess(`Imported ${data.imported} work orders as Titan projects`);
    },
    onError: (error: any) => {
      showError(error.response?.data?.message || 'Failed to import work orders');
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

  // Auto-link mutations
  const autoLinkDepartmentsMutation = useMutation({
    mutationFn: vistaDataService.autoLinkExactDepartmentMatches,
    onSuccess: async (data: AutoLinkDepartmentsResult) => {
      await queryClient.refetchQueries({ queryKey: ['vista-department-duplicates'] });
      queryClient.invalidateQueries({ queryKey: ['vista-contracts'] });
      queryClient.invalidateQueries({ queryKey: ['vista-work-orders'] });
      queryClient.invalidateQueries({ queryKey: ['vista-stats'] });
      showSuccess(`Auto-linked ${data.codes_linked} department codes`);
    },
    onError: (error: any) => {
      showError(error.response?.data?.message || 'Failed to auto-link departments');
    },
  });

  const autoLinkCustomersMutation = useMutation({
    mutationFn: vistaDataService.autoLinkExactCustomerMatches,
    onSuccess: async (data: AutoLinkCustomersResult) => {
      await queryClient.refetchQueries({ queryKey: ['vista-customer-duplicates'] });
      await queryClient.refetchQueries({ queryKey: ['vista-vp-customers'] });
      queryClient.invalidateQueries({ queryKey: ['vista-stats'] });
      showSuccess(`Auto-linked ${data.customers_linked} customers (100% matches)`);
    },
    onError: (error: any) => {
      showError(error.response?.data?.message || 'Failed to auto-link customers');
    },
  });

  const autoLinkAllCustomersMutation = useMutation({
    mutationFn: vistaDataService.autoLinkAllCustomerMatches,
    onSuccess: async (data: AutoLinkCustomersResult) => {
      await queryClient.refetchQueries({ queryKey: ['vista-customer-duplicates'] });
      await queryClient.refetchQueries({ queryKey: ['vista-vp-customers'] });
      queryClient.invalidateQueries({ queryKey: ['vista-stats'] });
      showSuccess(`Auto-linked ${data.customers_linked} customers (all matches)`);
    },
    onError: (error: any) => {
      showError(error.response?.data?.message || 'Failed to auto-link customers');
    },
  });

  const autoLinkVendorsMutation = useMutation({
    mutationFn: vistaDataService.autoLinkExactVendorMatches,
    onSuccess: async (data: AutoLinkVendorsResult) => {
      await queryClient.refetchQueries({ queryKey: ['vista-vendor-duplicates'] });
      await queryClient.refetchQueries({ queryKey: ['vista-vp-vendors'] });
      queryClient.invalidateQueries({ queryKey: ['vista-stats'] });
      showSuccess(`Auto-linked ${data.vendors_linked} vendors (100% matches)`);
    },
    onError: (error: any) => {
      showError(error.response?.data?.message || 'Failed to auto-link vendors');
    },
  });

  // DELETE Titan-only mutations
  const deleteTitanOnlyCustomersMutation = useMutation({
    mutationFn: vistaDataService.deleteTitanOnlyCustomers,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['titan-only-customers'] });
      queryClient.invalidateQueries({ queryKey: ['vista-stats'] });
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      showSuccess(`Deleted ${data.deleted} Titan-only customers`);
    },
    onError: (error: any) => {
      showError(error.response?.data?.message || 'Failed to delete Titan-only customers');
    },
  });

  const deleteTitanOnlyEmployeesMutation = useMutation({
    mutationFn: vistaDataService.deleteTitanOnlyEmployees,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['titan-only-employees'] });
      queryClient.invalidateQueries({ queryKey: ['vista-stats'] });
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      showSuccess(`Deleted ${data.deleted} Titan-only employees`);
    },
    onError: (error: any) => {
      showError(error.response?.data?.message || 'Failed to delete Titan-only employees');
    },
  });

  const deleteTitanOnlyProjectsMutation = useMutation({
    mutationFn: vistaDataService.deleteTitanOnlyProjects,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['titan-only-projects'] });
      queryClient.invalidateQueries({ queryKey: ['vista-stats'] });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      showSuccess(`Deleted ${data.deleted} Titan-only projects`);
    },
    onError: (error: any) => {
      showError(error.response?.data?.message || 'Failed to delete Titan-only projects');
    },
  });

  const deleteTitanOnlyVendorsMutation = useMutation({
    mutationFn: vistaDataService.deleteTitanOnlyVendors,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['titan-only-vendors'] });
      queryClient.invalidateQueries({ queryKey: ['vista-stats'] });
      showSuccess(`Deleted ${data.deleted} Titan-only vendors`);
    },
    onError: (error: any) => {
      showError(error.response?.data?.message || 'Failed to delete Titan-only vendors');
    },
  });

  // Auto-link 100% matches mutations
  const autoLinkContractsMutation = useMutation({
    mutationFn: vistaDataService.autoLinkExactContractMatches,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['vista-contracts'] });
      queryClient.invalidateQueries({ queryKey: ['vista-contract-duplicates'] });
      queryClient.invalidateQueries({ queryKey: ['vista-stats'] });
      queryClient.invalidateQueries({ queryKey: ['titan-only-projects'] });
      showSuccess(`Auto-linked ${data.contracts_linked} contracts by number`);
    },
    onError: (error: any) => {
      showError(error.response?.data?.message || 'Failed to auto-link contracts');
    },
  });

  const autoLinkEmployeesMutation = useMutation({
    mutationFn: vistaDataService.autoLinkExactEmployeeMatches,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['vista-vp-employees'] });
      queryClient.invalidateQueries({ queryKey: ['vista-employee-duplicates'] });
      queryClient.invalidateQueries({ queryKey: ['vista-stats'] });
      queryClient.invalidateQueries({ queryKey: ['titan-only-employees'] });
      showSuccess(`Auto-linked ${data.employees_linked} employees by number`);
    },
    onError: (error: any) => {
      showError(error.response?.data?.message || 'Failed to auto-link employees');
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
      showSuccess(`Linked "${data.department_code}" - updated ${data.total_updated} records`);
    },
    onError: (error: any) => {
      showError(error.response?.data?.message || 'Failed to link department code');
    },
  });

  // === HELPERS ===

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
      setLinkForm({ employee_id: (record as VPEmployee).linked_employee_id || undefined });
    } else if (type === 'vp_customer') {
      setLinkForm({ customer_id: (record as VPCustomer).linked_customer_id || undefined });
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

  const getSimilarityBadge = (similarity: number) => {
    const bg = similarity >= 0.8 ? 'rgba(16, 185, 129, 0.2)' :
               similarity >= 0.6 ? 'rgba(245, 158, 11, 0.2)' : 'rgba(239, 68, 68, 0.1)';
    const color = similarity >= 0.8 ? '#10b981' :
                  similarity >= 0.6 ? '#f59e0b' : '#ef4444';
    return (
      <span style={{
        padding: '2px 8px',
        borderRadius: '4px',
        fontSize: '0.75rem',
        fontWeight: 600,
        background: bg,
        color: color,
      }}>
        {Math.round(similarity * 100)}%
      </span>
    );
  };

  const toggleEntity = (entity: EntityType) => {
    if (expandedEntity === entity) {
      setExpandedEntity(null);
    } else {
      setExpandedEntity(entity);
      setViewMode('matches');
      setFilter('unmatched');
      setSearch('');
    }
  };

  // === RENDER ===

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

  // Calculate stats for each entity - showing Vista vs Titan comparison
  const getEntityStats = (entity: EntityType) => {
    const defaultStats = { vistaCount: 0, titanCount: 0, linked: 0, vistaUnlinked: 0, titanUnlinked: 0, potentialMatches: 0 };
    if (!stats) return defaultStats;

    switch (entity) {
      case 'contracts': {
        const vistaCount = stats.vista_contracts || stats.total_contracts || 0;
        const titanCount = stats.titan_projects || 0;
        const linked = stats.matched_contracts || 0;
        return {
          vistaCount,
          titanCount,
          linked,
          vistaUnlinked: stats.unmatched_contracts || 0,
          titanUnlinked: titanCount - (stats.titan_projects_linked || 0),
          potentialMatches: contractDuplicates?.length || 0,
        };
      }
      case 'work-orders': {
        // Work orders are displayed directly from Vista - no separate Titan table
        // The Vista work orders ARE the Titan work orders
        const vistaCount = stats.vista_work_orders || stats.total_work_orders || 0;
        return {
          vistaCount,
          titanCount: vistaCount, // Vista work orders ARE Titan work orders
          linked: vistaCount, // All are available in Titan
          vistaUnlinked: 0,
          titanUnlinked: 0,
          potentialMatches: 0,
        };
      }
      case 'employees': {
        const vistaCount = stats.vista_employees || stats.total_employees || 0;
        const titanCount = stats.titan_employees || 0;
        const linked = stats.linked_employees || 0;
        return {
          vistaCount,
          titanCount,
          linked,
          vistaUnlinked: vistaCount - linked,
          titanUnlinked: titanCount - (stats.titan_employees_linked || 0),
          potentialMatches: employeeDuplicates?.length || 0,
        };
      }
      case 'customers': {
        const vistaCount = stats.vista_customers || stats.total_customers || 0;
        const titanCount = stats.titan_customers || 0;
        const linked = stats.linked_customers || 0;
        return {
          vistaCount,
          titanCount,
          linked,
          vistaUnlinked: vistaCount - linked,
          titanUnlinked: titanCount - (stats.titan_customers_linked || 0),
          potentialMatches: customerDuplicates?.length || 0,
        };
      }
      case 'vendors': {
        const vistaCount = stats.vista_vendors || stats.total_vendors || 0;
        const titanCount = stats.titan_vendors || 0;
        const linked = stats.linked_vendors || 0;
        return {
          vistaCount,
          titanCount,
          linked,
          vistaUnlinked: vistaCount - linked,
          titanUnlinked: titanCount - (stats.titan_vendors_linked || 0),
          potentialMatches: vendorDuplicates?.length || 0,
        };
      }
      case 'departments': {
        const vistaCount = stats.vista_departments || 0;
        const titanCount = stats.titan_departments || 0;
        const linked = stats.linked_departments || 0;
        return {
          vistaCount,
          titanCount,
          linked,
          vistaUnlinked: vistaCount - linked,
          titanUnlinked: 0, // Departments are created from Vista codes
          potentialMatches: departmentDuplicates?.length || 0,
        };
      }
      case 'facilities': {
        // Facilities are stored in customers table - count customers with facilities
        const withFacility = customers?.filter((c: any) => c.customer_facility)?.length || 0;
        const withoutFacility = (customers?.length || 0) - withFacility;
        return {
          vistaCount: withoutFacility,  // Customers needing facility data
          titanCount: withFacility,      // Customers with facility data
          linked: withFacility,
          vistaUnlinked: 0,              // Don't show "unlinked" - not relevant for facilities
          titanUnlinked: 0,
          potentialMatches: 0,
        };
      }
      default:
        return defaultStats;
    }
  };

  const renderEntityDetails = () => {
    if (!expandedEntity) return null;

    const isLoading =
      expandedEntity === 'contracts' ? (viewMode === 'matches' ? contractDuplicatesLoading : contractsLoading) :
      expandedEntity === 'work-orders' ? workOrdersLoading :
      expandedEntity === 'employees' ? (viewMode === 'matches' ? employeeDuplicatesLoading : vpEmployeesLoading) :
      expandedEntity === 'customers' ? (viewMode === 'matches' ? customerDuplicatesLoading : vpCustomersLoading) :
      expandedEntity === 'vendors' ? (viewMode === 'matches' ? vendorDuplicatesLoading : vpVendorsLoading) :
      expandedEntity === 'departments' ? departmentDuplicatesLoading :
      expandedEntity === 'facilities' ? !customers :
      false;

    return (
      <div className="sales-chart-card" style={{ marginTop: '16px' }}>
        {/* View Mode Toggle & Filters */}
        {expandedEntity !== 'departments' && expandedEntity !== 'facilities' && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                className={viewMode === 'matches' ? 'sales-btn-primary' : 'sales-btn'}
                onClick={() => setViewMode('matches')}
                style={{ padding: '8px 16px' }}
              >
                Potential Matches
              </button>
              <button
                className={viewMode === 'data' ? 'sales-btn-primary' : 'sales-btn'}
                onClick={() => setViewMode('data')}
                style={{ padding: '8px 16px' }}
              >
                All Data
              </button>
            </div>

            {viewMode === 'data' && (
              <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                <select
                  value={filter}
                  onChange={(e) => setFilter(e.target.value as FilterType)}
                  className="sales-input"
                  style={{ width: 'auto' }}
                >
                  <option value="all">All (Vista)</option>
                  <option value="unmatched">Unmatched (Vista)</option>
                  <option value="auto_matched">Auto Matched</option>
                  <option value="manual_matched">Manual Matched</option>
                  <option value="ignored">Ignored</option>
                  <option value="titan_only">Titan Only (not in Vista)</option>
                </select>
                <input
                  type="text"
                  placeholder="Search..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="sales-input"
                  style={{ width: '200px' }}
                />
              </div>
            )}
          </div>
        )}

        {isLoading ? (
          <div style={{ textAlign: 'center', padding: '2rem' }}>Loading...</div>
        ) : (
          renderEntityContent()
        )}
      </div>
    );
  };

  const renderEntityContent = () => {
    // Check for Titan-only filter
    if (filter === 'titan_only' && viewMode === 'data') {
      return renderTitanOnlyData();
    }

    switch (expandedEntity) {
      case 'contracts':
        return viewMode === 'matches' ? renderContractMatches() : renderContractsData();
      case 'work-orders':
        return renderWorkOrdersData();
      case 'employees':
        return viewMode === 'matches' ? renderEmployeeMatches() : renderEmployeesData();
      case 'customers':
        return viewMode === 'matches' ? renderCustomerMatches() : renderCustomersData();
      case 'vendors':
        return viewMode === 'matches' ? renderVendorMatches() : renderVendorsData();
      case 'departments':
        return renderDepartmentMatches();
      case 'facilities':
        return renderFacilitiesData();
      default:
        return null;
    }
  };

  // Render Titan-only records (records in Titan not linked to Vista)
  const renderTitanOnlyData = () => {
    const isLoading = expandedEntity === 'contracts' ? titanOnlyProjectsLoading :
                      expandedEntity === 'employees' ? titanOnlyEmployeesLoading :
                      expandedEntity === 'customers' ? titanOnlyCustomersLoading :
                      expandedEntity === 'vendors' ? titanOnlyVendorsLoading :
                      false;

    if (isLoading) {
      return <div style={{ textAlign: 'center', padding: '2rem' }}>Loading Titan-only records...</div>;
    }

    const data = expandedEntity === 'contracts' ? titanOnlyProjects :
                 expandedEntity === 'employees' ? titanOnlyEmployees :
                 expandedEntity === 'customers' ? titanOnlyCustomers :
                 expandedEntity === 'vendors' ? titanOnlyVendors :
                 [];

    if (!data || data.length === 0) {
      return (
        <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>
          No Titan-only records found. All Titan records are linked to Vista.
        </div>
      );
    }

    const handleDeleteAll = () => {
      const entityName = expandedEntity === 'contracts' ? 'projects' : expandedEntity;
      if (window.confirm(`Are you sure you want to DELETE ALL ${data.length} Titan-only ${entityName}? This action cannot be undone.`)) {
        if (expandedEntity === 'contracts') {
          deleteTitanOnlyProjectsMutation.mutate();
        } else if (expandedEntity === 'employees') {
          deleteTitanOnlyEmployeesMutation.mutate();
        } else if (expandedEntity === 'customers') {
          deleteTitanOnlyCustomersMutation.mutate();
        } else if (expandedEntity === 'vendors') {
          deleteTitanOnlyVendorsMutation.mutate();
        }
      }
    };

    const isDeleting = deleteTitanOnlyProjectsMutation.isPending ||
                       deleteTitanOnlyEmployeesMutation.isPending ||
                       deleteTitanOnlyCustomersMutation.isPending ||
                       deleteTitanOnlyVendorsMutation.isPending;

    return (
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <div style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
            Showing {data.length} Titan record(s) not linked to Vista
          </div>
          <button
            onClick={handleDeleteAll}
            disabled={isDeleting}
            style={{
              padding: '8px 16px',
              background: '#ef4444',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: isDeleting ? 'not-allowed' : 'pointer',
              opacity: isDeleting ? 0.6 : 1,
              fontWeight: 500,
            }}
          >
            {isDeleting ? 'Deleting...' : `Delete All ${data.length} Records`}
          </button>
        </div>
        <table className="sales-table" style={{ width: '100%' }}>
          <thead>
            <tr>
              {expandedEntity === 'contracts' && (
                <>
                  <th>Project #</th>
                  <th>Name</th>
                  <th>Status</th>
                  <th>Created</th>
                </>
              )}
              {expandedEntity === 'employees' && (
                <>
                  <th>Emp #</th>
                  <th>Name</th>
                  <th>Job Title</th>
                  <th>Status</th>
                </>
              )}
              {expandedEntity === 'customers' && (
                <>
                  <th>Company Name</th>
                  <th>Facilities</th>
                </>
              )}
              {expandedEntity === 'vendors' && (
                <>
                  <th>Name</th>
                  <th>City</th>
                  <th>State</th>
                  <th>Status</th>
                </>
              )}
            </tr>
          </thead>
          <tbody>
            {expandedEntity === 'contracts' && (titanOnlyProjects || []).map((p: TitanOnlyProject) => (
              <tr key={p.id}>
                <td>{p.number || '-'}</td>
                <td>{p.name}</td>
                <td>{p.status || '-'}</td>
                <td>{new Date(p.created_at).toLocaleDateString()}</td>
              </tr>
            ))}
            {expandedEntity === 'employees' && (titanOnlyEmployees || []).map((e: TitanOnlyEmployee) => (
              <tr key={e.id}>
                <td>{e.employee_number || '-'}</td>
                <td>{e.first_name} {e.last_name}</td>
                <td>{e.job_title || '-'}</td>
                <td>{e.employment_status || '-'}</td>
              </tr>
            ))}
            {expandedEntity === 'customers' && (titanOnlyCustomers || []).map((c: TitanOnlyCustomer) => (
              <tr key={c.id}>
                <td>{c.name}</td>
                <td>{c.facility_count}</td>
              </tr>
            ))}
            {expandedEntity === 'vendors' && (titanOnlyVendors || []).map((v: TitanOnlyVendor) => (
              <tr key={v.id}>
                <td>{v.vendor_name}</td>
                <td>{v.city || '-'}</td>
                <td>{v.state || '-'}</td>
                <td>{v.status || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  // === RENDER MATCHES ===

  const renderContractMatches = () => {
    if (!contractDuplicates || contractDuplicates.length === 0) {
      return (
        <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>
          No potential contract matches found. All contracts may already be linked.
        </div>
      );
    }

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {contractDuplicates.map((dup: ContractDuplicate) => (
          <div key={dup.vp_id} style={{
            border: '1px solid var(--border-color)',
            borderRadius: '8px',
            padding: '16px',
            background: 'var(--card-bg)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
              <div>
                <div style={{ fontWeight: 600 }}>VP Contract: {dup.vp_contract_number}</div>
                <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                  {dup.vp_description || 'No description'} | {dup.vp_customer || 'No customer'}
                  {dup.vp_amount && ` | ${formatCurrency(dup.vp_amount)}`}
                </div>
              </div>
            </div>
            <table className="sales-table" style={{ fontSize: '0.875rem' }}>
              <thead>
                <tr>
                  <th>Match</th>
                  <th>Project #</th>
                  <th>Name</th>
                  <th>Customer</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {dup.potential_matches.map((match, idx) => (
                  <tr key={idx}>
                    <td>{getSimilarityBadge(match.similarity)}</td>
                    <td style={{ fontWeight: 500 }}>{match.titan_number || '-'}</td>
                    <td>{match.titan_name || '-'}</td>
                    <td>{match.titan_customer || '-'}</td>
                    <td>
                      <button
                        className="sales-btn-primary"
                        style={{ padding: '4px 12px', fontSize: '0.75rem' }}
                        onClick={() => linkContractMutation.mutate({ id: dup.vp_id, data: { project_id: match.titan_id } })}
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
    );
  };

  const renderEmployeeMatches = () => {
    if (!employeeDuplicates || employeeDuplicates.length === 0) {
      return (
        <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>
          No potential employee matches found.
        </div>
      );
    }

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {employeeDuplicates.map((dup: EmployeeDuplicate) => (
          <div key={dup.vp_id} style={{
            border: '1px solid var(--border-color)',
            borderRadius: '8px',
            padding: '16px',
            background: 'var(--card-bg)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
              <div>
                <div style={{ fontWeight: 600 }}>VP #{dup.vp_employee_number}: {dup.vp_name}</div>
                <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                  {dup.vp_active ? 'Active' : 'Inactive'}
                </div>
              </div>
            </div>
            <table className="sales-table" style={{ fontSize: '0.875rem' }}>
              <thead>
                <tr>
                  <th>Match</th>
                  <th>Titan Employee</th>
                  <th>Employee #</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {dup.potential_matches.map((match, idx) => (
                  <tr key={idx}>
                    <td>{getSimilarityBadge(match.similarity)}</td>
                    <td style={{ fontWeight: 500 }}>{match.titan_name}</td>
                    <td>{match.titan_employee_number || '-'}</td>
                    <td>
                      <button
                        className="sales-btn-primary"
                        style={{ padding: '4px 12px', fontSize: '0.75rem' }}
                        onClick={() => linkVPEmployeeMutation.mutate({ id: dup.vp_id, employeeId: match.titan_id })}
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
    );
  };

  const renderCustomerMatches = () => {
    if (!customerDuplicates || customerDuplicates.length === 0) {
      return (
        <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>
          No potential customer matches found.
        </div>
      );
    }

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {customerDuplicates.map((dup: CustomerDuplicate) => (
          <div key={dup.vp_id} style={{
            border: '1px solid var(--border-color)',
            borderRadius: '8px',
            padding: '16px',
            background: 'var(--card-bg)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
              <div>
                <div style={{ fontWeight: 600 }}>VP #{dup.vp_customer_number}: {dup.vp_name}</div>
                <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                  {dup.vp_location || 'No location'} | {dup.vp_active ? 'Active' : 'Inactive'}
                </div>
              </div>
            </div>
            <table className="sales-table" style={{ fontSize: '0.875rem' }}>
              <thead>
                <tr>
                  <th>Match</th>
                  <th>Titan Customer</th>
                  <th>Facility</th>
                  <th>Location</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {dup.potential_matches.map((match, idx) => (
                  <tr key={idx}>
                    <td>{getSimilarityBadge(match.similarity)}</td>
                    <td style={{ fontWeight: 500 }}>{match.titan_owner || '-'}</td>
                    <td>{match.titan_facility || '-'}</td>
                    <td>{match.titan_location || '-'}</td>
                    <td>
                      <button
                        className="sales-btn-primary"
                        style={{ padding: '4px 12px', fontSize: '0.75rem' }}
                        onClick={() => linkVPCustomerMutation.mutate({ id: dup.vp_id, customerId: match.titan_id })}
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
    );
  };

  const renderVendorMatches = () => {
    if (!vendorDuplicates || vendorDuplicates.length === 0) {
      return (
        <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>
          No potential vendor matches found.
        </div>
      );
    }

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {vendorDuplicates.map((dup: VendorDuplicate) => (
          <div key={dup.vp_id} style={{
            border: '1px solid var(--border-color)',
            borderRadius: '8px',
            padding: '16px',
            background: 'var(--card-bg)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
              <div>
                <div style={{ fontWeight: 600 }}>VP #{dup.vp_vendor_number}: {dup.vp_name}</div>
                <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                  {dup.vp_location || 'No location'} | {dup.vp_active ? 'Active' : 'Inactive'}
                </div>
              </div>
            </div>
            <table className="sales-table" style={{ fontSize: '0.875rem' }}>
              <thead>
                <tr>
                  <th>Match</th>
                  <th>Vendor Name</th>
                  <th>Company</th>
                  <th>Location</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {dup.potential_matches.map((match, idx) => (
                  <tr key={idx}>
                    <td>{getSimilarityBadge(match.similarity)}</td>
                    <td style={{ fontWeight: 500 }}>{match.titan_vendor_name || '-'}</td>
                    <td>{match.titan_company_name || '-'}</td>
                    <td>{match.titan_location || '-'}</td>
                    <td>
                      <button
                        className="sales-btn-primary"
                        style={{ padding: '4px 12px', fontSize: '0.75rem' }}
                        onClick={() => linkVPVendorMutation.mutate({ id: dup.vp_id, vendorId: match.titan_id })}
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
    );
  };

  const renderDepartmentMatches = () => {
    if (!departmentDuplicates || departmentDuplicates.length === 0) {
      return (
        <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>
          No unlinked department codes found. All Vista department codes are linked to Titan departments.
        </div>
      );
    }

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {departmentDuplicates.map((dup: DepartmentDuplicate) => (
          <div key={dup.vp_department_code} style={{
            border: '1px solid var(--border-color)',
            borderRadius: '8px',
            padding: '16px',
            background: 'var(--card-bg)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
              <div>
                <div style={{ fontWeight: 600 }}>VP Department Code: {dup.vp_department_code}</div>
                <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                  Used in {dup.usage_count.contracts} contracts and {dup.usage_count.work_orders} work orders
                </div>
              </div>
            </div>
            {dup.potential_matches.length > 0 ? (
              <table className="sales-table" style={{ fontSize: '0.875rem' }}>
                <thead>
                  <tr>
                    <th>Match</th>
                    <th>Dept #</th>
                    <th>Name</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {dup.potential_matches.map((match, idx) => (
                    <tr key={idx}>
                      <td>{getSimilarityBadge(match.similarity)}</td>
                      <td style={{ fontWeight: 500 }}>{match.titan_number || '-'}</td>
                      <td>{match.titan_name || '-'}</td>
                      <td>
                        <button
                          className="sales-btn-primary"
                          style={{ padding: '4px 12px', fontSize: '0.75rem' }}
                          onClick={() => linkDepartmentCodeMutation.mutate({
                            departmentCode: dup.vp_department_code,
                            departmentId: match.titan_id
                          })}
                          disabled={linkDepartmentCodeMutation.isPending}
                        >
                          Link
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div style={{
                padding: '12px',
                background: 'rgba(239, 68, 68, 0.1)',
                borderRadius: '6px',
                color: '#ef4444',
                fontSize: '0.875rem'
              }}>
                No matching Titan department found. Use "Import" button above to create this department in Titan.
              </div>
            )}
          </div>
        ))}
      </div>
    );
  };

  const renderFacilitiesData = () => {
    if (!customers || customers.length === 0) {
      return (
        <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>
          No customers found. Import customers from Vista first, then import facilities.
        </div>
      );
    }

    const customersWithFacility = customers.filter((c: any) => c.customer_facility);
    const customersWithoutFacility = customers.filter((c: any) => !c.customer_facility);

    return (
      <div>
        <div style={{ display: 'flex', gap: '16px', marginBottom: '16px' }}>
          <div style={{
            flex: 1,
            padding: '16px',
            background: 'rgba(16, 185, 129, 0.1)',
            borderRadius: '8px',
            textAlign: 'center'
          }}>
            <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#10b981' }}>
              {customersWithFacility.length}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
              With Facility
            </div>
          </div>
          <div style={{
            flex: 1,
            padding: '16px',
            background: 'rgba(239, 68, 68, 0.1)',
            borderRadius: '8px',
            textAlign: 'center'
          }}>
            <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#ef4444' }}>
              {customersWithoutFacility.length}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
              Without Facility
            </div>
          </div>
        </div>

        <div style={{ marginBottom: '12px', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
          Showing {customers.length} customers - facilities imported from Customer List Excel file
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table className="sales-table">
            <thead>
              <tr>
                <th>Company (Owner)</th>
                <th>Facility/Location</th>
                <th>City</th>
                <th>State</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {customers.map((customer: any) => (
                <tr key={customer.id}>
                  <td style={{ fontWeight: 500 }}>{customer.customer_owner || '-'}</td>
                  <td>{customer.customer_facility || <span style={{ color: '#ef4444', fontStyle: 'italic' }}>Not imported</span>}</td>
                  <td>{customer.city || '-'}</td>
                  <td>{customer.state || '-'}</td>
                  <td>
                    {customer.customer_facility ? (
                      <span style={{
                        padding: '4px 8px',
                        borderRadius: '4px',
                        fontSize: '0.75rem',
                        background: 'rgba(16, 185, 129, 0.1)',
                        color: '#10b981',
                      }}>
                        Has Facility
                      </span>
                    ) : (
                      <span style={{
                        padding: '4px 8px',
                        borderRadius: '4px',
                        fontSize: '0.75rem',
                        background: 'rgba(239, 68, 68, 0.1)',
                        color: '#ef4444',
                      }}>
                        Missing
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  // === RENDER DATA TABLES ===

  const renderContractsData = () => {
    if (!contracts || contracts.length === 0) {
      return <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>No contracts found.</div>;
    }

    return (
      <div style={{ overflowX: 'auto' }}>
        <table className="sales-table">
          <thead>
            <tr>
              <th>Contract #</th>
              <th>Description</th>
              <th>Customer</th>
              <th>Amount</th>
              <th>Status</th>
              <th>Links</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {contracts.map((record: VPContract) => (
              <tr key={record.id}>
                <td style={{ fontWeight: 500 }}>{record.contract_number}</td>
                <td style={{ maxWidth: '250px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {record.description || '-'}
                </td>
                <td>{record.customer_name || '-'}</td>
                <td>{formatCurrency(record.contract_amount)}</td>
                <td>{getStatusBadge(record.link_status)}</td>
                <td style={{ fontSize: '0.8rem' }}>
                  {record.linked_project_name ? (
                    <span>Project: {record.linked_project_name}</span>
                  ) : (
                    <span style={{ color: 'var(--text-secondary)' }}>No links</span>
                  )}
                </td>
                <td>
                  <div style={{ display: 'flex', gap: '4px' }}>
                    <button className="sales-btn" style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                      onClick={() => openLinkModal('contract', record)}>
                      {record.linked_project_id ? 'Edit' : 'Link'}
                    </button>
                    {record.link_status !== 'ignored' && (
                      <button className="sales-btn" style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                        onClick={() => ignoreContractMutation.mutate(record.id)}>
                        Ignore
                      </button>
                    )}
                    {record.linked_project_id && (
                      <button className="sales-btn" style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                        onClick={() => unlinkContractMutation.mutate(record.id)}>
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
    );
  };

  const renderWorkOrdersData = () => {
    if (!workOrders || workOrders.length === 0) {
      return <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>No work orders found.</div>;
    }

    return (
      <div style={{ overflowX: 'auto' }}>
        <table className="sales-table">
          <thead>
            <tr>
              <th>WO #</th>
              <th>Description</th>
              <th>Customer</th>
              <th>Amount</th>
              <th>Status</th>
              <th>Links</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {workOrders.map((record: VPWorkOrder) => (
              <tr key={record.id}>
                <td style={{ fontWeight: 500 }}>{record.work_order_number}</td>
                <td style={{ maxWidth: '250px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {record.description || '-'}
                </td>
                <td>{record.customer_name || '-'}</td>
                <td>{formatCurrency(record.contract_amount)}</td>
                <td>{getStatusBadge(record.link_status)}</td>
                <td style={{ fontSize: '0.8rem' }}>
                  {record.linked_employee_name || record.linked_customer_facility ? (
                    <div>
                      {record.linked_employee_name && <div>PM: {record.linked_employee_name}</div>}
                      {record.linked_customer_facility && <div>Cust: {record.linked_customer_facility}</div>}
                    </div>
                  ) : (
                    <span style={{ color: 'var(--text-secondary)' }}>No links</span>
                  )}
                </td>
                <td>
                  <div style={{ display: 'flex', gap: '4px' }}>
                    <button className="sales-btn" style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                      onClick={() => openLinkModal('work_order', record)}>
                      {record.linked_employee_id || record.linked_customer_id ? 'Edit' : 'Link'}
                    </button>
                    {record.link_status !== 'ignored' && (
                      <button className="sales-btn" style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                        onClick={() => ignoreWorkOrderMutation.mutate(record.id)}>
                        Ignore
                      </button>
                    )}
                    {(record.linked_employee_id || record.linked_customer_id) && (
                      <button className="sales-btn" style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                        onClick={() => unlinkWorkOrderMutation.mutate(record.id)}>
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
    );
  };

  const renderEmployeesData = () => {
    if (!vpEmployees || vpEmployees.length === 0) {
      return <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>No VP employees found.</div>;
    }

    return (
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
                  {emp.linked_employee_name || <span style={{ color: 'var(--text-secondary)' }}>Not linked</span>}
                </td>
                <td>
                  <div style={{ display: 'flex', gap: '4px' }}>
                    <button className="sales-btn" style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                      onClick={() => openLinkModal('vp_employee', emp)}>
                      {emp.linked_employee_id ? 'Edit' : 'Link'}
                    </button>
                    {emp.linked_employee_id && (
                      <button className="sales-btn" style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                        onClick={() => unlinkVPEmployeeMutation.mutate(emp.id)}>
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
    );
  };

  const renderCustomersData = () => {
    if (!vpCustomers || vpCustomers.length === 0) {
      return <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>No VP customers found.</div>;
    }

    return (
      <div style={{ overflowX: 'auto' }}>
        <table className="sales-table">
          <thead>
            <tr>
              <th>Customer #</th>
              <th>Name</th>
              <th>City</th>
              <th>State</th>
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
                <td>{getStatusBadge(cust.link_status)}</td>
                <td style={{ fontSize: '0.8rem' }}>
                  {cust.linked_customer_owner || <span style={{ color: 'var(--text-secondary)' }}>Not linked</span>}
                </td>
                <td>
                  <div style={{ display: 'flex', gap: '4px' }}>
                    <button className="sales-btn" style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                      onClick={() => openLinkModal('vp_customer', cust)}>
                      {cust.linked_customer_id ? 'Edit' : 'Link'}
                    </button>
                    {cust.linked_customer_id && (
                      <button className="sales-btn" style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                        onClick={() => unlinkVPCustomerMutation.mutate(cust.id)}>
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
    );
  };

  const renderVendorsData = () => {
    if (!vpVendors || vpVendors.length === 0) {
      return <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>No VP vendors found.</div>;
    }

    return (
      <div style={{ overflowX: 'auto' }}>
        <table className="sales-table">
          <thead>
            <tr>
              <th>Vendor #</th>
              <th>Name</th>
              <th>City</th>
              <th>State</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {vpVendors.map((vendor: VPVendor) => (
              <tr key={vendor.id}>
                <td style={{ fontWeight: 500 }}>{vendor.vendor_number}</td>
                <td>{vendor.name || '-'}</td>
                <td>{vendor.city || '-'}</td>
                <td>{vendor.state || '-'}</td>
                <td>{getStatusBadge(vendor.link_status)}</td>
                <td>
                  <div style={{ display: 'flex', gap: '4px' }}>
                    <button className="sales-btn" style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                      onClick={() => openLinkModal('vp_vendor', vendor)}>
                      {vendor.linked_vendor_id ? 'Edit' : 'Link'}
                    </button>
                    {vendor.linked_vendor_id && (
                      <button className="sales-btn" style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                        onClick={() => unlinkVPVendorMutation.mutate(vendor.id)}>
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
    );
  };

  return (
    <div className="sales-container">
      <div className="sales-page-header">
        <div className="sales-page-title">
          <div>
            <h1>Vista Data Linking</h1>
            <div className="sales-subtitle">Link Vista ERP records to Titan entities</div>
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

      {/* Entity Cards Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
        gap: '16px',
        marginBottom: '16px',
      }}>
        <EntityCard
          title="Contracts"
          icon="📋"
          color="#3b82f6"
          stats={getEntityStats('contracts')}
          vistaLabel="Vista"
          titanLabel="Projects"
          isExpanded={expandedEntity === 'contracts'}
          isLoading={statsLoading}
          onToggle={() => toggleEntity('contracts')}
          actions={
            <button
              className="sales-btn-primary"
              style={{ padding: '6px 12px', fontSize: '0.75rem' }}
              onClick={() => autoLinkContractsMutation.mutate()}
              disabled={autoLinkContractsMutation.isPending}
            >
              {autoLinkContractsMutation.isPending ? 'Linking...' : 'Auto-Link 100% Matches'}
            </button>
          }
        />

        <EntityCard
          title="Work Orders"
          icon="🔧"
          color="#8b5cf6"
          stats={getEntityStats('work-orders')}
          vistaLabel="Vista"
          titanLabel="Titan"
          isExpanded={expandedEntity === 'work-orders'}
          isLoading={statsLoading}
          onToggle={() => toggleEntity('work-orders')}
          actions={
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontStyle: 'italic' }}>
              Work orders sync directly from Vista
            </span>
          }
        />

        <EntityCard
          title="Employees"
          icon="👤"
          color="#f59e0b"
          stats={getEntityStats('employees')}
          isExpanded={expandedEntity === 'employees'}
          isLoading={statsLoading}
          onToggle={() => toggleEntity('employees')}
          actions={
            <button
              className="sales-btn-primary"
              style={{ padding: '6px 12px', fontSize: '0.75rem' }}
              onClick={() => autoLinkEmployeesMutation.mutate()}
              disabled={autoLinkEmployeesMutation.isPending}
            >
              {autoLinkEmployeesMutation.isPending ? 'Linking...' : 'Auto-Link 100% Matches'}
            </button>
          }
        />

        <EntityCard
          title="Customers"
          icon="🏢"
          color="#10b981"
          stats={getEntityStats('customers')}
          isExpanded={expandedEntity === 'customers'}
          isLoading={statsLoading}
          onToggle={() => toggleEntity('customers')}
          actions={
            <button
              className="sales-btn-primary"
              style={{ padding: '6px 12px', fontSize: '0.75rem' }}
              onClick={() => autoLinkCustomersMutation.mutate()}
              disabled={autoLinkCustomersMutation.isPending}
            >
              {autoLinkCustomersMutation.isPending ? 'Linking...' : 'Auto-Link 100% Matches'}
            </button>
          }
        />

        <EntityCard
          title="Vendors"
          icon="🏭"
          color="#ef4444"
          stats={getEntityStats('vendors')}
          isExpanded={expandedEntity === 'vendors'}
          isLoading={statsLoading}
          onToggle={() => toggleEntity('vendors')}
          actions={
            <button
              className="sales-btn-primary"
              style={{ padding: '6px 12px', fontSize: '0.75rem' }}
              onClick={() => autoLinkVendorsMutation.mutate()}
              disabled={autoLinkVendorsMutation.isPending}
            >
              {autoLinkVendorsMutation.isPending ? 'Linking...' : 'Auto-Link 100% Matches'}
            </button>
          }
        />

        <EntityCard
          title="Departments"
          icon="🏛️"
          color="#6366f1"
          stats={getEntityStats('departments')}
          isExpanded={expandedEntity === 'departments'}
          isLoading={statsLoading || departmentDuplicatesLoading}
          onToggle={() => toggleEntity('departments')}
          actions={
            <button
              className="sales-btn-primary"
              style={{ padding: '6px 12px', fontSize: '0.75rem' }}
              onClick={() => autoLinkDepartmentsMutation.mutate()}
              disabled={autoLinkDepartmentsMutation.isPending}
            >
              {autoLinkDepartmentsMutation.isPending ? 'Linking...' : 'Auto-Link 100% Matches'}
            </button>
          }
        />

        <EntityCard
          title="Facilities"
          icon="📍"
          color="#ec4899"
          stats={getEntityStats('facilities')}
          vistaLabel="Missing"
          titanLabel="Has Facility"
          isExpanded={expandedEntity === 'facilities'}
          isLoading={statsLoading || !customers}
          onToggle={() => toggleEntity('facilities')}
          actions={
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontStyle: 'italic' }}>
              Upload Customer List via Vista Excel import
            </span>
          }
        />
      </div>

      {/* Expanded Entity Details */}
      {renderEntityDetails()}

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
                    linkModal.type === 'vp_customer' ? 'VP Customer' :
                    linkModal.type === 'vp_vendor' ? 'VP Vendor' : 'Record'}
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
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
                        <option key={e.id} value={e.id}>{e.first_name} {e.last_name}</option>
                      ))}
                    </select>
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
                        <option key={d.id} value={d.id}>{d.department_number} - {d.name}</option>
                      ))}
                    </select>
                  </div>
                </>
              )}

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
                      <option key={e.id} value={e.id}>{e.first_name} {e.last_name}</option>
                    ))}
                  </select>
                </div>
              )}

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
                </div>
              )}
            </div>

            <div style={{ display: 'flex', gap: '12px', marginTop: '24px', justifyContent: 'flex-end' }}>
              <button className="sales-btn" onClick={() => setLinkModal(null)}>Cancel</button>
              <button
                className="sales-btn-primary"
                onClick={handleLink}
                disabled={linkContractMutation.isPending || linkWorkOrderMutation.isPending ||
                  linkVPEmployeeMutation.isPending || linkVPCustomerMutation.isPending}
              >
                Save Link
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default VistaLinkingManager;
