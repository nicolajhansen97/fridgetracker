import React, { createContext, useState, useContext, useEffect } from 'react';
import { supabase } from '../config/supabase';
import { useAuth } from './AuthContext';
import { useHousehold } from './HouseholdContext';

const DrawerContext = createContext();

export const useDrawers = () => {
  const context = useContext(DrawerContext);
  if (!context) {
    throw new Error('useDrawers must be used within a DrawerProvider');
  }
  return context;
};

export const DrawerProvider = ({ children }) => {
  const { user } = useAuth();
  const { currentHousehold } = useHousehold();
  const [drawers, setDrawers] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  // Load drawers when user or household changes
  useEffect(() => {
    if (user) {
      loadDrawers();
    } else {
      setDrawers([]);
    }
  }, [user, currentHousehold]);

  const loadDrawers = async () => {
    if (!user) return;

    try {
      setIsLoading(true);

      let query = supabase.from('drawers').select('*');

      if (currentHousehold?.id) {
        // Load household drawers
        query = query.eq('household_id', currentHousehold.id);
      } else {
        // Load personal drawers (no household)
        query = query.eq('user_id', user.id).is('household_id', null);
      }

      const { data, error } = await query.order('sort_order', { ascending: true });

      if (error) throw error;
      setDrawers(data || []);
    } catch (error) {
      console.error('Error loading drawers:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const addDrawer = async (drawerData) => {
    if (!user) return { error: 'No user logged in' };

    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('drawers')
        .insert([
          {
            user_id: user.id,
            household_id: currentHousehold?.id || null,
            name: drawerData.name,
            icon: drawerData.icon || '📦',
            sort_order: drawerData.sort_order || drawers.length,
          },
        ])
        .select();

      if (error) throw error;

      setDrawers((prev) => [...prev, data[0]].sort((a, b) => a.sort_order - b.sort_order));
      return { data: data[0] };
    } catch (error) {
      console.error('Error adding drawer:', error);
      return { error: error.message };
    } finally {
      setIsLoading(false);
    }
  };

  const updateDrawer = async (drawerId, updates) => {
    if (!user) return { error: 'No user logged in' };

    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('drawers')
        .update(updates)
        .eq('id', drawerId)
        .eq('user_id', user.id)
        .select();

      if (error) throw error;

      setDrawers((prev) =>
        prev.map((drawer) => (drawer.id === drawerId ? data[0] : drawer))
          .sort((a, b) => a.sort_order - b.sort_order)
      );
      return { data: data[0] };
    } catch (error) {
      console.error('Error updating drawer:', error);
      return { error: error.message };
    } finally {
      setIsLoading(false);
    }
  };

  const deleteDrawer = async (drawerId) => {
    if (!user) return { error: 'No user logged in' };

    try {
      setIsLoading(true);
      const { error } = await supabase
        .from('drawers')
        .delete()
        .eq('id', drawerId)
        .eq('user_id', user.id);

      if (error) throw error;

      setDrawers((prev) => prev.filter((drawer) => drawer.id !== drawerId));
      return { success: true };
    } catch (error) {
      console.error('Error deleting drawer:', error);
      return { error: error.message };
    } finally {
      setIsLoading(false);
    }
  };

  const reorderDrawers = async (reorderedDrawers) => {
    if (!user) return { error: 'No user logged in' };

    try {
      setIsLoading(true);

      // Update sort_order for each drawer
      const updates = reorderedDrawers.map((drawer, index) =>
        supabase
          .from('drawers')
          .update({ sort_order: index })
          .eq('id', drawer.id)
          .eq('user_id', user.id)
      );

      await Promise.all(updates);

      setDrawers(reorderedDrawers.map((drawer, index) => ({
        ...drawer,
        sort_order: index,
      })));

      return { success: true };
    } catch (error) {
      console.error('Error reordering drawers:', error);
      return { error: error.message };
    } finally {
      setIsLoading(false);
    }
  };

  const value = {
    drawers,
    isLoading,
    addDrawer,
    updateDrawer,
    deleteDrawer,
    reorderDrawers,
    loadDrawers,
  };

  return <DrawerContext.Provider value={value}>{children}</DrawerContext.Provider>;
};
