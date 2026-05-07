import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  Modal,
  RefreshControl,
} from 'react-native';
import { useHousehold } from '../context/HouseholdContext';
import { useLanguage } from '../i18n';
import {
  Screen,
  ScreenHeader,
  Card,
  Icon,
  Badge,
  Input,
  PrimaryButton,
  SecondaryButton,
  SectionTitle,
} from '../components/ui';
import { colors, radii, shadows, spacing, typography } from '../theme';

const ManageHouseholdScreen = ({ navigation }) => {
  const {
    households, currentHousehold, householdMembers, invitations, pendingInvites,
    createHousehold, deleteHousehold, inviteMember, resendInvite, cancelInvite,
    acceptInvitation, declineInvitation, leaveHousehold, removeMember, switchHousehold,
    loadHouseholds, loadHouseholdMembers, loadInvitations,
  } = useHousehold();

  const { t } = useLanguage();
  const [refreshing, setRefreshing] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [householdName, setHouseholdName] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');

  const handleCreateHousehold = async () => {
    if (!householdName.trim()) {
      Alert.alert(t('common.error'), t('household.enterHouseholdName'));
      return;
    }
    const result = await createHousehold(householdName.trim());
    if (result.success) {
      Alert.alert(t('common.success'), t('household.householdCreated'));
      setHouseholdName('');
      setShowCreateModal(false);
      switchHousehold(result.household);
    } else {
      Alert.alert(t('common.error'), result.error);
    }
  };

  const handleInviteMember = async () => {
    if (!inviteEmail.trim()) {
      Alert.alert(t('common.error'), t('household.enterEmail'));
      return;
    }
    if (!currentHousehold) {
      Alert.alert(t('common.error'), t('household.noHouseholdSelected'));
      return;
    }
    const result = await inviteMember(currentHousehold.id, inviteEmail.trim());
    if (result.success) {
      const message = result.emailSent
        ? t('household.invitationSentEmail', { email: inviteEmail.trim() })
        : t('household.invitationSentApp', { email: inviteEmail.trim() });
      Alert.alert(t('household.invitationSent'), message);
      setInviteEmail('');
      setShowInviteModal(false);
    } else {
      Alert.alert(t('common.error'), result.error);
    }
  };

  const handleAcceptInvitation = async (invitation) => {
    const result = await acceptInvitation(invitation.id, invitation.household_id);
    if (result.success) {
      Alert.alert(t('common.success'), t('household.joinedHousehold', { name: invitation.household_name }));
    } else {
      Alert.alert(t('common.error'), result.error);
    }
  };

  const handleDeclineInvitation = async (invitation) => {
    Alert.alert(t('household.declineInvitation'), t('household.declineConfirm', { name: invitation.household_name }), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('household.decline'),
        style: 'destructive',
        onPress: async () => {
          const result = await declineInvitation(invitation.id);
          if (!result.success) Alert.alert(t('common.error'), result.error);
        },
      },
    ]);
  };

  const handleLeaveHousehold = () => {
    if (!currentHousehold) return;
    Alert.alert(t('household.leaveHousehold'), t('household.leaveConfirm', { name: currentHousehold.name }), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('household.leaveHousehold'),
        style: 'destructive',
        onPress: async () => {
          const result = await leaveHousehold(currentHousehold.id);
          if (result.success) Alert.alert(t('common.success'), t('household.leftHousehold'));
          else Alert.alert(t('common.error'), result.error);
        },
      },
    ]);
  };

  const handleDeleteHousehold = () => {
    if (!currentHousehold) return;
    Alert.alert(t('household.deleteHousehold'), t('household.deleteConfirm', { name: currentHousehold.name }), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: async () => {
          const result = await deleteHousehold(currentHousehold.id);
          if (result.success) Alert.alert(t('common.success'), t('household.householdDeleted'));
          else Alert.alert(t('common.error'), result.error);
        },
      },
    ]);
  };

  const handleRemoveMember = (member) => {
    Alert.alert(t('household.removeMember'), t('household.removeMemberConfirm', { email: member.user_email }), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.remove'),
        style: 'destructive',
        onPress: async () => {
          const result = await removeMember(member.id);
          if (!result.success) Alert.alert(t('common.error'), result.error);
        },
      },
    ]);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all([loadHouseholds(), loadInvitations()]);
      if (currentHousehold) await loadHouseholdMembers(currentHousehold.id);
    } catch (e) { console.error('Refresh error:', e); }
    finally { setRefreshing(false); }
  };

  const isOwner = currentHousehold?.role === 'owner';

  return (
    <Screen>
      <ScreenHeader
        title={t('household.title')}
        onBack={() => navigation.goBack()}
        backLabel={t('common.back')}
      />

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        {invitations.length > 0 && (
          <>
            <SectionTitle icon={<Icon name="mail-outline" size={14} color={colors.textMuted} />}>
              {t('household.pendingInvitations')}
            </SectionTitle>
            {invitations.map((invitation) => (
              <Card key={invitation.id} style={styles.invitationCard}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.invitationName}>{invitation.household_name}</Text>
                  <Text style={styles.invitationText}>{t('household.invitedToJoin')}</Text>
                </View>
                <View style={styles.row}>
                  <PrimaryButton
                    title={t('household.accept')}
                    onPress={() => handleAcceptInvitation(invitation)}
                    fullWidth={false}
                    style={styles.smallBtn}
                  />
                  <SecondaryButton
                    title={t('household.decline')}
                    onPress={() => handleDeclineInvitation(invitation)}
                    danger
                    style={styles.smallBtnSecondary}
                  />
                </View>
              </Card>
            ))}
          </>
        )}

        {currentHousehold && (
          <>
            <SectionTitle icon={<Icon name="people-outline" size={14} color={colors.textMuted} />}>
              {t('household.currentHousehold')}
            </SectionTitle>
            <Card>
              <View style={styles.householdHeader}>
                <Text style={styles.householdName}>{currentHousehold.name}</Text>
                <Badge tone={isOwner ? 'primary' : 'default'}>
                  {isOwner ? t('household.owner') : t('household.member')}
                </Badge>
              </View>

              <Text style={styles.subTitle}>
                {t('household.members', { count: householdMembers.length })}
              </Text>
              {householdMembers.map((member) => (
                <View key={member.id} style={styles.memberRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.memberEmail} numberOfLines={1}>{member.user_email}</Text>
                    <Text style={styles.memberRole}>{member.role}</Text>
                  </View>
                  {isOwner && member.role !== 'owner' && (
                    <SecondaryButton
                      title={t('common.remove')}
                      onPress={() => handleRemoveMember(member)}
                      danger
                      style={styles.smallBtnSecondary}
                    />
                  )}
                </View>
              ))}

              {isOwner && pendingInvites.length > 0 && (
                <>
                  <Text style={[styles.subTitle, { marginTop: spacing.lg }]}>
                    {t('household.pendingInvites', { count: pendingInvites.length })}
                  </Text>
                  {pendingInvites.map((invite) => {
                    const hoursSince = invite.last_email_sent_at
                      ? (Date.now() - new Date(invite.last_email_sent_at).getTime()) / 3600000
                      : 25;
                    const canResend = hoursSince >= 24;
                    const hoursLeft = Math.ceil(24 - hoursSince);
                    return (
                      <View key={invite.id} style={styles.memberRow}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.memberEmail} numberOfLines={1}>{invite.invited_email}</Text>
                          <View style={styles.awaitingRow}>
                            <Icon name="time-outline" size={12} color={colors.warning} />
                            <Text style={[styles.memberRole, { color: colors.warning }]}>
                              {t('household.awaitingResponse')}
                            </Text>
                          </View>
                        </View>
                        <View style={styles.row}>
                          <SecondaryButton
                            title={canResend ? t('household.resend') : t('household.hoursLeft', { count: hoursLeft })}
                            disabled={!canResend}
                            onPress={async () => {
                              const result = await resendInvite(invite.id);
                              if (result.success) {
                                Alert.alert(t('household.emailSent'), t('household.invitationResent', { email: invite.invited_email }));
                              } else if (result.cooldown) {
                                Alert.alert(t('household.tooSoon'), t('household.resendCooldown', { hours: result.hoursRemaining }));
                              } else {
                                Alert.alert(t('common.error'), result.error);
                              }
                            }}
                            style={styles.smallBtnSecondary}
                          />
                          <SecondaryButton
                            title={t('common.cancel')}
                            onPress={() =>
                              Alert.alert(t('household.cancelInvite'), t('household.cancelInviteConfirm', { email: invite.invited_email }), [
                                { text: t('common.no'), style: 'cancel' },
                                { text: t('household.cancelInvite'), style: 'destructive', onPress: () => cancelInvite(invite.id) },
                              ])
                            }
                            danger
                            style={styles.smallBtnSecondary}
                          />
                        </View>
                      </View>
                    );
                  })}
                </>
              )}

              <View style={styles.actionsRow}>
                {isOwner ? (
                  <>
                    <PrimaryButton
                      title={t('household.inviteMember')}
                      icon={<Icon name="person-add-outline" size={16} color={colors.surface} />}
                      onPress={() => setShowInviteModal(true)}
                    />
                    <SecondaryButton
                      title={t('household.deleteHousehold')}
                      onPress={handleDeleteHousehold}
                      danger
                      style={{ marginTop: spacing.sm }}
                    />
                  </>
                ) : (
                  <SecondaryButton
                    title={t('household.leaveHousehold')}
                    onPress={handleLeaveHousehold}
                    danger
                  />
                )}
              </View>
            </Card>
          </>
        )}

        <SectionTitle>{t('household.allHouseholds')}</SectionTitle>
        <PrimaryButton
          title={t('household.createNew')}
          onPress={() => setShowCreateModal(true)}
          style={{ marginBottom: spacing.md }}
        />

        {households.map((household) => {
          const isActive = currentHousehold?.id === household.id;
          return (
            <TouchableOpacity
              key={household.id}
              activeOpacity={0.85}
              onPress={() => switchHousehold(household)}
            >
              <Card style={[styles.householdItem, isActive && styles.householdItemActive]}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.householdItemName}>{household.name}</Text>
                  <Text style={styles.householdItemRole}>{household.role}</Text>
                </View>
                {isActive && (
                  <View style={styles.activeBadge}>
                    <Icon name="checkmark-circle" size={14} color={colors.primary} />
                    <Text style={styles.activeBadgeText}>{t('household.active')}</Text>
                  </View>
                )}
              </Card>
            </TouchableOpacity>
          );
        })}

        <View style={{ height: spacing.xxxl }} />
      </ScrollView>

      <FormModal
        visible={showCreateModal}
        title={t('household.createNewTitle')}
        value={householdName}
        setValue={setHouseholdName}
        placeholder={t('household.householdNamePlaceholder')}
        confirmTitle={t('common.create')}
        onCancel={() => { setShowCreateModal(false); setHouseholdName(''); }}
        onConfirm={handleCreateHousehold}
      />

      <FormModal
        visible={showInviteModal}
        title={t('household.inviteMember')}
        value={inviteEmail}
        setValue={setInviteEmail}
        placeholder={t('household.emailAddress')}
        confirmTitle={t('household.sendInvite')}
        onCancel={() => { setShowInviteModal(false); setInviteEmail(''); }}
        onConfirm={handleInviteMember}
        keyboardType="email-address"
        autoCapitalize="none"
      />
    </Screen>
  );
};

