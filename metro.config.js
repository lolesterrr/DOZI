const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

const config = getDefaultConfig(__dirname);

// Drizzle migrations (src/db/migrations/*.sql) are bundled into the app.
config.resolver.sourceExts.push('sql');

// expo-sqlite's web build loads its SQLite engine from a .wasm file. Without this, any web bundle
// (pressing `w`, or opening the dev server in a browser) fails with "Unable to resolve
// ./wa-sqlite/wa-sqlite.wasm". The app is Android-first; this only keeps web bundling working.
config.resolver.assetExts.push('wasm');

module.exports = withNativeWind(config, { input: './global.css' });
