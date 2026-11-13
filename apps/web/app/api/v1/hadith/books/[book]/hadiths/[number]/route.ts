import { handle } from '@/server/handlers';
import { preflight } from '@/server/route';

export const GET = handle('getHadith');
export const OPTIONS = preflight;
