import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ScrollView,
} from 'react-native';
import DateTimePickerModal from 'react-native-modal-datetime-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFridge } from '../context/FridgeContext';
import { useDrawers } from '../context/DrawerContext';
import { useLanguage } from '../i18n';
import {
  Screen,
  ScreenHeader,
  Icon,
  Pill,
  Input,
  PrimaryButton,
  SecondaryButton,
} from '../components/ui';
import { colors, radii, spacing, typography } from '../theme';

const USE_PACKAGE_NUMBERS_KEY = 'freezely_use_package_numbers';
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

  const { addItem, getNextAvailablePosition } = useFridge();
  const { drawers } = useDrawers();
  const { t, formatDate, dateFormatPattern } = useLanguage();

  useEffect(() => {
    AsyncStorage.getItem(USE_PACKAGE_NUMBERS_KEY).then((val) => {
      setUsePackageNumbers(val === 'true');
    });
  }, []);

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
      Alert.alert(t('common.success'), t('addItem.itemAdded'), [
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
        title={t('addItem.title')}
        onBack={() => navigation.goBack()}
        backLabel={t('common.cancel')}
      />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <Input
            label={t('addItem.itemName')}
            placeholder={t('addItem.itemNamePlaceholder')}
            value={name}
            onChangeText={setName}
            editable={!isLoading}
            style={styles.field}
          />

          <View style={styles.field}>
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

          <Input
            label={t('addItem.quantity')}
            placeholder="1"
            value={quantity}
            onChangeText={setQuantity}
            keyboardType="number-pad"
            editable={!isLoading}
            style={styles.field}
          />

          <View style={styles.field}>
            <Text style={styles.label}>{t('addItem.unit')}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pillRow}>
              {UNITS.map((u) => (
                <Pill
                  key={u}
                  label={u}
                  selected={unit === u}
                  onPress={() => setUnit(u)}
                  disabled={isLoading}
                  style={{ marginRight: 8 }}
                />
              ))}
            </ScrollView>
          </View>

          {usePackageNumbers && (
            <View style={styles.field}>
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
          )}

          <View style={styles.field}>
            <Text style={styles.label}>{t('addItem.frozenDate')}</Text>
            <TouchableOpacity
              style={styles.datePicker}
              onPress={() => setFrozenDatePickerVisibility(true)}
              disabled={isLoading}
            >
              <Text style={[styles.dateText, !frozenDate && styles.datePlaceholder]}>
                {frozenDate ? formatDate(frozenDate) : t('addItem.selectDate')}
              </Text>
              <Icon name="snow-outline" size={18} color={colors.textMuted} />
            </TouchableOpacity>
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
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>{t('addItem.expiryDate')}</Text>
            <TouchableOpacity
              style={styles.datePicker}
              onPress={() => setDatePickerVisibility(true)}
              disabled={isLoading}
            >
              <Text style={[styles.dateText, !expiryDate && styles.datePlaceholder]}>
                {expiryDate ? formatDate(expiryDate) : t('addItem.selectDateFormat', { format: dateFormatPattern })}
              </Text>
              <Icon name="calendar-outline" size={18} color={colors.textMuted} />
            </TouchableOpacity>
            {expiryDate ? (
              <TouchableOpacity onPress={clearDate} hitSlop={6} style={{ marginTop: 6, alignSelf: 'flex-start' }}>
                <Text style={styles.linkText}>{t('addItem.clearDate')}</Text>
              </TouchableOpacity>
            ) : null}
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
          </View>

          <Input
            label={t('addItem.notes')}
            placeholder={t('addItem.notesPlaceholder')}
            value={notes}
            onChangeText={setNotes}
            multiline
            numberOfLines={3}
            editable={!isLoading}
            style={styles.field}
          />

          <PrimaryButton
            title={isLoading ? t('addItem.adding') : t('addItem.addToFreezer')}
            onPress={handleSubmit}
            loading={isLoading}
            style={{ marginTop: spacing.lg }}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
};

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xxxl,
  },
  field: {
    marginBottom: spacing.lg,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  label: {
    ...typography.label,
    color: colors.textMuted,
    marginBottom: 6,
  },
  linkText: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '600',
  },
  pillRow: {
    paddingVertical: 4,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  autoBtn: {
    paddingVertical: 12,
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
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 12,
    paddingHorizontal: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dateText: {
    fontSize: 15,
    color: colors.text,
  },
  datePlaceholder: {
    color: colors.textSubtle,
  },
  helper: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: 6,
  },
});

export default AddItemScreen;
