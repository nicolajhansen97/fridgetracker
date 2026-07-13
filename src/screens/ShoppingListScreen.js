import React, { useState, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
  RefreshControl,
  KeyboardAvoidingView,
  Keyboard,
  Platform,
  ScrollView,
  LayoutAnimation,
  UIManager,
  Modal,
  Animated,
  PanResponder,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useShoppingList } from '../context/ShoppingListContext';
import { useFridge } from '../context/FridgeContext';
import { useHousehold } from '../context/HouseholdContext';
import { useLanguage } from '../i18n';
import { useStockInsights } from '../hooks/useStockInsights';
import { getCategory, CATEGORY_ORDER } from '../utils/foodCategories';
import {
  Screen,
  ScreenHeader,
  Icon,
} from '../components/ui';
import { colors, gradients, radii, shadows, spacing, typography } from '../theme';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// Category → MCI icon (small leading glyph on each row, à la Bring/Listonic)
const CATEGORY_MCI = {
  fruit: 'food-apple-outline',
  vegetables: 'carrot',
  meat: 'food-drumstick-outline',
  fish: 'fish',
  dairy: 'cheese',
  bread: 'bread-slice-outline',
  frozen: 'snowflake-variant',
  pantry: 'package-variant',
  drinks: 'bottle-soda-outline',
  other: 'tag-outline',
};

