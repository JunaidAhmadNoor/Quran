import { setupServer } from 'msw/node';

/** API mock for component tests. Each test adds the handlers it needs. */
export const server = setupServer();
