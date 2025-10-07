import type { Page } from '@playwright/test';

export async function installDeterministicRng(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const pool = new Uint32Array([0x12345678, 0x9abcdef0, 0xdeadbeef, 0xcafebabe]);
    let index = 0;
    const nextValue = () => {
      const value = pool[index % pool.length];
      index += 1;
      return value >>> 0;
    };

    if (typeof globalThis.crypto === 'undefined') {
      Object.defineProperty(globalThis, 'crypto', {
        value: {},
        configurable: true,
      });
    }

    Object.defineProperty(globalThis.crypto, 'getRandomValues', {
      value(array: ArrayBufferView) {
        if (array instanceof Uint8Array) {
          for (let i = 0; i < array.length; i += 1) {
            array[i] = nextValue() & 0xff;
          }
          return array;
        }
        if (array instanceof Uint16Array) {
          for (let i = 0; i < array.length; i += 1) {
            array[i] = nextValue() & 0xffff;
          }
          return array;
        }
        if (array instanceof Uint32Array) {
          for (let i = 0; i < array.length; i += 1) {
            array[i] = nextValue();
          }
          return array;
        }
        throw new TypeError('Expected unsigned integer typed array');
      },
      configurable: true,
    });
  });
}
