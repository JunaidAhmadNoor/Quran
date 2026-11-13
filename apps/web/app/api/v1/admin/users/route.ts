import { handle } from '@/server/handlers';
import { preflight } from '@/server/route';

export const GET = handle('listUsers');
export const OPTIONS = preflight;
