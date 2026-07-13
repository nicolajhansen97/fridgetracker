import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Modal,
  Pressable,
  LayoutAnimation,
} from 'react-native';
import { useFridge } from '../context/FridgeContext';
import { useShoppingList } from '../context/ShoppingListContext';
import { useLanguage } from '../i18n';
import { useStockInsights } from '../hooks/useStockInsights';
import { usePremium } from '../context/PremiumContext';
import PaywallModal from '../components/PaywallModal';
import {
  Screen,
  ScreenHeader,
  Card,
  Icon,
  Badge,
  EmptyState,
} from '../components/ui';
import { colors, radii, spacing, typography } from '../theme';

const STATUS_TONE = { low: 'warning', over: 'info', ok: 'success' };

// Collapsible section header: colored icon + a one-line "what this is" + a count
// and chevron. Tapping expands/collapses, so a freezer with lots of items reads
// as four short headers instead of one long scroll.
const SectionHeader = ({ icon, tint, bg, title, subtitle, count, open, onToggle }) => (
  <TouchableOpacity style={styles.secHeader} onPress={onToggle} activeOpacity={0.7}>
    <View style={[styles.secIcon, { backgroundColor: bg }]}>
      <Icon name={icon} size={16} color={tint} />
    </View>
    <View style={{ flex: 1, minWidth: 0 }}>
      <Text style={styles.secTitle}>{title}</Text>
      {subtitle ? <Text style={styles.secSub}>{subtitle}</Text> : null}
    </View>
    {count != null ? <Text style={styles.secCount}>{count}</Text> : null}
    <Icon name={open ? 'chevron-up' : 'chevron-down'} size={18} color={colors.textMuted} />
  </TouchableOpacity>
);

