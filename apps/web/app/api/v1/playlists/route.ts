import { handle } from '@/server/handlers';
import { preflight } from '@/server/route';

export const GET = handle('listPlaylists');
export const POST = handle('createPlaylist');
export const OPTIONS = preflight;
