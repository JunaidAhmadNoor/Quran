import { handle } from '@/server/handlers';
import { preflight } from '@/server/route';

export const GET = handle('searchHadith');
export const OPTIONS = preflight;
