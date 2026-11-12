import { handle } from '@/server/handlers';
import { preflight } from '@/server/route';

export const GET = handle('getSurah');
export const OPTIONS = preflight;
