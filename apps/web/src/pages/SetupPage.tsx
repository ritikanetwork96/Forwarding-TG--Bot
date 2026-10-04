import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

/**
 * Public registration is permanently decommissioned.
 * Redirects automatically to the Sign In portal.
 */
export const SetupPage: React.FC = () => {
  const navigate = useNavigate();

  useEffect(() => {
    navigate('/login', { replace: true });
  }, [navigate]);

  return null;
};
