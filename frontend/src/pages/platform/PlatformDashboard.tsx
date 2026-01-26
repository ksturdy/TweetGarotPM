import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Container,
  Typography,
  Grid,
  Card,
  CardContent,
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
  Stack,
} from '@mui/material';
import {
  Business,
  People,
  Folder,
  TrendingUp,
  Search,
  Refresh,
  Add,
  Visibility,
} from '@mui/icons-material';
import { getPlatformStats, getPlanStats, getTenants, PlatformStats, PlanStats, Tenant } from '../../services/platform';

const PlatformDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [planStats, setPlanStats] = useState<PlanStats[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  const fetchData = async () => {
    setLoading(true);
    setError('');
    try {
      const [statsData, planStatsData, tenantsData] = await Promise.all([
        getPlatformStats(),
        getPlanStats(),
        getTenants({ limit: 10 }),
      ]);
      setStats(statsData);
      setPlanStats(planStatsData);
      setTenants(tenantsData.tenants);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load platform data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSearch = async () => {
    try {
      const tenantsData = await getTenants({ search: searchTerm, limit: 10 });
      setTenants(tenantsData.tenants);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Search failed');
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

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Container maxWidth="xl" sx={{ py: 3 }}>
      {/* Header */}
      <Box sx={{ mb: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 700 }}>
            Platform Administration
          </Typography>
          <Typography color="text.secondary">
            Manage all tenants, plans, and platform settings
          </Typography>
        </Box>
        <Button startIcon={<Refresh />} onClick={fetchData} variant="outlined">
          Refresh
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {/* Stats Cards */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <Business sx={{ color: 'primary.main', mr: 1 }} />
                <Typography color="text.secondary" variant="body2">
                  Total Tenants
                </Typography>
              </Box>
              <Typography variant="h4" sx={{ fontWeight: 700 }}>
                {stats?.total_tenants || 0}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {stats?.active_tenants || 0} active, {stats?.suspended_tenants || 0} suspended
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <People sx={{ color: 'success.main', mr: 1 }} />
                <Typography color="text.secondary" variant="body2">
                  Total Users
                </Typography>
              </Box>
              <Typography variant="h4" sx={{ fontWeight: 700 }}>
                {stats?.total_active_users || 0}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {stats?.total_users || 0} total registered
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <Folder sx={{ color: 'warning.main', mr: 1 }} />
                <Typography color="text.secondary" variant="body2">
                  Total Projects
                </Typography>
              </Box>
              <Typography variant="h4" sx={{ fontWeight: 700 }}>
                {stats?.total_projects || 0}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Across all tenants
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <TrendingUp sx={{ color: 'info.main', mr: 1 }} />
                <Typography color="text.secondary" variant="body2">
                  New Tenants (30d)
                </Typography>
              </Box>
              <Typography variant="h4" sx={{ fontWeight: 700 }}>
                {stats?.new_tenants_30d || 0}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {stats?.total_opportunities || 0} total opportunities
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Plan Distribution */}
      <Card sx={{ mb: 4 }}>
        <CardContent>
          <Typography variant="h6" sx={{ mb: 2 }}>
            Plan Distribution
          </Typography>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Plan</TableCell>
                  <TableCell align="right">Price/Month</TableCell>
                  <TableCell align="right">Tenants</TableCell>
                  <TableCell align="right">Est. Monthly Revenue</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {planStats.map((plan) => (
                  <TableRow key={plan.plan_name}>
                    <TableCell>{plan.display_name || plan.plan_name}</TableCell>
                    <TableCell align="right">
                      ${Number(plan.price_monthly || 0).toFixed(2)}
                    </TableCell>
                    <TableCell align="right">{plan.tenant_count}</TableCell>
                    <TableCell align="right">
                      ${Number(plan.monthly_revenue || 0).toFixed(2)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>

      {/* Recent Tenants */}
      <Card>
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="h6">Recent Tenants</Typography>
            <Stack direction="row" spacing={2}>
              <TextField
                size="small"
                placeholder="Search tenants..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Search />
                    </InputAdornment>
                  ),
                }}
              />
              <Button
                variant="contained"
                startIcon={<Add />}
                onClick={() => navigate('/platform/tenants')}
              >
                View All
              </Button>
            </Stack>
          </Box>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Organization</TableCell>
                  <TableCell>Plan</TableCell>
                  <TableCell align="right">Users</TableCell>
                  <TableCell align="right">Projects</TableCell>
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
                          {tenant.slug}
                        </Typography>
                      </Box>
                    </TableCell>
                    <TableCell>{tenant.plan_display_name || tenant.plan_name}</TableCell>
                    <TableCell align="right">
                      {tenant.active_users} / {tenant.total_users}
                    </TableCell>
                    <TableCell align="right">{tenant.project_count}</TableCell>
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
                      <IconButton
                        size="small"
                        onClick={() => navigate(`/platform/tenants/${tenant.id}`)}
                      >
                        <Visibility />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
                {tenants.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} align="center">
                      <Typography color="text.secondary">No tenants found</Typography>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>
    </Container>
  );
};

export default PlatformDashboard;
