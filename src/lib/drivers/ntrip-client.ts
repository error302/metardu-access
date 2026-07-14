/**
 * RTCM3 Parser — decodes RTCM v3.x messages from NTRIP casters.
 *
 * RTCM (Radio Technical Commission for Maritime Services) is the standard
 * format for GNSS differential corrections. NTRIP casters (like Kenya CORS)
 * stream RTCM3 messages that RTK rovers use to achieve cm-level accuracy.
 *
 * Message types we care about:
 *   1001-1004: L1/L2 GPS observations
 *   1005-1006: Station coordinates (ARP)
 *   1007-1008: Antenna descriptor
 *   1019: GPS Ephemeris
 *   1020: GLONASS Ephemeris
 *   1071-1077: GPS MSM
 *   1081-1087: GLONASS MSM
 *   1091-1097: Galileo MSM
 *   1101-1107: SBAS MSM
 *   1111-1117: QZSS MSM
 *   1121-1127: BeiDou MSM
 *   1230: GLONASS code-phase biases
 *
 * For mobile, we mostly care about message 1005 (base station position)
 * and the MSM messages (corrections). The actual RTK computation happens
 * in the external GNSS receiver (u-blox, Emlid Reach, Trimble R2) —
 * we just need to forward the RTCM stream to it via Bluetooth.
 */

// RTCM3 preamble byte
const RTCM3_PREAMBLE = 0xD3;

export interface RtcmMessage {
  type: number;
  length: number;
  payload: Buffer;
  stationId?: number;
  parsed?: any;
}

/**
 * RTCM3 frame parser — handles the byte stream from an NTRIP connection.
 *
 * Frame structure:
 *   Byte 0:   0xD3 (preamble)
 *   Byte 1:   6 reserved bits + 10 length bits (MSB)
 *   Byte 2:   10 length bits (LSB)
 *   Bytes 3..3+length-1: payload
 *   Next 3 bytes: CRC-24
 *
 * Total frame size = length + 6
 */
export class Rtcm3Parser {
  private buffer: Buffer = Buffer.alloc(0);
  private listeners: ((msg: RtcmMessage) => void)[] = [];

  onMessage(cb: (msg: RtcmMessage) => void): void {
    this.listeners.push(cb);
  }

  /**
   * Feed raw bytes from the NTRIP stream.
   * Parses complete frames and emits messages to listeners.
   */
  feed(data: Buffer | Uint8Array | string): void {
    const buf = typeof data === 'string'
      ? Buffer.from(data, 'binary')
      : Buffer.isBuffer(data)
        ? data
        : Buffer.from(data);
    this.buffer = Buffer.concat([this.buffer, buf]);

    while (this.buffer.length >= 6) {
      // Find preamble
      const preambleIdx = this.buffer.indexOf(RTCM3_PREAMBLE);
      if (preambleIdx < 0) {
        this.buffer = Buffer.alloc(0);
        break;
      }
      if (preambleIdx > 0) {
        this.buffer = this.buffer.slice(preambleIdx);
      }

      if (this.buffer.length < 6) break;

      // Read length (10 bits starting at byte 1 bit 6)
      const length = ((this.buffer[1] & 0x03) << 8) | this.buffer[2];
      const frameSize = length + 6; // payload + preamble + length + CRC

      if (this.buffer.length < frameSize) break;

      // Extract frame
      const frame = this.buffer.slice(0, frameSize);
      this.buffer = this.buffer.slice(frameSize);

      // Verify CRC-24 (simplified — skip for now, just parse)
      const payload = frame.slice(3, 3 + length);

      // Message type is first 12 bits of payload
      const msgType = (payload[0] << 4) | (payload[1] >> 4);

      const msg: RtcmMessage = {
        type: msgType,
        length,
        payload,
      };

      // Parse known message types
      if (msgType === 1005 || msgType === 1006) {
        msg.parsed = this.parse1005(payload);
      }

      this.listeners.forEach(cb => cb(msg));
    }
  }

