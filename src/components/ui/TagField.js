import React, { useState, useMemo } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { colors, radii, spacing, typography } from '../../theme';
import Icon from './Icon';
import { useLanguage } from '../../i18n';
import { normalizeTag } from '../../hooks/useTagDefinitions';

export { normalizeTag };

// Tags on an item.
//
// Picking a tag and inventing one are separate actions on purpose. When any
// text box can mint a tag, one typo puts "gril" in the household's list
// permanently, sitting next to "grill" with nothing to say which was the
// mistake. So the normal path is tapping a tag that already exists, and
// creating one is a second, deliberate step behind a near-match check.
//
// Deleting is the way back out when a typo gets through anyway. It lives behind
// an Edit mode rather than on every chip, because a tap on a chip already means
// "put this on the item", and a destructive action one mis-tap away from that
// is how tags get lost.
const TagField = ({
  value = [],
  onChange,
  defined = [],
  onDefine,
  onDelete,
  usageCount,
  nearMatch,
  exists,
  disabled,
}) => {
  const { t } = useLanguage();
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState('');
  const [editing, setEditing] = useState(false);

  // Derived rather than reset in an effect: deleting the last tag simply ends
  // edit mode, with nothing left to tap.
  const canEdit = !!onDelete && defined.length > 0;
  const isEditing = editing && canEdit;

  const toggle = (tag) =>
    onChange(value.includes(tag) ? value.filter((x) => x !== tag) : [...value, tag]);

  // Defined tags, selected ones first so what is on the item reads as a group.
  const ordered = useMemo(() => {
    const on = defined.filter((tag) => value.includes(tag));
    const off = defined.filter((tag) => !value.includes(tag));
    return [...on, ...off];
  }, [defined, value]);

  const confirmDelete = (tag) => {
    const count = usageCount ? usageCount(tag) : 0;
    Alert.alert(
      t('tags.deleteTitle', { tag }),
      count > 0 ? t('tags.deleteBody', { count }) : t('tags.deleteBodyUnused'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: async () => {
            const result = await onDelete(tag);
            if (result && result.success === false) {
              Alert.alert(t('common.error'), t('tags.deleteFailed'));
              return;
            }
            // Drop it from this form as well. Otherwise saving the item puts
            // back the tag that was just deleted, now with no definition, where
            // the picker cannot show it and nobody can take it off.
            if (value.includes(tag)) onChange(value.filter((x) => x !== tag));
          },
        },
      ]
    );
  };

  const toggleEditing = () => {
    setEditing((on) => !on);
    setCreating(false);
    setDraft('');
  };

  const commitNew = async () => {
    const name = normalizeTag(draft);
    if (!name) {
      setCreating(false);
      setDraft('');
      return;
    }

    // Already defined: just apply it rather than complaining.
    if (exists && exists(name)) {
      if (!value.includes(name)) onChange([...value, name]);
      setDraft('');
      setCreating(false);
      return;
    }

    const near = nearMatch ? nearMatch(name) : null;
    if (near) {
      // A typo and a genuinely new tag look identical in a text box, so ask.
      // Defaulting to the existing tag is what keeps the list from splitting.
      Alert.alert(
        t('tags.similarTitle'),
        t('tags.similarBody', { typed: name, existing: near }),
        [
          {
            text: t('tags.useExisting', { existing: near }),
            onPress: () => {
              if (!value.includes(near)) onChange([...value, near]);
              setDraft('');
              setCreating(false);
            },
          },
          {
            text: t('tags.createAnyway', { typed: name }),
            style: 'destructive',
            onPress: async () => {
              await onDefine?.(name);
              if (!value.includes(name)) onChange([...value, name]);
              setDraft('');
              setCreating(false);
            },
          },
        ]
      );
      return;
    }

    await onDefine?.(name);
    if (!value.includes(name)) onChange([...value, name]);
    setDraft('');
    setCreating(false);
  };

  return (
    <View>
      <View style={styles.labelRow}>
        <View style={styles.labelLeft}>
          <Text style={styles.label}>{t('tags.label')}</Text>
          <Text style={styles.optional}>{t('common.optional')}</Text>
        </View>
        {canEdit ? (
          <TouchableOpacity
            onPress={toggleEditing}
            disabled={disabled}
            hitSlop={10}
            accessibilityRole="button"
          >
            <Text style={styles.editText}>
              {isEditing ? t('tags.done') : t('tags.edit')}
            </Text>
          </TouchableOpacity>
        ) : null}
      </View>

      <View style={styles.chips}>
        {ordered.map((tag) => {
          // In edit mode every chip looks the same: whether it is on this item
          // is beside the point when the question is whether it should exist.
          const on = value.includes(tag) && !isEditing;
          return (
            <TouchableOpacity
              key={tag}
              style={[styles.chip, on && styles.chipOn, isEditing && styles.chipEditing]}
              onPress={() => (isEditing ? confirmDelete(tag) : toggle(tag))}
              onLongPress={canEdit && !isEditing ? () => confirmDelete(tag) : undefined}
              disabled={disabled}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityState={isEditing ? undefined : { selected: on }}
              accessibilityLabel={isEditing ? t('tags.deleteNamed', { tag }) : tag}
            >
              {on ? <Icon name="checkmark" size={13} color={colors.primaryText} /> : null}
              <Text style={[styles.chipText, on && styles.chipTextOn]}>{tag}</Text>
              {isEditing ? <Icon name="close" size={14} color={colors.dangerText} /> : null}
            </TouchableOpacity>
          );
        })}

        {!creating && !isEditing ? (
          <TouchableOpacity
            style={styles.newChip}
            onPress={() => setCreating(true)}
            disabled={disabled}
            activeOpacity={0.7}
          >
            <Icon name="add" size={14} color={colors.primary} />
            <Text style={styles.newChipText}>{t('tags.newTag')}</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {creating ? (
        <View style={styles.inputRow}>
          <Icon name="pricetag-outline" size={18} color={colors.textMuted} />
          <TextInput
            style={styles.input}
            value={draft}
            onChangeText={setDraft}
            placeholder={t('tags.placeholder')}
            placeholderTextColor={colors.textSubtle}
            autoCapitalize="none"
            autoCorrect={false}
            autoFocus
            editable={!disabled}
            returnKeyType="done"
            onSubmitEditing={commitNew}
          />
          <TouchableOpacity onPress={commitNew} hitSlop={8} disabled={disabled}>
            <Icon name="checkmark-circle" size={22} color={colors.primary} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => {
              setCreating(false);
              setDraft('');
            }}
            hitSlop={8}
            disabled={disabled}
          >
            <Icon name="close-circle" size={22} color={colors.textSubtle} />
          </TouchableOpacity>
        </View>
      ) : null}

      {isEditing ? <Text style={styles.hint}>{t('tags.editHint')}</Text> : null}

      {defined.length === 0 && !creating ? (
        <Text style={styles.hint}>{t('tags.emptyHint')}</Text>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  labelLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  label: {
    ...typography.label,
    color: colors.textMuted,
  },
  editText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.primary,
  },
  optional: {
    ...typography.label,
    color: colors.textSubtle,
    textTransform: 'none',
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  chipOn: {
    backgroundColor: colors.primaryTint,
    borderColor: colors.primaryTint,
  },
  chipEditing: {
    borderColor: colors.dangerSoft,
    backgroundColor: colors.surface,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textMuted,
  },
  chipTextOn: {
    color: colors.primaryText,
    fontWeight: '700',
  },
  newChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.primary,
    backgroundColor: 'transparent',
  },
  newChipText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.primary,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    height: 48,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    backgroundColor: colors.bg,
    paddingHorizontal: 14,
    marginTop: 8,
  },
  input: {
    flex: 1,
    fontSize: 15,
    color: colors.text,
    padding: 0,
  },
  hint: {
    fontSize: 12,
    color: colors.textSubtle,
    marginTop: 8,
  },
});

export default TagField;
