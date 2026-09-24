import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ScrollView,
} from 'react-native';
import DateTimePickerModal from 'react-native-modal-datetime-picker';
import { useFridge } from '../context/FridgeContext';
import { useDrawers } from '../context/DrawerContext';
import { useLanguage } from '../i18n';
import {
  Screen,
  ScreenHeader,
  Card,
  Icon,
  Pill,
  AmountField,
  PriceField,
  TagField,
  CategoryPickerSheet,
  Input,
  PrimaryButton,
} from '../components/ui';
import { colors, radii, spacing, typography } from '../theme';
import { useCategory } from '../hooks/useCategory';
import { useFridgeExpiry } from '../hooks/useFridgeExpiry';
import { useItemPrices } from '../hooks/useItemPrices';
import { parseMoney } from '../utils/currency';

const EditItemScreen = ({ route, navigation }) => {
  const { item } = route.params;
  const [name, setName] = useState(item.name);
  const [drawer, setDrawer] = useState(item.drawer);
  const [quantity, setQuantity] = useState(String(item.quantity || 1));
  const [frozenDate, setFrozenDate] = useState(item.frozen_date || '');
  const [selectedFrozenDate, setSelectedFrozenDate] = useState(
    item.frozen_date ? new Date(item.frozen_date) : new Date()
  );
  const [isFrozenDatePickerVisible, setFrozenDatePickerVisibility] = useState(false);
  const [expiryDate, setExpiryDate] = useState(item.expiry_date || '');
  const [selectedDate, setSelectedDate] = useState(
    item.expiry_date ? new Date(item.expiry_date) : null
  );
  const [isDatePickerVisible, setDatePickerVisibility] = useState(false);
  // Which of the two dates governs this item — see usesManualExpiry(). Only
  // meaningful when the item has both a picked date and a frozen date.
  const [useManualExpiry, setUseManualExpiry] = useState(item.use_manual_expiry !== false);
  const [notes, setNotes] = useState(item.notes || '');
  const [position, setPosition] = useState(item.position ? String(item.position) : '');
  const [unit, setUnit] = useState(item.unit || 'pcs');
  const [price, setPrice] = useState(item.price != null ? String(item.price) : '');
  const [tags, setTags] = useState(item.tags || []);
  const [isLoading, setIsLoading] = useState(false);
  const [catPickerVisible, setCatPickerVisible] = useState(false);

  const { updateItem, allTags } = useFridge();
  const { priceFor, remember: rememberPrice } = useItemPrices();
  const { getFreezerEstimate } = useFridgeExpiry();
  const { drawers } = useDrawers();
  const { t, formatDate } = useLanguage();
  const {
    getCategory: catOf, isOverridden, setCategory, labelFor,
    customCategories, addCustomCategory, removeCustomCategory,
  } = useCategory();

  const currentCategory = catOf(item.name);
  const categoryIsAuto = !isOverridden(item.name);

  // Estimate built from the form's live values rather than the saved row, so
  // the choice reflects edits to the name or frozen date before they are saved.
  const freezerEstimate = getFreezerEstimate({
    name: name.trim() || item.name,
    frozen_date: frozenDate || null,
  });

  const handleFrozenDateConfirm = (date) => {
    setSelectedFrozenDate(date);
    setFrozenDate(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`);
    setFrozenDatePickerVisibility(false);
  };

  // Picking a date is a statement that it should count, so re-select it — the
  // user would otherwise pick a date and see nothing change.
  const handleDateConfirm = (date) => {
    setSelectedDate(date);
    setExpiryDate(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`);
    setUseManualExpiry(true);
    setDatePickerVisibility(false);
  };

  const clearDate = () => {
    setExpiryDate('');
    setSelectedDate(null);
    setUseManualExpiry(true);
  };

  const handleSubmit = async () => {
    if (!name.trim()) {
      Alert.alert(t('common.error'), t('addItem.enterItemName'));
      return;
    }
    if (!drawer) {
      Alert.alert(t('common.error'), t('addItem.selectDrawer'));
      return;
    }

    const parsedPrice = parseMoney(price);
    setIsLoading(true);
    const result = await updateItem(item.id, {
      name: name.trim(),
      drawer,
      quantity: parseInt(quantity) || 1,
      unit,
      frozen_date: frozenDate || null,
      expiry_date: expiryDate || null,
      use_manual_expiry: useManualExpiry,
      notes: notes.trim(),
      position: position ? parseInt(position) : null,
      price: parsedPrice,
      tags,
    });
    setIsLoading(false);

    if (result.success) {
      // Correcting a price here is the most reliable signal we get about what
      // something actually costs, so it updates the remembered value too.
      if (parsedPrice !== null) {
        rememberPrice(name.trim(), parsedPrice, parseInt(quantity) || 1, unit);
      }
      Alert.alert(t('common.success'), t('editItem.itemUpdated'), [
        { text: t('common.ok'), onPress: () => navigation.goBack() },
      ]);
    } else {
      if (result.error && result.error.includes('Position')) {
        Alert.alert(t('addItem.positionInUse'), result.error, [{ text: t('common.ok') }]);
      } else {
        Alert.alert(t('common.error'), result.error);
      }
    }
  };

  return (
    <Screen>
      <ScreenHeader
        title={t('editItem.title')}
        onBack={() => navigation.goBack()}
        backLabel={t('common.cancel')}
      />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* ── Item ───────────────────────────────────────────── */}
          <Text style={[styles.sectionLabel, styles.sectionLabelFirst]}>{t('addItem.sectionItem')}</Text>
          <Card style={styles.card} padded={false}>
            <View style={styles.cardInner}>
              <TextInput
                style={styles.nameInput}
                placeholder={t('addItem.itemNamePlaceholder')}
                placeholderTextColor={colors.textSubtle}
                value={name}
                onChangeText={setName}
                editable={!isLoading}
              />
            </View>
          </Card>

          {/* ── Storage ────────────────────────────────────────── */}
          <Text style={styles.sectionLabel}>{t('addItem.sectionStorage')}</Text>
          <Card style={styles.card} padded={false}>
            <View style={styles.cardInner}>
              <View style={styles.labelRow}>
                <Text style={styles.label}>{t('addItem.compartment')}</Text>
                <TouchableOpacity onPress={() => navigation.navigate('ManageDrawers')} hitSlop={8}>
                  <Text style={styles.linkText}>{t('addItem.manageCompartments')}</Text>
                </TouchableOpacity>
              </View>
              {drawers.length === 0 ? (
                <View style={styles.warning}>
                  <Text style={styles.warningText}>{t('addItem.noCompartments')}</Text>
                </View>
              ) : (
                <View style={styles.chipWrap}>
                  {drawers.map((d) => (
                    <Pill
                      key={d.id}
                      label={d.name}
                      icon={d.icon}
                      selected={drawer === d.name}
                      onPress={() => setDrawer(d.name)}
                      disabled={isLoading}
                    />
                  ))}
                </View>
              )}
            </View>

            <View style={styles.divider} />

            <View style={styles.cardInner}>
              <AmountField
                quantity={quantity}
                setQuantity={setQuantity}
                unit={unit}
                setUnit={setUnit}
                disabled={isLoading}
              />
            </View>

            <View style={styles.divider} />

            <View style={styles.cardInner}>
              <PriceField
                value={price}
                onChangeText={setPrice}
                remembered={priceFor(name, quantity)}
                onUseRemembered={(p) => setPrice(String(p))}
                quantity={quantity}
                disabled={isLoading}
              />
            </View>

            <View style={styles.divider} />

            <View style={styles.cardInner}>
              <TagField
                value={tags}
                onChange={setTags}
                suggestions={allTags}
                disabled={isLoading}
              />
            </View>

            <View style={styles.divider} />

            <View style={styles.cardInner}>
              <Text style={styles.label}>{t('addItem.category')}</Text>
              <TouchableOpacity
                style={styles.datePicker}
                onPress={() => setCatPickerVisible(true)}
                disabled={isLoading}
                activeOpacity={0.7}
              >
                <Text style={styles.dateText} numberOfLines={1}>
                  {`${labelFor(currentCategory)}${categoryIsAuto ? ` · ${t('addItem.categoryAuto')}` : ''}`}
                </Text>
                <Icon name="chevron-down" size={18} color={colors.textSubtle} />
              </TouchableOpacity>
            </View>
          </Card>

          {/* ── Dates ──────────────────────────────────────────── */}
          <Text style={styles.sectionLabel}>{t('addItem.sectionDates')}</Text>
          <Card style={styles.card} padded={false}>
            <View style={styles.cardInner}>
              <Text style={styles.label}>{t('addItem.frozenDate')}</Text>
              <TouchableOpacity style={styles.datePicker} onPress={() => setFrozenDatePickerVisibility(true)} disabled={isLoading}>
                <Text style={[styles.dateText, !frozenDate && styles.datePlaceholder]} numberOfLines={1}>
                  {frozenDate ? formatDate(frozenDate) : t('addItem.selectDate')}
                </Text>
                <Icon name="snow-outline" size={18} color={colors.primary} />
              </TouchableOpacity>
            </View>

            <View style={styles.divider} />

            <View style={styles.cardInner}>
              <Text style={styles.label}>{t('addItem.expiryDate')}</Text>
              <TouchableOpacity style={styles.datePicker} onPress={() => setDatePickerVisibility(true)} disabled={isLoading}>
                <Text style={[styles.dateText, !expiryDate && styles.datePlaceholder]} numberOfLines={1}>
                  {expiryDate ? formatDate(expiryDate) : t('addItem.selectDate')}
                </Text>
                <Icon name="calendar-outline" size={18} color={colors.accent} />
              </TouchableOpacity>
              {expiryDate ? (
                <TouchableOpacity onPress={clearDate} hitSlop={6} style={{ marginTop: 6, alignSelf: 'flex-start' }}>
                  <Text style={styles.linkText}>{t('addItem.clearDate')}</Text>
                </TouchableOpacity>
              ) : (
                <Text style={styles.helper}>{t('addItem.expiryAutoHint')}</Text>
              )}

              {/* Both dates exist and disagree about when this item is due —
                  let the user say which one is real. Hidden when there is only
                  one candidate, since then there is nothing to choose. */}
              {expiryDate && frozenDate ? (
                <View style={styles.sourceBlock}>
                  <Text style={styles.sourceLabel}>{t('addItem.expirySourceLabel')}</Text>
                  <View style={styles.sourceRow}>
                    <Pill
                      label={`${t('addItem.expirySourceManual')} · ${formatDate(expiryDate)}`}
                      selected={useManualExpiry}
                      onPress={() => setUseManualExpiry(true)}
                      disabled={isLoading}
                      style={styles.sourcePill}
                    />
                    <Pill
                      label={`${t('addItem.expirySourceEstimate')} · ${formatDate(freezerEstimate)}`}
                      selected={!useManualExpiry}
                      onPress={() => setUseManualExpiry(false)}
                      disabled={isLoading}
                      style={styles.sourcePill}
                    />
                  </View>
                  <Text style={styles.helper}>{t('addItem.expirySourceHint')}</Text>
                </View>
              ) : null}
            </View>
          </Card>

          {/* ── Package number ─────────────────────────────────── */}
          <Text style={styles.sectionLabel}>{t('addItem.packageNumber')}</Text>
          <Card style={styles.card} padded={false}>
            <View style={styles.cardInner}>
              <Input
                placeholder={t('addItem.packageNumberPlaceholder')}
                value={position}
                onChangeText={setPosition}
                keyboardType="number-pad"
                editable={!isLoading}
                helper={t('addItem.packageNumberHelper')}
              />
            </View>
          </Card>

          {/* ── Notes ──────────────────────────────────────────── */}
          <Text style={styles.sectionLabel}>{t('addItem.sectionNotes')}</Text>
          <Card style={styles.card} padded={false}>
            <View style={styles.cardInner}>
              <View style={styles.notesRow}>
                <Icon name="create-outline" size={16} color={colors.textSubtle} />
                <TextInput
                  style={styles.notesInput}
                  placeholder={t('addItem.notesPlaceholder')}
                  placeholderTextColor={colors.textSubtle}
                  value={notes}
                  onChangeText={setNotes}
                  multiline
                  editable={!isLoading}
                />
              </View>
            </View>
          </Card>
        </ScrollView>

        <View style={styles.footer}>
          <PrimaryButton
            title={isLoading ? t('editItem.updating') : t('editItem.updateItem')}
            onPress={handleSubmit}
            loading={isLoading}
          />
        </View>

        <DateTimePickerModal
          isVisible={isFrozenDatePickerVisible}
          mode="date"
          onConfirm={handleFrozenDateConfirm}
          onCancel={() => setFrozenDatePickerVisibility(false)}
          date={selectedFrozenDate || new Date()}
          maximumDate={new Date()}
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          pickerContainerStyleIOS={{ backgroundColor: 'white' }}
          textColor="#000000"
        />
        <DateTimePickerModal
          isVisible={isDatePickerVisible}
          mode="date"
          onConfirm={handleDateConfirm}
          onCancel={() => setDatePickerVisibility(false)}
          date={selectedDate || new Date()}
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          pickerContainerStyleIOS={{ backgroundColor: 'white' }}
          textColor="#000000"
        />

        <CategoryPickerSheet
          visible={catPickerVisible}
          value={currentCategory}
          isAuto={categoryIsAuto}
          title={item.name}
          customCategories={customCategories}
          onSelect={(cat) => {
            setCategory(item.name, cat);
            setCatPickerVisible(false);
          }}
          onCreate={(catName) => {
            const key = addCustomCategory(catName);
            if (key) setCategory(item.name, key);
            setCatPickerVisible(false);
          }}
          onDelete={(key) => removeCustomCategory(key)}
          onClose={() => setCatPickerVisible(false)}
        />
      </KeyboardAvoidingView>
    </Screen>
  );
};

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.xl,
  },
  footer: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textMuted,
    marginLeft: 4,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  sectionLabelFirst: {
    marginTop: spacing.xs,
  },
  card: {
    marginBottom: 0,
  },
  cardInner: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
  },
  nameInput: {
    fontSize: 17,
    fontWeight: '600',
    color: colors.text,
    padding: 0,
    minHeight: 24,
  },
  notesRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  notesInput: {
    flex: 1,
    fontSize: 15,
    color: colors.text,
    minHeight: 24,
    textAlignVertical: 'top',
    padding: 0,
    paddingTop: 1,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  label: {
    ...typography.label,
    color: colors.textMuted,
    marginBottom: 8,
  },
  linkText: {
    color: colors.accent,
    fontSize: 13,
    fontWeight: '700',
  },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  warning: {
    backgroundColor: colors.warningSoft,
    borderRadius: radii.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: '#FCD34D',
  },
  warningText: {
    color: '#92400E',
    fontSize: 13,
    textAlign: 'center',
  },
  datePicker: {
    backgroundColor: colors.bg,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 11,
    paddingHorizontal: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 6,
  },
  dateText: {
    fontSize: 14,
    color: colors.text,
    flexShrink: 1,
  },
  datePlaceholder: {
    color: colors.textSubtle,
  },
  helper: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: 6,
  },
  sourceBlock: {
    marginTop: spacing.md,
  },
  sourceLabel: {
    ...typography.label,
    color: colors.textMuted,
    marginBottom: 8,
  },
  sourceRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  sourcePill: {
    flexGrow: 1,
  },
});

export default EditItemScreen;