const FormModal = ({ visible, title, value, setValue, placeholder, confirmTitle, onCancel, onConfirm, keyboardType, autoCapitalize }) => (
  <Modal visible={visible} transparent animationType="fade">
    <View style={styles.modalOverlay}>
      <View style={styles.modalSheet}>
        <Text style={styles.modalTitle}>{title}</Text>
        <Input
          placeholder={placeholder}
          value={value}
          onChangeText={setValue}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          autoFocus
        />
        <View style={styles.modalActions}>
          <SecondaryButton title="Cancel" onPress={onCancel} style={{ flex: 1 }} />
          <PrimaryButton title={confirmTitle} onPress={onConfirm} style={{ flex: 1 }} />
        </View>
      </View>
    </View>
  </Modal>
);

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.lg,
  },
  invitationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.sm,
  },
  invitationName: {
    ...typography.bodyStrong,
    color: colors.text,
  },
  invitationText: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: 2,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.sm,
    flexWrap: 'wrap',
  },
  smallBtn: {
    paddingHorizontal: 14,
  },
  smallBtnSecondary: {
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  householdHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  householdName: {
    ...typography.h3,
    color: colors.text,
    flex: 1,
    marginRight: spacing.sm,
  },
  subTitle: {
    ...typography.label,
    color: colors.textMuted,
    marginBottom: spacing.sm,
  },
  memberRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: spacing.sm,
  },
  memberEmail: {
    ...typography.bodySmall,
    color: colors.text,
  },
  memberRole: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: 2,
  },
  actionsRow: {
    marginTop: spacing.lg,
  },
  householdItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  householdItemActive: {
    borderWidth: 2,
    borderColor: colors.primary,
  },
  householdItemName: {
    ...typography.bodyStrong,
    color: colors.text,
  },
  householdItemRole: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: 2,
  },
  activeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#CCFBF1',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  activeBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0F766E',
  },
  awaitingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
  },
  modalSheet: {
    backgroundColor: colors.surface,
    borderRadius: radii.xl,
    padding: spacing.xxl,
    width: '100%',
    maxWidth: 420,
    ...shadows.button,
  },
  modalTitle: {
    ...typography.h2,
    color: colors.text,
    marginBottom: spacing.lg,
    textAlign: 'center',
  },
  modalActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
});

export default ManageHouseholdScreen;
