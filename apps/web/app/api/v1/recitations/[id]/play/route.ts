import { handle } from '@/server/handlers';
import { preflight } from '@/server/route';

export const POST = handle('recordPlay');
export const OPTIONS = preflight;
