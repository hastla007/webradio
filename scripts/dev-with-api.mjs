#!/usr/bin/env node
import { spawn } from 'node:child_process';
import process from 'node:process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const viteArgs = process.argv.slice(2).filter(arg => arg !== '--');
const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';

console.log('Starting API server on port 4000…');
const serverProcess = spawn(process.execPath, ['index.js'], {
    cwd: path.resolve(__dirname, '../server'),
    stdio: 'inherit',
    env: {
        ...process.env,
    },
});

console.log('Starting Vite dev server…');
const viteProcess = spawn(npmCommand, ['run', 'dev:ui', '--', ...viteArgs], {
    cwd: path.resolve(__dirname, '..'),
    stdio: 'inherit',
    env: {
        ...process.env,
    },
    shell: process.platform === 'win32',
});

const children = [serverProcess, viteProcess];
let exiting = false;

const shutdown = (code = 0) => {
    if (exiting) {
        return;
    }
    exiting = true;
    for (const child of children) {
        if (child && !child.killed) {
            try {
                child.kill('SIGTERM');
            } catch (error) {
                console.error('Failed to terminate child process', error);
            }
        }
    }
    setTimeout(() => {
        for (const child of children) {
            if (child && !child.killed) {
                try {
                    child.kill('SIGKILL');
                } catch {
                    // ignore
                }
            }
        }
        process.exit(code);
    }, 500);
};

const handleChildExit = (name, code, signal) => {
    if (exiting) {
        return;
    }
    if (code !== 0) {
        console.error(`${name} exited with code ${code ?? 'null'}${signal ? ` (signal ${signal})` : ''}`);
    }
    shutdown(code ?? 0);
};

serverProcess.on('exit', (code, signal) => handleChildExit('API server', code, signal));
serverProcess.on('error', error => {
    console.error('Failed to start API server', error);
    shutdown(1);
});

viteProcess.on('exit', (code, signal) => handleChildExit('Vite dev server', code, signal));
viteProcess.on('error', error => {
    console.error('Failed to start Vite dev server', error);
    shutdown(1);
});

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));
