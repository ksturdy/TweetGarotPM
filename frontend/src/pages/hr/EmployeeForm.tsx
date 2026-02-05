import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const EmployeeForm: React.FC = () => {
  const navigate = useNavigate();

  // Employees are now managed via Vista - redirect to employee list
  useEffect(() => {
    navigate('/hr/employees', { replace: true });
  }, [navigate]);

  return (
    <div style={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      height: '50vh',
      color: 'var(--text-secondary)'
    }}>
      Redirecting to employees...
    </div>
  );
};

export default EmployeeForm;
