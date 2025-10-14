type TestCase = {
    name: string;
    fn: () => void | Promise<void>;
};

const tests: TestCase[] = [];

export function test(name: string, fn: () => void | Promise<void>) {
    tests.push({ name, fn });
}

export async function run() {
    let failures = 0;

    for (const { name, fn } of tests) {
        try {
            await fn();
            console.log(`✓ ${name}`);
        } catch (error) {
            failures += 1;
            console.error(`✗ ${name}`);
            if (error instanceof Error) {
                console.error(error.stack ?? error.message);
            } else {
                console.error(error);
            }
        }
    }

    if (failures > 0) {
        throw new Error(`${failures} test${failures === 1 ? '' : 's'} failed`);
    }
}
