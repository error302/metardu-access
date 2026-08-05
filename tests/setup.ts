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

// expo-crypto — Node-test-env replacement using Node's built-in crypto.
// Mirrors the runtime API surface used by src/lib/crypto/*.
// NOTE: jest.mock() factories can't close over outer variables, so we use
// the global `crypto` (Node 19+) or `require('crypto')` inline.
jest.mock('expo-crypto', () => {
  const nc = require('crypto');
  return {
    CryptoDigestAlgorithm: { SHA256: 'SHA256' },
    CryptoEncoding: { HEX: 'hex', BASE64: 'base64' },
    digestStringAsync: (_algorithm: string, data: string, opts: { encoding: string }) =>
      Promise.resolve(
        nc.createHash('sha256').update(data).digest(opts?.encoding ?? 'hex')
      ),
    getRandomBytesAsync: (n: number) =>
      Promise.resolve(new Uint8Array(nc.randomBytes(n))),
  };
});

jest.mock('expo-application', () => ({
  getAndroidId: () => 'mock-android-id',
  getIosIdForVendorAsync: () => Promise.resolve('mock-ios-id'),
}));
