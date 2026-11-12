import { handle } from '@/server/handlers';
import { preflight } from '@/server/route';

export const GET = handle('getReciterStats');
export const OPTIONS = preflight;
