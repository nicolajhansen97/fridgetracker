import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useLanguage } from '../i18n';
import { Card, Icon, Input, SectionTitle } from './ui';
import { colors, frames, radii, spacing, typography } from '../theme';
import { formatQty, parseAmount } from '../utils/scanRecipe';

// Edit form for a scanned recipe: fix what the AI misread (a word, an
// amount, a unit), add or remove ingredients and steps. Rendered inside
// ScannedRecipeModal in place of the cook-from view, with its own
// Cancel / Save header. `onSave(recipe)` resolves true when it was stored.

const toDraft = (recipe) => ({
  title: recipe.title || '',
  description: recipe.description || '',
  servings: recipe.servings ? String(recipe.servings) : '',
  totalMinutes: recipe.totalMinutes ? String(recipe.totalMinutes) : '',
  ingredients: (recipe.ingredients || []).map((ing) => ({
    ...ing,
    amountText: ing.amount ? formatQty(ing.amount) : '',
    unit: ing.unit || '',
    note: ing.note || '',
  })),
  steps: [...(recipe.steps || [])],
});

const blankIngredient = (last) => ({
  name: '',
  amountText: '',
  unit: '',
  note: '',
  // New lines join the group of the line above, so they land under the same
  // heading ("For the sauce") in the cook-from view.
  group: last?.group || null,
  scanned: true,
});

const toInt = (s, max) => {
  const n = parseInt(String(s).replace(/[^\d]/g, ''), 10);
  return Number.isFinite(n) && n > 0 ? Math.min(n, max) : null;
};

// Draft → the saved recipe shape. Empty rows are dropped. An ingredient
// whose name was changed loses the item the AI matched at scan time; the
// live name match in the cook-from view takes over.
const fromDraft = (draft) => {
  const ingredients = draft.ingredients
    .map(({ amountText, _orig, ...ing }) => {
      const name = ing.name.trim();
      if (!name) return null;
      const renamed = !_orig || _orig.name !== name;
      return {
        ...ing,
        name,
        amount: parseAmount(amountText),
        unit: ing.unit.trim() || null,
        note: ing.note.trim() || null,
        fridgeItem: renamed ? null : ing.fridgeItem ?? null,
        inFridge: renamed ? false : !!ing.inFridge,
      };
    })
    .filter(Boolean);
  return {
    title: draft.title.trim(),
    description: draft.description.trim(),
    servings: toInt(draft.servings, 100),
    totalMinutes: toInt(draft.totalMinutes, 9999),
    ingredients,
    steps: draft.steps.map((s) => s.trim()).filter(Boolean),
  };
};

