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
const TagField = ({
  value = [],
  onChange,
  defined = [],
  onDefine,
  nearMatch,
  exists,
  disabled,
}) => {
  const { t } = useLanguage();
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState('');

  const toggle = (tag) =>
    onChange(value.includes(tag) ? value.filter((x) => x !== tag) : [...value, tag]);

  // Defined tags, selected ones first so what is on the item reads as a group.
  const ordered = useMemo(() => {
    const on = defined.filter((tag) => value.includes(tag));
    const off = defined.filter((tag) => !value.includes(tag));
    return [...on, ...off];
  }, [defined, value]);

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
            text: t('tags.useExisting', { tag: near }),
            onPress: () => {
              if (!value.includes(near)) onChange([...value, near]);
              setDraft('');
              setCreating(false);
            },
          },
          {
            text: t('tags.createAnyway', { tag: name }),
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
        <Text style={styles.label}>{t('tags.label')}</Text>
        <Text style={styles.optional}>{t('common.optional')}</Text>
      </View>

      <View style={styles.chips}>
        {ordered.map((tag) => {
          const on = value.includes(tag);
          return (
            <TouchableOpacity
              key={tag}
              style={[styles.chip, on && styles.chipOn]}
              onPress={() => toggle(tag)}
              disabled={disabled}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
            >
              {on ? <Icon name="checkmark" size={13} color={colors.primaryText} /> : null}
              <Text style={[styles.chipText, on && styles.chipTextOn]}>{tag}</Text>
            </TouchableOpacity>
          );
        })}

        {!creating ? (
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
  label: {
    ...typography.label,
    color: colors.textMuted,
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
