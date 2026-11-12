import { handle } from '@/server/handlers';
import { preflight } from '@/server/route';

export const PATCH = handle('updateUser');
export const OPTIONS = preflight;