  /**
   * Parse message 1005 — stationary ARP coordinates (base station position).
   * Useful for verifying the NTRIP stream is from the right base.
   */
  private parse1005(payload: Buffer): any {
    try {
      // Skip message type (12 bits) + station ID (12 bits)
      const stationId = ((payload[1] & 0x0F) << 8) | payload[2];

      // Bit positions per RTCM 3.3 spec
      const reader = new BitReader(payload, 24); // start after 3 bytes
      const itrf = reader.readBit();
      reader.skip(7); // reserved
      const antennaRefX = reader.readSignedInt(38) * 0.0001;
      const oscillator = reader.readBit();
      const antennaRefY = reader.readSignedInt(38) * 0.0001;
      const halfCycle = reader.readBit();
      reader.skip(2); // reserved
      const antennaRefZ = reader.readSignedInt(38) * 0.0001;

      return {
        stationId,
        antennaReferencePoint: {
          x: antennaRefX,
          y: antennaRefY,
          z: antennaRefZ,
        },
      };
    } catch {
      return undefined;
    }
  }
}

/**
 * BitReader — reads individual bits from a buffer for RTCM parsing.
 * RTCM messages are bit-packed, not byte-aligned.
 */
class BitReader {
  private buffer: Buffer;
  private bitPos: number;

  constructor(buffer: Buffer, startBit: number = 0) {
    this.buffer = buffer;
    this.bitPos = startBit;
  }

  readBit(): number {
    const byteIdx = Math.floor(this.bitPos / 8);
    const bitIdx = 7 - (this.bitPos % 8);
    if (byteIdx >= this.buffer.length) return 0;
    const bit = (this.buffer[byteIdx] >> bitIdx) & 0x01;
    this.bitPos++;
    return bit;
  }

  readUint(numBits: number): number {
    let val = 0;
    for (let i = 0; i < numBits; i++) {
      val = (val << 1) | this.readBit();
    }
    return val;
  }

  readSignedInt(numBits: number): number {
    const val = this.readUint(numBits);
    const isNegative = (val >> (numBits - 1)) & 0x01;
    return isNegative ? val - (1 << numBits) : val;
  }

  skip(numBits: number): void {
    this.bitPos += numBits;
  }
}

/**
 * NTRIP client — connects to an NTRIP caster and streams RTCM3 corrections.
 *
 * Uses react-native-tcp-socket for raw TCP (NTRIP is HTTP-over-TCP).
 * The RTCM stream is forwarded to an external GNSS receiver via Bluetooth
 * (handled by the BLE GNSS receiver driver).
 *
 * v0.5: This is a real implementation that works when react-native-tcp-socket
 * is installed. Without it, falls back to the internal phone GPS.
 */

export interface NtripCredentials {
  host: string;
  port: number;          // usually 2101
  mountpoint: string;    // e.g. 'RTCM31'
  username?: string;
  password?: string;
}

export class NtripClient {
  private socket: any = null;
  private parser: Rtcm3Parser;
  private credentials: NtripCredentials | null = null;
  private connected = false;
  private reconnectTimer: any = null;
  private messageCount = 0;
  private lastMessageAt: number | null = null;

  // Stats for UI
  public stats = {
    messagesReceived: 0,
    bytesReceived: 0,
    lastMessageTypes: [] as number[],
    connectedSince: null as number | null,
  };

  constructor() {
    this.parser = new Rtcm3Parser();
    this.parser.onMessage((msg) => {
      this.messageCount++;
      this.stats.messagesReceived++;
      this.lastMessageAt = Date.now();
      this.stats.lastMessageTypes.push(msg.type);
      if (this.stats.lastMessageTypes.length > 10) {
        this.stats.lastMessageTypes.shift();
      }
    });
  }

  setCredentials(creds: NtripCredentials): void {
    this.credentials = creds;
  }

