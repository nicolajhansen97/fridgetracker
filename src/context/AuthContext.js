import React, { createContext, useState, useContext, useEffect, useRef, useCallback } from 'react';
import { AppState } from 'react-native';
import { supabase } from '../config/supabase';
import { BiometricAuth } from '../utils/BiometricAuth';

const AuthContext = createContext();

// How long the app may sit in the background before it re-locks. Locking the
// instant you switch apps makes a quick glance at a recipe or the calculator
// infuriating; never re-locking makes the lock decorative. A minute is the
// usual compromise.
const LOCK_GRACE_MS = 60 * 1000;

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [biometricType, setBiometricType] = useState('Biometric');
  // Signed in, but hidden behind a biometric gate. Distinct from
  // !isAuthenticated: the session is alive and valid, it just is not shown
  // until the right face or finger turns up.
  const [locked, setLocked] = useState(false);
  const backgroundedAt = useRef(null);

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

    // Check active sessions on mount, and lock straight away if there is one
    // and the user asked for the gate. Done together so the app never flashes
    // its contents for a frame before the lock appears.
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setUser(session?.user ?? null);
      setIsAuthenticated(!!session);
      if (session) {
        const { available } = await BiometricAuth.isAvailable();
        if (available && (await BiometricAuth.isBiometricEnabled())) setLocked(true);
      }
      setLoading(false);
    };
    init();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setIsAuthenticated(!!session);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Re-lock when the app comes back from the background after long enough.
  // Checked against SecureStore rather than a cached flag so turning the lock
  // off in Settings takes effect immediately.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'background' || state === 'inactive') {
        if (backgroundedAt.current === null) backgroundedAt.current = Date.now();
        return;
      }
      if (state !== 'active') return;

      const since = backgroundedAt.current;
      backgroundedAt.current = null;
      if (since === null || Date.now() - since < LOCK_GRACE_MS) return;

      BiometricAuth.isBiometricEnabled()
        .then((on) => { if (on) setLocked(true); })
        .catch(() => {});
    });
    return () => sub.remove();
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
      // Just proved themselves with a password; do not immediately demand a
      // face as well.
      setLocked(false);
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
      setLocked(false);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  // Clear the gate after a successful face/fingerprint check.
  //
  // This replaces the old loginWithBiometric(), which could never succeed: it
  // required supabase.auth.getSession() to return a session, but it was only
  // ever reachable from the login screen, which is only shown when there is no
  // session. Every scan ended in "Session expired". Biometrics are a lock over
  // a live session, not a way to create one.
  const unlock = useCallback(async () => {
    try {
      const name = await BiometricAuth.getBiometricName();
      const result = await BiometricAuth.authenticate("Unlock Freezely with " + name);
      if (result.success) {
        setLocked(false);
        return { success: true };
      }
      return { success: false, error: result.error };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }, []);

  const enableBiometric = async (email) => {
    return await BiometricAuth.enableBiometric(email);
  };

  const disableBiometric = async () => {
    const res = await BiometricAuth.disableBiometric();
    setLocked(false);
    return res;
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
        locked,
        unlock,
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
