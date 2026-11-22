import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Modal,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useFridge } from '../context/FridgeContext';
import { useShoppingList } from '../context/ShoppingListContext';
import { useLanguage } from '../i18n';
import { Card, Icon, Badge, PrimaryButton, SectionTitle } from './ui';
import { colors, frames, gradients, radii, spacing, typography } from '../theme';
import { formatAmount, matchRecipeToInventory, matchStats } from '../utils/scanRecipe';
import ScannedRecipeEditor from './ScannedRecipeEditor';

// A recipe read from a photo, laid out to cook from: servings you can scale,
// ingredients checked against what's at home right now, the missing ones
// pre-selected for the shopping list (one tap), and steps you tick off as
// you go. Same modal chrome as the AI recipe detail in RecipeSuggestionsScreen.
const ScannedRecipeModal = ({ recipe, visible, onClose, onDelete, onSave }) => {
  const { items } = useFridge();
  const { items: shoppingItems, addItem } = useShoppingList();
  const { t } = useLanguage();

  const baseServings = recipe?.servings || null;
  const [servings, setServings] = useState(baseServings);
  const [selected, setSelected] = useState({}); // ingredient index → bool (user overrides)
  const [doneSteps, setDoneSteps] = useState({});
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState(false);

  // Fresh state each time a (different) recipe opens.
  useEffect(() => {
    setServings(recipe?.servings || null);
    setSelected({});
    setDoneSteps({});
    setEditing(false);
  }, [recipe?.id, visible]);

  // After an edit the servings may have changed: start from the new number.
  useEffect(() => {
    setServings(recipe?.servings || null);
  }, [recipe?.servings]);

  const saveEdits = async (changes) => {
    const ok = await onSave(changes);
    if (ok) {
      setEditing(false);
      setSelected({});
      setDoneSteps({});
    }
    return ok;
  };

  const factor = baseServings && servings ? servings / baseServings : 1;

  const matched = useMemo(
    () => matchRecipeToInventory(recipe?.ingredients || [], items, shoppingItems),
    [recipe, items, shoppingItems]
  );
  const stats = matchStats(matched);

  // Missing, non-staple ingredients start ticked; staples and things already
  // on the list start unticked. The user can flip any of them.
  const isBuyable = (ing) => !ing.inFridge && !ing.onList;
  const isSelected = (ing, idx) =>
    isBuyable(ing) && (idx in selected ? selected[idx] : !ing.pantry);
  const toggle = (ing, idx) =>
    setSelected((prev) => ({ ...prev, [idx]: !isSelected(ing, idx) }));

  const toBuy = matched
    .map((ing, idx) => ({ ing, idx }))
    .filter(({ ing, idx }) => isSelected(ing, idx));
  const anyBuyable = matched.some(isBuyable);

  const addSelected = async () => {
    if (toBuy.length === 0) return;
    setAdding(true);
    let added = 0;
    for (const { ing } of toBuy) {
      const res = await addItem(ing.name, formatAmount(ing.amount, ing.unit, factor));
      if (res.success) added++;
    }
    setAdding(false);
    setSelected({});
    Alert.alert(t('recipes.addedToList'), t('recipeScan.addedDesc', { count: added }));
  };

  const confirmDelete = () => {
    Alert.alert(t('recipeScan.deleteTitle'), t('recipeScan.deleteDesc'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('common.delete'), style: 'destructive', onPress: onDelete },
    ]);
  };

  if (!recipe) return null;

  let lastGroup = null;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={editing ? () => {} : onClose}>
      <SafeAreaView style={styles.container}>
        {editing ? (
          <ScannedRecipeEditor
            key={recipe.id}
            recipe={recipe}
            onSave={saveEdits}
            onCancel={() => setEditing(false)}
          />
        ) : (
        <>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} hitSlop={8} style={styles.closeRow}>
            <Icon name="close" size={20} color={colors.primary} />
            <Text style={styles.close}>{t('recipes.close')}</Text>
          </TouchableOpacity>
          <View style={styles.headerActions}>
            <TouchableOpacity
              onPress={() => setEditing(true)}
              hitSlop={8}
              style={styles.headerBtn}
              accessibilityLabel={t('recipeScan.editTitle')}
            >
              <Icon name="create-outline" size={22} color={colors.primary} />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={confirmDelete}
              hitSlop={8}
              style={styles.headerBtn}
              accessibilityLabel={t('recipeScan.deleteTitle')}
            >
              <Icon name="trash-outline" size={21} color={colors.textMuted} />
            </TouchableOpacity>
          </View>
        </View>

        <ScrollView showsVerticalScrollIndicator={false}>
          <View style={[styles.body, frames.readable]}>
            <LinearGradient
              colors={gradients.hero}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.art}
            >
              <Icon name="document-text-outline" size={42} color={colors.surface} />
            </LinearGradient>

            <Badge tone="primary" style={{ marginBottom: spacing.sm }}>
              {t('recipeScan.scannedBadge')}
            </Badge>
            <Text style={styles.title}>{recipe.title}</Text>
            {recipe.description ? <Text style={styles.desc}>{recipe.description}</Text> : null}

            <View style={styles.metaRow}>
              {recipe.totalMinutes > 0 && (
                <View style={styles.metaPill}>
                  <Icon name="time-outline" size={13} color={colors.infoText} />
                  <Text style={styles.metaPillText}>{recipe.totalMinutes} min</Text>
                </View>
              )}
              {baseServings ? (
                <View style={[styles.metaPill, styles.metaPillPrimary]}>
                  <Icon name="people-outline" size={13} color={colors.primaryText} />
                  <TouchableOpacity
                    onPress={() => setServings((s) => Math.max(1, s - 1))}
                    hitSlop={8}
                    accessibilityLabel="−"
                  >
                    <Text style={styles.stepperBtn}>−</Text>
                  </TouchableOpacity>
                  <Text style={[styles.metaPillText, { color: colors.primaryText }]}>
                    {t('recipes.servesSimple', { count: servings })}
                  </Text>
                  <TouchableOpacity
                    onPress={() => setServings((s) => Math.min(50, s + 1))}
                    hitSlop={8}
                    accessibilityLabel="+"
                  >
                    <Text style={styles.stepperBtn}>+</Text>
                  </TouchableOpacity>
                </View>
              ) : null}
            </View>

            <SectionTitle
              action={
                stats.total > 0 ? (
                  <Badge tone={stats.missing === 0 ? 'success' : 'default'}>
                    {t('recipeScan.haveCount', { have: stats.matched, total: stats.total })}
                  </Badge>
                ) : null
              }
            >
              {t('recipes.ingredients')}
            </SectionTitle>

            <Card padded={false}>
              {matched.map((ing, idx) => {
                const groupHeader = ing.group && ing.group !== lastGroup ? ing.group : null;
                lastGroup = ing.group || lastGroup;
                const buyable = isBuyable(ing);
                const on = isSelected(ing, idx);
                const amount = formatAmount(ing.amount, ing.unit, factor);
                const Row = buyable ? TouchableOpacity : View;
                return (
                  <React.Fragment key={idx}>
                    {groupHeader ? (
                      <Text style={[styles.groupHeader, idx > 0 && styles.divider]}>{groupHeader}</Text>
                    ) : null}
                    <Row
                      style={[styles.ingRow, idx > 0 && !groupHeader && styles.divider]}
                      {...(buyable
                        ? {
                            onPress: () => toggle(ing, idx),
                            activeOpacity: 0.6,
                            accessibilityRole: 'checkbox',
                            accessibilityState: { checked: on },
                          }
                        : {})}
                    >
                      <View style={styles.ingIcon}>
                        {ing.inFridge ? (
                          <Icon name="checkmark-circle" size={20} color={colors.primary} />
                        ) : ing.onList ? (
                          <Icon name="cart-outline" size={18} color={colors.textMuted} />
                        ) : (
                          <View style={[styles.checkbox, on && styles.checkboxOn]}>
                            {on ? <Icon name="checkmark" size={14} color={colors.surface} /> : null}
                          </View>
                        )}
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.ingText}>
                          {amount ? <Text style={styles.ingQty}>{amount} </Text> : null}
                          {ing.name}
                          {ing.note ? <Text style={styles.ingNote}>{`, ${ing.note}`}</Text> : null}
                        </Text>
                        {ing.inFridge ? (
                          <Text style={styles.haveText} numberOfLines={1}>
                            {t('recipeScan.youHave', { name: ing.haveItem })}
                          </Text>
                        ) : ing.onList ? (
                          <Text style={styles.subtleText}>{t('recipeScan.onList')}</Text>
                        ) : ing.pantry ? (
                          <Text style={styles.subtleText}>{t('recipes.pantryStaple')}</Text>
                        ) : null}
                      </View>
                    </Row>
                  </React.Fragment>
                );
              })}
            </Card>

            {anyBuyable ? (
              <PrimaryButton
                title={
                  toBuy.length > 0
                    ? t('recipeScan.addToList', { count: toBuy.length })
                    : t('recipeScan.selectToAdd')
                }
                icon={<Icon name="cart-outline" size={16} color={colors.surface} />}
                onPress={addSelected}
                loading={adding}
                disabled={toBuy.length === 0}
                style={{ marginTop: spacing.md }}
              />
            ) : (
              <View style={styles.allSet}>
                <Icon name="checkmark-circle" size={18} color={colors.success} />
                <Text style={styles.allSetText}>{t('recipeScan.allSet')}</Text>
              </View>
            )}

            {(recipe.steps || []).length > 0 && (
              <>
                <SectionTitle>{t('recipes.instructions')}</SectionTitle>
                <Text style={styles.hint}>{t('recipeScan.tapStepHint')}</Text>
                <View style={{ gap: spacing.md }}>
                  {recipe.steps.map((step, i) => {
                    const done = !!doneSteps[i];
                    return (
                      <TouchableOpacity
                        key={i}
                        style={styles.step}
                        activeOpacity={0.7}
                        onPress={() => setDoneSteps((p) => ({ ...p, [i]: !p[i] }))}
                        accessibilityRole="checkbox"
                        accessibilityState={{ checked: done }}
                      >
                        <View style={[styles.stepBadge, done && styles.stepBadgeDone]}>
                          {done ? (
                            <Icon name="checkmark" size={15} color={colors.surface} />
                          ) : (
                            <Text style={styles.stepNumber}>{i + 1}</Text>
                          )}
                        </View>
                        <Text style={[styles.stepText, done && styles.stepTextDone]}>{step}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </>
            )}
          </View>
          <View style={{ height: spacing.xxxl }} />
        </ScrollView>
        </>
        )}
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
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
  closeRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  close: { ...typography.bodyStrong, color: colors.primary },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  headerBtn: { padding: 4 },
  body: { padding: spacing.lg },
  art: {
    width: '100%',
    height: 140,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.lg,
    marginBottom: spacing.md,
  },
  title: { ...typography.h2, color: colors.text, marginBottom: spacing.xs },
  desc: { ...typography.body, color: colors.textMuted, marginBottom: spacing.md, lineHeight: 21 },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: spacing.sm },
  metaPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: colors.infoSoft,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  metaPillPrimary: { backgroundColor: colors.primaryTint, gap: 8 },
  metaPillText: { fontSize: 12, fontWeight: '700', color: colors.infoText },
  stepperBtn: { fontSize: 16, fontWeight: '800', color: colors.primaryText, paddingHorizontal: 4 },
  groupHeader: {
    ...typography.label,
    color: colors.textMuted,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: 4,
  },
  ingRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 11,
    paddingHorizontal: spacing.lg,
    gap: 12,
  },
  divider: { borderTopWidth: 1, borderTopColor: colors.border },
  ingIcon: { width: 22, alignItems: 'center', marginTop: 1 },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  ingText: { ...typography.body, color: colors.text, lineHeight: 21 },
  ingQty: { fontWeight: '700', color: colors.text },
  ingNote: { color: colors.textMuted },
  haveText: { ...typography.caption, color: colors.primaryText, fontWeight: '600', marginTop: 2 },
  subtleText: { ...typography.caption, color: colors.textSubtle, marginTop: 2 },
  allSet: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: spacing.md,
    backgroundColor: colors.successSoft,
    borderRadius: radii.md,
    padding: spacing.md,
  },
  allSetText: { ...typography.bodyStrong, color: colors.successText, flex: 1 },
  hint: { ...typography.caption, color: colors.textMuted, marginBottom: spacing.sm },
  step: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  stepBadge: {
    backgroundColor: colors.primary,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    marginTop: 1,
  },
  stepBadgeDone: { backgroundColor: colors.success },
  stepNumber: { color: colors.surface, fontSize: 13, fontWeight: '700' },
  stepText: { flex: 1, ...typography.body, color: colors.text, lineHeight: 22 },
  stepTextDone: { color: colors.textSubtle, textDecorationLine: 'line-through' },
});

export default ScannedRecipeModal;