const StockInsightsScreen = ({ navigation }) => {
  const { loadItems } = useFridge();
  const { addItem, items: shoppingItems } = useShoppingList();
  const { t } = useLanguage();
  const { isPremium } = usePremium();
  const {
    restock, lowBasic, ignoredItems, overbought, mostStocked, mostUsed,
    loading, error, reload, ignore, unignore,
  } = useStockInsights();
  const [refreshing, setRefreshing] = useState(false);
  const [added, setAdded] = useState({});
  const [ignoredVisible, setIgnoredVisible] = useState(false);
  const [paywallVisible, setPaywallVisible] = useState(false);
  const [open, setOpen] = useState({ low: true, stock: false, over: false, used: false });

  // Free tier gets a simple inventory-based "running low"; Pro gets the
  // usage-predicted version. Everything else usage-based is Pro.
  const lowList = isPremium ? restock : lowBasic;

  const toggle = (id) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setOpen((o) => ({ ...o, [id]: !o[id] }));
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([loadItems(), reload()]);
    } finally {
      setRefreshing(false);
    }
  }, [loadItems, reload]);

  const addToList = useCallback(
    async (entry) => {
      const qty =
        entry.suggestedQty > 0
          ? `${entry.suggestedQty}${entry.unit ? ` ${entry.unit}` : ''}`
          : '';
      const dup = shoppingItems.find(
        (i) => (i.name || '').trim().toLowerCase() === entry.key && !i.checked
      );
      const res = dup ? { success: true } : await addItem(entry.name, qty);
      if (res.success) setAdded((m) => ({ ...m, [entry.key]: true }));
    },
    [shoppingItems, addItem]
  );

  // "3 kg on hand" / "2 on hand"
  const onHandLabel = (e) =>
    t('restock.onHand', {
      qty: e.unit ? `${e.onHand} ${e.unit}` : e.onHand,
    });

  const rateLabel = (e) => {
    if (e.usedPerWeek <= 0) return t('restock.notUsedRecently');
    const r = e.usedPerWeek < 0.1 ? '<0.1' : e.usedPerWeek < 10 ? e.usedPerWeek.toFixed(1) : String(Math.round(e.usedPerWeek));
    return t('restock.usageRate', { rate: r });
  };

  const weeksLeftLabel = (e) => {
    if (!isFinite(e.weeksLeft) || e.usedPerWeek <= 0) return null;
    if (e.weeksLeft < 1) return t('restock.lessThanWeekLeft');
    return t('restock.weeksLeft', { count: Math.round(e.weeksLeft) });
  };

  const metaLine = (e) => {
    const parts = [onHandLabel(e), rateLabel(e)];
    const wl = weeksLeftLabel(e);
    if (wl) parts.push(wl);
    return parts.join(' · ');
  };

  // Stock view cares about how much you hold, not usage rate.
  const stockLine = (e) => {
    const parts = [onHandLabel(e)];
    if (e.packs > 1) parts.push(t('restock.packs', { count: e.packs }));
    return parts.join(' · ');
  };

  const Row = ({ e, showAdd, showBadge, stock }) => (
    <View style={styles.row}>
      <View style={{ flex: 1, minWidth: 0 }}>
        <View style={styles.rowHead}>
          <Text style={styles.name} numberOfLines={1}>{e.name}</Text>
          {showBadge ? (
            <Badge tone={STATUS_TONE[e.status]}>{t(`restock.status_${e.status}`)}</Badge>
          ) : null}
        </View>
        <Text style={styles.meta} numberOfLines={2}>{stock ? stockLine(e) : metaLine(e)}</Text>
      </View>
      {showAdd ? (
        added[e.key] ? (
          <View style={styles.addedTag}>
            <Icon name="checkmark" size={16} color={colors.success} />
            <Text style={styles.addedText}>{t('restock.added')}</Text>
          </View>
        ) : (
          <View style={styles.lowActions}>
            <TouchableOpacity
              style={styles.ignoreBtn}
              onPress={() => ignore(e.key)}
              activeOpacity={0.7}
              accessibilityLabel={t('restock.ignore')}
              hitSlop={6}
            >
              <Icon name="close" size={18} color={colors.textMuted} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.addBtn} onPress={() => addToList(e)} activeOpacity={0.8}>
              <Icon name="cart-outline" size={15} color={colors.surface} />
              <Text style={styles.addBtnText}>{t('restock.add')}</Text>
            </TouchableOpacity>
          </View>
        )
      ) : null}
    </View>
  );

  // Soft, non-blocking upsell card shown to free users in place of the
  // usage-based ("smart") sections.
  const ProTeaser = () => (
    <Card style={[styles.card, styles.teaser]}>
      <View style={styles.teaserIcon}>
        <Icon name="sparkles-outline" size={20} color={colors.secondary} />
      </View>
      <Text style={styles.teaserTitle}>{t('restock.proTitle')}</Text>
      <Text style={styles.teaserBody}>{t('restock.proBody')}</Text>
      <TouchableOpacity style={styles.teaserBtn} onPress={() => setPaywallVisible(true)} activeOpacity={0.85}>
        <Text style={styles.teaserBtnText}>{t('restock.proCta')}</Text>
      </TouchableOpacity>
    </Card>
  );

  const hasAny =
    lowList.length > 0 || overbought.length > 0 || mostStocked.length > 0 || mostUsed.length > 0;

  return (
    <Screen>
      <ScreenHeader
        title={t('restock.title')}
        onBack={() => navigation.goBack()}
        right={
          <TouchableOpacity
            onPress={() => setIgnoredVisible(true)}
            hitSlop={8}
            style={styles.headerBtn}
            accessibilityLabel={t('restock.ignoredTitle')}
          >
            <Icon name="options-outline" size={20} color={colors.surface} />
          </TouchableOpacity>
        }
      />

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        >
          {!hasAny ? (
            <EmptyState
              icon="cart-outline"
              title={t('restock.emptyTitle')}
              description={error ? t('restock.errorBody') : t('restock.emptyBody')}
            />
          ) : (
            <>
              {/* Running low → buy (basic for free, usage-predicted for Pro) */}
              {lowList.length > 0 && (
                <>
                  <SectionHeader
                    icon="alert-circle-outline"
                    tint={colors.danger}
                    bg={colors.dangerSoft}
                    title={t('restock.runningLow')}
                    subtitle={isPremium ? t('restock.runningLowSub') : t('restock.runningLowSubFree')}
                    count={lowList.length}
                    open={open.low}
                    onToggle={() => toggle('low')}
                  />
                  {open.low && (
                    <Card style={styles.card} padded={false}>
                      {lowList.map((e, i) => (
                        <View key={e.key}>
                          {i > 0 && <View style={styles.divider} />}
                          <Row e={e} showAdd />
                        </View>
                      ))}
                    </Card>
                  )}
                </>
              )}

              {/* What you have most of — the "how much do I have" overview (free) */}
              {mostStocked.length > 0 && (
                <>
                  <SectionHeader
                    icon="cube-outline"
                    tint={colors.primaryDark}
                    bg={colors.primarySoft}
                    title={t('restock.mostStocked')}
                    subtitle={t('restock.mostStockedSub')}
                    count={mostStocked.length}
                    open={open.stock}
                    onToggle={() => toggle('stock')}
                  />
                  {open.stock && (
                    <Card style={styles.card} padded={false}>
                      {mostStocked.map((e, i) => (
                        <View key={e.key}>
                          {i > 0 && <View style={styles.divider} />}
                          <Row e={e} stock />
                        </View>
                      ))}
                    </Card>
                  )}
                </>
              )}

              {/* Usage-based intelligence: Pro only. Free sees a soft upsell. */}
              {isPremium ? (
                <>
                  {/* Overbought → buy less */}
                  {overbought.length > 0 && (
                    <>
                      <SectionHeader
                        icon="refresh-outline"
                        tint={colors.accent}
                        bg={colors.accentSoft}
                        title={t('restock.buyingTooOften')}
                        subtitle={t('restock.buyingTooOftenSub')}
                        count={overbought.length}
                        open={open.over}
                        onToggle={() => toggle('over')}
                      />
                      {open.over && (
                        <Card style={styles.card} padded={false}>
                          {overbought.map((e, i) => (
                            <View key={e.key}>
                              {i > 0 && <View style={styles.divider} />}
                              <Row e={e} />
                            </View>
                          ))}
                        </Card>
                      )}
                    </>
                  )}

                  {/* What you use most — an overview, not the whole freezer */}
                  {mostUsed.length > 0 && (
                    <>
                      <SectionHeader
                        icon="flame-outline"
                        tint={colors.warning}
                        bg={colors.warningSoft}
                        title={t('restock.mostUsed')}
                        subtitle={t('restock.mostUsedSub')}
                        count={mostUsed.length}
                        open={open.used}
                        onToggle={() => toggle('used')}
                      />
                      {open.used && (
                        <Card style={styles.card} padded={false}>
                          {mostUsed.map((e, i) => (
                            <View key={e.key}>
                              {i > 0 && <View style={styles.divider} />}
                              <Row e={e} showBadge />
                            </View>
                          ))}
                        </Card>
                      )}
                    </>
                  )}
                </>
              ) : (
                <ProTeaser />
              )}
            </>
          )}
          <View style={{ height: spacing.xxl }} />
        </ScrollView>
      )}

      {/* Ignored items — managed here, out of the main list */}
      <Modal
        visible={ignoredVisible}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setIgnoredVisible(false)}
      >
        <Pressable style={styles.backdrop} onPress={() => setIgnoredVisible(false)}>
          <Pressable style={styles.sheet}>
            <Text style={styles.sheetTitle}>{t('restock.ignoredTitle')}</Text>
            <Text style={styles.sheetSub}>{t('restock.ignoredDesc')}</Text>
            {ignoredItems.length === 0 ? (
              <Text style={styles.sheetEmpty}>{t('restock.ignoredEmpty')}</Text>
            ) : (
              <ScrollView style={styles.sheetList} showsVerticalScrollIndicator={false}>
                {ignoredItems.map((e, i) => (
                  <View key={e.key} style={[styles.ignRow, i === ignoredItems.length - 1 && { borderBottomWidth: 0 }]}>
                    <Text style={styles.ignName} numberOfLines={1}>{e.name}</Text>
                    <TouchableOpacity
                      style={styles.restoreBtn}
                      onPress={() => unignore(e.key)}
                      activeOpacity={0.7}
                    >
                      <Icon name="refresh-outline" size={16} color={colors.accent} />
                      <Text style={styles.restoreText}>{t('restock.restore')}</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </ScrollView>
            )}
          </Pressable>
        </Pressable>
      </Modal>

      <PaywallModal visible={paywallVisible} onClose={() => setPaywallVisible(false)} />
    </Screen>
  );
};

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textMuted,
    marginLeft: 4,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  secHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.xl,
    marginBottom: spacing.sm,
    paddingHorizontal: 2,
  },
  secIcon: {
    width: 30,
    height: 30,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: -0.2,
  },
  secSub: {
    fontSize: 12.5,
    color: colors.textMuted,
    marginTop: 1,
  },
  secCount: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.textMuted,
    marginRight: 2,
  },
  headerBtn: {
    width: 40,
    height: 40,
    borderRadius: radii.sm + 2,
    backgroundColor: colors.whiteAlpha20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    marginBottom: 0,
  },
  teaser: {
    marginTop: spacing.xl,
    alignItems: 'flex-start',
    borderWidth: 1,
    borderColor: colors.border,
  },
  teaserIcon: {
    width: 36,
    height: 36,
    borderRadius: radii.md,
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  teaserTitle: {
    ...typography.h3,
    color: colors.text,
    marginBottom: 4,
  },
  teaserBody: {
    ...typography.body,
    color: colors.textMuted,
    lineHeight: 21,
    marginBottom: spacing.md,
  },
  teaserBtn: {
    backgroundColor: colors.secondary,
    borderRadius: radii.pill,
    paddingVertical: 10,
    paddingHorizontal: 18,
  },
  teaserBtnText: {
    color: colors.surface,
    fontSize: 14,
    fontWeight: '700',
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginHorizontal: spacing.lg,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  rowHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: 3,
  },
  name: {
    ...typography.bodyStrong,
    color: colors.text,
    flexShrink: 1,
  },
  meta: {
    fontSize: 13,
    color: colors.textMuted,
  },
  lowActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  ignoreBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: colors.primary,
    borderRadius: radii.pill,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  restoreBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 8,
    paddingHorizontal: 6,
  },
  restoreText: {
    color: colors.accent,
    fontSize: 13,
    fontWeight: '700',
  },
  addBtnText: {
    color: colors.surface,
    fontSize: 13,
    fontWeight: '700',
  },
  addedTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 8,
    paddingHorizontal: 6,
  },
  addedText: {
    color: colors.success,
    fontSize: 13,
    fontWeight: '700',
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.45)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radii.lg,
    borderTopRightRadius: radii.lg,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xxl,
    maxHeight: '70%',
  },
  sheetTitle: {
    ...typography.h3,
    color: colors.text,
  },
  sheetSub: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: 2,
    marginBottom: spacing.sm,
  },
  sheetEmpty: {
    ...typography.body,
    color: colors.textMuted,
    textAlign: 'center',
    paddingVertical: spacing.xl,
  },
  sheetList: {
    flexGrow: 0,
  },
  ignRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  ignName: {
    ...typography.bodyStrong,
    color: colors.text,
    flex: 1,
    minWidth: 0,
    marginRight: spacing.sm,
  },
});

export default StockInsightsScreen;
