/**
 * @metardu/engine — shared types
 */

export interface Observation {
  id: string;
  fromPoint: string;
  toPoint: string;
  rawHorizontalAngle?: number;
  rawVerticalAngle?: number;
  rawSlopeDistance?: number;
  face: 'left' | 'right';
  timestamp: string;
}

export interface Point2D {
  easting: number;
  northing: number;
}

export interface Point3D extends Point2D {
  elevation: number;
}
