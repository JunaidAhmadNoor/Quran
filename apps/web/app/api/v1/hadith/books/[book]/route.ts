import { handle } from '@/server/handlers';
import { preflight } from '@/server/route';

export const GET = handle('getHadithBook');
export const OPTIONS = preflight;
