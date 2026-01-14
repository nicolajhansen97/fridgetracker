import React, { createContext, useState, useContext, useEffect } from 'react';
import { supabase } from '../config/supabase';
import { useAuth } from './AuthContext';
import { useHousehold } from './HouseholdContext';

const FridgeContext = createContext();

export const FridgeProvider = ({ children }) => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();
  const { currentHousehold } = useHousehold();

  useEffect(() => {
    if (user) {
      loadItems();
    }
  }, [user, currentHousehold]);

  const loadItems = async () => {
    try {
      setLoading(true);

      let query = supabase.from('fridge_items').select('*');

      if (currentHousehold?.id) {
        // Load household items
        query = query.eq('household_id', currentHousehold.id);
      } else {
        // Load personal items (no household)
        query = query.eq('user_id', user.id).is('household_id', null);
      }

      const { data, error } = await query.order('created_at', { ascending: false });

      if (error) throw error;
      setItems(data || []);
    } catch (error) {
      console.error('Error loading items:', error);
    } finally {
      setLoading(false);
    }
  };

  const addItem = async (itemData) => {
    try {
      const { data, error } = await supabase
        .from('fridge_items')
        .insert([
          {
            user_id: user.id,
            household_id: currentHousehold?.id || null,
            name: itemData.name,
            drawer: itemData.drawer,
            quantity: itemData.quantity || 1,
            expiry_date: itemData.expiry_date,
            notes: itemData.notes,
          },
        ])
        .select();

      if (error) throw error;

      setItems([...data, ...items]);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  const updateItem = async (id, itemData) => {
    try {
      const { data, error } = await supabase
        .from('fridge_items')
        .update(itemData)
        .eq('id', id)
        .eq('user_id', user.id)
        .select();

      if (error) throw error;

      setItems(items.map((item) => (item.id === id ? data[0] : item)));
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  const deleteItem = async (id) => {
    try {
      const { error } = await supabase
        .from('fridge_items')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id);

      if (error) throw error;

      setItems(items.filter((item) => item.id !== id));
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  return (
    <FridgeContext.Provider
      value={{
        items,
        loading,
        addItem,
        updateItem,
        deleteItem,
        loadItems,
      }}
    >
      {children}
    </FridgeContext.Provider>
  );
};

export const useFridge = () => {
  const context = useContext(FridgeContext);
  if (!context) {
    throw new Error('useFridge must be used within a FridgeProvider');
  }
  return context;
};
