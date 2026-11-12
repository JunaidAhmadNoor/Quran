import { handle } from '@/server/handlers';
import { preflight } from '@/server/route';

export const GET = handle('getModerationQueue');
export const OPTIONS = preflight;
