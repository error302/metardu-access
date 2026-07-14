module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      ['babel-preset-expo', { jsxImportSource: 'nativewind' }],
      'nativewind/babel',
    ],
    plugins: [
      [
        'module-resolver',
        {
          alias: {
            '@': './src',
            '@engine': './packages/engine/src',
            '@app': './app',
          },
        },
      ],
      'react-native-reanimated/plugin',
    ],
  };
};
