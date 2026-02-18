import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  Alert,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useDrawers } from '../context/DrawerContext';

const ICON_OPTIONS = ['❄️', '🧊', '🥶', '📦', '🗄️', '🍦', '🥩', '🍕', '🌽', '🥦', '🍓', '🍔'];

const ManageDrawersScreen = ({ navigation }) => {
  const { drawers, isLoading, addDrawer, updateDrawer, deleteDrawer } = useDrawers();
  const [newDrawerName, setNewDrawerName] = useState('');
  const [selectedIcon, setSelectedIcon] = useState('📦');
  const [editingDrawer, setEditingDrawer] = useState(null);
  const [editName, setEditName] = useState('');
  const [editIcon, setEditIcon] = useState('');

  const handleAddDrawer = async () => {
    if (!newDrawerName.trim()) {
      Alert.alert('Error', 'Please enter a compartment name');
      return;
    }

    const result = await addDrawer({
      name: newDrawerName.trim(),
      icon: selectedIcon,
    });

    if (result.error) {
      Alert.alert('Error', result.error);
    } else {
      setNewDrawerName('');
      setSelectedIcon('📦');
      Alert.alert('Success', 'Compartment added successfully!');
    }
  };

  const handleEditDrawer = (drawer) => {
    setEditingDrawer(drawer.id);
    setEditName(drawer.name);
    setEditIcon(drawer.icon);
  };

  const handleSaveEdit = async () => {
    if (!editName.trim()) {
      Alert.alert('Error', 'Please enter a compartment name');
      return;
    }

    const result = await updateDrawer(editingDrawer, {
      name: editName.trim(),
      icon: editIcon,
    });

    if (result.error) {
      Alert.alert('Error', result.error);
    } else {
      setEditingDrawer(null);
      setEditName('');
      setEditIcon('');
      Alert.alert('Success', 'Compartment updated successfully!');
    }
  };

  const handleCancelEdit = () => {
    setEditingDrawer(null);
    setEditName('');
    setEditIcon('');
  };

  const handleDeleteDrawer = (drawer) => {
    Alert.alert(
      'Delete Compartment',
      `Are you sure you want to delete "${drawer.name}"? Items in this compartment will not be deleted.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const result = await deleteDrawer(drawer.id);
            if (result.error) {
              Alert.alert('Error', result.error);
            }
          },
        },
      ]
    );
  };

  const renderDrawerItem = ({ item }) => {
    const isEditing = editingDrawer === item.id;

    if (isEditing) {
      return (
        <View style={styles.drawerItem}>
          <View style={styles.editContainer}>
            <Text style={styles.sectionLabel}>Icon</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.iconScrollEdit}
            >
              {ICON_OPTIONS.map((icon) => (
                <TouchableOpacity
                  key={icon}
                  style={[
                    styles.iconOption,
                    editIcon === icon && styles.iconOptionSelected,
                  ]}
                  onPress={() => setEditIcon(icon)}
                >
                  <Text style={styles.iconText}>{icon}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Text style={styles.sectionLabel}>Name</Text>
            <TextInput
              style={styles.editInput}
              value={editName}
              onChangeText={setEditName}
              placeholder="Drawer name"
            />

            <View style={styles.editButtons}>
              <TouchableOpacity
                style={[styles.button, styles.cancelButton]}
                onPress={handleCancelEdit}
              >
                <Text style={styles.buttonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.button, styles.saveButton]}
                onPress={handleSaveEdit}
                disabled={isLoading}
              >
                <Text style={styles.buttonText}>
                  {isLoading ? 'Saving...' : 'Save'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      );
    }

    return (
      <View style={styles.drawerItem}>
        <View style={styles.drawerInfo}>
          <Text style={styles.drawerIcon}>{item.icon}</Text>
          <Text style={styles.drawerName}>{item.name}</Text>
        </View>
        <View style={styles.drawerActions}>
          <TouchableOpacity
            style={styles.editButton}
            onPress={() => handleEditDrawer(item)}
          >
            <Text style={styles.editButtonText}>Edit</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.deleteButton}
            onPress={() => handleDeleteDrawer(item)}
          >
            <Text style={styles.deleteButtonText}>Delete</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient colors={['#4facfe', '#00f2fe']} style={styles.header}>
        <View style={styles.headerContent}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.backButtonText}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Manage Compartments</Text>
          <View style={styles.placeholder} />
        </View>
      </LinearGradient>

      <ScrollView style={styles.content}>
        <View style={styles.addSection}>
          <Text style={styles.sectionTitle}>Add New Compartment</Text>

          <Text style={styles.sectionLabel}>Select Icon</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.iconScroll}
          >
            {ICON_OPTIONS.map((icon) => (
              <TouchableOpacity
                key={icon}
                style={[
                  styles.iconOption,
                  selectedIcon === icon && styles.iconOptionSelected,
                ]}
                onPress={() => setSelectedIcon(icon)}
              >
                <Text style={styles.iconText}>{icon}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <Text style={styles.sectionLabel}>Compartment Name</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g., Top Shelf, Bottom Drawer, Door Shelf"
            value={newDrawerName}
            onChangeText={setNewDrawerName}
          />

          <TouchableOpacity
            style={[styles.addButton, isLoading && styles.buttonDisabled]}
            onPress={handleAddDrawer}
            disabled={isLoading}
          >
            <Text style={styles.addButtonText}>
              {isLoading ? 'Adding...' : 'Add Compartment'}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.listSection}>
          <Text style={styles.sectionTitle}>Your Compartments ({drawers.length})</Text>
          {drawers.length === 0 ? (
            <Text style={styles.emptyText}>
              No compartments yet. Add your first compartment above!
            </Text>
          ) : (
            <FlatList
              data={drawers}
              keyExtractor={(item) => item.id}
              renderItem={renderDrawerItem}
              scrollEnabled={false}
            />
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
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
  content: {
    flex: 1,
  },
  addSection: {
    backgroundColor: '#fff',
    padding: 20,
    marginTop: 20,
    marginHorizontal: 20,
    marginBottom: 10,
    borderRadius: 15,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  listSection: {
    backgroundColor: '#fff',
    padding: 20,
    marginHorizontal: 20,
    marginBottom: 20,
    borderRadius: 15,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 15,
    color: '#333',
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginTop: 10,
    marginBottom: 8,
    color: '#666',
  },
  iconScroll: {
    marginBottom: 15,
  },
  iconScrollEdit: {
    marginBottom: 10,
  },
  iconOption: {
    width: 50,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
    borderRadius: 25,
    backgroundColor: '#f0f0f0',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  iconOptionSelected: {
    borderColor: '#007AFF',
    backgroundColor: '#e3f2fd',
  },
  iconText: {
    fontSize: 24,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 15,
    backgroundColor: '#fff',
  },
  editInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 10,
    backgroundColor: '#fff',
  },
  addButton: {
    backgroundColor: '#007AFF',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
  },
  addButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  buttonDisabled: {
    backgroundColor: '#ccc',
  },
  drawerItem: {
    backgroundColor: '#f9f9f9',
    padding: 15,
    borderRadius: 8,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  drawerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  drawerIcon: {
    fontSize: 24,
    marginRight: 10,
  },
  drawerName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    flex: 1,
  },
  drawerActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  editButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 6,
    marginRight: 10,
  },
  editButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  deleteButton: {
    backgroundColor: '#FF3B30',
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 6,
  },
  deleteButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  editContainer: {
    backgroundColor: '#fff',
    padding: 10,
    borderRadius: 8,
  },
  editButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 10,
  },
  button: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 6,
    marginLeft: 10,
  },
  cancelButton: {
    backgroundColor: '#999',
  },
  saveButton: {
    backgroundColor: '#34C759',
  },
  buttonText: {
    color: '#fff',
    fontWeight: '600',
  },
  emptyText: {
    textAlign: 'center',
    color: '#999',
    fontSize: 16,
    marginTop: 20,
  },
});

export default ManageDrawersScreen;
