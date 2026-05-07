import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  Alert,
  ScrollView,
  RefreshControl,
} from 'react-native';
import { useDrawers } from '../context/DrawerContext';
import { useLanguage } from '../i18n';
import {
  Screen,
  ScreenHeader,
  Card,
  Input,
  PrimaryButton,
  SecondaryButton,
} from '../components/ui';
import { colors, radii, spacing, typography } from '../theme';

const ICON_OPTIONS = ['❄️', '🧊', '🥶', '📦', '🗄️', '🍦', '🥩', '🍕', '🌽', '🥦', '🍓', '🍔'];

const IconPicker = ({ value, onChange }) => (
  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.iconRow}>
    {ICON_OPTIONS.map((icon) => (
      <TouchableOpacity
        key={icon}
        onPress={() => onChange(icon)}
        style={[styles.iconOption, value === icon && styles.iconOptionSelected]}
        activeOpacity={0.85}
      >
        <Text style={styles.iconText}>{icon}</Text>
      </TouchableOpacity>
    ))}
  </ScrollView>
);

const ManageDrawersScreen = ({ navigation }) => {
  const { drawers, isLoading, addDrawer, updateDrawer, deleteDrawer, loadDrawers } = useDrawers();
  const { t } = useLanguage();
  const [refreshing, setRefreshing] = useState(false);
  const [newDrawerName, setNewDrawerName] = useState('');
  const [selectedIcon, setSelectedIcon] = useState('📦');
  const [editingDrawer, setEditingDrawer] = useState(null);
  const [editName, setEditName] = useState('');
  const [editIcon, setEditIcon] = useState('');

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await loadDrawers();
    } catch (e) {
      console.error('Refresh error:', e);
    } finally {
      setRefreshing(false);
    }
  };

  const handleAddDrawer = async () => {
    if (!newDrawerName.trim()) {
      Alert.alert(t('common.error'), t('drawers.enterName'));
      return;
    }
    const result = await addDrawer({ name: newDrawerName.trim(), icon: selectedIcon });
    if (result.error) {
      Alert.alert(t('common.error'), result.error);
    } else {
      setNewDrawerName('');
      setSelectedIcon('📦');
      Alert.alert(t('common.success'), t('drawers.addedSuccess'));
    }
  };

  const handleEditDrawer = (drawer) => {
    setEditingDrawer(drawer.id);
    setEditName(drawer.name);
    setEditIcon(drawer.icon);
  };

  const handleSaveEdit = async () => {
    if (!editName.trim()) {
      Alert.alert(t('common.error'), t('drawers.enterName'));
      return;
    }
    const result = await updateDrawer(editingDrawer, { name: editName.trim(), icon: editIcon });
    if (result.error) {
      Alert.alert(t('common.error'), result.error);
    } else {
      setEditingDrawer(null);
      setEditName('');
      setEditIcon('');
      Alert.alert(t('common.success'), t('drawers.updatedSuccess'));
    }
  };

  const handleCancelEdit = () => {
    setEditingDrawer(null);
    setEditName('');
    setEditIcon('');
  };

  const handleDeleteDrawer = (drawer) => {
    Alert.alert(t('drawers.deleteCompartment'), t('drawers.confirmDelete', { name: drawer.name }), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: async () => {
          const result = await deleteDrawer(drawer.id);
          if (result.error) Alert.alert(t('common.error'), result.error);
        },
      },
    ]);
  };

  const renderDrawerItem = ({ item }) => {
    const isEditing = editingDrawer === item.id;

    if (isEditing) {
      return (
        <Card style={styles.drawerCard}>
          <Text style={styles.fieldLabel}>{t('drawers.icon')}</Text>
          <IconPicker value={editIcon} onChange={setEditIcon} />

          <Input
            label={t('drawers.name')}
            value={editName}
            onChangeText={setEditName}
            placeholder={t('drawers.drawerName')}
            style={{ marginTop: spacing.md }}
          />

          <View style={styles.editButtonRow}>
            <SecondaryButton title={t('common.cancel')} onPress={handleCancelEdit} style={{ flex: 1 }} />
            <PrimaryButton
              title={isLoading ? t('drawers.saving') : t('common.save')}
              onPress={handleSaveEdit}
              loading={isLoading}
              style={{ flex: 1 }}
            />
          </View>
        </Card>
      );
    }

    return (
      <Card style={styles.drawerCard}>
        <View style={styles.drawerRow}>
          <Text style={styles.drawerIcon}>{item.icon}</Text>
          <Text style={styles.drawerName} numberOfLines={1}>{item.name}</Text>
        </View>
        <View style={styles.drawerActionRow}>
          <SecondaryButton title={t('common.edit')} onPress={() => handleEditDrawer(item)} style={{ flex: 1 }} />
          <SecondaryButton title={t('common.delete')} onPress={() => handleDeleteDrawer(item)} danger style={{ flex: 1 }} />
        </View>
      </Card>
    );
  };

  return (
    <Screen>
      <ScreenHeader
        title={t('drawers.title')}
        onBack={() => navigation.goBack()}
        backLabel={t('common.back')}
      />

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        <Card style={styles.section}>
          <Text style={styles.sectionTitle}>{t('drawers.addNew')}</Text>

          <Text style={styles.fieldLabel}>{t('drawers.selectIcon')}</Text>
          <IconPicker value={selectedIcon} onChange={setSelectedIcon} />

          <Input
            label={t('drawers.compartmentName')}
            placeholder={t('drawers.namePlaceholder')}
            value={newDrawerName}
            onChangeText={setNewDrawerName}
            style={{ marginTop: spacing.md }}
          />

          <PrimaryButton
            title={isLoading ? t('drawers.adding') : t('drawers.addCompartment')}
            onPress={handleAddDrawer}
            loading={isLoading}
            style={{ marginTop: spacing.lg }}
          />
        </Card>

        <Text style={styles.listTitle}>
          {t('drawers.yourCompartments', { count: drawers.length })}
        </Text>

        {drawers.length === 0 ? (
          <Card style={styles.emptyCard}>
            <Text style={styles.emptyText}>{t('drawers.noCompartments')}</Text>
          </Card>
        ) : (
          <FlatList
            data={drawers}
            keyExtractor={(item) => item.id}
            renderItem={renderDrawerItem}
            scrollEnabled={false}
          />
        )}
        <View style={{ height: spacing.xxl }} />
      </ScrollView>
    </Screen>
  );
};

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.lg,
  },
  section: {
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    ...typography.h3,
    color: colors.text,
    marginBottom: spacing.md,
  },
  fieldLabel: {
    ...typography.label,
    color: colors.textMuted,
    marginBottom: 8,
    marginTop: spacing.sm,
  },
  iconRow: {
    paddingVertical: 4,
    paddingRight: 8,
  },
  iconOption: {
    width: 48,
    height: 48,
    borderRadius: radii.md,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  iconOptionSelected: {
    borderColor: colors.primary,
    backgroundColor: '#ECFEFF',
  },
  iconText: {
    fontSize: 22,
  },
  listTitle: {
    ...typography.label,
    color: colors.textMuted,
    marginBottom: spacing.sm,
    marginLeft: 4,
  },
  drawerCard: {
    marginBottom: spacing.sm,
  },
  drawerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  drawerIcon: {
    fontSize: 24,
  },
  drawerName: {
    ...typography.bodyStrong,
    color: colors.text,
    flex: 1,
  },
  drawerActionRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  editButtonRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  emptyCard: {
    alignItems: 'center',
    paddingVertical: spacing.xxl,
  },
  emptyText: {
    ...typography.body,
    color: colors.textMuted,
    textAlign: 'center',
  },
});

export default ManageDrawersScreen;
