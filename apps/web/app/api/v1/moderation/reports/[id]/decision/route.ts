import { handle } from '@/server/handlers';
import { preflight } from '@/server/route';

export const POST = handle('decideReport');
export const OPTIONS = preflight;
