
const suites = [];
let currentSuite = null;

export function describe(name, fn) {
    const suite = { name, tests: [] };
    const previousSuite = currentSuite;
    currentSuite = suite;
    fn();
    suites.push(suite);
    currentSuite = previousSuite;
}

export function it(name, fn) {
    if (currentSuite) {
        currentSuite.tests.push({ name, fn });
    } else {
        suites.push({ name: 'Global', tests: [{ name, fn }] });
    }
}

export function expect(actual) {
    return {
        toBe: (expected) => {
            if (actual !== expected) {
                throw new Error(`Expected ${actual} to be ${expected}`);
            }
        },
        toEqual: (expected) => {
            if (JSON.stringify(actual) !== JSON.stringify(expected)) {
                throw new Error(`Expected ${JSON.stringify(actual)} to equal ${JSON.stringify(expected)}`);
            }
        },
        toBeGreaterThan: (expected) => {
            if (!(actual > expected)) {
                throw new Error(`Expected ${actual} to be greater than ${expected}`);
            }
        },
        toBeLessThan: (expected) => {
            if (!(actual < expected)) {
                throw new Error(`Expected ${actual} to be less than ${expected}`);
            }
        },
        toBeDefined: () => {
            if (actual === undefined) {
                throw new Error(`Expected ${actual} to be defined`);
            }
        }
    };
}

export async function run() {
    const output = document.getElementById('output');
    if (!output) return;

    let passed = 0;
    let failed = 0;

    for (const suite of suites) {
        log(`Suite: ${suite.name}`, 'suite-header');
        for (const test of suite.tests) {
            try {
                await test.fn();
                log(`  ✔ ${test.name}`, 'pass');
                passed++;
            } catch (e) {
                log(`  ✘ ${test.name}: ${e.message}`, 'fail');
                console.error(e);
                failed++;
            }
        }
    }

    log(`\nTotal: ${passed} passed, ${failed} failed`, failed > 0 ? 'fail' : 'pass');
}

function log(text, className) {
    const div = document.createElement('div');
    div.textContent = text;
    if (className) div.className = className;
    document.getElementById('output').appendChild(div);
}
