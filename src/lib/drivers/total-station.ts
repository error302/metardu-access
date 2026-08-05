/**
 * BLE Total Station Driver — scaffolding for instrument connectivity.
 *
 * v0.2: Implements device scanning, connection management, and message framing.
 *       Protocol parsers (GSI, JobXML, RW5) are stubbed — to be filled in
 *       when paired with a real total station for testing.
 *
 * Supported instruments (roadmap):
 *   - Trimble (GSI, JobXML, RW5)
 *   - Leica (GSI, XML)
 *   - Topcon (GTS, RW5)
 *   - Sokkia (SDR)
 *   - Nikon (Nikon RAW)
 *
 * Bluetooth profiles:
 *   - SPP (Serial Port Profile) — most total stations
 *   - BLE GATT — newer instruments (Trimble SX, Leica Nova)
 */

import { BleManager, type Device, type State as BluetoothState } from 'react-native-ble-plx';
import { Platform } from 'react-native';

export type InstrumentBrand = 'trimble' | 'leica' | 'topcon' | 'sokkia' | 'nikon' | 'generic';
export type ProtocolFormat = 'gsi' | 'jobxml' | 'rw5' | 'sdr' | 'nikon_raw' | 'gts' | 'ascii';

export interface Instrument {
  id: string;
  name: string;
  brand: InstrumentBrand;
  model?: string;
  serialNumber?: string;
  protocol: ProtocolFormat;
  rssi?: number;
  connectionType?: 'ble' | 'usb' | 'spp';
}

export interface ObservationReading {
  pointNumber?: string;
  horizontalAngle?: number; // degrees
  verticalAngle?: number;   // degrees
  slopeDistance?: number;   // meters
  face?: 'left' | 'right';
  timestamp: string;
  raw?: string;             // raw message from instrument
}

// Common BLE service UUIDs for surveying instruments
const BLE_SERVICES = {
  trimble: '0000fe01-0000-1000-8000-00805f9b34fb',
  leica: '0000fe02-0000-1000-8000-00805f9b34fb',
  spp: '00001101-0000-1000-8000-00805f9b34fb',  // Serial Port Profile
  nordicUart: '6e400001-b5a3-f393-e0a9-e50e24dcca9e',
};

const BLE_CHARACTERTISTICS = {
  nordicUartTx: '6e400002-b5a3-f393-e0a9-e50e24dcca9e',
  nordicUartRx: '6e400003-b5a3-f393-e0a9-e50e24dcca9e',
};

export class TotalStationDriver {
  private manager: BleManager;
  private connectedDevice: Device | null = null;
  private scanSubscription: any = null;
  public isConnected: boolean = false;
  public connectionType: 'ble' | 'usb' | 'spp' | null = null;
  // USB serial state
  private usbHandle: string | null = null;
  private usbReceiveBuffer: string = '';
  private measurementCallback: ((reading: ObservationReading) => void) | null = null;

  constructor() {
    this.manager = new BleManager();
  }

  /**
   * Check if Bluetooth is powered on.
   */
  async getState(): Promise<BluetoothState> {
    return await this.manager.state();
  }

  /**
   * Request permissions (Android 12+ requires BLUETOOTH_SCAN/CONNECT).
   */
  async requestPermissions(): Promise<boolean> {
    // react-native-ble-plx handles permissions internally on Android 12+
    // but we need to ensure location permission for older versions
    if (Platform.OS === 'android') {
      try {
        const { status } = await require('expo-location').requestForegroundPermissionsAsync();
        return status === 'granted';
      } catch {
        return false;
      }
    }
    return true;
  }

  /**
   * Scan for nearby Bluetooth devices.
   * Returns a stream of discovered instruments.
   */
  async scanForDevices(
    onDeviceFound: (instrument: Instrument) => void,
    durationMs: number = 10000
  ): Promise<void> {
    const granted = await this.requestPermissions();
    if (!granted) {
      throw new Error('Bluetooth permissions not granted');
    }

    this.stopScan();
    this.scanSubscription = this.manager.startDeviceScan(
      null,
      { allowDuplicates: false },
      (error, device) => {
        if (error) {
          console.warn('BLE scan error:', error);
          return;
        }
        if (!device?.name) return;
        const instrument = this.identifyInstrument(device);
        if (instrument) {
          onDeviceFound(instrument);
        }
      }
    );

    // Auto-stop after duration
    setTimeout(() => this.stopScan(), durationMs);
  }

