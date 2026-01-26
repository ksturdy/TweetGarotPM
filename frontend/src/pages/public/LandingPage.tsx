import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
  Box,
  Container,
  Typography,
  Button,
  Grid,
  Card,
  CardContent,
  AppBar,
  Toolbar,
  Stack,
} from '@mui/material';
import {
  Construction,
  Assignment,
  Description,
  CalendarMonth,
  People,
  TrendingUp,
  CheckCircle,
} from '@mui/icons-material';

const features = [
  {
    icon: <Construction fontSize="large" />,
    title: 'Project Management',
    description: 'Track all your construction projects in one place with real-time status updates.',
  },
  {
    icon: <Assignment fontSize="large" />,
    title: 'RFIs & Submittals',
    description: 'Streamline your request for information and submittal workflows.',
  },
  {
    icon: <Description fontSize="large" />,
    title: 'Change Orders',
    description: 'Manage contract modifications with full audit trails and approval workflows.',
  },
  {
    icon: <CalendarMonth fontSize="large" />,
    title: 'Scheduling',
    description: 'Plan and track project schedules with work breakdown structures.',
  },
  {
    icon: <People fontSize="large" />,
    title: 'Team Management',
    description: 'Organize your workforce across departments and office locations.',
  },
  {
    icon: <TrendingUp fontSize="large" />,
    title: 'Sales Pipeline',
    description: 'Track opportunities from lead to project conversion.',
  },
];

const LandingPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  // If already logged in, redirect to dashboard
  React.useEffect(() => {
    if (user) {
      navigate('/');
    }
  }, [user, navigate]);

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

      {/* Hero Section */}
      <Box
        sx={{
          py: { xs: 8, md: 12 },
          background: 'linear-gradient(135deg, #1976d2 0%, #1565c0 100%)',
          color: 'white',
        }}
      >
        <Container maxWidth="lg">
          <Grid container spacing={4} alignItems="center">
            <Grid size={{ xs: 12, md: 6 }}>
              <Typography variant="h2" component="h1" sx={{ fontWeight: 700, mb: 2 }}>
                Construction Project Management Made Simple
              </Typography>
              <Typography variant="h5" sx={{ mb: 4, opacity: 0.9 }}>
                Streamline your projects, track progress, and grow your business with Titan PM.
              </Typography>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                <Button
                  variant="contained"
                  size="large"
                  component={Link}
                  to="/signup"
                  sx={{
                    bgcolor: 'white',
                    color: 'primary.main',
                    '&:hover': { bgcolor: 'grey.100' },
                    py: 1.5,
                    px: 4,
                  }}
                >
                  Start Free Trial
                </Button>
                <Button
                  variant="outlined"
                  size="large"
                  component={Link}
                  to="/pricing"
                  sx={{
                    borderColor: 'white',
                    color: 'white',
                    '&:hover': { borderColor: 'white', bgcolor: 'rgba(255,255,255,0.1)' },
                    py: 1.5,
                    px: 4,
                  }}
                >
                  View Pricing
                </Button>
              </Stack>
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <Box
                sx={{
                  bgcolor: 'rgba(255,255,255,0.1)',
                  borderRadius: 2,
                  p: 3,
                  backdropFilter: 'blur(10px)',
                }}
              >
                <Typography variant="h6" sx={{ mb: 2 }}>
                  Trusted by contractors nationwide
                </Typography>
                <Stack spacing={1}>
                  {['Track unlimited projects', 'Manage RFIs and submittals', 'Real-time collaboration', 'Mobile-friendly interface'].map((item) => (
                    <Stack key={item} direction="row" spacing={1} alignItems="center">
                      <CheckCircle sx={{ fontSize: 20 }} />
                      <Typography>{item}</Typography>
                    </Stack>
                  ))}
                </Stack>
              </Box>
            </Grid>
          </Grid>
        </Container>
      </Box>

      {/* Features Section */}
      <Container maxWidth="lg" sx={{ py: 10 }}>
        <Typography variant="h3" component="h2" textAlign="center" sx={{ mb: 2, fontWeight: 700 }}>
          Everything You Need
        </Typography>
        <Typography variant="h6" textAlign="center" color="text.secondary" sx={{ mb: 6, maxWidth: 600, mx: 'auto' }}>
          Titan PM gives you all the tools to manage your construction business from lead to completion.
        </Typography>
        <Grid container spacing={4}>
          {features.map((feature) => (
            <Grid size={{ xs: 12, sm: 6, md: 4 }} key={feature.title}>
              <Card sx={{ height: '100%', transition: '0.3s', '&:hover': { transform: 'translateY(-4px)', boxShadow: 4 } }}>
                <CardContent>
                  <Box sx={{ color: 'primary.main', mb: 2 }}>{feature.icon}</Box>
                  <Typography variant="h6" sx={{ mb: 1, fontWeight: 600 }}>
                    {feature.title}
                  </Typography>
                  <Typography color="text.secondary">{feature.description}</Typography>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      </Container>

      {/* CTA Section */}
      <Box sx={{ bgcolor: 'grey.100', py: 10 }}>
        <Container maxWidth="md">
          <Card sx={{ p: 6, textAlign: 'center' }}>
            <Typography variant="h4" sx={{ mb: 2, fontWeight: 700 }}>
              Ready to get started?
            </Typography>
            <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
              Join hundreds of contractors who trust Titan PM to manage their projects.
              Start your free trial today - no credit card required.
            </Typography>
            <Button variant="contained" size="large" component={Link} to="/signup" sx={{ py: 1.5, px: 6 }}>
              Create Free Account
            </Button>
          </Card>
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

export default LandingPage;
