// Zod 4 probes `Function("")` to decide whether it may JIT-compile validators. Our CSP forbids
// eval, so the probe would log a violation; jitless mode skips it (validation is unchanged).
import { z } from 'zod';

z.config({ jitless: true });