  stopScan(): void {
    if (this.scanSubscription) {
      this.scanSubscription.remove();
      this.scanSubscription = null;
    }
    this.manager.stopDeviceScan();
  }

  /**
   * Identify instrument brand and protocol from BLE device name.
   */
  private identifyInstrument(device: Device): Instrument | null {
    const name = device.name?.toLowerCase() ?? '';
    let brand: InstrumentBrand = 'generic';
    let protocol: ProtocolFormat = 'ascii';

    if (name.includes('trimble') || name.includes('s5') || name.includes('s7') || name.includes('s9')) {
      brand = 'trimble';
      protocol = 'gsi';
    } else if (name.includes('leica') || name.includes('ts') || name.includes('nova')) {
      brand = 'leica';
      protocol = 'gsi';
    } else if (name.includes('topcon') || name.includes('gt') || name.includes('gpt') || name.includes('es')) {
      brand = 'topcon';
      protocol = name.includes('es') ? 'gts' : 'rw5';
    } else if (name.includes('sokkia') || name.includes('cx') || name.includes('fx')) {
      brand = 'sokkia';
      protocol = 'sdr';
    } else if (name.includes('nikon') || name.includes('dtm') || name.includes('nivo')) {
      brand = 'nikon';
      protocol = 'nikon_raw';
    } else if (!name) {
      return null;
    }

    return {
      id: device.id,
      name: device.name ?? 'Unknown',
      brand,
      protocol,
      rssi: device.rssi ?? undefined,
    };
  }

  /**
   * Connect to a specific instrument via BLE.
   */
  async connect(instrumentId: string): Promise<void> {
    this.connectedDevice = await this.manager.connectToDevice(instrumentId);
    await this.connectedDevice.discoverAllServicesAndCharacteristics();
    this.isConnected = true;
  }

  /**
   * Connect to an instrument via USB Serial (Android only).
   *
   * Uses the `usb-serial-for-android` library via a custom Expo config plugin
   * (see `plugins/usb-serial/index.ts`). The native module exposes:
   *
   *   UsbSerial.connect(deviceId, baudRate) -> native handle
   *   UsbSerial.write(handle, base64Payload) -> Promise<void>
   *   UsbSerial.subscribe(handle, cb)       -> receives base64 chunks
   *   UsbSerial.disconnect(handle)          -> Promise<void>
   *
   * Falls back gracefully if the native module is not available (e.g. dev
   * build without the plugin, or iOS — USB-OTG serial is Android-only).
   */
  async connectUsb(deviceId?: string, baudRate: number = 9600): Promise<void> {
    if (Platform.OS !== 'android') {
      throw new Error('USB Serial is only supported on Android');
    }
    const UsbSerial = await loadUsbSerialModule();
    if (!UsbSerial) {
      throw new Error(
        'USB Serial native module not available. Rebuild with the usb-serial ' +
        'Expo config plugin (see plugins/usb-serial/README.md).'
      );
    }

    // If no deviceId provided, list connected devices and take the first.
    if (!deviceId) {
      const devices = await UsbSerial.listDevices();
      if (!devices || devices.length === 0) {
        throw new Error('No USB serial devices connected');
      }
      deviceId = devices[0].deviceId;
    }

    this.usbHandle = await UsbSerial.connect(deviceId, baudRate);
    this.connectionType = 'usb';
    this.isConnected = true;

    // Auto-subscribe to incoming measurements
    UsbSerial.subscribe(this.usbHandle, (base64Chunk: string) => {
      const raw = this.decodeBase64(base64Chunk);
      // Buffer until newline (most serial protocols are line-based)
      this.usbReceiveBuffer += raw;
      let nl: number;
      while ((nl = this.usbReceiveBuffer.indexOf('\n')) >= 0) {
        const line = this.usbReceiveBuffer.slice(0, nl).trim();
        this.usbReceiveBuffer = this.usbReceiveBuffer.slice(nl + 1);
        if (line) {
          const reading = this.parseRawMessage(line);
          if (reading && this.measurementCallback) this.measurementCallback(reading);
        }
      }
    });
  }

