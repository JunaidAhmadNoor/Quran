import { handle } from '@/server/handlers';
import { preflight } from '@/server/route';

export const GET = handle('getLibrary');
export const OPTIONS = preflight;
