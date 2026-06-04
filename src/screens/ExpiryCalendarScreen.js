import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
} from 'react-native';
import { useFridge } from '../context/FridgeContext';
import { usePremium } from '../context/PremiumContext';
import { useLanguage } from '../i18n';
import { useFridgeExpiry } from '../hooks/useFridgeExpiry';
import PaywallModal from '../components/PaywallModal';
import {
  Screen,
  ScreenHeader,
  Card,
  Icon,
  SectionTitle,
  EmptyState,
} from '../components/ui';
import { colors, radii, spacing, typography } from '../theme';

const MS_PER_DAY = 86400000;
const FREE_DAYS_AHEAD = 14;

const startOfDay = (date) => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
};

// Local-time ISO day key (YYYY-MM-DD). Built from local parts — not
// toISOString() — so a day never shifts across the UTC boundary.
const dayKey = (date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
    date.getDate()
  ).padStart(2, '0')}`;

const addMonths = (date, delta) => {
  const d = new Date(date);
  d.setMonth(d.getMonth() + delta);
  return d;
};

const ExpiryCalendarScreen = ({ navigation }) => {
  const { items, loadItems } = useFridge();
  const { getEffectiveExpiry } = useFridgeExpiry();
  const { isPremium } = usePremium();
  const { t, formatDate } = useLanguage();

  const today = useMemo(() => startOfDay(new Date()), []);
  const cutoff = useMemo(() => {
    const c = new Date(today);
    c.setDate(today.getDate() + FREE_DAYS_AHEAD);
    return c;
  }, [today]);

  const [viewMonth, setViewMonth] = useState(
    () => new Date(today.getFullYear(), today.getMonth(), 1)
  );
  const [selectedKey, setSelectedKey] = useState(() => dayKey(today));
  const [paywallVisible, setPaywallVisible] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Map every tracked item onto its effective-expiry day.
  const itemsByDay = useMemo(() => {
    const map = new Map();
    (items || []).forEach((item) => {
      const exp = getEffectiveExpiry(item);
      if (!exp) return;
      const key = dayKey(exp);
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(item);
    });
    return map;
  }, [items, getEffectiveExpiry]);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await loadItems();
    } catch (e) {
      console.error('Refresh error:', e);
    } finally {
      setRefreshing(false);
    }
  };

  // A day is locked when free and it falls beyond the 14-day window.
  const isLockedDate = (date) => !isPremium && date > cutoff;

  // Urgency color for a given expiry day (relative to today).
  const dayColor = (date) => {
    const days = Math.round((date - today) / MS_PER_DAY);
    if (days <= 1) return colors.danger;
    if (days <= 3) return colors.warning;
    if (days <= 7) return colors.info;
    return colors.primary;
  };

  // Build the calendar cells for the displayed month, Monday-first.
  const cells = useMemo(() => {
    const year = viewMonth.getFullYear();
    const month = viewMonth.getMonth();
    const firstWeekday = (new Date(year, month, 1).getDay() + 6) % 7; // Mon=0
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const list = [];
    for (let i = 0; i < firstWeekday; i++) list.push(null);
    for (let d = 1; d <= daysInMonth; d++) list.push(new Date(year, month, d));
    while (list.length % 7 !== 0) list.push(null);
    return list;
  }, [viewMonth]);

  const weekdayLabels = useMemo(
    () => Array.from({ length: 7 }, (_, i) => t(`calendar.weekdays.${i}`)),
    [t]
  );

  const monthLabel = `${t(`calendar.months.${viewMonth.getMonth()}`)} ${viewMonth.getFullYear()}`;

  // Forward nav is blocked for free users once the whole next month sits
  // beyond the cutoff — that opens the paywall instead of navigating.
  const nextMonthFullyLocked = () => {
    if (isPremium) return false;
    const firstOfNext = new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 1);
    return firstOfNext > cutoff;
  };

  const goPrev = () => setViewMonth(addMonths(viewMonth, -1));
  const goNext = () => {
    if (nextMonthFullyLocked()) {
      setPaywallVisible(true);
      return;
    }
    setViewMonth(addMonths(viewMonth, 1));
  };

  const onPressDay = (date) => {
    if (!date) return;
    if (isLockedDate(date)) {
      setPaywallVisible(true);
      return;
    }
    setSelectedKey(dayKey(date));
  };

  const selectedItems = selectedKey ? itemsByDay.get(selectedKey) || [] : [];
  const selectedDateObj = selectedKey ? new Date(selectedKey) : null;

  return (
    <Screen>
      <ScreenHeader
        title={t('calendar.title')}
        onBack={() => navigation.goBack()}
        backLabel={t('common.back')}
      />

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
      >
        {!isPremium && (
          <TouchableOpacity
            style={styles.banner}
            activeOpacity={0.85}
            onPress={() => setPaywallVisible(true)}
          >
            <Icon name="lock-closed" size={16} color="#075985" />
            <Text style={styles.bannerText}>
              {t('calendar.freeLimitBanner', { date: formatDate(dayKey(cutoff)) })}
            </Text>
            <Text style={styles.bannerCta}>{t('calendar.unlock')}</Text>
          </TouchableOpacity>
        )}

        <Card style={styles.calendarCard} padded={false}>
          {/* Month switcher */}
          <View style={styles.monthRow}>
            <TouchableOpacity onPress={goPrev} hitSlop={10} style={styles.monthArrow}>
              <Icon name="chevron-back" size={20} color={colors.text} />
            </TouchableOpacity>
            <Text style={styles.monthLabel}>{monthLabel}</Text>
            <TouchableOpacity onPress={goNext} hitSlop={10} style={styles.monthArrow}>
              <Icon
                name={nextMonthFullyLocked() ? 'lock-closed' : 'chevron-forward'}
                size={nextMonthFullyLocked() ? 16 : 20}
                color={nextMonthFullyLocked() ? colors.textMuted : colors.text}
              />
            </TouchableOpacity>
          </View>

          {/* Weekday header */}
          <View style={styles.weekRow}>
            {weekdayLabels.map((label, i) => (
              <Text key={i} style={styles.weekdayLabel}>
                {label}
              </Text>
            ))}
          </View>

          {/* Day grid */}
          <View style={styles.grid}>
            {cells.map((date, idx) => {
              if (!date) return <View key={`b${idx}`} style={styles.cell} />;
              const key = dayKey(date);
              const dayItems = itemsByDay.get(key) || [];
              const count = dayItems.length;
              const locked = isLockedDate(date);
              const isToday = key === dayKey(today);
              const isSelected = key === selectedKey;
              return (
                <TouchableOpacity
                  key={key}
                  style={styles.cell}
                  activeOpacity={0.7}
                  onPress={() => onPressDay(date)}
                >
                  <View
                    style={[
                      styles.cellInner,
                      isToday && styles.cellToday,
                      isSelected && styles.cellSelected,
                    ]}
                  >
                    <Text
                      style={[
                        styles.cellDay,
                        locked && styles.cellDayLocked,
                        isSelected && styles.cellDaySelected,
                      ]}
                    >
                      {date.getDate()}
                    </Text>
                    {locked ? (
                      <Icon name="lock-closed" size={9} color={colors.textSubtle} />
                    ) : count > 0 ? (
                      <View style={[styles.countDot, { backgroundColor: dayColor(date) }]}>
                        <Text style={styles.countDotText}>{count}</Text>
                      </View>
                    ) : (
                      <View style={styles.countSpacer} />
                    )}
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        </Card>

        {/* Day detail */}
        {selectedDateObj && (
          <>
            <SectionTitle>
              {selectedItems.length > 0
                ? `${formatDate(selectedKey)} · ${t('calendar.itemsOnDay', { count: selectedItems.length })}`
                : formatDate(selectedKey)}
            </SectionTitle>
            {selectedItems.length === 0 ? (
              <EmptyState icon="checkmark-circle-outline" description={t('calendar.noItemsDay')} />
            ) : (
              <Card padded={false}>
                {selectedItems.map((item, idx) => (
                  <TouchableOpacity
                    key={item.id}
                    activeOpacity={0.7}
                    onPress={() =>
                      navigation.navigate('FreezerTab', {
                        screen: 'EditItem',
                        params: { item },
                      })
                    }
                    style={[styles.itemRow, idx < selectedItems.length - 1 && styles.itemDivider]}
                  >
                    <View style={[styles.itemDot, { backgroundColor: dayColor(selectedDateObj) }]} />
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={styles.itemName} numberOfLines={1}>
                        {item.name}
                      </Text>
                      <View style={styles.itemMetaRow}>
                        <Icon name="cube-outline" size={12} color={colors.textMuted} />
                        <Text style={styles.itemMeta}>
                          {item.drawer}
                          {item.quantity && item.quantity > 1 ? `  ·  ×${item.quantity}` : ''}
                        </Text>
                      </View>
                    </View>
                    <Icon name="chevron-forward" size={18} color={colors.textSubtle} />
                  </TouchableOpacity>
                ))}
              </Card>
            )}
          </>
        )}

        {!selectedDateObj && (
          <View style={styles.hint}>
            <Icon name="hand-left-outline" size={28} color={colors.textMuted} />
            <Text style={styles.hintText}>{t('calendar.selectDayHint')}</Text>
          </View>
        )}

        <View style={{ height: spacing.xxxl }} />
      </ScrollView>

      <PaywallModal visible={paywallVisible} onClose={() => setPaywallVisible(false)} />
    </Screen>
  );
};

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.infoSoft,
    borderRadius: radii.md,
    paddingVertical: 10,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.md,
  },
  bannerText: {
    ...typography.caption,
    color: '#075985',
    flex: 1,
  },
  bannerCta: {
    ...typography.caption,
    color: colors.primary,
    fontWeight: '700',
  },

  calendarCard: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
  },
  monthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.sm,
    marginBottom: spacing.md,
  },
  monthArrow: {
    width: 36,
    height: 36,
    borderRadius: radii.sm,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthLabel: {
    ...typography.h3,
    color: colors.text,
  },
  weekRow: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  weekdayLabel: {
    flex: 1,
    textAlign: 'center',
    ...typography.caption,
    color: colors.textMuted,
    fontWeight: '700',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  cell: {
    width: `${100 / 7}%`,
    aspectRatio: 1,
    padding: 3,
  },
  cellInner: {
    flex: 1,
    borderRadius: radii.sm,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  cellToday: {
    backgroundColor: colors.surfaceMuted,
  },
  cellSelected: {
    backgroundColor: colors.primary,
  },
  cellDay: {
    ...typography.bodySmall,
    color: colors.text,
    fontWeight: '600',
  },
  cellDayLocked: {
    color: colors.textSubtle,
    fontWeight: '400',
  },
  cellDaySelected: {
    color: colors.surface,
    fontWeight: '700',
  },
  countDot: {
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  countDotText: {
    color: colors.surface,
    fontSize: 10,
    fontWeight: '700',
  },
  countSpacer: {
    height: 16,
  },

  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: spacing.lg,
    gap: 12,
  },
  itemDivider: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  itemDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  itemName: {
    ...typography.bodyStrong,
    color: colors.text,
  },
  itemMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  itemMeta: {
    ...typography.caption,
    color: colors.textMuted,
  },

  hint: {
    alignItems: 'center',
    paddingVertical: spacing.xxxl,
    gap: spacing.sm,
  },
  hintText: {
    ...typography.body,
    color: colors.textMuted,
    textAlign: 'center',
  },
});

export default ExpiryCalendarScreen;
