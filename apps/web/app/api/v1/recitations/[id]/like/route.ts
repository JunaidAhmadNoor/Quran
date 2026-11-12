import { handle } from '@/server/handlers';
import { preflight } from '@/server/route';

export const POST = handle('likeRecitation');
export const DELETE = handle('unlikeRecitation');
export const OPTIONS = preflight;
