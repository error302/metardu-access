module.exports = {
  preset: 'jest-expo',
  testEnvironment: 'node',
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|react-navigation|@react-navigation/.*|@sentry/react-native|native-base|react-native-svg|@gorhom|react-native-reanimated|react-native-gesture-handler|react-native-screens|react-native-safe-area-context|@maplibre|react-native-maps|react-native-ble-plx|expo-router|expo-status-bar|expo-constants|expo-linking|expo-font|expo-splash-screen|expo-secure-store|expo-sqlite|expo-location|expo-camera|expo-file-system|expo-network|expo-application|expo-clipboard|expo-haptics|expo-image|expo-linear-gradient|expo-blur|expo-localization|expo-notifications|expo-updates|expo-background-fetch|expo-task-manager|expo-sensors|expo-sharing|expo-media-library|expo-image-picker|expo-crypto|expo-device|@expo/vector-icons|@tanstack/react-query|zustand|react-hook-form|@hookform|zod|i18next|react-i18next|date-fns|uuid)'
  ],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@engine/(.*)$': '<rootDir>/packages/engine/src/$1',
    '^@app/(.*)$': '<rootDir>/app/$1',
  },
  testMatch: [
    '<rootDir>/tests/**/*.test.ts',
    '<rootDir>/tests/**/*.test.tsx',
    '<rootDir>/packages/engine/src/**/*.test.ts',
  ],
  collectCoverageFrom: [
    'packages/engine/src/**/*.ts',
    'src/lib/**/*.ts',
    '!**/*.d.ts',
  ],
};
