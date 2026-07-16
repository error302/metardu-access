/**
 * Metardu Industrial connector — syncs field data to Metardu Industrial
 * (the industrial / heavy-equipment surveying variant).
 *
 * Metardu Industrial is the fourth pillar of the ecosystem:
 *   - metardu (web) — multi-user SaaS, NLIMS submission
 *   - metardu-desktop — office workstation, deed plans, statutory forms
 *   - metardu-access (this app) — mobile field capture
 *   - metardu-industrial — heavy industrial sites: mines, construction,
 *     deformation monitoring, large-scale engineering
 *
 * Industrial sync differs from regular sync:
 *   - Higher frequency (deformation monitoring needs 1-minute updates)
 *   - Larger datasets (point clouds, scan data)
 *   - Different regulatory framework (mining regs, not cadastral)
 *   - Often air-gapped (industrial sites may not allow internet)
 *   - Requires equipment integration (laser scanners, total stations
 *     with continuous monitoring)
 *
 * v0.6: Connector scaffold. Real implementation requires the industrial
 * server to be deployed and an API contract agreed upon.
 */

import { getSyncEngine } from '@/lib/sync/engine';

export type IndustrialSiteType =
  | 'mine-open-pit'
  | 'mine-underground'
  | 'construction-site'
  | 'deformation-monitoring'
  | 'tunnel'
  | 'dam'
  | 'bridge'
  | 'tower';

export interface IndustrialSite {
  id: string;
  name: string;
  type: IndustrialSiteType;
  operator: string;
  projectManager: string;
  safetyContact: string;
  coordinates: { lat: number; lng: number };
  areaSqKm: number;
  monitoringFrequency: 'realtime' | 'hourly' | 'daily' | 'weekly';
  lastSyncAt?: string;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
}

export interface DeformationReading {
  id: string;
  siteId: string;
  pointId: string;
  timestamp: string;
  easting: number;
  northing: number;
  elevation: number;
  displacementMm: {
    north?: number;
    east?: number;
    up?: number;
  };
  alarmLevel: 'normal' | 'advisory' | 'warning' | 'critical';
}

export class IndustrialConnector {
  private industrialApiUrl: string | null = null;
  private apiKey: string | null = null;

  configure(opts: { industrialApiUrl?: string; apiKey?: string }): void {
    this.industrialApiUrl = opts.industrialApiUrl ?? null;
    this.apiKey = opts.apiKey ?? null;
  }

  async pushDeformationReading(reading: DeformationReading): Promise<{ ok: boolean; error?: string }> {
    if (!this.industrialApiUrl || !this.apiKey) {
      const engine = getSyncEngine();
      if (!engine.hasCredentials()) {
        return { ok: false, error: 'No industrial or regular sync server configured' };
      }
      try {
        const url = (engine as any).apiUrl.replace(/\/sync\/?$/, '') + '/industrial/deformation';
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${(engine as any).apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(reading),
        });
        return { ok: response.ok };
      } catch (err: any) {
        return { ok: false, error: err.message };
      }
    }

    try {
      const response = await fetch(`${this.industrialApiUrl}/deformation`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(reading),
      });
      return { ok: response.ok };
    } catch (err: any) {
      return { ok: false, error: err.message };
    }
  }

  async listSites(): Promise<IndustrialSite[]> {
    return [];
  }

  getAlarmThresholds(siteType: IndustrialSiteType): {
    advisoryMm: number;
    warningMm: number;
    criticalMm: number;
  } {
    switch (siteType) {
      case 'dam':
        return { advisoryMm: 5, warningMm: 15, criticalMm: 30 };
      case 'tunnel':
        return { advisoryMm: 3, warningMm: 10, criticalMm: 25 };
      case 'mine-underground':
        return { advisoryMm: 2, warningMm: 8, criticalMm: 20 };
      case 'mine-open-pit':
        return { advisoryMm: 10, warningMm: 30, criticalMm: 60 };
      case 'bridge':
        return { advisoryMm: 2, warningMm: 5, criticalMm: 12 };
      case 'tower':
        return { advisoryMm: 1, warningMm: 3, criticalMm: 8 };
      default:
        return { advisoryMm: 5, warningMm: 15, criticalMm: 30 };
    }
  }

  requiresRealtime(site: IndustrialSite): boolean {
    return site.monitoringFrequency === 'realtime';
  }
}

let industrialInstance: IndustrialConnector | null = null;

export function getIndustrialConnector(): IndustrialConnector {
  if (!industrialInstance) {
    industrialInstance = new IndustrialConnector();
  }
  return industrialInstance;
}

export const INDUSTRIAL_SITE_TYPES: {
  value: IndustrialSiteType;
  label: string;
  icon: string;
  color: string;
  description: string;
}[] = [
  { value: 'mine-open-pit', label: 'Open-Pit Mine', icon: 'excavator', color: '#A16207', description: 'Slope stability · volumetrics · bench monitoring' },
  { value: 'mine-underground', label: 'Underground Mine', icon: 'pickaxe', color: '#7C2D12', description: 'Tunnel convergence · rockbolt strain' },
  { value: 'construction-site', label: 'Construction Site', icon: 'crane', color: '#3B82F6', description: 'Setting out · as-built · progress monitoring' },
  { value: 'deformation-monitoring', label: 'Deformation Monitoring', icon: 'chart-line-variant', color: '#EF4444', description: 'Landslides · structures · long-term movement' },
  { value: 'tunnel', label: 'Tunnel', icon: 'tunnel', color: '#525252', description: 'Convergence · settlement · lining stress' },
  { value: 'dam', label: 'Dam', icon: 'dam', color: '#0891B2', description: 'Structural · seepage · crest settlement' },
  { value: 'bridge', label: 'Bridge', icon: 'bridge', color: '#7C3AED', description: 'Deck deflection · pier tilt · cable tension' },
  { value: 'tower', label: 'Tower', icon: 'radio-tower', color: '#9333EA', description: 'Tilt · sway · vibration' },
];
