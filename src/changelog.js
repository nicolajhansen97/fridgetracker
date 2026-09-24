// ─────────────────────────────────────────────────────────────
// CHANGELOG
// When you ship an OTA update, bump CURRENT_VERSION and add a
// new entry at the TOP of the CHANGELOG array.
// The app shows the "What's New" popup once per version.
// ─────────────────────────────────────────────────────────────

export const CURRENT_VERSION = '1.2.0';

// Features use translation keys — add the matching keys to each language file.
// The i18n system falls back to English automatically if a language is missing a key.
export const CHANGELOG = [
  {
    // Store release, not an OTA: this is the first build on the new app
    // framework, so it ships with its own native runtime version (1.2.0).
    version: '1.2.0',
    date: '2026-09-24',
    features: [
      { icon: '🔒', titleKey: 'changelog.v120_lock_title',   descKey: 'changelog.v120_lock_desc' },
      { icon: '✨', titleKey: 'changelog.v120_look_title',   descKey: 'changelog.v120_look_desc' },
      { icon: '🧊', titleKey: 'changelog.v120_space_title',  descKey: 'changelog.v120_space_desc' },
      { icon: '⚡', titleKey: 'changelog.v120_engine_title', descKey: 'changelog.v120_engine_desc' },
    ],
  },
  {
    version: '1.1.4',
    date: '2026-09-23',
    features: [
      { icon: '💰', titleKey: 'changelog.v114_prices_title',   descKey: 'changelog.v114_prices_desc' },
      { icon: '📅', titleKey: 'changelog.v114_mealplan_title', descKey: 'changelog.v114_mealplan_desc' },
      { icon: '📊', titleKey: 'changelog.v114_wastefix_title', descKey: 'changelog.v114_wastefix_desc' },
    ],
  },
  {
    version: '1.1.3',
    date: '2026-08-25',
    features: [
      { icon: '📅', titleKey: 'changelog.v113_yourdate_title',   descKey: 'changelog.v113_yourdate_desc' },
      { icon: '🔀', titleKey: 'changelog.v113_datesource_title', descKey: 'changelog.v113_datesource_desc' },
      { icon: '❄️', titleKey: 'changelog.v113_bestbefore_title', descKey: 'changelog.v113_bestbefore_desc' },
    ],
  },
  {
    version: '1.1.2',
    date: '2026-08-18',
    features: [
      { icon: '🔔', titleKey: 'changelog.v112_reminders_title', descKey: 'changelog.v112_reminders_desc' },
      { icon: '✨', titleKey: 'changelog.v112_pro_title',       descKey: 'changelog.v112_pro_desc' },
    ],
  },
  {
    version: '1.1.1',
    date: '2026-07-15',
    features: [
      { icon: '✅', titleKey: 'changelog.v111_usesoon_title', descKey: 'changelog.v111_usesoon_desc' },
      { icon: '➕', titleKey: 'changelog.v111_batch_title',   descKey: 'changelog.v111_batch_desc' },
      { icon: '🔧', titleKey: 'changelog.v111_androidpro_title', descKey: 'changelog.v111_androidpro_desc' },
    ],
  },
  {
    version: '1.1.0',
    date: '2026-07-13',
    features: [
      { icon: '🔄', titleKey: 'changelog.v110_restock_title', descKey: 'changelog.v110_restock_desc' },
      { icon: '➕', titleKey: 'changelog.v110_add_title',      descKey: 'changelog.v110_add_desc' },
      { icon: '🏠', titleKey: 'changelog.v110_home_title',     descKey: 'changelog.v110_home_desc' },
      { icon: '🧹', titleKey: 'changelog.v110_polish_title',   descKey: 'changelog.v110_polish_desc' },
    ],
  },
  {
    version: '1.0.8',
    date: '2026-07-09',
    features: [
      { icon: '🔍', titleKey: 'changelog.v108_usefirst_title', descKey: 'changelog.v108_usefirst_desc' },
      { icon: '➕', titleKey: 'changelog.v108_quickadd_title',  descKey: 'changelog.v108_quickadd_desc' },
      { icon: '🔄', titleKey: 'changelog.v108_activity_title',  descKey: 'changelog.v108_activity_desc' },
    ],
  },
  {
    version: '1.0.7',
    date: '2026-06-05',
    features: [
      { icon: '📅', titleKey: 'changelog.v107_calendar_title', descKey: 'changelog.v107_calendar_desc' },
      { icon: '📷', titleKey: 'changelog.v107_scan_title',     descKey: 'changelog.v107_scan_desc' },
      { icon: '✨', titleKey: 'changelog.v107_photo_title',    descKey: 'changelog.v107_photo_desc' },
      { icon: '🥄', titleKey: 'changelog.v107_partial_title',  descKey: 'changelog.v107_partial_desc' },
    ],
  },
  {
    version: '1.0.6',
    date: '2026-06-02',
    features: [
      { icon: '📅', titleKey: 'changelog.v106_dateformat_title', descKey: 'changelog.v106_dateformat_desc' },
      { icon: '📊', titleKey: 'changelog.v106_stats_title',       descKey: 'changelog.v106_stats_desc' },
    ],
  },
  {
    version: '1.0.5',
    date: '2026-05-17',
    features: [
      { icon: '🧊', titleKey: 'changelog.v105_useby_title',    descKey: 'changelog.v105_useby_desc' },
      { icon: '⚙️', titleKey: 'changelog.v105_times_title',    descKey: 'changelog.v105_times_desc' },
      { icon: '📊', titleKey: 'changelog.v105_stats_title',    descKey: 'changelog.v105_stats_desc' },
      { icon: '📝', titleKey: 'changelog.v105_activity_title', descKey: 'changelog.v105_activity_desc' },
    ],
  },
  {
    version: '1.0.4',
    date: '2026-05-14',
    features: [
      { icon: '🍳', titleKey: 'changelog.v104_ai_title',       descKey: 'changelog.v104_ai_desc' },
      { icon: '🎯', titleKey: 'changelog.v104_mood_title',     descKey: 'changelog.v104_mood_desc' },
      { icon: '✨', titleKey: 'changelog.v104_refine_title',   descKey: 'changelog.v104_refine_desc' },
      { icon: '🔖', titleKey: 'changelog.v104_cookbook_title', descKey: 'changelog.v104_cookbook_desc' },
    ],
  },
  {
    version: '1.0.3',
    date: '2026-05-07',
    features: [
      { icon: '📱', titleKey: 'changelog.v103_tabs_title',     descKey: 'changelog.v103_tabs_desc' },
      { icon: '🎨', titleKey: 'changelog.v103_design_title',   descKey: 'changelog.v103_design_desc' },
      { icon: '🛒', titleKey: 'changelog.v103_shopping_title', descKey: 'changelog.v103_shopping_desc' },
      { icon: '💬', titleKey: 'changelog.v103_feedback_title', descKey: 'changelog.v103_feedback_desc' },
      { icon: '⬇️', titleKey: 'changelog.v103_updates_title',  descKey: 'changelog.v103_updates_desc' },
    ],
  },
  {
    version: '1.0.2',
    date: '2026-03-28',
    features: [
      { icon: '🛒', titleKey: 'changelog.v102_shopping_title', descKey: 'changelog.v102_shopping_desc' },
      { icon: '📋', titleKey: 'changelog.v102_lists_title',    descKey: 'changelog.v102_lists_desc' },
      { icon: '🍽️', titleKey: 'changelog.v102_consumed_title', descKey: 'changelog.v102_consumed_desc' },
      { icon: '🏷️', titleKey: 'changelog.v102_categories_title', descKey: 'changelog.v102_categories_desc' },
      { icon: '🌍', titleKey: 'changelog.v102_recipes_title',  descKey: 'changelog.v102_recipes_desc' },
    ],
  },
  {
    version: '1.0.1',
    date: '2026-03-19',
    features: [
      { icon: '🛒', titleKey: 'changelog.v101_shopping_title', descKey: 'changelog.v101_shopping_desc' },
      { icon: '🔤', titleKey: 'changelog.v101_text_title',     descKey: 'changelog.v101_text_desc' },
    ],
  },
  {
    version: '1.0.0',
    date: '2026-01-01',
    features: [
      { icon: '❄️', titleKey: 'changelog.v100_inventory_title', descKey: 'changelog.v100_inventory_desc' },
      { icon: '👨‍👩‍👧', titleKey: 'changelog.v100_sharing_title',   descKey: 'changelog.v100_sharing_desc' },
      { icon: '⏰', titleKey: 'changelog.v100_expiry_title',    descKey: 'changelog.v100_expiry_desc' },
      { icon: '🍽️', titleKey: 'changelog.v100_recipes_title',  descKey: 'changelog.v100_recipes_desc' },
      { icon: '📊', titleKey: 'changelog.v100_activity_title', descKey: 'changelog.v100_activity_desc' },
    ],
  },
];
