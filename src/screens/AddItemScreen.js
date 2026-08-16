import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
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
  ActivityIndicator,
  Modal,
  BackHandler,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import DateTimePickerModal from 'react-native-modal-datetime-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
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
  CategoryPickerSheet,
  Input,
  PrimaryButton,
  SecondaryButton,
} from '../components/ui';
import { colors, radii, spacing, typography } from '../theme';
import BarcodeScannerModal from '../components/BarcodeScannerModal';
import PaywallModal from '../components/PaywallModal';
import { usePremium } from '../context/PremiumContext';
import { useCategory } from '../hooks/useCategory';
import { lookupBarcode, analyzeProductImage } from '../utils/productLookup';

const USE_PACKAGE_NUMBERS_KEY = 'freezely_use_package_numbers';
const LAST_DRAWER_KEY = 'freezely_last_drawer';

const AddItemScreen = ({ navigation, route }) => {
  // Launched from Home's Quick Add (vs. opened from within the Freezer tab).
  const fromHome = route?.params?.from === 'home';

  const ymd = (d) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const today = new Date();
  const todayStr = ymd(today);
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  const yesterdayStr = ymd(yesterday);

  const [name, setName] = useState('');
  const [showSuggest, setShowSuggest] = useState(false);
  const [drawer, setDrawer] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [frozenDate, setFrozenDate] = useState(todayStr);
  const [selectedFrozenDate, setSelectedFrozenDate] = useState(today);
  const [isFrozenDatePickerVisible, setFrozenDatePickerVisibility] = useState(false);
  const [expiryDate, setExpiryDate] = useState('');
  const [selectedDate, setSelectedDate] = useState(null);
  const [isDatePickerVisible, setDatePickerVisibility] = useState(false);
  const [notes, setNotes] = useState('');
  const [position, setPosition] = useState('');
  const [unit, setUnit] = useState('pcs');
  const [isLoading, setIsLoading] = useState(false);
  const [usePackageNumbers, setUsePackageNumbers] = useState(false);
  const [scannerVisible, setScannerVisible] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [paywallVisible, setPaywallVisible] = useState(false);
  const [catPickerVisible, setCatPickerVisible] = useState(false);
  // Batch entry: how many items were added without leaving the form, plus the
  // most recent name — shown as a running confirmation while stocking up.
  const [addedCount, setAddedCount] = useState(0);
  const [lastAdded, setLastAdded] = useState('');
  const nameRef = useRef(null);

  const { addItem, getNextAvailablePosition, items } = useFridge();
  const { drawers } = useDrawers();
  const { t, formatDate, locale } = useLanguage();
  const { isPremium } = usePremium();
  const {
    getCategory: catOf, isOverridden, setCategory, labelFor,
    customCategories, addCustomCategory, removeCustomCategory,
  } = useCategory();

  // Effective category for the current name (override-aware); null until named.
  const currentCategory = name.trim() ? catOf(name) : null;
  const categoryIsAuto = !isOverridden(name);

  useEffect(() => {
    AsyncStorage.getItem(USE_PACKAGE_NUMBERS_KEY).then((val) => {
      setUsePackageNumbers(val === 'true');
    });
  }, []);

  // Smart default for the compartment: pre-select the last one the user added
  // to (or the only one that exists), so the common case is zero taps here.
  useEffect(() => {
    if (drawer || !drawers || drawers.length === 0) return;
    let cancelled = false;
    (async () => {
      try {
        const last = await AsyncStorage.getItem(LAST_DRAWER_KEY);
        if (!cancelled && last && drawers.some((d) => d.name === last)) {
          setDrawer(last);
          return;
        }
      } catch {}
      if (!cancelled && drawers.length === 1) setDrawer(drawers[0].name);
    })();
    return () => { cancelled = true; };
  }, [drawers]); // eslint-disable-line react-hooks/exhaustive-deps

  // Item-name suggestions drawn from everything already in the freezer, so the
  // user can re-add a recurring item without retyping (and keeps the name
  // spelled consistently, which helps use-by matching and recipe search).
  const nameSuggestions = useMemo(() => {
    const q = name.trim().toLowerCase();
    if (!q) return [];
    const seen = new Set();
    const out = [];
    for (const it of items) {
      const n = (it.name || '').trim();
      const key = n.toLowerCase();
      if (!n || key === q || seen.has(key)) continue;
      if (key.includes(q)) {
        seen.add(key);
        out.push(n);
        if (out.length >= 5) break;
      }
    }
    return out;
  }, [name, items]);

  // Frozen date is almost always today; quick-pick chips make that one tap.
  const isCustomFrozen = frozenDate && frozenDate !== todayStr && frozenDate !== yesterdayStr;
  const pickFrozen = (dateObj) => {
    setSelectedFrozenDate(dateObj);
    setFrozenDate(ymd(dateObj));
  };

  const handleFrozenDateConfirm = (date) => {
    setSelectedFrozenDate(date);
    setFrozenDate(ymd(date));
    setFrozenDatePickerVisibility(false);
  };

  const handleDateConfirm = (date) => {
    setSelectedDate(date);
    setExpiryDate(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`);
    setDatePickerVisibility(false);
  };

  const clearDate = () => {
    setExpiryDate('');
    setSelectedDate(null);
  };

  // Scan a barcode → look the product up → pre-fill the form.
  const handleScanned = async (code) => {
    setScanning(true);
    const product = await lookupBarcode(code);
    setScanning(false);
    setScannerVisible(false);
    if (!product) {
      Alert.alert(t('scan.notFoundTitle'), t('scan.notFound'));
      return;
    }
    setName(product.name);
    if (product.quantity) setQuantity(String(product.quantity));
    if (product.unit) setUnit(product.unit);
  };

  // Take a photo of the package → vision AI reads it → pre-fill the form.
  // For products not in any barcode database (e.g. local store brands).
  const handleAnalyzePhoto = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert(t('scan.cameraDenied'));
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ quality: 0.7 });
    if (result.canceled || !result.assets?.[0]?.uri) return;

    setAnalyzing(true);
    try {
      const manip = await ImageManipulator.manipulateAsync(
        result.assets[0].uri,
        [{ resize: { width: 1000 } }],
        { compress: 0.5, base64: true, format: ImageManipulator.SaveFormat.JPEG }
      );
      const res = await analyzeProductImage(manip.base64, locale);
      if (!res.ok) {
        Alert.alert(
          t('scan.notFoundTitle'),
          res.unavailable ? t('scan.photoUnavailable') : t('scan.photoNotFound')
        );
        return;
      }
      setName(res.name);
      if (res.quantity) setQuantity(String(res.quantity));
      if (res.unit) setUnit(res.unit);
    } catch (e) {
      Alert.alert(t('scan.notFoundTitle'), t('scan.photoNotFound'));
    } finally {
      setAnalyzing(false);
    }
  };

  // Leave the Add Item screen. When we were launched from Home's Quick Add we
  // first pop ourselves off the Freezer stack (so that tab is left on the
  // inventory, not this form) and then return the user to Home where they
  // started. Otherwise we just step back within the Freezer tab.
  const dismiss = useCallback(() => {
    if (fromHome) {
      navigation.goBack();
      navigation.navigate('HomeTab', { screen: 'Home' });
    } else {
      navigation.goBack();
    }
  }, [fromHome, navigation]);

  // Keep the Android hardware back consistent with the Cancel button: when this
  // screen came from Home, hardware back returns to Home too. Scoped to focus so
  // it doesn't fire while a pushed screen (e.g. ManageDrawers) is on top.
  useFocusEffect(
    useCallback(() => {
      if (!fromHome || Platform.OS !== 'android') return undefined;
      const sub = BackHandler.addEventListener('hardwareBackPress', () => {
        dismiss();
        return true;
      });
      return () => sub.remove();
    }, [fromHome, dismiss])
  );

  // Shared add path. When `addAnother` is true we stay on the form for rapid
  // batch entry: the item-specific fields reset but the compartment, frozen
  // date and unit (constant across a grocery haul) are kept, and the name field
  // refocuses. Otherwise we save and leave as before.
  const doAdd = async (addAnother) => {
    if (!name.trim()) {
      Alert.alert(t('common.error'), t('addItem.enterItemName'));
      return;
    }
    if (!drawer) {
      Alert.alert(t('common.error'), t('addItem.selectDrawer'));
      return;
    }

    const addedName = name.trim();
    setIsLoading(true);
    const result = await addItem({
      name: addedName,
      drawer,
      quantity: parseInt(quantity) || 1,
      unit,
      frozen_date: frozenDate || null,
      expiry_date: expiryDate || null,
      notes: notes.trim(),
      position: position ? parseInt(position) : null,
    });
    setIsLoading(false);

    if (!result.success) {
      if (result.error && result.error.includes('Position')) {
        Alert.alert(t('addItem.positionInUse'), result.error, [{ text: t('common.ok') }]);
      } else {
        Alert.alert(t('common.error'), result.error);
      }
      return;
    }

    // Remember the compartment for next time either way.
    try { await AsyncStorage.setItem(LAST_DRAWER_KEY, drawer); } catch {}

    if (!addAnother) {
      // Return the user to wherever they launched Add Item from.
      dismiss();
      return;
    }

    // Keep drawer / frozen date / unit; clear the item-specific fields.
    setName('');
    setQuantity('1');
    setNotes('');
    setPosition('');
    setExpiryDate('');
    setSelectedDate(null);
    setShowSuggest(false);
    setLastAdded(addedName);
    setAddedCount((c) => c + 1);
    requestAnimationFrame(() => nameRef.current?.focus());
  };

  const handleSubmit = () => doAdd(false);
  const handleSaveAndAdd = () => doAdd(true);

  const busy = isLoading || analyzing;

  return (
    <Screen>
      <ScreenHeader
        title={t('addItem.title')}
        onBack={dismiss}
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
          {/* Running confirmation while batch-adding (Save & add another). */}
          {addedCount > 0 ? (
            <View style={styles.addedBanner}>
              <Icon name="checkmark-circle" size={18} color={colors.success} />
              <Text style={styles.addedBannerText} numberOfLines={2}>
                {t('addItem.addedAnother', { name: lastAdded, count: addedCount })}
              </Text>
            </View>
          ) : null}

          {/* ── Item ───────────────────────────────────────────── */}
          <Text style={[styles.sectionLabel, styles.sectionLabelFirst]}>{t('addItem.sectionItem')}</Text>
          <Card style={styles.card} padded={false}>
            <View style={styles.cardInner}>
              <TextInput
                ref={nameRef}
                style={styles.nameInput}
                placeholder={t('addItem.itemNamePlaceholder')}
                placeholderTextColor={colors.textSubtle}
                value={name}
                onChangeText={(v) => {
                  setName(v);
                  setShowSuggest(true);
                }}
                editable={!isLoading}
              />
            </View>

            {showSuggest && nameSuggestions.length > 0 && (
              <>
                <View style={styles.divider} />
                <View style={styles.suggestWrap}>
                  {nameSuggestions.map((s) => (
                    <TouchableOpacity
                      key={s}
                      style={styles.suggestRow}
                      onPress={() => {
                        setName(s);
                        setShowSuggest(false);
                      }}
                      activeOpacity={0.6}
                    >
                      <Icon name="time-outline" size={15} color={colors.textSubtle} />
                      <Text style={styles.suggestText} numberOfLines={1}>{s}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            )}

            <View style={styles.divider} />

            {/* Autofill — the fast path (Pro feature) */}
            <View style={styles.cardInner}>
              <View style={styles.autofillRow}>
                <TouchableOpacity
                  style={styles.autofillBtn}
                  onPress={() => (isPremium ? setScannerVisible(true) : setPaywallVisible(true))}
                  disabled={busy}
                  activeOpacity={0.85}
                >
                  <Icon name="barcode-outline" size={16} color={colors.primaryDark} />
                  <Text style={styles.autofillText}>{t('scan.button')}</Text>
                  {!isPremium && <View style={styles.proTag}><Text style={styles.proTagText}>PRO</Text></View>}
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.autofillBtn}
                  onPress={() => (isPremium ? handleAnalyzePhoto() : setPaywallVisible(true))}
                  disabled={busy}
                  activeOpacity={0.85}
                >
                  <Icon name="camera-outline" size={16} color={colors.primaryDark} />
                  <Text style={styles.autofillText}>{t('scan.photoButton')}</Text>
                  {!isPremium && <View style={styles.proTag}><Text style={styles.proTagText}>PRO</Text></View>}
                </TouchableOpacity>
              </View>
              <Text style={styles.coverage}>{t('scan.coverage')}</Text>
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
                <TouchableOpacity style={styles.warning} onPress={() => navigation.navigate('ManageDrawers')} activeOpacity={0.85}>
                  <Text style={styles.warningText}>{t('addItem.noCompartments')}</Text>
                  <Text style={styles.warningCta}>{t('addItem.manageCompartments')} ›</Text>
                </TouchableOpacity>
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
              <Text style={styles.label}>{t('addItem.category')}</Text>
              <TouchableOpacity
                style={[styles.datePicker, !name.trim() && styles.categoryDisabled]}
                onPress={() => name.trim() && setCatPickerVisible(true)}
                disabled={isLoading || !name.trim()}
                activeOpacity={0.7}
              >
                <Text style={[styles.dateText, !name.trim() && styles.datePlaceholder]} numberOfLines={1}>
                  {!name.trim()
                    ? t('addItem.categoryNeedsName')
                    : `${labelFor(currentCategory)}${categoryIsAuto ? ` · ${t('addItem.categoryAuto')}` : ''}`}
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
              <View style={styles.chipWrap}>
                <Pill
                  label={t('addItem.today')}
                  selected={frozenDate === todayStr}
                  onPress={() => pickFrozen(today)}
                  disabled={isLoading}
                />
                <Pill
                  label={t('addItem.yesterday')}
                  selected={frozenDate === yesterdayStr}
                  onPress={() => pickFrozen(yesterday)}
                  disabled={isLoading}
                />
                <Pill
                  label={isCustomFrozen ? formatDate(frozenDate) : t('addItem.pickDate')}
                  icon={<Icon name="calendar-outline" size={14} color={isCustomFrozen ? colors.surface : colors.textMuted} />}
                  selected={!!isCustomFrozen}
                  onPress={() => setFrozenDatePickerVisibility(true)}
                  disabled={isLoading}
                />
              </View>
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
            </View>
          </Card>

          {/* ── Package number (optional, when enabled in settings) ── */}
          {usePackageNumbers && (
            <>
              <Text style={styles.sectionLabel}>{t('addItem.packageNumber')}</Text>
              <Card style={styles.card} padded={false}>
                <View style={styles.cardInner}>
                  <View style={styles.row}>
                    <Input
                      placeholder={t('addItem.packageNumberPlaceholder')}
                      value={position}
                      onChangeText={setPosition}
                      keyboardType="number-pad"
                      editable={!isLoading}
                      style={{ flex: 1 }}
                    />
                    <SecondaryButton
                      title={t('addItem.autoAssign')}
                      onPress={() => setPosition(String(getNextAvailablePosition()))}
                      disabled={isLoading}
                      style={styles.autoBtn}
                    />
                  </View>
                  <Text style={styles.helper}>{t('addItem.packageNumberHelper')}</Text>
                </View>
              </Card>
            </>
          )}

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
          <SecondaryButton
            title={t('addItem.saveAndAddAnother')}
            onPress={handleSaveAndAdd}
            disabled={busy}
            style={styles.addAnotherBtn}
          />
          <PrimaryButton
            title={isLoading ? t('addItem.adding') : t('addItem.addToFreezer')}
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

        <BarcodeScannerModal
          visible={scannerVisible}
          busy={scanning}
          onClose={() => setScannerVisible(false)}
          onScanned={handleScanned}
        />

        <PaywallModal visible={paywallVisible} onClose={() => setPaywallVisible(false)} />

        <CategoryPickerSheet
          visible={catPickerVisible}
          value={currentCategory}
          isAuto={categoryIsAuto}
          title={name.trim() || undefined}
          customCategories={customCategories}
          onSelect={(cat) => {
            setCategory(name, cat);
            setCatPickerVisible(false);
          }}
          onCreate={(catName) => {
            const key = addCustomCategory(catName);
            if (key) setCategory(name, key);
            setCatPickerVisible(false);
          }}
          onDelete={(key) => removeCustomCategory(key)}
          onClose={() => setCatPickerVisible(false)}
        />

        <Modal visible={analyzing} transparent animationType="fade" statusBarTranslucent>
          <View style={styles.analyzeOverlay}>
            <View style={styles.analyzeCard}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={styles.analyzeText}>{t('scan.analyzing')}</Text>
            </View>
          </View>
        </Modal>
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
  addedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.successSoft,
    borderRadius: radii.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    marginTop: spacing.xs,
    marginBottom: spacing.xs,
  },
  addedBannerText: {
    ...typography.bodySmall,
    color: '#065F46',
    flex: 1,
    fontWeight: '600',
  },
  addAnotherBtn: {
    marginBottom: spacing.sm,
  },
  autofillRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  autofillBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.primarySoft,
    borderWidth: 1,
    borderColor: colors.primaryTint,
    borderRadius: radii.pill,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  autofillText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.primaryDark,
  },
  proTag: {
    backgroundColor: colors.primary,
    borderRadius: radii.pill,
    paddingHorizontal: 6,
    paddingVertical: 1,
    marginLeft: 2,
  },
  proTagText: {
    color: colors.surface,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  coverage: {
    ...typography.caption,
    color: colors.textSubtle,
    marginTop: spacing.sm,
    lineHeight: 16,
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
  suggestWrap: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xs,
  },
  suggestRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: 10,
  },
  suggestText: {
    flex: 1,
    fontSize: 15,
    color: colors.text,
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
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  autoBtn: {
    paddingVertical: 10,
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
  warningCta: {
    color: '#92400E',
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
    marginTop: 6,
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
  categoryDisabled: {
    opacity: 0.6,
  },
  helper: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: 6,
  },
  analyzeOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  analyzeCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.xxl,
    alignItems: 'center',
    gap: spacing.md,
  },
  analyzeText: {
    ...typography.bodyStrong,
    color: colors.text,
  },
});

export default AddItemScreen;
