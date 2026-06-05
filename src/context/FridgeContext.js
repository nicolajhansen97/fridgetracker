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
      // Validate position if provided
      if (itemData.position) {
        const { data: isAvailable, error: validationError } = await supabase.rpc(
          'is_position_available',
          {
            p_position: itemData.position,
            p_household_id: currentHousehold?.id || null,
          }
        );

        if (validationError) throw validationError;

        if (!isAvailable) {
          return {
            success: false,
            error: `Position ${itemData.position} is already in use`,
            errorKey: 'positionInUse',
            errorParams: { position: itemData.position },
          };
        }
      }

      const { data, error } = await supabase
        .from('fridge_items')
        .insert([
          {
            user_id: user.id,
            household_id: currentHousehold?.id || null,
            name: itemData.name,
            drawer: itemData.drawer,
            quantity: itemData.quantity || 1,
            unit: itemData.unit || null,
            expiry_date: itemData.expiry_date,
            frozen_date: itemData.frozen_date || null,
            notes: itemData.notes,
            position: itemData.position || null,
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
      // Validate position if changed and provided
      if (itemData.position !== undefined && itemData.position !== null) {
        const { data: isAvailable, error: validationError } = await supabase.rpc(
          'is_position_available',
          {
            p_position: itemData.position,
            p_household_id: currentHousehold?.id || null,
            p_exclude_item_id: id,
          }
        );

        if (validationError) throw validationError;

        if (!isAvailable) {
          return {
            success: false,
            error: `Position ${itemData.position} is already in use`,
            errorKey: 'positionInUse',
            errorParams: { position: itemData.position },
          };
        }
      }

      let updateQuery = supabase
        .from('fridge_items')
        .update(itemData)
        .eq('id', id);

      if (currentHousehold?.id) {
        updateQuery = updateQuery.eq('household_id', currentHousehold.id);
      } else {
        updateQuery = updateQuery.eq('user_id', user.id);
      }

      const { data, error } = await updateQuery.select();

      if (error) throw error;

      setItems(items.map((item) => (item.id === id ? data[0] : item)));
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  const deleteItem = async (id) => {
    try {
      let query = supabase
        .from('fridge_items')
        .delete()
        .eq('id', id);

      if (currentHousehold?.id) {
        query = query.eq('household_id', currentHousehold.id);
      } else {
        query = query.eq('user_id', user.id);
      }

      const { error } = await query;

      if (error) throw error;

      setItems(items.filter((item) => item.id !== id));
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  const consumeItem = async (id) => {
    try {
      const { error } = await supabase.rpc('consume_fridge_item', { p_item_id: id });
      if (error) throw error;
      setItems(items.filter((item) => item.id !== id));
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  // Partial use: log the used amount as a 'consumed' event and reduce the
  // item's quantity (removing it if nothing is left). Backed by the
  // consume_fridge_item_partial RPC (see SQL Scripts/ADD_PARTIAL_CONSUME.sql).
  const consumePartial = async (id, used) => {
    try {
      const { error } = await supabase.rpc('consume_fridge_item_partial', {
        p_item_id: id,
        p_used: used,
      });
      if (error) throw error;
      setItems(
        items
          .map((item) => {
            if (item.id !== id) return item;
            const remaining = (Number(item.quantity) || 0) - used;
            return remaining > 0 ? { ...item, quantity: remaining } : null;
          })
          .filter(Boolean)
      );
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  const getNextAvailablePosition = () => {
    const usedPositions = new Set(
      items
        .filter((item) => item.position != null && item.position > 0)
        .map((item) => item.position)
    );
    let next = 1;
    while (usedPositions.has(next)) {
      next++;
    }
    return next;
  };

  return (
    <FridgeContext.Provider
      value={{
        items,
        loading,
        addItem,
        updateItem,
        deleteItem,
        consumeItem,
        consumePartial,
        loadItems,
        getNextAvailablePosition,
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
