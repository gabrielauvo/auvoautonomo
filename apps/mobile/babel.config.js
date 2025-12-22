module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      // Required for PowerSync async iterator support
      '@babel/plugin-transform-async-generator-functions',
    ],
  };
};
