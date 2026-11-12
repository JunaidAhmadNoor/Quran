import { handle } from '@/server/handlers';
import { preflight } from '@/server/route';

export const GET = handle('listMyRecitations');
export const OPTIONS = preflight;
