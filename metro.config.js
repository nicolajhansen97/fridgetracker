// Metro config — keep the Supabase Edge Function source out of the app bundle
// and out of Expo's TS detection. supabase/functions/* is Deno code that
// shouldn't be transpiled or watched by Metro.
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

const supabaseDir = path.resolve(__dirname, 'supabase');
config.resolver.blockList = [
  // existing blockList may be a RegExp or array — normalize to array
  ...(Array.isArray(config.resolver.blockList)
    ? config.resolver.blockList
    : config.resolver.blockList
    ? [config.resolver.blockList]
    : []),
  new RegExp(`${supabaseDir.replace(/\\/g, '\\\\')}.*`),
];

module.exports = config;
