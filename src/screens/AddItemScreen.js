import React, { useState, useEffect } from 'react';
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
} from 'react-native';
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

const AddItemScreen = ({ navigation }) => {
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
      // Remember the compartment for next time, then drop straight back to the
      // freezer — the new item is right there, so no extra confirmation tap.
      try { await AsyncStorage.setItem(LAST_DRAWER_KEY, drawer); } catch {}
      navigation.goBack();
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
          {/* Autofill — the fast path (Pro feature) */}
          <View style={styles.scanRow}>
            <TouchableOpacity
              style={styles.scanBtn}
              onPress={() => (isPremium ? setScannerVisible(true) : setPaywallVisible(true))}
              disabled={busy}
              activeOpacity={0.85}
            >
              {!isPremium && <View style={styles.proBadge}><Text style={styles.proBadgeText}>PRO</Text></View>}
              <Icon name="barcode-outline" size={18} color={colors.primary} />
              <Text style={styles.scanBtnText}>{t('scan.button')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.scanBtn}
              onPress={() => (isPremium ? handleAnalyzePhoto() : setPaywallVisible(true))}
              disabled={busy}
              activeOpacity={0.85}
            >
              {!isPremium && <View style={styles.proBadge}><Text style={styles.proBadgeText}>PRO</Text></View>}
              <Icon name="camera-outline" size={18} color={colors.primary} />
              <Text style={styles.scanBtnText}>{t('scan.photoButton')}</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.coverage}>{t('scan.coverage')}</Text>

          {/* Essentials — one compact card */}
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
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pillRow}>
                  {drawers.map((d) => (
                    <Pill
                      key={d.id}
                      label={d.name}
                      icon={d.icon}
                      selected={drawer === d.name}
                      onPress={() => setDrawer(d.name)}
                      disabled={isLoading}
                      style={{ marginRight: 8 }}
                    />
                  ))}
                </ScrollView>
              )}
            </View>

            <View style={styles.divider} />

            <View style={styles.cardInner}>
              <Text style={styles.label}>{t('addItem.quantity')}</Text>
              <View style={styles.qtyRow}>
                <TextInput
                  style={styles.qtyInput}
                  placeholder="1"
                  placeholderTextColor={colors.textSubtle}
                  value={quantity}
                  onChangeText={setQuantity}
                  keyboardType="number-pad"
                  editable={!isLoading}
                />
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.pillRow}
                  style={styles.unitScroll}
                  keyboardShouldPersistTaps="handled"
                >
                  {UNITS.map((u) => (
                    <Pill key={u} label={u} selected={unit === u} onPress={() => setUnit(u)} disabled={isLoading} style={{ marginRight: 8 }} />
                  ))}
                </ScrollView>
              </View>
            </View>

            <View style={styles.divider} />

            <View style={styles.cardInner}>
              <View style={styles.dateRow}>
                <View style={styles.dateCol}>
                  <Text style={styles.label}>{t('addItem.frozenDate')}</Text>
                  <TouchableOpacity style={styles.datePicker} onPress={() => setFrozenDatePickerVisibility(true)} disabled={isLoading}>
                    <Text style={[styles.dateText, !frozenDate && styles.datePlaceholder]} numberOfLines={1}>
                      {frozenDate ? formatDate(frozenDate) : t('addItem.selectDate')}
                    </Text>
                    <Icon name="snow-outline" size={18} color={colors.primary} />
                  </TouchableOpacity>
                </View>
                <View style={styles.dateCol}>
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
                  ) : null}
                </View>
              </View>
            </View>

            {usePackageNumbers && (
              <>
                <View style={styles.divider} />
                <View style={styles.cardInner}>
                  <Text style={styles.label}>{t('addItem.packageNumber')}</Text>
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
              </>
            )}

            <View style={styles.divider} />
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
    paddingBottom: spacing.lg,
  },
  footer: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
  scanRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  scanBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: colors.primarySoft,
    borderWidth: 1.5,
    borderColor: colors.primary,
    borderRadius: radii.md,
    paddingVertical: 12,
  },
  scanBtnText: {
    ...typography.bodyStrong,
    fontSize: 14,
    color: colors.primary,
  },
  proBadge: {
    position: 'absolute',
    top: -8,
    right: -6,
    backgroundColor: colors.primary,
    borderRadius: radii.pill,
    paddingHorizontal: 7,
    paddingVertical: 1,
  },
  proBadgeText: {
    color: colors.surface,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  coverage: {
    ...typography.caption,
    color: colors.textMuted,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  card: {
    marginBottom: spacing.md,
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
    fontSize: 16,
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
  pillRow: {
    paddingVertical: 2,
  },
  qtyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  qtyInput: {
    width: 60,
    backgroundColor: colors.bg,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 10,
    paddingHorizontal: 12,
    fontSize: 15,
    color: colors.text,
    textAlign: 'center',
    fontWeight: '700',
  },
  unitScroll: {
    flex: 1,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  autoBtn: {
    paddingVertical: 10,
  },
  dateRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  dateCol: {
    flex: 1,
    minWidth: 0,
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