  /**
   * Disconnect from the current instrument.
   */
  async disconnect(): Promise<void> {
    // BLE path
    if (this.connectedDevice) {
      await this.manager.cancelDeviceConnection(this.connectedDevice.id);
      this.connectedDevice = null;
    }
    // USB path
    if (this.usbHandle) {
      const UsbSerial = await loadUsbSerialModule();
      if (UsbSerial) {
        try { await UsbSerial.disconnect(this.usbHandle); } catch {}
      }
      this.usbHandle = null;
    }
    this.usbReceiveBuffer = '';
    this.measurementCallback = null;
    this.isConnected = false;
    this.connectionType = null;
  }

  /**
   * Listen for incoming measurements from the instrument.
   * Works for both BLE and USB modes — in USB mode, this just stores the
   * callback since `connectUsb` already subscribes to the native stream.
   */
  async subscribeToMeasurements(
    onReading: (reading: ObservationReading) => void
  ): Promise<void> {
    this.measurementCallback = onReading;

    // USB mode — already subscribed in connectUsb(); nothing more to do.
    if (this.connectionType === 'usb' && this.usbHandle) {
      return;
    }

    if (!this.connectedDevice) {
      throw new Error('Not connected to an instrument');
    }

    // Try Nordic UART first (common in modern total stations)
    try {
      await this.connectedDevice.monitorCharacteristicForService(
        BLE_SERVICES.nordicUart,
        BLE_CHARACTERTISTICS.nordicUartRx,
        (error, characteristic) => {
          if (error || !characteristic?.value) return;
          const raw = this.decodeBase64(characteristic.value);
          const reading = this.parseRawMessage(raw);
          if (reading) onReading(reading);
        }
      );
    } catch {
      // Fall back to SPP
      // (would need custom native module for full SPP support)
      throw new Error('Could not subscribe to measurements. Instrument may use unsupported profile.');
    }
  }

  /**
   * Send a command to the instrument (e.g., "measure", "set prism", "face right").
   */
  async sendCommand(command: string): Promise<void> {
    if (this.connectionType === 'usb' && this.usbHandle) {
      const UsbSerial = await loadUsbSerialModule();
      if (!UsbSerial) throw new Error('USB Serial native module went away');
      await UsbSerial.write(this.usbHandle, this.encodeBase64(command));
      return;
    }

    if (!this.connectedDevice) {
      throw new Error('Not connected to an instrument');
    }
    const encoded = this.encodeBase64(command);
    await this.connectedDevice.writeCharacteristicWithResponseForService(
      BLE_SERVICES.nordicUart,
      BLE_CHARACTERTISTICS.nordicUartTx,
      encoded
    );
  }

  /**
   * Parse a raw ASCII message from the instrument.
   * Protocol-specific parsers are stubbed here.
   */
  private parseRawMessage(raw: string): ObservationReading | null {
    // GSI format: *12345 1.2345 2.3456 3.4567 ...
    if (raw.startsWith('*')) {
      return this.parseGSI(raw);
    }
    // GTS format (basic): <VH>,<HH>,<SD>
    if (raw.includes('VH') || raw.includes('ZA')) {
      return this.parseGTS(raw);
    }
    // RW5 format: line-based
    if (raw.includes(',"') && raw.includes('"')) {
      return this.parseRW5(raw);
    }
    // Generic ASCII: HA,VA,SD
    const parts = raw.split(',').map(s => parseFloat(s.trim()));
    if (parts.length >= 3 && parts.every(p => !isNaN(p))) {
      return {
        horizontalAngle: parts[0],
        verticalAngle: parts[1],
        slopeDistance: parts[2],
        timestamp: new Date().toISOString(),
        raw,
      };
    }
    return null;
  }

