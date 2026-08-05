/**
 * GNSS RTK Driver — connects to external GNSS receivers via Bluetooth
 * and feeds them NTRIP corrections for cm-level accuracy.
 *
 * Supported receivers (roadmap):
 *   - u-blox C099-F9P, ZED-F9P
 *   - Emlid Reach RS2+, Reach M2
 *   - Trimble R2, R10
 *   - Septentrio AsterX-i2
 *
 * Workflow:
 *   1. Surveyor pairs GNSS receiver via Bluetooth (in OS settings)
 *   2. App scans for the receiver via BLE
 *   3. App connects to NTRIP caster (KENCORS or custom)
 *   4. App forwards RTCM3 stream from NTRIP to receiver via BLE
 *   5. Receiver computes RTK solution, sends position back via BLE
 *   6. App displays cm-level position
 *
 * Without external receiver: falls back to internal phone GPS (3-5m accuracy)
 */

import { Platform } from 'react-native';
import { getNtripClient, type NtripCredentials } from './ntrip-client';

export interface GnssSatelliteStatus {
  totalInView: number;
  avgSnr: number;
  timestamp: string;
}

export interface GnssPosition {
  latitude: number;
  longitude: number;
  height: number;
  accuracy: number;       // meters
  solutionType: 'single' | 'dgps' | 'float' | 'fixed';
  numSatellites: number;
  satellitesInView?: number;
  avgSnr?: number;        // Signal-to-Noise Ratio (dB-Hz)
  hdop?: number;
  vdop?: number;
  timestamp: string;
  receiver?: string;       // name of external receiver (if connected)
}

export interface GnssReceiver {
  id: string;
  name: string;
  brand: 'u-blox' | 'emlid' | 'trimble' | 'septentrio' | 'generic';
  model?: string;
  rssi?: number;
}

// Common BLE service UUIDs for GNSS receivers
const BLE_SERVICES = {
  nordicUart: '6e400001-b5a3-f393-e0a9-e50e24dcca9e',
  nordicUartTx: '6e400002-b5a3-f393-e0a9-e50e24dcca9e',
  nordicUartRx: '6e400003-b5a3-f393-e0a9-e50e24dcca9e',
  ublox: '0000fe01-0000-1000-8000-00805f9b34fb',
};

export class GnssRtkDriver {
  private ntrip = getNtripClient();
  private bleManager: any = null;
  private connectedReceiver: any = null;
  private positionListeners: ((pos: GnssPosition) => void)[] = [];
  private satelliteListeners: ((status: GnssSatelliteStatus) => void)[] = [];
  private ntripCredentials: NtripCredentials | null = null;
  private watchSubscription: any = null;

  /**
   * Configure the NTRIP source.
   */
  setNtripCredentials(creds: NtripCredentials): void {
    this.ntripCredentials = creds;
    this.ntrip.setCredentials(creds);
  }

  getNtripClient() {
    return this.ntrip;
  }

  /**
   * Scan for BLE GNSS receivers.
   * Returns a stream of discovered devices.
   */
  async scanForReceivers(
    onReceiverFound: (receiver: GnssReceiver) => void,
    durationMs: number = 10000
  ): Promise<void> {
    try {
      const BleModule = await import('react-native-ble-plx').catch(() => null);
      if (!BleModule || !BleModule.BleManager) {
        throw new Error('BLE module not available. Install react-native-ble-plx.');
      }
      this.bleManager = new BleModule.BleManager();

      this.bleManager.startDeviceScan(
        null,
        { allowDuplicates: false },
        (error: any, device: any) => {
          if (error || !device?.name) return;
          const receiver = this.identifyReceiver(device);
          if (receiver) {
            onReceiverFound(receiver);
          }
        }
      );

      setTimeout(() => this.stopScan(), durationMs);
    } catch (err: any) {
      throw new Error(`BLE scan failed: ${err.message}`);
    }
  }

  stopScan(): void {
    if (this.bleManager) {
      this.bleManager.stopDeviceScan();
    }
  }

