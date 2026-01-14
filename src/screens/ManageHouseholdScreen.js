import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  TextInput,
  Alert,
  Modal,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useHousehold } from '../context/HouseholdContext';

const ManageHouseholdScreen = ({ navigation }) => {
  const {
    households,
    currentHousehold,
    householdMembers,
    invitations,
    createHousehold,
    updateHouseholdName,
    deleteHousehold,
    inviteMember,
    acceptInvitation,
    declineInvitation,
    leaveHousehold,
    removeMember,
    switchHousehold,
  } = useHousehold();

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [householdName, setHouseholdName] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');

  const handleCreateHousehold = async () => {
    if (!householdName.trim()) {
      Alert.alert('Error', 'Please enter a household name');
      return;
    }

    const result = await createHousehold(householdName.trim());
    if (result.success) {
      Alert.alert('Success', 'Household created successfully!');
      setHouseholdName('');
      setShowCreateModal(false);
      switchHousehold(result.household);
    } else {
      Alert.alert('Error', result.error);
    }
  };

  const handleInviteMember = async () => {
    if (!inviteEmail.trim()) {
      Alert.alert('Error', 'Please enter an email address');
      return;
    }

    if (!currentHousehold) {
      Alert.alert('Error', 'No household selected');
      return;
    }

    const result = await inviteMember(currentHousehold.id, inviteEmail.trim());
    if (result.success) {
      Alert.alert('Success', `Invitation sent to ${inviteEmail}`);
      setInviteEmail('');
      setShowInviteModal(false);
    } else {
      Alert.alert('Error', result.error);
    }
  };

  const handleAcceptInvitation = async (invitation) => {
    const result = await acceptInvitation(invitation.id, invitation.household_id);
    if (result.success) {
      Alert.alert('Success', `You joined ${invitation.household_name}!`);
    } else {
      Alert.alert('Error', result.error);
    }
  };

  const handleDeclineInvitation = async (invitation) => {
    Alert.alert(
      'Decline Invitation',
      `Decline invitation to ${invitation.household_name}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Decline',
          style: 'destructive',
          onPress: async () => {
            const result = await declineInvitation(invitation.id);
            if (!result.success) {
              Alert.alert('Error', result.error);
            }
          },
        },
      ]
    );
  };

  const handleLeaveHousehold = () => {
    if (!currentHousehold) return;

    Alert.alert(
      'Leave Household',
      `Are you sure you want to leave "${currentHousehold.name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Leave',
          style: 'destructive',
          onPress: async () => {
            const result = await leaveHousehold(currentHousehold.id);
            if (result.success) {
              Alert.alert('Success', 'You left the household');
            } else {
              Alert.alert('Error', result.error);
            }
          },
        },
      ]
    );
  };

  const handleDeleteHousehold = () => {
    if (!currentHousehold) return;

    Alert.alert(
      'Delete Household',
      `Are you sure you want to delete "${currentHousehold.name}"? This will remove all items and cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const result = await deleteHousehold(currentHousehold.id);
            if (result.success) {
              Alert.alert('Success', 'Household deleted');
            } else {
              Alert.alert('Error', result.error);
            }
          },
        },
      ]
    );
  };

  const handleRemoveMember = (member) => {
    Alert.alert(
      'Remove Member',
      `Remove ${member.user_email} from the household?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            const result = await removeMember(member.id);
            if (!result.success) {
              Alert.alert('Error', result.error);
            }
          },
        },
      ]
    );
  };

  const isOwner = currentHousehold?.role === 'owner';

  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient colors={['#43e97b', '#38f9d7']} style={styles.header}>
        <View style={styles.headerContent}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <Text style={styles.backButtonText}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Family Sharing</Text>
          <View style={styles.placeholder} />
        </View>
      </LinearGradient>

      <ScrollView style={styles.content}>
        {/* Invitations Section */}
        {invitations.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>📨 Pending Invitations</Text>
            {invitations.map((invitation) => (
              <View key={invitation.id} style={styles.invitationCard}>
                <View style={styles.invitationInfo}>
                  <Text style={styles.invitationName}>{invitation.household_name}</Text>
                  <Text style={styles.invitationText}>You've been invited to join</Text>
                </View>
                <View style={styles.invitationActions}>
                  <TouchableOpacity
                    style={[styles.invitationButton, styles.acceptButton]}
                    onPress={() => handleAcceptInvitation(invitation)}
                  >
                    <Text style={styles.buttonText}>Accept</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.invitationButton, styles.declineButton]}
                    onPress={() => handleDeclineInvitation(invitation)}
                  >
                    <Text style={styles.buttonText}>Decline</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Current Household Section */}
        {currentHousehold && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>🏠 Current Household</Text>
            <View style={styles.householdCard}>
              <View style={styles.householdHeader}>
                <Text style={styles.householdName}>{currentHousehold.name}</Text>
                <View style={styles.roleBadge}>
                  <Text style={styles.roleText}>{isOwner ? 'Owner' : 'Member'}</Text>
                </View>
              </View>

              {/* Members */}
              <View style={styles.membersSection}>
                <Text style={styles.subTitle}>Members ({householdMembers.length})</Text>
                {householdMembers.map((member) => (
                  <View key={member.id} style={styles.memberRow}>
                    <View style={styles.memberInfo}>
                      <Text style={styles.memberEmail}>{member.user_email}</Text>
                      <Text style={styles.memberRole}>{member.role}</Text>
                    </View>
                    {isOwner && member.role !== 'owner' && (
                      <TouchableOpacity
                        style={styles.removeButton}
                        onPress={() => handleRemoveMember(member)}
                      >
                        <Text style={styles.removeButtonText}>Remove</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                ))}
              </View>

              {/* Actions */}
              <View style={styles.actionsSection}>
                {isOwner && (
                  <>
                    <TouchableOpacity
                      style={[styles.actionButton, styles.inviteButton]}
                      onPress={() => setShowInviteModal(true)}
                    >
                      <Text style={styles.actionButtonText}>➕ Invite Member</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.actionButton, styles.deleteButton]}
                      onPress={handleDeleteHousehold}
                    >
                      <Text style={styles.actionButtonText}>🗑️ Delete Household</Text>
                    </TouchableOpacity>
                  </>
                )}
                {!isOwner && (
                  <TouchableOpacity
                    style={[styles.actionButton, styles.leaveButton]}
                    onPress={handleLeaveHousehold}
                  >
                    <Text style={styles.actionButtonText}>🚪 Leave Household</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          </View>
        )}

        {/* All Households */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>All Your Households</Text>
          <TouchableOpacity
            style={styles.createButton}
            onPress={() => setShowCreateModal(true)}
          >
            <Text style={styles.createButtonText}>+ Create New Household</Text>
          </TouchableOpacity>

          {households.map((household) => (
            <TouchableOpacity
              key={household.id}
              style={[
                styles.householdListItem,
                currentHousehold?.id === household.id && styles.activeHousehold,
              ]}
              onPress={() => switchHousehold(household)}
            >
              <View>
                <Text style={styles.householdListName}>{household.name}</Text>
                <Text style={styles.householdListRole}>{household.role}</Text>
              </View>
              {currentHousehold?.id === household.id && (
                <Text style={styles.activeIndicator}>✓ Active</Text>
              )}
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>

      {/* Create Household Modal */}
      <Modal visible={showCreateModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Create New Household</Text>
            <TextInput
              style={styles.input}
              placeholder="Household Name (e.g., The Smiths)"
              value={householdName}
              onChangeText={setHouseholdName}
            />
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => {
                  setShowCreateModal(false);
                  setHouseholdName('');
                }}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.confirmButton]}
                onPress={handleCreateHousehold}
              >
                <Text style={styles.confirmButtonText}>Create</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Invite Member Modal */}
      <Modal visible={showInviteModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Invite Member</Text>
            <TextInput
              style={styles.input}
              placeholder="Email address"
              value={inviteEmail}
              onChangeText={setInviteEmail}
              keyboardType="email-address"
              autoCapitalize="none"
            />
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => {
                  setShowInviteModal(false);
                  setInviteEmail('');
                }}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.confirmButton]}
                onPress={handleInviteMember}
              >
                <Text style={styles.confirmButtonText}>Send Invite</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    paddingTop: 20,
    paddingBottom: 20,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  backButton: {
    padding: 8,
  },
  backButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  placeholder: {
    width: 70,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  section: {
    marginBottom: 30,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 15,
  },
  invitationCard: {
    backgroundColor: '#fff',
    borderRadius: 15,
    padding: 15,
    marginBottom: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  invitationInfo: {
    flex: 1,
  },
  invitationName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  invitationText: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  invitationActions: {
    flexDirection: 'row',
    gap: 10,
  },
  invitationButton: {
    paddingVertical: 8,
    paddingHorizontal: 15,
    borderRadius: 8,
  },
  acceptButton: {
    backgroundColor: '#43e97b',
  },
  declineButton: {
    backgroundColor: '#ff6b6b',
  },
  buttonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  householdCard: {
    backgroundColor: '#fff',
    borderRadius: 15,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  householdHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  householdName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  roleBadge: {
    backgroundColor: '#43e97b',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 12,
  },
  roleText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 12,
  },
  membersSection: {
    marginBottom: 20,
  },
  subTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10,
  },
  memberRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  memberInfo: {
    flex: 1,
  },
  memberEmail: {
    fontSize: 14,
    color: '#333',
  },
  memberRole: {
    fontSize: 12,
    color: '#888',
    marginTop: 2,
  },
  removeButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: '#ff6b6b',
    borderRadius: 8,
  },
  removeButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  actionsSection: {
    gap: 10,
  },
  actionButton: {
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  inviteButton: {
    backgroundColor: '#43e97b',
  },
  deleteButton: {
    backgroundColor: '#ff6b6b',
  },
  leaveButton: {
    backgroundColor: '#ffa500',
  },
  actionButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },
  createButton: {
    backgroundColor: '#667eea',
    paddingVertical: 15,
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: 15,
  },
  createButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  householdListItem: {
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 10,
    marginBottom: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  activeHousehold: {
    borderWidth: 2,
    borderColor: '#43e97b',
  },
  householdListName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  householdListRole: {
    fontSize: 12,
    color: '#888',
    marginTop: 4,
  },
  activeIndicator: {
    color: '#43e97b',
    fontWeight: 'bold',
    fontSize: 14,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 25,
    width: '85%',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 20,
    textAlign: 'center',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 10,
    padding: 15,
    fontSize: 16,
    marginBottom: 20,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 10,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#f0f0f0',
  },
  confirmButton: {
    backgroundColor: '#43e97b',
  },
  cancelButtonText: {
    color: '#333',
    fontWeight: '600',
    fontSize: 16,
  },
  confirmButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },
});

export default ManageHouseholdScreen;
