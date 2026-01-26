import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../../services/api';
import {
  Box,
  Container,
  Typography,
  Button,
  Card,
  CardContent,
  Grid,
  AppBar,
  Toolbar,
  Stack,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Chip,
  CircularProgress,
} from '@mui/material';
import { Construction, CheckCircle, Close } from '@mui/icons-material';

interface Plan {
  id: number;
  name: string;
  display_name: string;
  description: string;
  price_monthly: number;
  price_yearly: number;
  limits: {
    max_users: number;
    max_projects: number;
    max_customers: number;
    max_opportunities: number;
    storage_gb: number;
  };
  features: {
    projects: boolean;
    rfis: boolean;
    submittals: boolean;
    change_orders: boolean;
    daily_reports: boolean;
    schedule: boolean;
    customers: boolean;
    companies: boolean;
    sales_pipeline: boolean;
    campaigns: boolean;
    estimates: boolean;
    hr_module: boolean;
    api_access: boolean;
    custom_branding: boolean;
  };
}

const featureLabels: { [key: string]: string } = {
  projects: 'Project Management',
  rfis: 'RFIs',
  submittals: 'Submittals',
  change_orders: 'Change Orders',
  daily_reports: 'Daily Reports',
  schedule: 'Scheduling',
  customers: 'Customer Management',
  companies: 'Company Directory',
  sales_pipeline: 'Sales Pipeline',
  campaigns: 'Marketing Campaigns',
  estimates: 'Estimating',
  hr_module: 'HR Module',
  api_access: 'API Access',
  custom_branding: 'Custom Branding',
};

