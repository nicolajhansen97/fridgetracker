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
  SafeAreaView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import DateTimePickerModal from 'react-native-modal-datetime-picker';
import { useFridge } from '../context/FridgeContext';
import { useDrawers } from '../context/DrawerContext';

const AddItemScreen = ({ navigation }) => {
  const [name, setName] = useState('');
  const [drawer, setDrawer] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [expiryDate, setExpiryDate] = useState('');
  const [selectedDate, setSelectedDate] = useState(null);
  const [isDatePickerVisible, setDatePickerVisibility] = useState(false);
  const [notes, setNotes] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { addItem } = useFridge();
  const { drawers } = useDrawers();

  const showDatePicker = () => {
    setDatePickerVisibility(true);
  };

  const hideDatePicker = () => {
    setDatePickerVisibility(false);
  };

  const handleDateConfirm = (date) => {
    setSelectedDate(date);
    // Format as YYYY-MM-DD for database storage
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    setExpiryDate(`${year}-${month}-${day}`);
    hideDatePicker();
  };

  const formatDateForDisplay = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}-${month}-${year}`;
  };

  const clearDate = () => {
    setExpiryDate('');
    setSelectedDate(null);
  };

  const handleSubmit = async () => {
    if (!name.trim()) {
      Alert.alert('Error', 'Please enter an item name');
      return;
    }

    if (!drawer) {
      Alert.alert('Error', 'Please select a drawer');
      return;
    }

    setIsLoading(true);
    const result = await addItem({
      name: name.trim(),
      drawer,
      quantity: parseInt(quantity) || 1,
      expiry_date: expiryDate || null,
      notes: notes.trim(),
    });
    setIsLoading(false);

    if (result.success) {
      Alert.alert('Success', 'Item added to your fridge!', [
        {
          text: 'OK',
          onPress: () => navigation.goBack(),
        },
      ]);
    } else {
      Alert.alert('Error', result.error);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient colors={['#fa709a', '#fee140']} style={styles.header}>
        <View style={styles.headerContent}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.backButtonText}>← Cancel</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Add Item</Text>
          <View style={styles.placeholder} />
        </View>
      </LinearGradient>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.form}>
            <View style={styles.inputContainer}>
              <Text style={styles.label}>Item Name *</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g., Milk, Eggs, Cheese"
                value={name}
                onChangeText={setName}
                editable={!isLoading}
              />
            </View>

            <View style={styles.inputContainer}>
              <View style={styles.labelRow}>
                <Text style={styles.label}>Drawer/Compartment *</Text>
                <TouchableOpacity
                  onPress={() => navigation.navigate('ManageDrawers')}
                  style={styles.manageLink}
                >
                  <Text style={styles.manageLinkText}>Manage Drawers</Text>
                </TouchableOpacity>
              </View>
              {drawers.length === 0 ? (
                <View style={styles.noDrawersContainer}>
                  <Text style={styles.noDrawersText}>
                    No drawers yet. Tap "Manage Drawers" to add your first drawer!
                  </Text>
                </View>
              ) : (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={styles.drawerOptions}
                >
                  {drawers.map((drawerItem) => (
                    <TouchableOpacity
                      key={drawerItem.id}
                      style={[
                        styles.drawerOption,
                        drawer === drawerItem.name && styles.drawerOptionSelected,
                      ]}
                      onPress={() => setDrawer(drawerItem.name)}
                      disabled={isLoading}
                    >
                      <Text style={styles.drawerIcon}>{drawerItem.icon}</Text>
                      <Text
                        style={[
                          styles.drawerOptionText,
                          drawer === drawerItem.name && styles.drawerOptionTextSelected,
                        ]}
                      >
                        {drawerItem.name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              )}
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.label}>Quantity</Text>
              <TextInput
                style={styles.input}
                placeholder="1"
                value={quantity}
                onChangeText={setQuantity}
                keyboardType="number-pad"
                editable={!isLoading}
              />
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.label}>Expiry Date (optional)</Text>
              <TouchableOpacity
                style={styles.datePickerButton}
                onPress={showDatePicker}
                disabled={isLoading}
              >
                <Text style={[styles.datePickerText, !expiryDate && styles.datePickerPlaceholder]}>
                  {expiryDate ? formatDateForDisplay(expiryDate) : 'Select date (DD-MM-YYYY)'}
                </Text>
                <Text style={styles.calendarIcon}>📅</Text>
              </TouchableOpacity>
              {expiryDate && (
                <TouchableOpacity style={styles.clearDateButton} onPress={clearDate}>
                  <Text style={styles.clearDateText}>Clear date</Text>
                </TouchableOpacity>
              )}
              <DateTimePickerModal
                isVisible={isDatePickerVisible}
                mode="date"
                onConfirm={handleDateConfirm}
                onCancel={hideDatePicker}
                date={selectedDate || new Date()}
                minimumDate={new Date()}
              />
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.label}>Notes (optional)</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Any additional notes..."
                value={notes}
                onChangeText={setNotes}
                multiline
                numberOfLines={3}
                editable={!isLoading}
              />
            </View>

            <TouchableOpacity
              style={[styles.submitButton, isLoading && styles.submitButtonDisabled]}
              onPress={handleSubmit}
              disabled={isLoading}
            >
              <Text style={styles.submitButtonText}>
                {isLoading ? 'Adding...' : 'Add to Fridge'}
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f7fa',
  },
  header: {
    paddingTop: 20,
    paddingBottom: 20,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  backButton: {
    padding: 8,
  },
  backButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  placeholder: {
    width: 70,
  },
  keyboardView: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    marginTop: 20,
  },
  form: {
    paddingBottom: 30,
  },
  inputContainer: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  manageLink: {
    padding: 4,
  },
  manageLinkText: {
    color: '#fa709a',
    fontSize: 14,
    fontWeight: '600',
  },
  noDrawersContainer: {
    backgroundColor: '#fff3cd',
    padding: 15,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ffc107',
  },
  noDrawersText: {
    color: '#856404',
    fontSize: 14,
    textAlign: 'center',
  },
  drawerIcon: {
    fontSize: 18,
    marginRight: 6,
  },
  input: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 15,
    fontSize: 16,
    color: '#333',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  datePickerButton: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 15,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  datePickerText: {
    fontSize: 16,
    color: '#333',
  },
  datePickerPlaceholder: {
    color: '#999',
  },
  calendarIcon: {
    fontSize: 20,
  },
  clearDateButton: {
    marginTop: 8,
    alignSelf: 'flex-start',
  },
  clearDateText: {
    color: '#fa709a',
    fontSize: 14,
    fontWeight: '600',
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  drawerOptions: {
    flexDirection: 'row',
  },
  drawerOption: {
    backgroundColor: '#ffffff',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 20,
    marginRight: 10,
    borderWidth: 2,
    borderColor: '#e0e0e0',
    flexDirection: 'row',
    alignItems: 'center',
  },
  drawerOptionSelected: {
    backgroundColor: '#fa709a',
    borderColor: '#fa709a',
  },
  drawerOptionText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  drawerOptionTextSelected: {
    color: '#ffffff',
  },
  submitButton: {
    backgroundColor: '#fa709a',
    borderRadius: 12,
    padding: 18,
    alignItems: 'center',
    marginTop: 20,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 4.65,
    elevation: 8,
  },
  submitButtonDisabled: {
    opacity: 0.7,
  },
  submitButtonText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: 'bold',
  },
});

export default AddItemScreen;
