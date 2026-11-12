import { handle } from '@/server/handlers';
import { preflight } from '@/server/route';

export const POST = handle('presignUpload');
export const OPTIONS = preflight;
