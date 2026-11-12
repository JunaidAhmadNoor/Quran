// Better Auth endpoints (sign-up, sign-in, OAuth callbacks, sessions, password reset).
import { getContainer } from '@/server/container';

async function handler(request: Request): Promise<Response> {
  const { auth } = await getContainer();
  if (!auth)
    return Response.json(
      { error: { code: 'SERVICE_UNAVAILABLE', message: 'Auth unavailable', details: {} } },
      { status: 503 },
    );
  return auth.handler(request);
}

export { handler as GET, handler as POST };
