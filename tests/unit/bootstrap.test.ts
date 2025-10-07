import { describe, expect, it } from 'vitest';

describe('test harness sanity', () => {
  it('initializes jsdom environment', () => {
    const div = document.createElement('div');
    div.id = 'fixture';

    document.body.append(div);

    expect(document.getElementById('fixture')).toBe(div);
    div.remove();
  });
});
