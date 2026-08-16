import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Pressable,
  ScrollView,
} from 'react-native';
import { colors, radii, spacing, typography } from '../../theme';
import Icon from './Icon';
import { useLanguage } from '../../i18n';
import { CATEGORY_ORDER, CATEGORY_ICON_MCI } from '../../utils/foodCategories';

// Bottom-sheet picker for assigning a food category to a product. Offers an
// "Automatic" option (clears the override → name-based detection), every
// built-in category, the user's own custom categories (deletable), and a field
// to create a new one.
const CategoryPickerSheet = ({
  visible,
  value,
  isAuto,
  onSelect,
  onClose,
  title,
  customCategories = [],
  onCreate,
  onDelete,
}) => {
  const { t } = useLanguage();
  const [newName, setNewName] = useState('');

  const submitNew = () => {
    const name = newName.trim();
    if (!name) return;
    setNewName('');
    onCreate?.(name);
  };

  const Option = ({ icon, iconSet, label, selected, onPress, onRemove }) => (
    <View style={styles.rowWrap}>
      <TouchableOpacity style={styles.row} onPress={onPress} activeOpacity={0.7}>
        <Icon name={icon} set={iconSet} size={20} color={selected ? colors.primary : colors.textMuted} />
        <Text style={[styles.label, selected && styles.labelOn]} numberOfLines={1}>{label}</Text>
        {selected ? <Icon name="checkmark" size={20} color={colors.primary} /> : null}
      </TouchableOpacity>
      {onRemove ? (
        <TouchableOpacity style={styles.removeBtn} onPress={onRemove} hitSlop={8} accessibilityLabel={t('common.delete')}>
          <Icon name="close" size={16} color={colors.textSubtle} />
        </TouchableOpacity>
      ) : null}
    </View>
  );

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet}>
          <Text style={styles.title}>{title || t('addItem.selectCategory')}</Text>
          <ScrollView showsVerticalScrollIndicator={false} style={styles.list} keyboardShouldPersistTaps="handled">
            <Option
              icon="sparkles-outline"
              label={t('addItem.categoryAuto')}
              selected={isAuto}
              onPress={() => onSelect(null)}
            />
            <View style={styles.divider} />
            {CATEGORY_ORDER.map((key) => (
              <Option
                key={key}
                icon={CATEGORY_ICON_MCI[key]}
                iconSet="mci"
                label={t(`shopping.cat_${key}`)}
                selected={!isAuto && value === key}
                onPress={() => onSelect(key)}
              />
            ))}
            {customCategories.length > 0 ? <View style={styles.divider} /> : null}
            {customCategories.map((c) => (
              <Option
                key={c.key}
                icon="pricetag-outline"
                label={c.name}
                selected={!isAuto && value === c.key}
                onPress={() => onSelect(c.key)}
                onRemove={onDelete ? () => onDelete(c.key) : undefined}
              />
            ))}
          </ScrollView>

          {onCreate ? (
            <View style={styles.newRow}>
              <Icon name="add" size={20} color={colors.textMuted} />
              <TextInput
                style={styles.newInput}
                placeholder={t('addItem.newCategory')}
                placeholderTextColor={colors.textSubtle}
                value={newName}
                onChangeText={setNewName}
                onSubmitEditing={submitNew}
                returnKeyType="done"
                autoCapitalize="sentences"
              />
              <TouchableOpacity onPress={submitNew} disabled={!newName.trim()} hitSlop={6}>
                <Text style={[styles.newAdd, !newName.trim() && { color: colors.textSubtle }]}>
                  {t('common.create')}
                </Text>
              </TouchableOpacity>
            </View>
          ) : null}
        </Pressable>
      </Pressable>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.45)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radii.lg,
    borderTopRightRadius: radii.lg,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xxl,
    maxHeight: '80%',
  },
  title: {
    ...typography.h3,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  list: {
    flexGrow: 0,
  },
  rowWrap: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  row: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: 13,
  },
  label: {
    flex: 1,
    minWidth: 0,
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  labelOn: {
    color: colors.primary,
  },
  removeBtn: {
    padding: 6,
    marginLeft: spacing.sm,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.xs,
  },
  newRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.sm,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  newInput: {
    flex: 1,
    fontSize: 16,
    color: colors.text,
    paddingVertical: 8,
  },
  newAdd: {
    color: colors.primary,
    fontSize: 15,
    fontWeight: '700',
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
});

export default CategoryPickerSheet;
