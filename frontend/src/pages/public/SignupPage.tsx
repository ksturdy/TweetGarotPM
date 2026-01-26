import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';
import {
  Box,
  Container,
  Typography,
  TextField,
  Button,
  Card,
  CardContent,
  Stepper,
  Step,
  StepLabel,
  Grid,
  Alert,
  InputAdornment,
  CircularProgress,
  Stack,
} from '@mui/material';
import {
  Construction,
  Business,
  Person,
  CheckCircle,
  Error as ErrorIcon,
} from '@mui/icons-material';

const steps = ['Company Info', 'Your Account', 'Confirmation'];

const SignupPage: React.FC = () => {
  const { signup } = useAuth();
  const navigate = useNavigate();
  const [activeStep, setActiveStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [slugChecking, setSlugChecking] = useState(false);
  const [slugAvailable, setSlugAvailable] = useState<boolean | null>(null);
  const [slugMessage, setSlugMessage] = useState('');

  // Form data
  const [formData, setFormData] = useState({
    companyName: '',
    slug: '',
    phone: '',
    address: '',
    city: '',
    state: '',
    zipCode: '',
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    confirmPassword: '',
  });

  // Handle input changes
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));

    // Auto-generate slug from company name
    if (name === 'companyName') {
      const generatedSlug = value
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .substring(0, 50);
      setFormData((prev) => ({ ...prev, slug: generatedSlug }));
      if (generatedSlug.length >= 3) {
        checkSlugAvailability(generatedSlug);
      }
    }

    // Check slug when manually changed
    if (name === 'slug') {
      const cleanSlug = value.toLowerCase().replace(/[^a-z0-9-]/g, '');
      setFormData((prev) => ({ ...prev, slug: cleanSlug }));
      if (cleanSlug.length >= 3) {
        checkSlugAvailability(cleanSlug);
      } else {
        setSlugAvailable(null);
        setSlugMessage('');
      }
    }
  };

  // Check slug availability
  const checkSlugAvailability = async (slug: string) => {
    setSlugChecking(true);
    try {
      const res = await api.get(`/public/check-slug/${slug}`);
      setSlugAvailable(res.data.available);
      setSlugMessage(res.data.reason || (res.data.available ? 'Available!' : 'Not available'));
    } catch (err) {
      setSlugAvailable(null);
      setSlugMessage('Could not check availability');
    } finally {
      setSlugChecking(false);
    }
  };

  // Validate current step
  const validateStep = (): boolean => {
    setError('');

    if (activeStep === 0) {
      if (!formData.companyName.trim()) {
        setError('Company name is required');
        return false;
      }
      if (formData.slug.length < 3) {
        setError('Company URL must be at least 3 characters');
        return false;
      }
      if (slugAvailable === false) {
        setError('Please choose a different company URL');
        return false;
      }
    }

    if (activeStep === 1) {
      if (!formData.firstName.trim() || !formData.lastName.trim()) {
        setError('First and last name are required');
        return false;
      }
      if (!formData.email.trim()) {
        setError('Email is required');
        return false;
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
        setError('Please enter a valid email address');
        return false;
      }
      if (formData.password.length < 8) {
        setError('Password must be at least 8 characters');
        return false;
      }
      if (!/[A-Z]/.test(formData.password)) {
        setError('Password must contain at least one uppercase letter');
        return false;
      }
      if (!/[a-z]/.test(formData.password)) {
        setError('Password must contain at least one lowercase letter');
        return false;
      }
      if (!/[0-9]/.test(formData.password)) {
        setError('Password must contain at least one number');
        return false;
      }
      if (formData.password !== formData.confirmPassword) {
        setError('Passwords do not match');
        return false;
      }
    }

    return true;
  };

  // Handle next step
  const handleNext = () => {
    if (validateStep()) {
      setActiveStep((prev) => prev + 1);
    }
  };

  // Handle back
  const handleBack = () => {
    setActiveStep((prev) => prev - 1);
  };

  // Handle form submission
  const handleSubmit = async () => {
    if (!validateStep()) return;

    setLoading(true);
    setError('');

    try {
      await signup({
        companyName: formData.companyName,
        slug: formData.slug,
        firstName: formData.firstName,
        lastName: formData.lastName,
        email: formData.email,
        password: formData.password,
        phone: formData.phone || undefined,
        address: formData.address || undefined,
        city: formData.city || undefined,
        state: formData.state || undefined,
        zipCode: formData.zipCode || undefined,
      });
      navigate('/');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to create account. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'grey.50', py: 4 }}>
      <Container maxWidth="sm">
        {/* Header */}
        <Stack direction="row" spacing={1} alignItems="center" justifyContent="center" sx={{ mb: 4 }}>
          <Construction sx={{ fontSize: 32, color: 'primary.main' }} />
          <Typography variant="h4" sx={{ fontWeight: 700, color: 'primary.main' }}>
            Titan PM
          </Typography>
        </Stack>

        <Card>
          <CardContent sx={{ p: 4 }}>
            <Typography variant="h5" sx={{ mb: 1, fontWeight: 600, textAlign: 'center' }}>
              Create Your Account
            </Typography>
            <Typography color="text.secondary" sx={{ mb: 4, textAlign: 'center' }}>
              Get started with your free account
            </Typography>

            {/* Stepper */}
            <Stepper activeStep={activeStep} sx={{ mb: 4 }}>
              {steps.map((label) => (
                <Step key={label}>
                  <StepLabel>{label}</StepLabel>
                </Step>
              ))}
            </Stepper>

            {/* Error Alert */}
            {error && (
              <Alert severity="error" sx={{ mb: 3 }}>
                {error}
              </Alert>
            )}

            {/* Step 1: Company Info */}
            {activeStep === 0 && (
              <Box>
                <Stack spacing={3}>
                  <TextField
                    label="Company Name"
                    name="companyName"
                    value={formData.companyName}
                    onChange={handleChange}
                    fullWidth
                    required
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <Business color="action" />
                        </InputAdornment>
                      ),
                    }}
                  />
                  <TextField
                    label="Company URL"
                    name="slug"
                    value={formData.slug}
                    onChange={handleChange}
                    fullWidth
                    required
                    helperText={
                      slugChecking
                        ? 'Checking availability...'
                        : slugMessage || 'This will be your unique URL'
                    }
                    error={slugAvailable === false}
                    InputProps={{
                      startAdornment: <InputAdornment position="start">titanpm.com/</InputAdornment>,
                      endAdornment: (
                        <InputAdornment position="end">
                          {slugChecking && <CircularProgress size={20} />}
                          {!slugChecking && slugAvailable === true && <CheckCircle color="success" />}
                          {!slugChecking && slugAvailable === false && <ErrorIcon color="error" />}
                        </InputAdornment>
                      ),
                    }}
                  />
                  <TextField
                    label="Phone (Optional)"
                    name="phone"
                    value={formData.phone}
                    onChange={handleChange}
                    fullWidth
                  />
                  <TextField
                    label="Address (Optional)"
                    name="address"
                    value={formData.address}
                    onChange={handleChange}
                    fullWidth
                  />
                  <Grid container spacing={2}>
                    <Grid size={5}>
                      <TextField
                        label="City"
                        name="city"
                        value={formData.city}
                        onChange={handleChange}
                        fullWidth
                      />
                    </Grid>
                    <Grid size={3}>
                      <TextField
                        label="State"
                        name="state"
                        value={formData.state}
                        onChange={handleChange}
                        fullWidth
                      />
                    </Grid>
                    <Grid size={4}>
                      <TextField
                        label="ZIP"
                        name="zipCode"
                        value={formData.zipCode}
                        onChange={handleChange}
                        fullWidth
                      />
                    </Grid>
                  </Grid>
                </Stack>
              </Box>
            )}

            {/* Step 2: Account Info */}
            {activeStep === 1 && (
              <Box>
                <Stack spacing={3}>
                  <Grid container spacing={2}>
                    <Grid size={6}>
                      <TextField
                        label="First Name"
                        name="firstName"
                        value={formData.firstName}
                        onChange={handleChange}
                        fullWidth
                        required
                      />
                    </Grid>
                    <Grid size={6}>
                      <TextField
                        label="Last Name"
                        name="lastName"
                        value={formData.lastName}
                        onChange={handleChange}
                        fullWidth
                        required
                      />
                    </Grid>
                  </Grid>
                  <TextField
                    label="Email"
                    name="email"
                    type="email"
                    value={formData.email}
                    onChange={handleChange}
                    fullWidth
                    required
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <Person color="action" />
                        </InputAdornment>
                      ),
                    }}
                  />
                  <TextField
                    label="Password"
                    name="password"
                    type="password"
                    value={formData.password}
                    onChange={handleChange}
                    fullWidth
                    required
                    helperText="At least 8 characters with uppercase, lowercase, and number"
                  />
                  <TextField
                    label="Confirm Password"
                    name="confirmPassword"
                    type="password"
                    value={formData.confirmPassword}
                    onChange={handleChange}
                    fullWidth
                    required
                  />
                </Stack>
              </Box>
            )}

            {/* Step 3: Confirmation */}
            {activeStep === 2 && (
              <Box>
                <Typography variant="h6" sx={{ mb: 2 }}>
                  Review Your Information
                </Typography>
                <Stack spacing={2}>
                  <Box sx={{ p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
                    <Typography variant="subtitle2" color="text.secondary">
                      Company
                    </Typography>
                    <Typography variant="body1" sx={{ fontWeight: 500 }}>
                      {formData.companyName}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      titanpm.com/{formData.slug}
                    </Typography>
                  </Box>
                  <Box sx={{ p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
                    <Typography variant="subtitle2" color="text.secondary">
                      Admin Account
                    </Typography>
                    <Typography variant="body1" sx={{ fontWeight: 500 }}>
                      {formData.firstName} {formData.lastName}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {formData.email}
                    </Typography>
                  </Box>
                  <Alert severity="info">
                    By creating an account, you agree to our Terms of Service and Privacy Policy.
                  </Alert>
                </Stack>
              </Box>
            )}

            {/* Navigation Buttons */}
            <Box sx={{ mt: 4, display: 'flex', justifyContent: 'space-between' }}>
              <Button disabled={activeStep === 0} onClick={handleBack}>
                Back
              </Button>
              <Box>
                {activeStep < steps.length - 1 ? (
                  <Button variant="contained" onClick={handleNext}>
                    Next
                  </Button>
                ) : (
                  <Button
                    variant="contained"
                    onClick={handleSubmit}
                    disabled={loading}
                    startIcon={loading && <CircularProgress size={20} color="inherit" />}
                  >
                    {loading ? 'Creating Account...' : 'Create Account'}
                  </Button>
                )}
              </Box>
            </Box>
          </CardContent>
        </Card>

        {/* Login Link */}
        <Typography variant="body2" sx={{ mt: 3, textAlign: 'center' }}>
          Already have an account?{' '}
          <Link to="/login" style={{ color: '#1976d2', textDecoration: 'none' }}>
            Log in
          </Link>
        </Typography>
      </Container>
    </Box>
  );
};

export default SignupPage;