const PricingPage: React.FC = () => {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPlans = async () => {
      try {
        const res = await api.get('/public/plans');
        setPlans(res.data);
      } catch (err) {
        console.error('Failed to fetch plans:', err);
        // Set default plan for display
        setPlans([
          {
            id: 1,
            name: 'free',
            display_name: 'Free',
            description: 'Perfect for small teams getting started',
            price_monthly: 0,
            price_yearly: 0,
            limits: {
              max_users: 3,
              max_projects: 5,
              max_customers: 50,
              max_opportunities: 25,
              storage_gb: 1,
            },
            features: {
              projects: true,
              rfis: true,
              submittals: true,
              change_orders: true,
              daily_reports: true,
              schedule: true,
              customers: true,
              companies: true,
              sales_pipeline: false,
              campaigns: false,
              estimates: false,
              hr_module: false,
              api_access: false,
              custom_branding: false,
            },
          },
        ]);
      } finally {
        setLoading(false);
      }
    };
    fetchPlans();
  }, []);

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
      {/* Navigation */}
      <AppBar position="static" color="transparent" elevation={0}>
        <Container maxWidth="lg">
          <Toolbar disableGutters>
            <Box
              component={Link}
              to="/welcome"
              sx={{
                display: 'flex',
                alignItems: 'center',
                textDecoration: 'none',
                flexGrow: 1,
              }}
            >
              <Box
                sx={{
                  fontSize: '2.5rem',
                  mr: 1,
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                🛡️
              </Box>
              <Typography
                variant="h4"
                sx={{
                  fontWeight: 800,
                  color: 'primary.main',
                  letterSpacing: '0.1em',
                }}
              >
                TITAN
              </Typography>
            </Box>
            <Stack direction="row" spacing={2}>
              <Button color="inherit" component={Link} to="/login">
                Login
              </Button>
              <Button variant="contained" component={Link} to="/signup">
                Get Started Free
              </Button>
            </Stack>
          </Toolbar>
        </Container>
      </AppBar>

      {/* Header */}
      <Box sx={{ py: 8, textAlign: 'center' }}>
        <Container maxWidth="md">
          <Typography variant="h3" component="h1" sx={{ fontWeight: 700, mb: 2 }}>
            Simple, Transparent Pricing
          </Typography>
          <Typography variant="h6" color="text.secondary">
            Start free and scale as you grow. No hidden fees.
          </Typography>
        </Container>
      </Box>

      {/* Pricing Cards */}
      <Container maxWidth="lg" sx={{ pb: 10 }}>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress />
          </Box>
        ) : (
          <Grid container spacing={4} justifyContent="center">
            {plans.map((plan) => (
              <Grid size={{ xs: 12, sm: 6, md: 4 }} key={plan.id}>
                <Card
                  sx={{
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    border: plan.name === 'free' ? '2px solid' : '1px solid',
                    borderColor: plan.name === 'free' ? 'primary.main' : 'grey.200',
                  }}
                >
                  <CardContent sx={{ flexGrow: 1, p: 4 }}>
                    {plan.name === 'free' && (
                      <Chip label="Most Popular" color="primary" size="small" sx={{ mb: 2 }} />
                    )}
                    <Typography variant="h5" sx={{ fontWeight: 700, mb: 1 }}>
                      {plan.display_name}
                    </Typography>
                    <Typography color="text.secondary" sx={{ mb: 3 }}>
                      {plan.description}
                    </Typography>

                    <Box sx={{ mb: 3 }}>
                      <Typography variant="h3" component="span" sx={{ fontWeight: 700 }}>
                        ${plan.price_monthly}
                      </Typography>
                      <Typography component="span" color="text.secondary">
                        /month
                      </Typography>
                    </Box>

                    <Button
                      variant={plan.name === 'free' ? 'contained' : 'outlined'}
                      fullWidth
                      size="large"
                      component={Link}
                      to="/signup"
                      sx={{ mb: 3 }}
                    >
                      {plan.price_monthly === 0 ? 'Get Started Free' : 'Start Trial'}
                    </Button>

                    {/* Limits */}
                    <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
                      Includes:
                    </Typography>
                    <List dense>
                      <ListItem disableGutters>
                        <ListItemIcon sx={{ minWidth: 32 }}>
                          <CheckCircle color="success" fontSize="small" />
                        </ListItemIcon>
                        <ListItemText primary={`${plan.limits.max_users} users`} />
                      </ListItem>
                      <ListItem disableGutters>
                        <ListItemIcon sx={{ minWidth: 32 }}>
                          <CheckCircle color="success" fontSize="small" />
                        </ListItemIcon>
                        <ListItemText primary={`${plan.limits.max_projects} projects`} />
                      </ListItem>
                      <ListItem disableGutters>
                        <ListItemIcon sx={{ minWidth: 32 }}>
                          <CheckCircle color="success" fontSize="small" />
                        </ListItemIcon>
                        <ListItemText primary={`${plan.limits.storage_gb} GB storage`} />
                      </ListItem>
                    </List>

                    {/* Features */}
                    <Typography variant="subtitle2" sx={{ mt: 2, mb: 1, fontWeight: 600 }}>
                      Features:
                    </Typography>
                    <List dense>
                      {Object.entries(plan.features).map(([key, enabled]) => (
                        <ListItem key={key} disableGutters>
                          <ListItemIcon sx={{ minWidth: 32 }}>
                            {enabled ? (
                              <CheckCircle color="success" fontSize="small" />
                            ) : (
                              <Close color="disabled" fontSize="small" />
                            )}
                          </ListItemIcon>
                          <ListItemText
                            primary={featureLabels[key] || key}
                            primaryTypographyProps={{
                              color: enabled ? 'text.primary' : 'text.disabled',
                            }}
                          />
                        </ListItem>
                      ))}
                    </List>
                  </CardContent>
                </Card>
              </Grid>
            ))}

            {/* Coming Soon Card */}
            <Grid size={{ xs: 12, sm: 6, md: 4 }}>
              <Card
                sx={{
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  bgcolor: 'grey.50',
                  border: '1px dashed',
                  borderColor: 'grey.300',
                }}
              >
                <CardContent sx={{ flexGrow: 1, p: 4, textAlign: 'center', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                  <Typography variant="h5" sx={{ fontWeight: 700, mb: 2, color: 'grey.600' }}>
                    Pro & Enterprise
                  </Typography>
                  <Typography color="text.secondary" sx={{ mb: 3 }}>
                    More plans coming soon with advanced features, unlimited users, and priority support.
                  </Typography>
                  <Chip label="Coming Soon" color="default" />
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        )}
      </Container>

      {/* FAQ Section */}
      <Box sx={{ bgcolor: 'grey.100', py: 8 }}>
        <Container maxWidth="md">
          <Typography variant="h4" sx={{ fontWeight: 700, mb: 4, textAlign: 'center' }}>
            Frequently Asked Questions
          </Typography>
          <Stack spacing={3}>
            {[
              {
                q: 'Is the free plan really free?',
                a: 'Yes! The free plan is completely free with no credit card required. You can use it as long as you want.',
              },
              {
                q: 'Can I upgrade later?',
                a: 'Absolutely. You can upgrade to a paid plan at any time when you need more users, projects, or features.',
              },
              {
                q: 'What happens to my data if I downgrade?',
                a: "Your data is always safe. If you exceed limits after downgrading, you'll still have read access but won't be able to create new items until you're within limits.",
              },
              {
                q: 'Do you offer discounts for annual billing?',
                a: "Yes, annual plans come with a 20% discount. We'll announce pricing when Pro and Enterprise plans launch.",
              },
            ].map((faq) => (
              <Card key={faq.q}>
                <CardContent>
                  <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>
                    {faq.q}
                  </Typography>
                  <Typography color="text.secondary">{faq.a}</Typography>
                </CardContent>
              </Card>
            ))}
          </Stack>
        </Container>
      </Box>

      {/* Footer */}
      <Box sx={{ bgcolor: 'grey.900', color: 'grey.300', py: 4 }}>
        <Container maxWidth="lg">
          <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems="center" spacing={2}>
            <Stack direction="row" spacing={1} alignItems="center">
              <Construction sx={{ color: 'primary.light' }} />
              <Typography variant="h6" sx={{ color: 'white', fontWeight: 600 }}>
                Titan PM
              </Typography>
            </Stack>
            <Typography variant="body2">
              &copy; {new Date().getFullYear()} Titan PM. All rights reserved.
            </Typography>
          </Stack>
        </Container>
      </Box>
    </Box>
  );
};

export default PricingPage;
