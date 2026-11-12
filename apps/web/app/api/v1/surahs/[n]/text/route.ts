import { handle } from '@/server/handlers';
import { preflight } from '@/server/route';

export const GET = handle('getSurahText');
export const OPTIONS = preflight;
