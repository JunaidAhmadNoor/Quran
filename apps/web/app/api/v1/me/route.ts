import { handle } from '@/server/handlers';
import { preflight } from '@/server/route';

export const GET = handle('getMe');
export const PATCH = handle('updateMe');
export const DELETE = handle('deleteMe');
export const OPTIONS = preflight;
