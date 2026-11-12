import { handle } from '@/server/handlers';
import { preflight } from '@/server/route';

export const PUT = handle('switchMode');
export const OPTIONS = preflight;