  private identifyReceiver(device: any): GnssReceiver | null {
    const name = (device.name ?? '').toLowerCase();
    let brand: GnssReceiver['brand'] = 'generic';

    if (name.includes('reach') || name.includes('emlid')) {
      brand = 'emlid';
    } else if (name.includes('u-blox') || name.includes('zed-f9p') || name.includes('c099')) {
      brand = 'u-blox';
    } else if (name.includes('trimble') || name.includes('r2') || name.includes('r10')) {
      brand = 'trimble';
    } else if (name.includes('septentrio') || name.includes('asterx')) {
      brand = 'septentrio';
    } else if (!device.name) {
      return null;
    } else {
      return null; // Only show known receivers in scan results
    }

    return {
      id: device.id,
      name: device.name,
      brand,
      rssi: device.rssi ?? undefined,
    };
  }

  /**
   * Connect to a specific GNSS receiver.
   */
  async connectReceiver(receiver: GnssReceiver): Promise<void> {
    if (!this.bleManager) {
      throw new Error('BLE manager not initialized. Scan first.');
    }
    this.connectedReceiver = await this.bleManager.connectToDevice(receiver.id);
    await this.connectedReceiver.discoverAllServicesAndCharacteristics();

    // If NTRIP credentials are set, forward RTCM to the receiver
    if (this.ntripCredentials) {
      await this.ntrip.connect();
      this.ntrip.forwardToBle(async (data) => {
        await this.connectedReceiver.writeCharacteristicWithResponseForService(
          BLE_SERVICES.nordicUart,
          BLE_SERVICES.nordicUartTx,
          data.toString('base64')
        );
      });
    }

    // Subscribe to position messages from the receiver
    // Receivers send NMEA sentences (GGA, RMC, etc.) via the Nordic UART RX characteristic
      await this.connectedReceiver.monitorCharacteristicForService(
        BLE_SERVICES.nordicUart,
        BLE_SERVICES.nordicUartRx,
        (error: any, characteristic: any) => {
          if (error || !characteristic?.value) return;
          const text = base64ToUtf8(characteristic.value);
          const position = this.parseNmea(text);
          if (position) {
            this.positionListeners.forEach(cb => cb(position));
          }
        }
      );
  }

  /**
   * Parse NMEA sentences from the GNSS receiver.
   * Handles GGA (position with quality), RMC (status), GSA (DOP).
   */
  private parseNmea(sentence: string): GnssPosition | null {
    const trimmed = sentence.trim();
    if (!trimmed.startsWith('$')) return null;

    const parts = trimmed.split('*')[0].split(',');
    const type = parts[0];

    if (type === '$GPGGA' || type === '$GNGGA') {
      // ... existing GGA parsing ...
      const time = parts[1];
      const lat = this.parseNmeaLat(parts[2], parts[3]);
      const lng = this.parseNmeaLng(parts[4], parts[5]);
      const quality = parseInt(parts[6] ?? '0');
      const sats = parseInt(parts[7] ?? '0');
      const hdop = parseFloat(parts[8] ?? '0');
      const height = parseFloat(parts[9] ?? '0');

      if (lat == null || lng == null) return null;

      const solutionType: GnssPosition['solutionType'] =
        quality === 4 ? 'fixed' :
        quality === 5 ? 'float' :
        quality === 2 ? 'dgps' :
        'single';

      return {
        latitude: lat,
        longitude: lng,
        height,
        accuracy: hdop * 3, // rough conversion
        solutionType,
        numSatellites: sats,
        hdop,
        timestamp: new Date().toISOString(),
        receiver: this.connectedReceiver?.name,
      };
    }

    if (type.endsWith('GSV')) {
      // GSV: Satellites in view
      const totalSats = parseInt(parts[3] ?? '0');
      let snrSum = 0;
      let snrCount = 0;
      for (let i = 7; i < parts.length; i += 4) {
        const snr = parseInt(parts[i]);
        if (!isNaN(snr) && snr > 0) {
          snrSum += snr;
          snrCount++;
        }
      }
      const status: GnssSatelliteStatus = {
        totalInView: totalSats,
        avgSnr: snrCount > 0 ? snrSum / snrCount : 0,
        timestamp: new Date().toISOString(),
      };
      this.satelliteListeners.forEach(cb => cb(status));
      return null;
    }

    return null;
  }

