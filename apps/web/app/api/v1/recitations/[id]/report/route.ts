import { handle } from '@/server/handlers';
import { preflight } from '@/server/route';

export const POST = handle('reportRecitation');
export const OPTIONS = preflight;