const ScannedRecipeEditor = ({ recipe, onSave, onCancel }) => {
  const { t } = useLanguage();
  const [draft, setDraft] = useState(() => {
    const d = toDraft(recipe);
    // Remember which original ingredient each row came from (by reference),
    // so a rename can be detected even after rows are added or removed.
    d.ingredients = d.ingredients.map((ing, i) => ({ ...ing, _orig: recipe.ingredients[i] }));
    return d;
  });
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);

  const set = (patch) => {
    setDraft((d) => ({ ...d, ...patch }));
    setDirty(true);
  };
  const setIng = (idx, patch) =>
    set({ ingredients: draft.ingredients.map((ing, i) => (i === idx ? { ...ing, ...patch } : ing)) });
  const removeIng = (idx) => set({ ingredients: draft.ingredients.filter((_, i) => i !== idx) });
  const addIng = () =>
    set({ ingredients: [...draft.ingredients, blankIngredient(draft.ingredients[draft.ingredients.length - 1])] });
  const setStep = (idx, text) => set({ steps: draft.steps.map((s, i) => (i === idx ? text : s)) });
  const removeStep = (idx) => set({ steps: draft.steps.filter((_, i) => i !== idx) });
  const addStep = () => set({ steps: [...draft.steps, ''] });

  const cancel = () => {
    if (!dirty) return onCancel();
    Alert.alert(t('recipeScan.discardTitle'), t('recipeScan.discardDesc'), [
      { text: t('recipeScan.keepEditing'), style: 'cancel' },
      { text: t('recipeScan.discard'), style: 'destructive', onPress: onCancel },
    ]);
  };

  const save = async () => {
    const out = fromDraft(draft);
    const problem = !out.title
      ? t('recipeScan.needTitle')
      : out.ingredients.length === 0
      ? t('recipeScan.needIngredient')
      : out.steps.length === 0
      ? t('recipeScan.needStep')
      : null;
    if (problem) {
      Alert.alert(t('recipeScan.cantSaveTitle'), problem);
      return;
    }
    setSaving(true);
    const ok = await onSave(out);
    setSaving(false);
    if (!ok) Alert.alert(t('common.error'), t('recipeScan.updateFailed'));
  };

  return (
    <>
      <View style={styles.header}>
        <TouchableOpacity onPress={cancel} hitSlop={8} disabled={saving}>
          <Text style={styles.headerCancel}>{t('common.cancel')}</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('recipeScan.editTitle')}</Text>
        <TouchableOpacity onPress={save} hitSlop={8} disabled={saving}>
          <Text style={[styles.headerSave, saving && { opacity: 0.5 }]}>{t('common.save')}</Text>
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.body, frames.readable]}
        >
          <Input
            label={t('recipeScan.fieldTitle')}
            value={draft.title}
            onChangeText={(v) => set({ title: v })}
          />
          <Input
            label={t('recipeScan.fieldDescription')}
            value={draft.description}
            onChangeText={(v) => set({ description: v })}
            style={styles.field}
          />
          <View style={[styles.field, styles.twoUp]}>
            <Input
              label={t('recipeScan.fieldServings')}
              value={draft.servings}
              onChangeText={(v) => set({ servings: v })}
              keyboardType="number-pad"
              style={{ flex: 1 }}
            />
            <Input
              label={t('recipeScan.fieldMinutes')}
              value={draft.totalMinutes}
              onChangeText={(v) => set({ totalMinutes: v })}
              keyboardType="number-pad"
              style={{ flex: 1 }}
            />
          </View>

          <SectionTitle
            action={
              <TouchableOpacity onPress={addIng} hitSlop={8}>
                <Text style={styles.link}>{t('recipeScan.addIngredient')}</Text>
              </TouchableOpacity>
            }
          >
            {t('recipes.ingredients')}
          </SectionTitle>
          <Text style={styles.help}>{t('recipeScan.ingredientHelp')}</Text>
          <Card padded={false}>
            {draft.ingredients.map((ing, idx) => (
              <View key={idx} style={[styles.ingRow, idx > 0 && styles.divider]}>
                <View style={styles.ingLine}>
                  <TextInput
                    value={ing.amountText}
                    onChangeText={(v) => setIng(idx, { amountText: v })}
                    placeholder={t('recipeScan.amountPh')}
                    placeholderTextColor={colors.textSubtle}
                    keyboardType={Platform.OS === 'ios' ? 'numbers-and-punctuation' : 'default'}
                    style={[styles.cell, styles.amountCell]}
                  />
                  <TextInput
                    value={ing.unit}
                    onChangeText={(v) => setIng(idx, { unit: v })}
                    placeholder={t('recipeScan.unitPh')}
                    placeholderTextColor={colors.textSubtle}
                    autoCapitalize="none"
                    autoCorrect={false}
                    style={[styles.cell, styles.unitCell]}
                  />
                  <TextInput
                    value={ing.name}
                    onChangeText={(v) => setIng(idx, { name: v })}
                    placeholder={t('recipeScan.namePh')}
                    placeholderTextColor={colors.textSubtle}
                    style={[styles.cell, { flex: 1 }]}
                  />
                  <TouchableOpacity
                    onPress={() => removeIng(idx)}
                    hitSlop={8}
                    accessibilityLabel={t('common.remove')}
                  >
                    <Icon name="close-circle" size={20} color={colors.textSubtle} />
                  </TouchableOpacity>
                </View>
                <TextInput
                  value={ing.note}
                  onChangeText={(v) => setIng(idx, { note: v })}
                  placeholder={t('recipeScan.notePh')}
                  placeholderTextColor={colors.textSubtle}
                  style={styles.noteCell}
                />
              </View>
            ))}
          </Card>

          <SectionTitle
            action={
              <TouchableOpacity onPress={addStep} hitSlop={8}>
                <Text style={styles.link}>{t('recipeScan.addStep')}</Text>
              </TouchableOpacity>
            }
          >
            {t('recipes.instructions')}
          </SectionTitle>
          <View style={{ gap: spacing.md }}>
            {draft.steps.map((step, i) => (
              <View key={i} style={styles.step}>
                <View style={styles.stepBadge}>
                  <Text style={styles.stepNumber}>{i + 1}</Text>
                </View>
                <TextInput
                  value={step}
                  onChangeText={(v) => setStep(i, v)}
                  multiline
                  placeholder={t('recipeScan.stepPh')}
                  placeholderTextColor={colors.textSubtle}
                  style={styles.stepInput}
                />
                <TouchableOpacity
                  onPress={() => removeStep(i)}
                  hitSlop={8}
                  style={{ marginTop: 6 }}
                  accessibilityLabel={t('common.remove')}
                >
                  <Icon name="close-circle" size={20} color={colors.textSubtle} />
                </TouchableOpacity>
              </View>
            ))}
          </View>
          <View style={{ height: spacing.xxxl }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </>
  );
};

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
  },
  headerCancel: { ...typography.body, color: colors.textMuted },
  headerTitle: { ...typography.bodyStrong, color: colors.text },
  headerSave: { ...typography.bodyStrong, color: colors.primary },
  body: { padding: spacing.lg },
  field: { marginTop: spacing.md },
  twoUp: { flexDirection: 'row', gap: spacing.md },
  link: { color: colors.primary, fontSize: 13, fontWeight: '700' },
  help: { ...typography.caption, color: colors.textMuted, marginBottom: spacing.sm },
  ingRow: { paddingVertical: 10, paddingHorizontal: spacing.md, gap: 6 },
  divider: { borderTopWidth: 1, borderTopColor: colors.border },
  ingLine: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  cell: {
    backgroundColor: colors.bg,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 8,
    paddingHorizontal: 8,
    fontSize: 15,
    color: colors.text,
  },
  amountCell: { width: 60, textAlign: 'center', fontWeight: '700' },
  unitCell: { width: 60 },
  noteCell: {
    ...typography.bodySmall,
    color: colors.textMuted,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  step: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  stepBadge: {
    backgroundColor: colors.primary,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  stepNumber: { color: colors.surface, fontSize: 13, fontWeight: '700' },
  stepInput: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 10,
    minHeight: 44,
    ...typography.body,
    color: colors.text,
    textAlignVertical: 'top',
  },
});

export default ScannedRecipeEditor;
