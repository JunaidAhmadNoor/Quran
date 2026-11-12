import { handle } from '@/server/handlers';
import { preflight } from '@/server/route';

export const GET = handle('listRecitations');
export const POST = handle('createRecitation');
export const OPTIONS = preflight;
