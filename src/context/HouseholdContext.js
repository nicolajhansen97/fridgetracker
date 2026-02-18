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
  const [pendingInvites, setPendingInvites] = useState([]);
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
      loadPendingInvites();
    } else {
      setPendingInvites([]);
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
    if (!currentHousehold || !currentHousehold.id) {
      setHouseholdMembers([]);
      return;
    }

    try {
      // Use RPC function to get members with emails
      const { data, error } = await supabase
        .rpc('get_household_members', {
          p_household_id: currentHousehold.id
        });

      if (error) {
        console.error('Error loading household members:', error);
        setHouseholdMembers([]);
        return;
      }

      setHouseholdMembers(data || []);
    } catch (error) {
      console.error('Error loading household members:', error);
      setHouseholdMembers([]);
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

  const loadPendingInvites = async () => {
    if (!currentHousehold?.id) {
      setPendingInvites([]);
      return;
    }
    try {
      const { data, error } = await supabase
        .rpc('get_pending_invites', { p_household_id: currentHousehold.id });

      if (error) throw error;
      setPendingInvites(data || []);
    } catch (error) {
      // Non-owners get access denied — that's expected, just clear the list
      setPendingInvites([]);
    }
  };

  const cancelInvite = async (inviteId) => {
    try {
      const { data, error } = await supabase
        .rpc('cancel_household_invite', { p_invite_id: inviteId });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Failed to cancel invite');

      await loadPendingInvites();
      return { success: true };
    } catch (error) {
      console.error('Error cancelling invite:', error);
      return { success: false, error: error.message };
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
      // Create invite via RPC to bypass RLS
      const { data: createResult, error } = await supabase
        .rpc('create_household_invite', {
          p_household_id: householdId,
          p_invited_email: email,
        });

      if (error) throw error;
      if (!createResult?.success) {
        return { success: false, error: createResult?.error || 'Failed to create invitation' };
      }

      // Send invite email (best-effort — invitation is valid even if email fails)
      let emailSent = false;
      try {
        const { data: emailResult } = await supabase.rpc('send_household_invite_email', {
          p_household_name: currentHousehold?.name || 'our household',
          p_invited_by_email: user.email,
          p_invitee_email: email,
          p_invite_id: createResult.invite_id,
        });
        emailSent = emailResult?.success === true;
      } catch (emailError) {
        console.error('Failed to send invite email:', emailError);
      }

      await loadPendingInvites();
      return { success: true, emailSent };
    } catch (error) {
      console.error('Error inviting member:', error);
      return { success: false, error: error.message };
    }
  };

  const resendInvite = async (inviteId) => {
    try {
      const { data, error } = await supabase
        .rpc('resend_invite_email', { p_invite_id: inviteId });

      if (error) throw error;

      if (data?.cooldown) {
        return { success: false, cooldown: true, hoursRemaining: data.hours_remaining };
      }
      if (!data?.success) throw new Error(data?.error || 'Failed to resend');

      await loadPendingInvites();
      return { success: true };
    } catch (error) {
      console.error('Error resending invite:', error);
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

      // Clear current household immediately if it's the one being left
      if (currentHousehold?.id === householdId) {
        setCurrentHousehold(null);
        setHouseholdMembers([]);
      }

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
        pendingInvites,
        loading,
        createHousehold,
        updateHouseholdName,
        deleteHousehold,
        inviteMember,
        resendInvite,
        cancelInvite,
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
