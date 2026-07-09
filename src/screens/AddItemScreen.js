import React, { useState, useEffect, useCallback } from 'react';
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
  Input,
  PrimaryButton,
  SecondaryButton,
} from '../components/ui';
import { colors, radii, spacing, typography } from '../theme';
import BarcodeScannerModal from '../components/BarcodeScannerModal';
import PaywallModal from '../components/PaywallModal';
import { usePremium } from '../context/PremiumContext';
import { lookupBarcode, analyzeProductImage } from '../utils/productLookup';

const USE_PACKAGE_NUMBERS_KEY = 'freezely_use_package_numbers';
const LAST_DRAWER_KEY = 'freezely_last_drawer';
const UNITS = ['pcs', 'kg', 'g', 'lbs', 'oz', 'portions'];

const AddItemScreen = ({ navigation, route }) => {
  // Launched from Home's Quick Add (vs. opened from within the Freezer tab).
  const fromHome = route?.params?.from === 'home';

  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  const [name, setName] = useState('');
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

  const { addItem, getNextAvailablePosition } = useFridge();
  const { drawers } = useDrawers();
  const { t, formatDate, locale } = useLanguage();
  const { isPremium } = usePremium();

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

  const handleFrozenDateConfirm = (date) => {
    setSelectedFrozenDate(date);
    setFrozenDate(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`);
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

  const handleSubmit = async () => {
    if (!name.trim()) {
      Alert.alert(t('common.error'), t('addItem.enterItemName'));
      return;
    }
    if (!drawer) {
      Alert.alert(t('common.error'), t('addItem.selectDrawer'));
      return;
    }

    setIsLoading(true);
    const result = await addItem({
      name: name.trim(),
      drawer,
      quantity: parseInt(quantity) || 1,
      unit,
      frozen_date: frozenDate || null,
      expiry_date: expiryDate || null,
      notes: notes.trim(),
      position: position ? parseInt(position) : null,
    });
    setIsLoading(false);

    if (result.success) {
      // Remember the compartment for next time, then return the user to wherever
      // they launched Add Item from (Home for Quick Add, else the freezer).
      try { await AsyncStorage.setItem(LAST_DRAWER_KEY, drawer); } catch {}
      dismiss();
    } else {
      if (result.error && result.error.includes('Position')) {
        Alert.alert(t('addItem.positionInUse'), result.error, [{ text: t('common.ok') }]);
      } else {
        Alert.alert(t('common.error'), result.error);
      }
    }
  };

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
              <View style={styles.qtyRow}>
                <Text style={[styles.label, styles.labelInline]}>{t('addItem.quantity')}</Text>
                <TextInput
                  style={styles.qtyInput}
                  value={quantity}
                  onChangeText={setQuantity}
                  keyboardType="number-pad"
                  editable={!isLoading}
                  placeholder="1"
                  placeholderTextColor={colors.textSubtle}
                  textAlign="center"
                />
              </View>
            </View>

            <View style={styles.divider} />

            <View style={styles.cardInner}>
              <Text style={styles.label}>{t('addItem.unit')}</Text>
              <View style={styles.chipWrap}>
                {UNITS.map((u) => (
                  <Pill key={u} label={u} selected={unit === u} onPress={() => setUnit(u)} disabled={isLoading} />
                ))}
              </View>
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
  qtyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  labelInline: {
    marginBottom: 0,
  },
  qtyInput: {
    minWidth: 80,
    height: 44,
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: 12,
    fontSize: 17,
    fontWeight: '700',
    color: colors.text,
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
