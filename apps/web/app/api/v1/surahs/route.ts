import { handle } from '@/server/handlers';
import { preflight } from '@/server/route';

export const GET = handle('listSurahs');
export const OPTIONS = preflight;
