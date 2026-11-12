import { handle } from '@/server/handlers';
import { preflight } from '@/server/route';

export const GET = handle('getRecitation');
export const PATCH = handle('updateRecitation');
export const DELETE = handle('deleteRecitation');
export const OPTIONS = preflight;