  private parseNmeaLat(value: string, dir: string): number | null {
    if (!value) return null;
    const deg = parseInt(value.slice(0, 2));
    const min = parseFloat(value.slice(2));
    const lat = deg + min / 60;
    return dir === 'S' ? -lat : lat;
  }

  private parseNmeaLng(value: string, dir: string): number | null {
    if (!value) return null;
    const deg = parseInt(value.slice(0, 3));
    const min = parseFloat(value.slice(3));
    const lng = deg + min / 60;
    return dir === 'W' ? -lng : lng;
  }

  /**
   * Subscribe to position updates.
   */
  onPosition(cb: (pos: GnssPosition) => void): () => void {
    this.positionListeners.push(cb);
    return () => {
      this.positionListeners = this.positionListeners.filter(l => l !== cb);
    };
  }

  /**
   * Subscribe to satellite status updates (from GSV sentences).
   */
  onSatelliteStatus(cb: (status: GnssSatelliteStatus) => void): () => void {
    this.satelliteListeners.push(cb);
    return () => {
      this.satelliteListeners = this.satelliteListeners.filter(l => l !== cb);
    };
  }

  /**
   * Start position updates.
   * If an external receiver is connected, uses it. Otherwise falls back to
   * the phone's internal GPS via expo-location.
   */
  async startPositionUpdates(onPosition: (pos: GnssPosition) => void): Promise<void> {
    // If we have an external receiver, use it
    if (this.connectedReceiver) {
      this.onPosition(onPosition);
      return;
    }

    // Fallback to internal GPS
    const Location = await import('expo-location');
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      throw new Error('Location permission denied');
    }

    this.watchSubscription = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.BestForNavigation,
        timeInterval: 1000,
        distanceInterval: 0.5,
      },
      (location) => {
        onPosition({
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
          height: location.coords.altitude ?? 0,
          accuracy: location.coords.accuracy ?? 10,
          solutionType: 'single', // Phone GPS is always single-point
          numSatellites: 0,
          timestamp: new Date(location.timestamp).toISOString(),
        });
      }
    );
  }

  async stopPositionUpdates(): Promise<void> {
    this.positionListeners = [];
    if (this.watchSubscription) {
      this.watchSubscription.remove();
      this.watchSubscription = null;
    }
  }

  /**
   * Disconnect from receiver and NTRIP.
   */
  async disconnect(): Promise<void> {
    await this.stopPositionUpdates();
    await this.ntrip.disconnect();
    if (this.connectedReceiver) {
      try {
        await this.bleManager.cancelDeviceConnection(this.connectedReceiver.id);
      } catch {}
      this.connectedReceiver = null;
    }
  }

  isConnectedToReceiver(): boolean {
    return this.connectedReceiver !== null;
  }

  isNtripConnected(): boolean {
    return this.ntrip.isConnected();
  }

  /**
   * Convert WGS84 to Arc 1960 / UTM 37S (Kenya default).
   */
  async convertToKenyaUtm(pos: GnssPosition): Promise<{ easting: number; northing: number; elevation: number }> {
    const { wgs84ToArc1960Utm37S } = await import('@engine/transforms');
    const utm = wgs84ToArc1960Utm37S({
      lat: pos.latitude,
      lng: pos.longitude,
    });
    return {
      easting: utm.easting,
      northing: utm.northing,
      elevation: pos.height,
    };
  }
}

// Singleton
let gnssInstance: GnssRtkDriver | null = null;

export function getGnssRtkDriver(): GnssRtkDriver {
  if (!gnssInstance) {
    gnssInstance = new GnssRtkDriver();
  }
  return gnssInstance;
}

// ============================================================================
// Helpers — base64 <-> UTF-8 (Buffer.from is not available in RN runtime)
// Matches the pattern used in drivers/total-station.ts
// ============================================================================
function base64ToUtf8(b64: string): string {
  if (typeof atob === 'function') {
    return atob(b64);
  }
  // Fallback (dev/Node only)
  return Buffer.from(b64, 'base64').toString('utf-8');
}