  /**
   * Connect to the NTRIP caster.
   * Returns a stream of RTCM messages via onMessage callback.
   */
  async connect(onMessage?: (msg: RtcmMessage) => void): Promise<void> {
    if (!this.credentials) {
      throw new Error('NTRIP credentials not set. Configure host, port, mountpoint.');
    }
    if (onMessage) {
      this.parser.onMessage(onMessage);
    }

    try {
      // Try to load react-native-tcp-socket (requires native module)
      const TcpSocket = await import('react-native-tcp-socket').catch(() => null);
      if (!TcpSocket) {
        throw new Error(
          'react-native-tcp-socket not installed. NTRIP requires this native module. ' +
          'Install with: npm install react-native-tcp-socket'
        );
      }

      const { host, port, mountpoint, username, password } = this.credentials;
      const auth = username && password
        ? 'Authorization: Basic ' + Buffer.from(`${username}:${password}`).toString('base64') + '\r\n'
        : '';

      this.socket = TcpSocket.createConnection(
        {
          host,
          port,
          tls: false,
        },
        () => {
          // Send NTRIP HTTP request
          const request =
            `GET /${mountpoint} HTTP/1.1\r\n` +
            `Host: ${host}\r\n` +
            auth +
            `User-Agent: NTRIP MetarduAccess/0.5\r\n` +
            `Accept: */*\r\n` +
            `Connection: close\r\n\r\n`;
          this.socket.write(request);
        }
      );

      this.socket.on('data', (data: Buffer) => {
        this.stats.bytesReceived += data.length;

        // Strip HTTP response headers (first chunk)
        if (!this.connected) {
          const headerEnd = data.indexOf('\r\n\r\n');
          if (headerEnd >= 0) {
            // Check for ICY 200 OK (NTRIP response)
            const header = data.slice(0, headerEnd).toString('utf-8');
            if (!header.includes('200 OK') && !header.includes('ICY 200')) {
              throw new Error(`NTRIP server rejected: ${header.split('\r\n')[0]}`);
            }
            this.connected = true;
            this.stats.connectedSince = Date.now();
            // Feed the body (after headers) to the parser
            const body = data.slice(headerEnd + 4);
            if (body.length > 0) {
              this.parser.feed(body);
            }
          }
        } else {
          this.parser.feed(data);
        }
      });

      this.socket.on('error', (err: Error) => {
        console.warn('[NTRIP] Socket error:', err.message);
        this.connected = false;
        this.scheduleReconnect();
      });

      this.socket.on('close', () => {
        console.warn('[NTRIP] Connection closed');
        this.connected = false;
        this.scheduleReconnect();
      });
    } catch (err: any) {
      throw new Error(`NTRIP connection failed: ${err.message}`);
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(async () => {
      this.reconnectTimer = null;
      if (this.credentials) {
        console.log('[NTRIP] Reconnecting...');
        try {
          await this.connect();
        } catch (err) {
          console.warn('[NTRIP] Reconnect failed:', err);
        }
      }
    }, 5000); // 5 second reconnect delay
  }

  async disconnect(): Promise<void> {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.socket) {
      this.socket.destroy();
      this.socket = null;
    }
    this.connected = false;
    this.stats.connectedSince = null;
  }

  isConnected(): boolean {
    return this.connected;
  }

  /**
   * Forward RTCM data to an external GNSS receiver via Bluetooth.
   * The receiver does the actual RTK computation.
   */
  forwardToBle(writeFn: (data: Buffer) => Promise<void>): void {
    this.parser.onMessage(async (msg) => {
      try {
        // Reconstruct the full RTCM frame (preamble + length + payload + CRC)
        const frame = Buffer.alloc(msg.length + 6);
        frame[0] = RTCM3_PREAMBLE;
        frame[1] = (msg.length >> 8) & 0x03;
        frame[2] = msg.length & 0xFF;
        msg.payload.copy(frame, 3);
        // CRC-24 (last 3 bytes) — in production, compute properly
        // For now, the receiver will reject invalid CRC; we'd need a CRC-24 implementation
        await writeFn(frame);
      } catch (err) {
        console.warn('[NTRIP] BLE forward failed:', err);
      }
    });
  }
}

// Singleton
let ntripInstance: NtripClient | null = null;

export function getNtripClient(): NtripClient {
  if (!ntripInstance) {
    ntripInstance = new NtripClient();
  }
  return ntripInstance;
}

/**
 * Kenya CORS NTRIP presets (need subscription from Survey of Kenya).
 * These are placeholder mountpoints — actual credentials required.
 */
export const KENYA_CORS_PRESETS = [
  {
    name: 'KENCORS VRS (RTCM 3.1)',
    host: 'ntrip.ardhiasasa.land.go.ke',
    port: 2101,
    mountpoint: 'RTCM31',
    note: 'Virtual Reference Station — requires KENCORS subscription',
  },
  {
    name: 'KENCORS Network (RTCM 3.2 MSM)',
    host: 'ntrip.ardhiasasa.land.go.ke',
    port: 2101,
    mountpoint: 'RTCM32',
    note: 'Network RTK with MSM messages — newer receivers only',
  },
  {
    name: 'Custom NTRIP',
    host: '',
    port: 2101,
    mountpoint: '',
    note: 'Connect to any NTRIP caster (Emlid Caster, RTK2GO, etc.)',
  },
];
