import { registerAs } from '@nestjs/config';
import { milliseconds } from 'date-fns';

export interface CacheConfig {
  ttl: number;
  max: number;
  store: string;
  isGlobal: boolean;
}

export const cacheConfig = registerAs(
  'cache',
  (): CacheConfig => ({
    ttl: parseInt(process.env.CACHE_TTL || milliseconds({ minutes: 1 }).toString(), 10),
    max: parseInt(process.env.CACHE_MAX_ITEMS || '100', 10),
    store: process.env.CACHE_STORE || 'memory',
    isGlobal: process.env.CACHE_IS_GLOBAL !== 'false', // default true
  }),
);
