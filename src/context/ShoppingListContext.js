import React, { createContext, useState, useContext, useEffect } from 'react';
import { supabase } from '../config/supabase';
import { useAuth } from './AuthContext';
import { useHousehold } from './HouseholdContext';

const ShoppingListContext = createContext();

export const ShoppingListProvider = ({ children }) => {
  const { user } = useAuth();
  const { currentHousehold } = useHousehold();
  const [items, setItems] = useState([]);
  const [lists, setLists] = useState([]);
  const [currentList, setCurrentList] = useState('default');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) {
      loadLists();
    }
  }, [user, currentHousehold]);

  useEffect(() => {
    if (user) {
      loadItems();
    }
  }, [user, currentHousehold, currentList]);

  const loadLists = async () => {
    try {
      let query = supabase
        .from('shopping_list')
        .select('list_name');

      if (currentHousehold) {
        query = query.eq('household_id', currentHousehold.id);
      } else {
        query = query.eq('user_id', user.id).is('household_id', null);
      }

      const { data, error } = await query;
      if (error) throw error;

      const uniqueNames = [...new Set((data || []).map(d => d.list_name))].sort();
      if (!uniqueNames.includes('default')) uniqueNames.unshift('default');
      setLists(uniqueNames);

      // If current list was deleted, go back to default
      if (!uniqueNames.includes(currentList)) {
        setCurrentList('default');
      }
    } catch (error) {
      console.error('Error loading lists:', error);
      setLists(['default']);
    }
  };

  const loadItems = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('shopping_list')
        .select('*')
        .eq('list_name', currentList)
        .order('checked', { ascending: true })
        .order('created_at', { ascending: false });

      if (currentHousehold) {
        query = query.eq('household_id', currentHousehold.id);
      } else {
        query = query.eq('user_id', user.id).is('household_id', null);
      }

      const { data, error } = await query;
      if (error) throw error;
      setItems(data || []);
    } catch (error) {
      console.error('Error loading shopping list:', error);
    } finally {
      setLoading(false);
    }
  };

  const addItem = async (name, quantity) => {
    if (!name.trim()) return { success: false };

    try {
      const newItem = {
        user_id: user.id,
        household_id: currentHousehold ? currentHousehold.id : null,
        name: name.trim(),
        quantity: quantity?.trim() || null,
        checked: false,
        added_by_email: user.email,
        list_name: currentList,
      };

      const { data, error } = await supabase
        .from('shopping_list')
        .insert(newItem)
        .select()
        .single();

      if (error) throw error;

      setItems(prev => [data, ...prev]);
      return { success: true };
    } catch (error) {
      console.error('Error adding item:', error);
      return { success: false, error: error.message };
    }
  };

  const toggleItem = async (id, checked) => {
    try {
      const { error } = await supabase
        .from('shopping_list')
        .update({ checked: !checked })
        .eq('id', id);

      if (error) throw error;

      setItems(prev =>
        prev.map(item => item.id === id ? { ...item, checked: !checked } : item)
      );
      return { success: true };
    } catch (error) {
      console.error('Error toggling item:', error);
      return { success: false };
    }
  };

  const deleteItem = async (id) => {
    try {
      const { error } = await supabase
        .from('shopping_list')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setItems(prev => prev.filter(item => item.id !== id));
      return { success: true };
    } catch (error) {
      console.error('Error deleting item:', error);
      return { success: false };
    }
  };

  const clearChecked = async () => {
    const checkedIds = items.filter(i => i.checked).map(i => i.id);
    if (checkedIds.length === 0) return { success: true };

    try {
      const { error } = await supabase
        .from('shopping_list')
        .delete()
        .in('id', checkedIds);

      if (error) throw error;

      setItems(prev => prev.filter(item => !item.checked));
      return { success: true };
    } catch (error) {
      console.error('Error clearing checked items:', error);
      return { success: false };
    }
  };

  const createList = async (name) => {
    const trimmed = name.trim();
    if (!trimmed || lists.includes(trimmed)) return { success: false };
    setLists(prev => [...prev, trimmed].sort());
    setCurrentList(trimmed);
    return { success: true };
  };

  const deleteList = async (name) => {
    if (name === 'default') return { success: false };

    try {
      let query = supabase
        .from('shopping_list')
        .delete()
        .eq('list_name', name);

      if (currentHousehold) {
        query = query.eq('household_id', currentHousehold.id);
      } else {
        query = query.eq('user_id', user.id).is('household_id', null);
      }

      const { error } = await query;
      if (error) throw error;

      setLists(prev => prev.filter(l => l !== name));
      if (currentList === name) setCurrentList('default');
      return { success: true };
    } catch (error) {
      console.error('Error deleting list:', error);
      return { success: false };
    }
  };

  const switchList = (name) => {
    setCurrentList(name);
  };

  return (
    <ShoppingListContext.Provider value={{
      items, loading, lists, currentList,
      loadItems, addItem, toggleItem, deleteItem, clearChecked,
      createList, deleteList, switchList, loadLists,
    }}>
      {children}
    </ShoppingListContext.Provider>
  );
};

export const useShoppingList = () => {
  const context = useContext(ShoppingListContext);
  if (!context) {
    throw new Error('useShoppingList must be used within a ShoppingListProvider');
  }
  return context;
};
