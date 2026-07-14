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
export type ProtocolFormat = 'gsi' | 'jobxml' | 'rw5' | 'sdr' | 'nikon_raw' | 'ascii';

export interface Instrument {
  id: string;
  name: string;
  brand: InstrumentBrand;
  model?: string;
  serialNumber?: string;
  protocol: ProtocolFormat;
  rssi?: number;
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
    } else if (name.includes('topcon') || name.includes('gt') || name.includes('gpt')) {
      brand = 'topcon';
      protocol = 'rw5';
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
   * Connect to a specific instrument.
   */
  async connect(instrumentId: string): Promise<void> {
    this.connectedDevice = await this.manager.connectToDevice(instrumentId);
    await this.connectedDevice.discoverAllServicesAndCharacteristics();
    this.isConnected = true;
  }

  /**
   * Disconnect from the current instrument.
   */
  async disconnect(): Promise<void> {
    if (this.connectedDevice) {
      await this.manager.cancelDeviceConnection(this.connectedDevice.id);
      this.connectedDevice = null;
      this.isConnected = false;
    }
  }

  /**
   * Listen for incoming measurements from the instrument.
   * The protocol parser converts raw BLE bytes to ObservationReading objects.
   */
  async subscribeToMeasurements(
    onReading: (reading: ObservationReading) => void
  ): Promise<void> {
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
}

// Singleton
let driverInstance: TotalStationDriver | null = null;

export function getTotalStationDriver(): TotalStationDriver {
  if (!driverInstance) {
    driverInstance = new TotalStationDriver();
  }
  return driverInstance;
}
