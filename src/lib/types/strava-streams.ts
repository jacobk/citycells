export type StreamType = 'latlng' | 'time' | 'distance';

export interface StravaStream<T> {
  type: StreamType;
  data: T[];
  series_type: 'time' | 'distance';
  original_size: number;
  resolution: 'low' | 'medium' | 'high';
}

export interface StravaStreamsResponse {
  latlng?: StravaStream<[number, number]>;
  time?: StravaStream<number>;
  distance?: StravaStream<number>;
}

export interface CachedStreams {
  latlng: [number, number][];
  time?: number[];
  distance?: number[];
  fetchedAt: string;
  pointCount: number;
}
