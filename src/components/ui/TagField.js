import React, { useState, useMemo } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { colors, radii, spacing, typography } from '../../theme';
import Icon from './Icon';
import { useLanguage } from '../../i18n';

const MAX_SUGGESTIONS = 6;

export const normalizeTag = (s) => (s || '').trim().toLowerCase();

// Tags on an item: the chips it already carries, a box to add one, and
// suggestions drawn from tags already in use.
//
// The suggestions are the whole point. Typing "barbecue" once and tapping it
// forever after is the difference between a feature people use and one they
// abandon after three items — and it is also what stops the same idea existing
// as "bbq", "BBQ" and "barbeque" a month later. Tags are lower-cased on the
// way in for the same reason.
const TagField = ({ value = [], onChange, suggestions = [], disabled }) => {
  const { t } = useLanguage();
  const [draft, setDraft] = useState('');

  const add = (raw) => {
    const tag = normalizeTag(raw);
    if (!tag || value.includes(tag)) {
      setDraft('');
      return;
    }
    onChange([...value, tag]);
    setDraft('');
  };

  const remove = (tag) => onChange(value.filter((x) => x !== tag));

  // Tags already in use that aren't on this item, narrowed by what's typed.
  const offered = useMemo(() => {
    const q = normalizeTag(draft);
    return suggestions
      .filter((s) => !value.includes(s))
      .filter((s) => (q ? s.includes(q) : true))
      .slice(0, MAX_SUGGESTIONS);
  }, [suggestions, value, draft]);

  const draftIsNew = normalizeTag(draft) && !suggestions.includes(normalizeTag(draft));

  return (
    <View>
      <View style={styles.labelRow}>
        <Text style={styles.label}>{t('tags.label')}</Text>
        <Text style={styles.optional}>{t('common.optional')}</Text>
      </View>

      {value.length > 0 ? (
        <View style={styles.chips}>
          {value.map((tag) => (
            <TouchableOpacity
              key={tag}
              style={styles.chip}
              onPress={() => remove(tag)}
              disabled={disabled}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel={t('tags.remove', { tag })}
            >
              <Text style={styles.chipText}>{tag}</Text>
              <Icon name="close" size={14} color={colors.primaryText} />
            </TouchableOpacity>
          ))}
        </View>
      ) : null}

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
          editable={!disabled}
          returnKeyType="done"
          onSubmitEditing={() => add(draft)}
        />
        {draftIsNew ? (
          <TouchableOpacity onPress={() => add(draft)} hitSlop={8} disabled={disabled}>
            <Icon name="add-circle" size={22} color={colors.primary} />
          </TouchableOpacity>
        ) : null}
      </View>

      {offered.length > 0 ? (
        <View style={styles.suggestions}>
          {offered.map((tag) => (
            <TouchableOpacity
              key={tag}
              style={styles.suggestion}
              onPress={() => add(tag)}
              disabled={disabled}
              activeOpacity={0.7}
            >
              <Icon name="add" size={13} color={colors.textMuted} />
              <Text style={styles.suggestionText}>{tag}</Text>
            </TouchableOpacity>
          ))}
        </View>
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
    marginBottom: 8,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingLeft: 10,
    paddingRight: 8,
    paddingVertical: 6,
    borderRadius: radii.pill,
    backgroundColor: colors.primaryTint,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.primaryText,
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
  },
  input: {
    flex: 1,
    fontSize: 15,
    color: colors.text,
    padding: 0,
  },
  suggestions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 8,
  },
  suggestion: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  suggestionText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textMuted,
  },
});

export default TagField;
