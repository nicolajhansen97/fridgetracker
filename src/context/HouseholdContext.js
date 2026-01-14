import React, { createContext, useState, useContext, useEffect } from 'react';
import { supabase } from '../config/supabase';
import { useAuth } from './AuthContext';

const HouseholdContext = createContext();

export const HouseholdProvider = ({ children }) => {
  const { user } = useAuth();
  const [households, setHouseholds] = useState([]);
  const [currentHousehold, setCurrentHousehold] = useState(null);
  const [householdMembers, setHouseholdMembers] = useState([]);
  const [invitations, setInvitations] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) {
      loadHouseholds();
      loadInvitations();
    } else {
      setHouseholds([]);
      setCurrentHousehold(null);
      setHouseholdMembers([]);
      setInvitations([]);
    }
  }, [user]);

  useEffect(() => {
    if (currentHousehold) {
      loadHouseholdMembers();
    }
  }, [currentHousehold]);

  const loadHouseholds = async () => {
    try {
      setLoading(true);

      // Get households where user is a member
      const { data: memberData, error: memberError } = await supabase
        .from('household_members')
        .select('household_id, role')
        .eq('user_id', user.id);

      if (memberError) throw memberError;

      if (memberData && memberData.length > 0) {
        const householdIds = memberData.map(m => m.household_id);

        // Get household details
        const { data: householdsData, error: householdsError } = await supabase
          .from('households')
          .select('*')
          .in('id', householdIds)
          .order('created_at', { ascending: false });

        if (householdsError) throw householdsError;

        // Add role to household objects
        const householdsWithRole = householdsData.map(household => ({
          ...household,
          role: memberData.find(m => m.household_id === household.id)?.role
        }));

        setHouseholds(householdsWithRole);

        // Set current household if not set
        if (!currentHousehold && householdsWithRole.length > 0) {
          setCurrentHousehold(householdsWithRole[0]);
        }
      } else {
        setHouseholds([]);
        setCurrentHousehold(null);
      }

      setLoading(false);
    } catch (error) {
      console.error('Error loading households:', error);
      setLoading(false);
    }
  };

  const loadHouseholdMembers = async () => {
    if (!currentHousehold) return;

    try {
      // Use RPC function to get members with emails
      const { data, error } = await supabase
        .rpc('get_household_members', {
          p_household_id: currentHousehold.id
        });

      if (error) throw error;

      setHouseholdMembers(data || []);
    } catch (error) {
      console.error('Error loading household members:', error);
    }
  };

  const loadInvitations = async () => {
    try {
      // Use RPC function to get invitations with household names
      const { data, error } = await supabase.rpc('get_user_invitations');

      if (error) throw error;

      setInvitations(data || []);
    } catch (error) {
      console.error('Error loading invitations:', error);
    }
  };

  const createHousehold = async (name) => {
    try {
      // Use RPC function to atomically create household and add member
      const { data, error } = await supabase
        .rpc('create_household_with_owner', {
          household_name: name
        });

      if (error) throw error;

      // data is an array, get first item
      const householdData = data[0];

      await loadHouseholds();
      return { success: true, household: householdData };
    } catch (error) {
      console.error('Error creating household:', error);
      return { success: false, error: error.message };
    }
  };

  const updateHouseholdName = async (householdId, newName) => {
    try {
      const { error } = await supabase
        .from('households')
        .update({ name: newName })
        .eq('id', householdId);

      if (error) throw error;

      await loadHouseholds();
      return { success: true };
    } catch (error) {
      console.error('Error updating household:', error);
      return { success: false, error: error.message };
    }
  };

  const deleteHousehold = async (householdId) => {
    try {
      const { error } = await supabase
        .from('households')
        .delete()
        .eq('id', householdId);

      if (error) throw error;

      await loadHouseholds();
      return { success: true };
    } catch (error) {
      console.error('Error deleting household:', error);
      return { success: false, error: error.message };
    }
  };

  const inviteMember = async (householdId, email) => {
    try {
      // Check if user is already a member
      const { data: existingMember } = await supabase
        .from('household_members')
        .select('id')
        .eq('household_id', householdId)
        .eq('user_id', (
          await supabase
            .from('auth.users')
            .select('id')
            .eq('email', email)
            .single()
        )?.data?.id)
        .single();

      if (existingMember) {
        return { success: false, error: 'User is already a member' };
      }

      // Create invitation
      const { error } = await supabase
        .from('household_invitations')
        .insert([{
          household_id: householdId,
          invited_email: email,
          invited_by: user.id
        }]);

      if (error) throw error;

      return { success: true };
    } catch (error) {
      console.error('Error inviting member:', error);
      return { success: false, error: error.message };
    }
  };

  const acceptInvitation = async (invitationId, householdId) => {
    try {
      // Use RPC function to accept invitation with elevated privileges
      const { data, error } = await supabase
        .rpc('accept_household_invitation', {
          p_invitation_id: invitationId
        });

      if (error) throw error;

      // Check if the function returned success
      if (data && data[0] && !data[0].success) {
        throw new Error(data[0].message);
      }

      await loadHouseholds();
      await loadInvitations();
      return { success: true };
    } catch (error) {
      console.error('Error accepting invitation:', error);
      return { success: false, error: error.message };
    }
  };

  const declineInvitation = async (invitationId) => {
    try {
      const { error } = await supabase
        .from('household_invitations')
        .update({ status: 'declined' })
        .eq('id', invitationId);

      if (error) throw error;

      await loadInvitations();
      return { success: true };
    } catch (error) {
      console.error('Error declining invitation:', error);
      return { success: false, error: error.message };
    }
  };

  const leaveHousehold = async (householdId) => {
    try {
      const { error } = await supabase
        .from('household_members')
        .delete()
        .eq('household_id', householdId)
        .eq('user_id', user.id);

      if (error) throw error;

      await loadHouseholds();
      return { success: true };
    } catch (error) {
      console.error('Error leaving household:', error);
      return { success: false, error: error.message };
    }
  };

  const removeMember = async (memberId) => {
    try {
      const { error } = await supabase
        .from('household_members')
        .delete()
        .eq('id', memberId);

      if (error) throw error;

      await loadHouseholdMembers();
      return { success: true };
    } catch (error) {
      console.error('Error removing member:', error);
      return { success: false, error: error.message };
    }
  };

  const switchHousehold = (household) => {
    setCurrentHousehold(household);
  };

  return (
    <HouseholdContext.Provider
      value={{
        households,
        currentHousehold,
        householdMembers,
        invitations,
        loading,
        createHousehold,
        updateHouseholdName,
        deleteHousehold,
        inviteMember,
        acceptInvitation,
        declineInvitation,
        leaveHousehold,
        removeMember,
        switchHousehold,
        loadHouseholds,
        loadHouseholdMembers,
      }}
    >
      {children}
    </HouseholdContext.Provider>
  );
};

export const useHousehold = () => {
  const context = useContext(HouseholdContext);
  if (!context) {
    throw new Error('useHousehold must be used within a HouseholdProvider');
  }
  return context;
};
