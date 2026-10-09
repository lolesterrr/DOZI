const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

const config = getDefaultConfig(__dirname);

// Drizzle migrations (src/db/migrations/*.sql) are bundled into the app.
config.resolver.sourceExts.push('sql');

module.exports = withNativeWind(config, { input: './global.css' });
