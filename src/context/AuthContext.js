import React, { createContext, useState, useContext, useEffect } from 'react';
import { supabase } from '../config/supabase';
import { BiometricAuth } from '../utils/BiometricAuth';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [biometricType, setBiometricType] = useState('Biometric');

  useEffect(() => {
    // Check biometric availability
    const checkBiometric = async () => {
      const { available } = await BiometricAuth.isAvailable();
      setBiometricAvailable(available);
      if (available) {
        const type = await BiometricAuth.getBiometricName();
        setBiometricType(type);
      }
    };
    checkBiometric();

    // Check active sessions on mount
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setIsAuthenticated(!!session);
      setLoading(false);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setIsAuthenticated(!!session);
    });

    return () => subscription.unsubscribe();
  }, []);

  const login = async (email, password) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      setUser(data.user);
      setIsAuthenticated(true);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  const register = async (email, password) => {
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
      });

      if (error) throw error;

      return {
        success: true,
        message: 'Registration successful! Please check your email to verify your account.'
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  const forgotPassword = async (email) => {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: 'your-app://reset-password',
      });

      if (error) throw error;

      return {
        success: true,
        message: 'Password reset email sent! Please check your inbox.'
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  const logout = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;

      setUser(null);
      setIsAuthenticated(false);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  const loginWithBiometric = async () => {
    try {
      const result = await BiometricAuth.performBiometricLogin();

      if (!result.success) {
        return { success: false, error: result.reason };
      }

      // Get the session from Supabase using the stored email
      // Note: For security, we still need valid session
      const { data: { session } } = await supabase.auth.getSession();

      if (session) {
        setUser(session.user);
        setIsAuthenticated(true);
        return { success: true };
      } else {
        return {
          success: false,
          error: 'Session expired. Please login with password again.'
        };
      }
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  const enableBiometric = async (email) => {
    return await BiometricAuth.enableBiometric(email);
  };

  const disableBiometric = async () => {
    return await BiometricAuth.disableBiometric();
  };

  const checkBiometricEnabled = async () => {
    return await BiometricAuth.isBiometricEnabled();
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated,
        loading,
        biometricAvailable,
        biometricType,
        login,
        register,
        forgotPassword,
        logout,
        loginWithBiometric,
        enableBiometric,
        disableBiometric,
        checkBiometricEnabled,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
