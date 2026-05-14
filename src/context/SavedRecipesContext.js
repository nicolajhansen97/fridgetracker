import React, { createContext, useState, useContext, useEffect, useMemo } from 'react';
import { supabase } from '../config/supabase';
import { useAuth } from './AuthContext';
import { useHousehold } from './HouseholdContext';

// Household-scoped "cookbook". Saving a recipe inserts a row in
// public.saved_recipes with the current household_id (or NULL for solo users).
// RLS makes the visibility rules match the rest of the app's household model.

const SavedRecipesContext = createContext(null);

export const SavedRecipesProvider = ({ children }) => {
  const { user } = useAuth();
  const { currentHousehold } = useHousehold();
  const [savedRecipes, setSavedRecipes] = useState([]);
  const [loading, setLoading] = useState(false);

  const householdId = currentHousehold?.id || null;

  // Reload whenever the user or active household changes — saved recipes are
  // scoped to "the cookbook this household currently sees".
  useEffect(() => {
    if (user) {
      loadSavedRecipes();
    } else {
      setSavedRecipes([]);
    }
  }, [user?.id, householdId]);

  const loadSavedRecipes = async () => {
    if (!user) return;
    try {
      setLoading(true);
      let query = supabase
        .from('saved_recipes')
        .select('*')
        .order('created_at', { ascending: false });
      if (householdId) {
        query = query.eq('household_id', householdId);
      } else {
        query = query.is('household_id', null).eq('saved_by_user_id', user.id);
      }
      const { data, error } = await query;
      if (error) throw error;
      setSavedRecipes(data || []);
    } catch (e) {
      console.error('Error loading saved recipes:', e);
      setSavedRecipes([]);
    } finally {
      setLoading(false);
    }
  };

  // Save the recipe and return the new row (so the screen can flip its
  // bookmark state immediately without waiting for a reload).
  const saveRecipe = async (recipe) => {
    if (!user) return { success: false, error: 'Not signed in' };
    try {
      const payload = {
        household_id: householdId,
        saved_by_user_id: user.id,
        title: recipe.title || '',
        description: recipe.description || null,
        total_minutes: recipe.totalMinutes ?? null,
        servings: recipe.servings ?? null,
        ingredients: recipe.ingredients || [],
        steps: recipe.steps || [],
      };
      const { data, error } = await supabase
        .from('saved_recipes')
        .insert(payload)
        .select()
        .single();
      if (error) throw error;
      setSavedRecipes((prev) => [data, ...prev]);
      return { success: true, row: data };
    } catch (e) {
      console.error('Error saving recipe:', e);
      return { success: false, error: e.message };
    }
  };

  const unsaveRecipe = async (id) => {
    try {
      const { error } = await supabase
        .from('saved_recipes')
        .delete()
        .eq('id', id);
      if (error) throw error;
      setSavedRecipes((prev) => prev.filter((r) => r.id !== id));
      return { success: true };
    } catch (e) {
      console.error('Error unsaving recipe:', e);
      return { success: false, error: e.message };
    }
  };

  // Recipes the picker just generated are kept in-memory; saved rows live in
  // the DB with snake_case column names. Convert a DB row back to the camelCase
  // shape the rest of the UI uses.
  const dbRowToRecipe = (row) => ({
    id: row.id,
    title: row.title,
    description: row.description,
    totalMinutes: row.total_minutes,
    servings: row.servings,
    ingredients: row.ingredients || [],
    steps: row.steps || [],
    _savedId: row.id, // marker used to drive the bookmark toggle UI
  });

  const value = useMemo(
    () => ({
      savedRecipes,
      loading,
      saveRecipe,
      unsaveRecipe,
      loadSavedRecipes,
      dbRowToRecipe,
    }),
    [savedRecipes, loading]
  );

  return (
    <SavedRecipesContext.Provider value={value}>
      {children}
    </SavedRecipesContext.Provider>
  );
};

export const useSavedRecipes = () => {
  const ctx = useContext(SavedRecipesContext);
  if (!ctx) {
    throw new Error('useSavedRecipes must be used within a SavedRecipesProvider');
  }
  return ctx;
};
