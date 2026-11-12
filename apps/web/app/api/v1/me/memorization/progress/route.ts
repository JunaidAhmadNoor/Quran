import { handle } from '@/server/handlers';
import { preflight } from '@/server/route';

export const GET = handle('getMemorizationProgress');
export const OPTIONS = preflight;
