import { handle } from '@/server/handlers';
import { preflight } from '@/server/route';

export const POST = handle('decideRecitation');
export const OPTIONS = preflight;
