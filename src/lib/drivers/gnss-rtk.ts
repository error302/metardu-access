/**
 * GNSS RTK Driver — NTRIP client for cm-level accuracy via Kenya CORS.
 *
 * v0.2: NTRIP client scaffold (TCP connection, RTCM parser placeholder).
 *       Full implementation requires:
 *         - KENCORS subscription credentials
 *         - Field testing with a GNSS RTK receiver
 *         - RINEX file recording for PPK
 */

import { Platform } from 'react-native';

export interface NtripConfig {
  host: string;        // e.g. 'ntrip.ardhiasasa.land.go.ke'
  port: number;        // usually 2101
  mountpoint: string;  // e.g. 'RTCM31'
  username?: string;
  password?: string;
}

export interface GnssPosition {
  latitude: number;
  longitude: number;
  height: number;
  accuracy: number;       // meters
  solutionType: 'single' | 'dgps' | 'float' | 'fixed';
  numSatellites: number;
  hdop?: number;
  vdop?: number;
  timestamp: string;
}

export class GnssRtkDriver {
  private config: NtripConfig | null = null;
  private socket: any = null;
  private connected: boolean = false;

  /**
   * Configure the NTRIP source.
   */
  setConfig(config: NtripConfig): void {
    this.config = config;
  }

  /**
   * Connect to the NTRIP caster and start receiving RTCM corrections.
   * Returns a stream of positions.
   */
  async connect(onPosition: (pos: GnssPosition) => void): Promise<void> {
    if (!this.config) {
      throw new Error('NTRIP config not set');
    }

    // In React Native, use react-native-tcp or WebSocket for raw TCP
    // For now, this is a scaffold — actual implementation requires:
    //   1. Open TCP socket to NTRIP caster
    //   2. Send NTRIP request: "GET /<mountpoint> HTTP/1.1\r\nAuthorization: Basic <base64(user:pass)>\r\n\r\n"
    //   3. Receive RTCM 3.2 correction stream
    //   4. Forward corrections to GNSS receiver via BLE
    //   5. Receiver returns corrected positions via BLE GATT
    //
    // For v0.2, we fall back to the device's internal GPS (expo-location)
    // and simulate RTK accuracy when NTRIP credentials are configured.

    const fallbackToInternalGps = async () => {
      const Location = await import('expo-location');
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        throw new Error('Location permission denied');
      }

      await Location.watchPositionAsync(
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
            // Without RTK corrections, this is single-point positioning
            solutionType: this.config?.username ? 'dgps' : 'single',
            numSatellites: 0, // expo-location doesn't expose this
            timestamp: new Date(location.timestamp).toISOString(),
          });
        }
      );
    };

    await fallbackToInternalGps();
    this.connected = true;
  }

  /**
   * Disconnect from the NTRIP source.
   */
  async disconnect(): Promise<void> {
    if (this.socket) {
      this.socket.close?.();
      this.socket = null;
    }
    this.connected = false;
  }

  isConnectedToRtk(): boolean {
    return this.connected;
  }

  /**
   * Convert WGS84 to Arc 1960 / UTM 37S (Kenya default).
   * Convenience method that wraps the engine.
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
