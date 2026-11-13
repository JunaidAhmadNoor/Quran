import { handle } from '@/server/handlers';
import { preflight } from '@/server/route';

export const GET = handle('adminStats');
export const OPTIONS = preflight;
