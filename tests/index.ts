import { run } from './harness';
import './api.test';
import './stationLogos.test';
import './localDataStore.test';
import './serverExport.test';

run().catch(error => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
});
