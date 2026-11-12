import { z } from 'zod';
import { IsoDateTime } from '../common';

export const HealthResponse = z
  .object({
    status: z.literal('ok'),
    apiVersion: z.string().meta({ examples: ['1.0.0'] }),
    time: IsoDateTime,
    checks: z.object({ database: z.literal('ok') }),
  })
  .meta({
    id: 'HealthResponse',
    description: 'If the database is unreachable the endpoint returns 503 SERVICE_UNAVAILABLE.',
  });
