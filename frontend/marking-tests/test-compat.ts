import { test as base, expect } from '@playwright/test';

// The reference tests use only Bun's table-driven test registration and standard assertions.
const test = Object.assign(
  (name: string, body: (...args: any[]) => unknown) => base(name, async () => { await body(); }),
  { each: (cases: readonly unknown[]) => (name: string, body: (...args: any[]) => unknown) => {
    cases.forEach((value, index) => base(`${name} [${index + 1}: ${JSON.stringify(value)}]`, async () => {
      await body(...(Array.isArray(value) ? value : [value]));
    }));
  } },
);
const describe = base.describe;
export { test, describe, expect };
