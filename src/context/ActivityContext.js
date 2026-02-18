import React, { createContext, useState, useContext, useEffect } from 'react';
import { supabase } from '../config/supabase';
import { useAuth } from './AuthContext';
import { useHousehold } from './HouseholdContext';

const ActivityContext = createContext();

export const ActivityProvider = ({ children }) => {
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();
  const { currentHousehold } = useHousehold();

  useEffect(() => {
    if (user) {
      loadActivities();
    }
  }, [user, currentHousehold]);

  const loadActivities = async (limit = 50, offset = 0) => {
    try {
      setLoading(true);

      const { data, error } = await supabase.rpc('get_activity_log', {
        p_household_id: currentHousehold?.id || null,
        p_limit: limit,
        p_offset: offset,
      });

      if (error) throw error;
      setActivities(data || []);
    } catch (error) {
      console.error('Error loading activities:', error);
    } finally {
      setLoading(false);
    }
  };

  const getActivityDescription = (activity) => {
    const { action, item_name, changes } = activity;

    if (action === 'created') {
      return `Added "${item_name}" to ${activity.item_drawer || 'freezer'}`;
    } else if (action === 'deleted') {
      return `Removed "${item_name}" from ${activity.item_drawer || 'freezer'}`;
    } else if (action === 'updated') {
      const changedFields = Object.keys(changes);
      if (changedFields.length === 1 && changedFields[0] === 'quantity') {
        const oldQty = changes.quantity.old;
        const newQty = changes.quantity.new;
        return `Updated quantity of "${item_name}" from ${oldQty} to ${newQty}`;
      }
      return `Updated "${item_name}"`;
    }

    return `${action} "${item_name}"`;
  };

  return (
    <ActivityContext.Provider
      value={{
        activities,
        loading,
        loadActivities,
        getActivityDescription,
      }}
    >
      {children}
    </ActivityContext.Provider>
  );
};

export const useActivity = () => {
  const context = useContext(ActivityContext);
  if (!context) {
    throw new Error('useActivity must be used within an ActivityProvider');
  }
  return context;
};