  private parseGSI(raw: string): ObservationReading | null {
    // GSI word format: *WI±value unit
    // Word indices: 11 = point no, 21 = HA, 22 = VA, 31 = SD
    try {
      const words = raw.trim().split(/\s+/);
      const reading: ObservationReading = { timestamp: new Date().toISOString(), raw };
      for (const word of words) {
        if (word.length < 7) continue;
        const wi = word.slice(0, 2);
        const value = word.slice(2);
        if (wi === '11') reading.pointNumber = value;
        else if (wi === '21') reading.horizontalAngle = parseFloat(value) / 100000; // GSI uses centiseconds
        else if (wi === '22') reading.verticalAngle = parseFloat(value) / 100000;
        else if (wi === '31') reading.slopeDistance = parseFloat(value) / 10000; // GSI uses 0.1mm units
      }
      return reading;
    } catch {
      return null;
    }
  }

  private parseRW5(raw: string): ObservationReading | null {
    // RW5 record: "TR,OP1,BP1,AR1.2345,ZE2.3456,SD3.4567"
    try {
      const fields = raw.split(',').map(f => f.trim().replace(/"/g, ''));
      const reading: ObservationReading = { timestamp: new Date().toISOString(), raw };
      for (const f of fields) {
        if (f.startsWith('AR')) reading.horizontalAngle = parseFloat(f.slice(2));
        else if (f.startsWith('ZE')) reading.verticalAngle = parseFloat(f.slice(2));
        else if (f.startsWith('SD')) reading.slopeDistance = parseFloat(f.slice(2));
      }
      return reading;
    } catch {
      return null;
    }
  }

  private parseGTS(raw: string): ObservationReading | null {
    // Topcon GTS format varies, but common is: "VH 12.3456 HH 23.4567 SD 34.5678"
    // or comma separated with labels.
    try {
      const reading: ObservationReading = { timestamp: new Date().toISOString(), raw };
      const normalized = raw.replace(/,/g, ' ');
      const parts = normalized.split(/\s+/);

      for (let i = 0; i < parts.length - 1; i++) {
        const label = parts[i].toUpperCase();
        const next = parseFloat(parts[i+1]);
        if (isNaN(next)) continue;

        if (label === 'VH' || label === 'ZA') reading.verticalAngle = next;
        else if (label === 'HH' || label === 'HA') reading.horizontalAngle = next;
        else if (label === 'SD') reading.slopeDistance = next;
      }
      return reading;
    } catch {
      return null;
    }
  }

  private decodeBase64(b64: string): string {
    // react-native-ble-plx returns base64; decode to string
    if (typeof atob === 'function') {
      return atob(b64);
    }
    // Fallback (should not happen in RN)
    return Buffer.from(b64, 'base64').toString('utf-8');
  }

  private encodeBase64(str: string): string {
    if (typeof btoa === 'function') {
      return btoa(str);
    }
    return Buffer.from(str, 'utf-8').toString('base64');
  }

  /**
   * Cleanup — call when done with the driver.
   */
  destroy(): void {
    this.stopScan();
    void this.disconnect();
    this.manager.destroy();
  }

  /**
   * List connected USB serial devices (Android only).
   * Use to populate a connection picker UI before calling connectUsb().
   */
  async listUsbDevices(): Promise<Array<{ deviceId: string; productName?: string; vendorId?: number }>> {
    if (Platform.OS !== 'android') return [];
    const UsbSerial = await loadUsbSerialModule();
    if (!UsbSerial) return [];
    return await UsbSerial.listDevices();
  }
}

// ============================================================================
// USB Serial native module loader
// ============================================================================
/**
 * Lazily load the UsbSerial native module added by `plugins/usb-serial`.
 * Returns null if not available (e.g. iOS, or dev build without the plugin).
 */
async function loadUsbSerialModule(): Promise<any | null> {
  try {
    const mod = await import('NativeModules').then(NativeModules => NativeModules.UsbSerial);
    return mod ?? null;
  } catch {
    return null;
  }
}

// Singleton
let driverInstance: TotalStationDriver | null = null;

export function getTotalStationDriver(): TotalStationDriver {
  if (!driverInstance) {
    driverInstance = new TotalStationDriver();
  }
  return driverInstance;
}
