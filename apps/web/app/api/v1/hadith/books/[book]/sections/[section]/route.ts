import { handle } from '@/server/handlers';
import { preflight } from '@/server/route';

export const GET = handle('getHadithSection');
export const OPTIONS = preflight;
