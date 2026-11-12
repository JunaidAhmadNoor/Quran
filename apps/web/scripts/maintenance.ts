// Daily job (Railway cron): purge due audio and report database size against the 512 MB budget.
import { databaseStats } from '@tilawah/db';
import { getContainer } from '../server/container';

const BUDGET_BYTES = 512 * 1024 * 1024;

const { core, database } = await getContainer();
if (!database) throw new Error('Container has no database');
const { purged } = await core.maintenance.purgeAudio();
const { totalBytes } = await databaseStats(database);
const mb = (n: number) => (n / 1024 / 1024).toFixed(1);
console.warn(
  `maintenance: purged audio for ${purged} recitations; database ${mb(totalBytes)} MB of ${mb(BUDGET_BYTES)} MB`,
);
if (totalBytes > BUDGET_BYTES * 0.8)
  console.error('maintenance: database is above 80% of the free-tier limit');
await database.close();
