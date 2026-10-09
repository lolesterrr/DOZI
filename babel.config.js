module.exports = function (api) {
  api.cache(true);
  return {
    presets: [['babel-preset-expo', { jsxImportSource: 'nativewind' }], 'nativewind/babel'],
    // Drizzle migrations are .sql files; inline them as strings so they ship inside the app.
    plugins: [['inline-import', { extensions: ['.sql'] }]],
  };
};
