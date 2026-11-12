import { handle } from '@/server/handlers';
import { preflight } from '@/server/route';

export const GET = handle('getPlaylist');
export const PATCH = handle('updatePlaylist');
export const DELETE = handle('deletePlaylist');
export const OPTIONS = preflight;
