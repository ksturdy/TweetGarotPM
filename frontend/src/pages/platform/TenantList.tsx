import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Container,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  Button,
  TextField,
  InputAdornment,
  IconButton,
  CircularProgress,
  Alert,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Stack,
  Pagination,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import {
  Search,
  Visibility,
  Block,
  CheckCircle,
  ArrowBack,
} from '@mui/icons-material';
import { getTenants, suspendTenant, activateTenant, Tenant } from '../../services/platform';

const TenantList: React.FC = () => {
  const navigate = useNavigate();
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [suspendDialog, setSuspendDialog] = useState<{ open: boolean; tenant: Tenant | null; reason: string }>({
    open: false,
    tenant: null,
    reason: '',
  });

  const limit = 20;

  const fetchTenants = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await getTenants({
        search: searchTerm || undefined,
        status: statusFilter || undefined,
        limit,
        offset: (page - 1) * limit,
      });
      setTenants(data.tenants);
      setTotal(data.total);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load tenants');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTenants();
  }, [page, statusFilter]);

  const handleSearch = () => {
    setPage(1);
    fetchTenants();
  };

  const handleSuspend = async () => {
    if (!suspendDialog.tenant || !suspendDialog.reason) return;
    try {
      await suspendTenant(suspendDialog.tenant.id, suspendDialog.reason);
      setSuspendDialog({ open: false, tenant: null, reason: '' });
      fetchTenants();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to suspend tenant');
    }
  };

  const handleActivate = async (tenant: Tenant) => {
    try {
      await activateTenant(tenant.id);
      fetchTenants();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to activate tenant');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'success';
      case 'suspended':
        return 'error';
      case 'cancelled':
        return 'default';
      default:
        return 'default';
    }
  };

  const totalPages = Math.ceil(total / limit);

  return (
    <Container maxWidth="xl" sx={{ py: 3 }}>
      {/* Header */}
      <Box sx={{ mb: 3 }}>
        <Button
          startIcon={<ArrowBack />}
          onClick={() => navigate('/platform')}
          sx={{ mb: 2 }}
        >
          Back to Dashboard
        </Button>
        <Typography variant="h4" sx={{ fontWeight: 700 }}>
          Tenant Management
        </Typography>
        <Typography color="text.secondary">
          View and manage all organizations on the platform
        </Typography>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      {/* Filters */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems="center">
          <TextField
            size="small"
            placeholder="Search by name, slug, or email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
            sx={{ minWidth: 300 }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Search />
                </InputAdornment>
              ),
            }}
          />
          <FormControl size="small" sx={{ minWidth: 150 }}>
            <InputLabel>Status</InputLabel>
            <Select
              value={statusFilter}
              label="Status"
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <MenuItem value="">All</MenuItem>
              <MenuItem value="active">Active</MenuItem>
              <MenuItem value="suspended">Suspended</MenuItem>
              <MenuItem value="cancelled">Cancelled</MenuItem>
            </Select>
          </FormControl>
          <Button variant="contained" onClick={handleSearch}>
            Search
          </Button>
          <Box sx={{ flexGrow: 1 }} />
          <Typography variant="body2" color="text.secondary">
            {total} tenant{total !== 1 ? 's' : ''} found
          </Typography>
        </Stack>
      </Paper>

      {/* Table */}
      <TableContainer component={Paper}>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
            <CircularProgress />
          </Box>
        ) : (
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Organization</TableCell>
                <TableCell>Plan</TableCell>
                <TableCell align="right">Users</TableCell>
                <TableCell align="right">Projects</TableCell>
                <TableCell align="right">Customers</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Created</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {tenants.map((tenant) => (
                <TableRow key={tenant.id} hover>
                  <TableCell>
                    <Box>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        {tenant.name}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {tenant.slug} | {tenant.email}
                      </Typography>
                    </Box>
                  </TableCell>
                  <TableCell>{tenant.plan_display_name || tenant.plan_name}</TableCell>
                  <TableCell align="right">
                    {tenant.active_users} / {tenant.total_users}
                  </TableCell>
                  <TableCell align="right">{tenant.project_count}</TableCell>
                  <TableCell align="right">{tenant.customer_count}</TableCell>
                  <TableCell>
                    <Chip
                      label={tenant.status}
                      color={getStatusColor(tenant.status) as any}
                      size="small"
                    />
                  </TableCell>
                  <TableCell>
                    {new Date(tenant.created_at).toLocaleDateString()}
                  </TableCell>
                  <TableCell align="right">
                    <Stack direction="row" spacing={1} justifyContent="flex-end">
                      <IconButton
                        size="small"
                        onClick={() => navigate(`/platform/tenants/${tenant.id}`)}
                        title="View Details"
                      >
                        <Visibility />
                      </IconButton>
                      {tenant.status === 'active' ? (
                        <IconButton
                          size="small"
                          color="error"
                          onClick={() => setSuspendDialog({ open: true, tenant, reason: '' })}
                          title="Suspend Tenant"
                        >
                          <Block />
                        </IconButton>
                      ) : (
                        <IconButton
                          size="small"
                          color="success"
                          onClick={() => handleActivate(tenant)}
                          title="Activate Tenant"
                        >
                          <CheckCircle />
                        </IconButton>
                      )}
                    </Stack>
                  </TableCell>
                </TableRow>
              ))}
              {tenants.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} align="center">
                    <Typography color="text.secondary" sx={{ py: 4 }}>
                      No tenants found
                    </Typography>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </TableContainer>

      {/* Pagination */}
      {totalPages > 1 && (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 3 }}>
          <Pagination
            count={totalPages}
            page={page}
            onChange={(_, value) => setPage(value)}
            color="primary"
          />
        </Box>
      )}

      {/* Suspend Dialog */}
      <Dialog
        open={suspendDialog.open}
        onClose={() => setSuspendDialog({ open: false, tenant: null, reason: '' })}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Suspend Tenant</DialogTitle>
        <DialogContent>
          <Typography sx={{ mb: 2 }}>
            Are you sure you want to suspend <strong>{suspendDialog.tenant?.name}</strong>?
            Users will not be able to access their account.
          </Typography>
          <TextField
            label="Reason for suspension"
            fullWidth
            multiline
            rows={3}
            value={suspendDialog.reason}
            onChange={(e) => setSuspendDialog({ ...suspendDialog, reason: e.target.value })}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSuspendDialog({ open: false, tenant: null, reason: '' })}>
            Cancel
          </Button>
          <Button
            variant="contained"
            color="error"
            onClick={handleSuspend}
            disabled={!suspendDialog.reason}
          >
            Suspend Tenant
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default TenantList;
