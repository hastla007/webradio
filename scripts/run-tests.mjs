import { build } from 'esbuild';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const tempDir = mkdtempSync(path.join(tmpdir(), 'webradio-tests-'));
const outfile = path.join(tempDir, 'tests.mjs');

async function run() {
    try {
        await build({
            entryPoints: ['tests/index.ts'],
            bundle: true,
            outfile,
            platform: 'node',
            target: ['node18'],
            format: 'esm',
            sourcemap: 'inline',
        });

        const result = spawnSync(process.execPath, [outfile], { stdio: 'inherit' });
        if (typeof result.status === 'number') {
            process.exitCode = result.status;
        } else if (result.error) {
            throw result.error;
        }
    } catch (error) {
        console.error(error);
        process.exitCode = 1;
    } finally {
        rmSync(tempDir, { recursive: true, force: true });
    }
}

run();