const ShoppingListScreen = () => {
  const {
    items, addItem, toggleItem, deleteItem, clearChecked, loadItems,
    lists, currentList, createList, deleteList, switchList,
  } = useShoppingList();
  const { addItem: addToFridge, getNextAvailablePosition } = useFridge();
  const { currentHousehold } = useHousehold();
  const { restock } = useStockInsights();
  const { t } = useLanguage();

  const [draft, setDraft] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [boughtCollapsed, setBoughtCollapsed] = useState(false);
  const [showLists, setShowLists] = useState(false);
  const [newListName, setNewListName] = useState('');
  const inputRef = useRef(null);

  const unchecked = items.filter((i) => !i.checked);
  const checked = items.filter((i) => i.checked);
  const total = items.length;

  // Restock suggestions the user hasn't already got on this list.
  const suggestions = useMemo(() => {
    const onList = new Set(unchecked.map((i) => (i.name || '').trim().toLowerCase()));
    return restock.filter((s) => !onList.has(s.key)).slice(0, 6);
  }, [restock, unchecked]);

  const addSuggestion = (s) => {
    const qty = s.suggestedQty > 0 ? `${s.suggestedQty}${s.unit ? ` ${s.unit}` : ''}` : '';
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    addItem(s.name, qty);
  };

  // Group unchecked items by category, in CATEGORY_ORDER
  const grouped = useMemo(() => {
    const map = {};
    unchecked.forEach((item) => {
      const cat = getCategory(item.name);
      (map[cat] ||= []).push(item);
    });
    return CATEGORY_ORDER
      .filter((c) => map[c])
      .map((c) => ({ category: c, items: map[c] }));
  }, [unchecked]);

  const subtitle = useMemo(() => {
    if (total === 0) return currentHousehold?.name;
    if (unchecked.length === 0) return t('shopping.allBought', { count: checked.length });
    if (checked.length === 0) return t('shopping.toBuyCount', { count: unchecked.length });
    return `${unchecked.length} ${t('shopping.toBuy').toLowerCase()}  ·  ${checked.length} ${t('shopping.bought').toLowerCase()}`;
  }, [total, unchecked.length, checked.length, currentHousehold, t]);

  const submit = async () => {
    const name = draft.trim();
    if (!name) {
      // Empty Return → just dismiss the keyboard instead of leaving the user stuck.
      Keyboard.dismiss();
      return;
    }
    const dup = items.find(
      (i) => i.name.toLowerCase() === name.toLowerCase() && !i.checked
    );
    if (dup) {
      Alert.alert(t('shopping.duplicateTitle'), t('shopping.duplicateMsg', { name }), [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('shopping.addAnyway'), onPress: () => doAdd(name) },
      ]);
      return;
    }
    await doAdd(name);
  };

  const doAdd = async (name) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setDraft('');
    await addItem(name, '');
    inputRef.current?.focus();
  };

  const handleToggle = (item) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    toggleItem(item.id, item.checked);
  };

  const handleItemLongPress = (item) => {
    const opts = [];
    if (item.checked) {
      opts.push({
        text: t('shopping.moveToFreezer'),
        onPress: () => moveToFreezer(item),
      });
    }
    opts.push({
      text: t('shopping.deleteItem'),
      style: 'destructive',
      onPress: () => {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        deleteItem(item.id);
      },
    });
    opts.push({ text: t('common.cancel'), style: 'cancel' });
    Alert.alert(item.name, item.quantity || null, opts);
  };

  const moveToFreezer = async (item) => {
    try {
      const position = await getNextAvailablePosition();
      const result = await addToFridge({
        name: item.name,
        quantity: item.quantity ? parseInt(item.quantity) || 1 : 1,
        position,
      });
      if (result.success) {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        await deleteItem(item.id);
      }
    } catch (e) {
      console.error('Move to freezer error:', e);
    }
  };

  const handleClearChecked = () => {
    if (checked.length === 0) return;
    Alert.alert(t('shopping.clearChecked'), t('shopping.clearCheckedConfirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('shopping.clear'),
        style: 'destructive',
        onPress: () => {
          LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
          clearChecked();
        },
      },
    ]);
  };

  const handleMoveAllToFreezer = async () => {
    if (checked.length === 0) return;
    Alert.alert(t('shopping.moveAllTitle'), t('shopping.moveAllMsg', { count: checked.length }), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('shopping.moveAll'),
        onPress: async () => {
          let moved = 0;
          for (const item of checked) {
            try {
              const position = await getNextAvailablePosition();
              const result = await addToFridge({
                name: item.name,
                quantity: item.quantity ? parseInt(item.quantity) || 1 : 1,
                position,
              });
              if (result.success) { await deleteItem(item.id); moved++; }
            } catch (e) { console.error('Move error:', e); }
          }
          if (moved > 0) {
            Alert.alert(t('shopping.movedToFreezer'), t('shopping.movedAllDesc', { count: moved }));
          }
        },
      },
    ]);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadItems();
    setRefreshing(false);
  };

  const handleCreateList = () => {
    if (!newListName.trim()) return;
    createList(newListName.trim());
    setNewListName('');
    setShowLists(false);
  };

  const handleDeleteList = (name) => {
    setShowLists(false);
    Alert.alert(t('shopping.deleteListTitle'), t('shopping.deleteListMsg', { name }), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('common.delete'), style: 'destructive', onPress: () => deleteList(name) },
    ]);
  };

  return (
    <Screen>
      <ScreenHeader
        title={currentList === 'default' ? t('shopping.title') : currentList}
        subtitle={subtitle}
        right={
          <TouchableOpacity
            onPress={() => setShowLists(true)}
            hitSlop={6}
            style={styles.headerListsBtn}
          >
            <Icon name="list-outline" size={20} color={colors.surface} />
          </TouchableOpacity>
        }
      />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
      >
        <ScrollView
          contentContainerStyle={styles.list}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
          }
        >
          {suggestions.length > 0 && (
            <View style={styles.suggestBlock}>
              <Text style={styles.suggestLabel}>{t('restock.suggestedToBuy').toUpperCase()}</Text>
              <View style={styles.suggestChips}>
                {suggestions.map((s) => (
                  <TouchableOpacity
                    key={s.key}
                    style={styles.suggestChip}
                    onPress={() => addSuggestion(s)}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.suggestChipText} numberOfLines={1}>{s.name}</Text>
                    <Icon name="add" size={15} color={colors.primary} />
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {total === 0 ? (
            <View style={styles.empty}>
              <View style={styles.emptyIconWrap}>
                <Icon name="cart-outline" size={40} color={colors.primary} />
              </View>
              <Text style={styles.emptyTitle}>{t('shopping.empty')}</Text>
              <Text style={styles.emptySub}>{t('shopping.emptySubtext')}</Text>
            </View>
          ) : (
            <>
              {grouped.map((group, gIdx) => (
                <View key={group.category} style={[styles.group, gIdx > 0 && styles.groupSpacing]}>
                  <Text style={styles.categoryLabel}>
                    {t('shopping.cat_' + group.category).toUpperCase()}
                  </Text>
                  {group.items.map((item, idx) => (
                    <View key={item.id}>
                      <SwipeableRow
                        item={item}
                        showAddedBy={!!currentHousehold}
                        onToggle={handleToggle}
                        onLongPress={handleItemLongPress}
                        onDelete={(i) => deleteItem(i.id)}
                      />
                      {idx < group.items.length - 1 && <View style={styles.divider} />}
                    </View>
                  ))}
                </View>
              ))}

              {checked.length > 0 && (
                <View style={styles.boughtBlock}>
                  <TouchableOpacity
                    onPress={() => {
                      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                      setBoughtCollapsed(!boughtCollapsed);
                    }}
                    activeOpacity={0.7}
                    style={styles.boughtHeader}
                  >
                    <Icon
                      name={boughtCollapsed ? 'chevron-forward' : 'chevron-down'}
                      size={14}
                      color={colors.textMuted}
                    />
                    <Text style={styles.boughtTitle}>
                      {t('shopping.inCart').toUpperCase()}  ·  {checked.length}
                    </Text>
                    <View style={{ flex: 1 }} />
                  </TouchableOpacity>

                  {!boughtCollapsed && (
                    <>
                      <View style={styles.boughtActions}>
                        <TouchableOpacity onPress={handleMoveAllToFreezer} hitSlop={6} style={styles.boughtActionBtn}>
                          <Icon name="snow-outline" size={13} color={colors.primary} />
                          <Text style={styles.boughtActionText}>{t('shopping.moveAllToFreezer')}</Text>
                        </TouchableOpacity>
                        <TouchableOpacity onPress={handleClearChecked} hitSlop={6}>
                          <Text style={styles.boughtActionDanger}>{t('shopping.clearChecked')}</Text>
                        </TouchableOpacity>
                      </View>
                      {checked.map((item, idx) => (
                        <View key={item.id}>
                          <SwipeableRow
                            item={item}
                            showAddedBy={!!currentHousehold}
                            onToggle={handleToggle}
                            onLongPress={handleItemLongPress}
                            onDelete={(i) => deleteItem(i.id)}
                          />
                          {idx < checked.length - 1 && <View style={styles.divider} />}
                        </View>
                      ))}
                    </>
                  )}
                </View>
              )}
            </>
          )}

          <View style={{ height: spacing.xxxl }} />
        </ScrollView>

        {/* Sticky bottom add bar */}
        <View style={styles.addBarWrap}>
          <View style={styles.addBar}>
            <Icon name="add" size={20} color={colors.textMuted} />
            <TextInput
              ref={inputRef}
              style={styles.addInput}
              placeholder={t('shopping.itemPlaceholder')}
              placeholderTextColor={colors.textSubtle}
              value={draft}
              onChangeText={setDraft}
              onSubmitEditing={submit}
              returnKeyType="done"
              autoCapitalize="sentences"
              blurOnSubmit={false}
            />
            <TouchableOpacity
              onPress={submit}
              disabled={!draft.trim()}
              activeOpacity={0.85}
              style={[styles.sendBtn, !draft.trim() && { opacity: 0 }]}
            >
              <LinearGradient
                colors={gradients.hero}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.sendBtnInner}
              >
                <Icon name="arrow-up" size={18} color={colors.surface} />
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>

      {/* Lists sheet */}
      <Modal
        visible={showLists}
        transparent
        animationType="fade"
        onRequestClose={() => setShowLists(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowLists(false)}
        >
          <View style={styles.modalSheet} onStartShouldSetResponder={() => true}>
            <Text style={styles.modalTitle}>{t('shopping.title')}</Text>
            {lists.map((name) => (
              <TouchableOpacity
                key={name}
                style={styles.listItem}
                onPress={() => { switchList(name); setShowLists(false); }}
                onLongPress={() => name !== 'default' && handleDeleteList(name)}
                activeOpacity={0.7}
              >
                <Text style={[styles.listItemText, currentList === name && styles.listItemTextActive]}>
                  {name === 'default' ? t('shopping.defaultList') : name}
                </Text>
                {currentList === name && (
                  <Icon name="checkmark" size={18} color={colors.primary} />
                )}
              </TouchableOpacity>
            ))}
            <View style={styles.newListRow}>
              <TextInput
                style={styles.newListInput}
                placeholder={t('shopping.newListPlaceholder')}
                placeholderTextColor={colors.textSubtle}
                value={newListName}
                onChangeText={setNewListName}
                onSubmitEditing={handleCreateList}
                returnKeyType="done"
              />
              <TouchableOpacity onPress={handleCreateList} disabled={!newListName.trim()} hitSlop={6}>
                <Text
                  style={[
                    styles.newListAdd,
                    !newListName.trim() && { color: colors.textSubtle },
                  ]}
                >
                  {t('common.create')}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>
    </Screen>
  );
};

// Pure visual row content — no touch handling. The wrapping SwipeableRow
// handles all interaction (tap, long-press, swipe).
const RowContent = ({ item, showAddedBy }) => {
  const isChecked = item.checked;
  const cat = getCategory(item.name);
  const catIcon = CATEGORY_MCI[cat];
  return (
    <View style={styles.row}>
      <View style={[styles.checkbox, isChecked && styles.checkboxChecked]}>
        {isChecked && <Icon name="checkmark" size={13} color={colors.surface} />}
      </View>
      <Icon
        name={catIcon}
        set="mci"
        size={18}
        color={isChecked ? colors.textSubtle : colors.textMuted}
        style={styles.rowCatIcon}
      />
      <View style={styles.rowContentText}>
        <Text
          style={[styles.itemName, isChecked && styles.itemNameChecked]}
          numberOfLines={1}
        >
          {item.name}
        </Text>
        {showAddedBy && item.added_by_email ? (
          <Text style={styles.addedBy} numberOfLines={1}>{item.added_by_email}</Text>
        ) : null}
      </View>
      {item.quantity ? (
        <Text style={[styles.itemQty, isChecked && styles.itemQtyChecked]} numberOfLines={1}>
          {item.quantity}
        </Text>
      ) : null}
    </View>
  );
};

const SCREEN_WIDTH = Dimensions.get('window').width;
const DELETE_WIDTH = 84;
const SWIPE_OPEN_THRESHOLD = 40;
const SWIPE_FAR_THRESHOLD = SCREEN_WIDTH * 0.5;
const SWIPE_VELOCITY_THRESHOLD = 0.5;

// Wraps a row with swipe-to-delete:
//   - Pan left to reveal the trash action; release at threshold to keep it open.
//   - Tap the trash to delete (animates the row off-screen first).
//   - Pan past 50% of screen (or fast flick) auto-deletes.
//   - Tap on the row body when open snaps it closed; otherwise toggles checked.
const SwipeableRow = ({ item, onToggle, onLongPress, onDelete, showAddedBy }) => {
  const translateX = useRef(new Animated.Value(0)).current;
  const isOpenRef = useRef(false);

  const close = () => {
    Animated.spring(translateX, {
      toValue: 0,
      useNativeDriver: true,
      friction: 9,
      tension: 50,
    }).start();
    isOpenRef.current = false;
  };

  const open = () => {
    Animated.spring(translateX, {
      toValue: -DELETE_WIDTH,
      useNativeDriver: true,
      friction: 9,
      tension: 50,
    }).start();
    isOpenRef.current = true;
  };

  const animateAndDelete = () => {
    Animated.timing(translateX, {
      toValue: -SCREEN_WIDTH,
      duration: 220,
      useNativeDriver: true,
    }).start(() => {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      onDelete(item);
    });
  };

  const panResponder = useRef(
    PanResponder.create({
      // Don't claim the touch on simple presses — let TouchableOpacity handle taps.
      onStartShouldSetPanResponder: () => false,
      // Claim it once the user moves horizontally.
      onMoveShouldSetPanResponder: (_, g) =>
        Math.abs(g.dx) > 8 && Math.abs(g.dx) > Math.abs(g.dy) * 1.5,
      onPanResponderGrant: () => {
        translateX.setOffset(isOpenRef.current ? -DELETE_WIDTH : 0);
        translateX.setValue(0);
      },
      onPanResponderMove: (_, g) => {
        // Resist swiping rightward past closed state.
        const offset = isOpenRef.current ? -DELETE_WIDTH : 0;
        let dx = g.dx;
        if (offset + dx > 0) dx = -offset + (offset + dx) * 0.25;
        translateX.setValue(dx);
      },
      onPanResponderRelease: (_, g) => {
        translateX.flattenOffset();
        const finalX = (isOpenRef.current ? -DELETE_WIDTH : 0) + g.dx;
        // Fast left flick or far swipe → auto-delete
        if (g.vx < -SWIPE_VELOCITY_THRESHOLD || finalX < -SWIPE_FAR_THRESHOLD) {
          animateAndDelete();
          return;
        }
        if (finalX < -SWIPE_OPEN_THRESHOLD) open();
        else close();
      },
      onPanResponderTerminate: () => {
        translateX.flattenOffset();
        if (isOpenRef.current) open(); else close();
      },
    })
  ).current;

  const handleTap = () => {
    if (isOpenRef.current) close();
    else onToggle(item);
  };

  const handleLongPress = () => {
    if (isOpenRef.current) close();
    else onLongPress(item);
  };

  return (
    <View style={styles.swipeContainer}>
      <View style={styles.deleteBg}>
        <TouchableOpacity
          onPress={animateAndDelete}
          style={styles.deleteAction}
          activeOpacity={0.7}
        >
          <Icon name="trash-outline" size={22} color={colors.surface} />
        </TouchableOpacity>
      </View>
      <Animated.View
        {...panResponder.panHandlers}
        style={[styles.swipeFront, { transform: [{ translateX }] }]}
      >
        <TouchableOpacity
          onPress={handleTap}
          onLongPress={handleLongPress}
          delayLongPress={350}
          activeOpacity={0.55}
        >
          <RowContent item={item} showAddedBy={showAddedBy} />
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  headerListsBtn: {
    width: 40,
    height: 40,
    borderRadius: radii.sm + 2,
    backgroundColor: colors.whiteAlpha20,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // List
  list: {
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
  },
  group: {},
  groupSpacing: {
    marginTop: spacing.lg,
  },

  // "Suggested to buy" strip
  suggestBlock: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    marginBottom: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  suggestLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textMuted,
    letterSpacing: 1.0,
    marginBottom: spacing.sm,
  },
  suggestChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  suggestChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    maxWidth: '100%',
    backgroundColor: colors.primarySoft,
    borderWidth: 1,
    borderColor: colors.primaryTint,
    borderRadius: radii.pill,
    paddingVertical: 7,
    paddingLeft: 12,
    paddingRight: 8,
  },
  suggestChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.primaryDark,
    flexShrink: 1,
  },
  categoryLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textMuted,
    letterSpacing: 1.0,
    marginBottom: 6,
    paddingHorizontal: spacing.lg,
  },

  // Row anatomy: 22pt circle | 18pt category icon | content | qty
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 13,
    paddingHorizontal: spacing.lg,
    minHeight: 50,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  rowCatIcon: {
    marginLeft: 12,
  },
  rowContentText: {
    flex: 1,
    minWidth: 0,
    marginLeft: 12,
    marginRight: 8,
  },

  // Swipe-to-delete
  swipeContainer: {
    position: 'relative',
    overflow: 'hidden',
  },
  deleteBg: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    width: DELETE_WIDTH,
    backgroundColor: colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteAction: {
    flex: 1,
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'center',
  },
  swipeFront: {
    backgroundColor: colors.bg,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
    // align after circle + icon + their margins (22 + 12 + 18 + 12 = 64)
    marginLeft: spacing.lg + 22 + 12 + 18 + 12,
  },
  itemName: {
    fontSize: 16,
    color: colors.text,
    letterSpacing: -0.1,
  },
  itemNameChecked: {
    textDecorationLine: 'line-through',
    color: colors.textSubtle,
  },
  itemQty: {
    fontSize: 13,
    color: colors.textMuted,
    marginLeft: 8,
  },
  itemQtyChecked: {
    color: colors.textSubtle,
    textDecorationLine: 'line-through',
  },
  addedBy: {
    fontSize: 11,
    color: colors.textSubtle,
    marginTop: 2,
  },

  // "Picked up" zone
  boughtBlock: {
    marginTop: spacing.xl,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    paddingTop: spacing.md,
  },
  boughtHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: 8,
    gap: 6,
  },
  boughtTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textMuted,
    letterSpacing: 1.0,
  },
  boughtActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: 4,
    paddingBottom: spacing.sm,
  },
  boughtActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  boughtActionText: {
    ...typography.bodySmall,
    color: colors.primary,
    fontWeight: '600',
  },
  boughtActionDanger: {
    ...typography.bodySmall,
    color: colors.danger,
    fontWeight: '600',
  },

  // Empty state
  empty: {
    alignItems: 'center',
    paddingVertical: 64,
    paddingHorizontal: spacing.xl,
  },
  emptyIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#ECFEFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  emptyTitle: {
    ...typography.h3,
    color: colors.text,
    marginBottom: 4,
    textAlign: 'center',
  },
  emptySub: {
    ...typography.body,
    color: colors.textMuted,
    textAlign: 'center',
  },

  // Sticky bottom add bar
  addBarWrap: {
    backgroundColor: colors.bg,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: Platform.OS === 'ios' ? 8 : spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  addBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingLeft: 14,
    paddingRight: 6,
    paddingVertical: 5,
    ...shadows.card,
  },
  addInput: {
    flex: 1,
    fontSize: 16,
    color: colors.text,
    paddingVertical: 10,
    paddingHorizontal: 8,
  },
  sendBtn: {
    borderRadius: radii.md,
    ...shadows.button,
  },
  sendBtnInner: {
    width: 36,
    height: 36,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Lists sheet
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.45)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xxxl,
    ...shadows.button,
  },
  modalTitle: {
    ...typography.h2,
    color: colors.text,
    marginBottom: spacing.md,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  listItemText: {
    fontSize: 16,
    color: colors.text,
    flex: 1,
  },
  listItemTextActive: {
    color: colors.primary,
    fontWeight: '600',
  },
  newListRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    marginTop: spacing.sm,
  },
  newListInput: {
    flex: 1,
    fontSize: 16,
    color: colors.text,
    paddingVertical: 8,
  },
  newListAdd: {
    color: colors.primary,
    fontSize: 15,
    fontWeight: '700',
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
});

export default ShoppingListScreen;
