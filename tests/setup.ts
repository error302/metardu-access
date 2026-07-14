// Jest setup — runs before each test file
// Mock React Native modules that aren't available in Node test environment

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn().mockResolvedValue(null),
  setItemAsync: jest.fn().mockResolvedValue(undefined),
  deleteItemAsync: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('expo-network', () => ({
  getNetworkStateAsync: jest.fn().mockResolvedValue({
    isConnected: true,
    isInternetReachable: true,
  }),
}));

jest.mock('expo-file-system', () => ({
  documentDirectory: '/tmp/',
  writeAsStringAsync: jest.fn().mockResolvedValue(undefined),
  makeDirectoryAsync: jest.fn().mockResolvedValue(undefined),
  EncodingType: { UTF8: 'utf8' },
}));

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn().mockResolvedValue(null),
  setItem: jest.fn().mockResolvedValue(undefined),
  removeItem: jest.fn().mockResolvedValue(undefined),
}));
