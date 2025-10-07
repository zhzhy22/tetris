import { describe, expect, it, vi, beforeEach } from 'vitest';

import { createSfxManager, type SfxManager } from '../../../src/audio/sfx';

declare global {
  interface AudioBuffer {}
}

class FakeGainNode {
  public gain = { value: 1 };
  public connect = vi.fn();
  public disconnect = vi.fn();
}

class FakeAudioBufferSourceNode {
  public buffer: AudioBuffer | null = null;
  public connect = vi.fn();
  public start = vi.fn();
  public stop = vi.fn();
}

class FakeAudioContext {
  public state: AudioContextState = 'suspended';
  public destination: AudioNode = {} as AudioNode;
  public resume = vi.fn(async () => {
    this.state = 'running';
  });
  public close = vi.fn(async () => {
    this.state = 'closed';
  });
  public createGain = vi.fn(() => new FakeGainNode());
  public createBufferSource = vi.fn(() => new FakeAudioBufferSourceNode());
  public decodeAudioData = vi.fn(async () => ({} as AudioBuffer));
}

describe('audio/sfx', () => {
  let context: FakeAudioContext;
  let manager: SfxManager;

  beforeEach(() => {
    context = new FakeAudioContext();
    manager = createSfxManager({
      createAudioContext: () => context as unknown as AudioContext,
    });
  });

  it('creates and resumes audio context on unlock, only once', async () => {
    await manager.unlock();
    await manager.unlock();

    expect(context.resume).toHaveBeenCalledTimes(1);
    expect(context.state).toBe('running');
  });

  it('loads and decodes samples once, caching the result', async () => {
    const loader = vi.fn(async () => new ArrayBuffer(8));
    const buffer = {} as AudioBuffer;
    context.decodeAudioData.mockResolvedValueOnce(buffer);

    await manager.unlock();
    const first = await manager.loadSample('line-clear', loader);
    const second = await manager.loadSample('line-clear', loader);

    expect(loader).toHaveBeenCalledTimes(1);
    expect(context.decodeAudioData).toHaveBeenCalledTimes(1);
    expect(first).toBe(buffer);
    expect(second).toBe(buffer);
  });

  it('plays buffered sounds when not muted', async () => {
    const loader = vi.fn(async () => new ArrayBuffer(4));
    const source = new FakeAudioBufferSourceNode();
    context.createBufferSource.mockReturnValueOnce(source);
    const buffer = {} as AudioBuffer;
    context.decodeAudioData.mockResolvedValueOnce(buffer);

    await manager.unlock();
    await manager.loadSample('drop', loader);

    const played = await manager.play('drop');

    expect(played).toBe(true);
    expect(source.buffer).toBe(buffer);
    expect(source.start).toHaveBeenCalledOnce();
  });

  it('mutes playback and restores volume when toggled', async () => {
    await manager.unlock();

    const gain = context.createGain.mock.results[0]?.value as FakeGainNode | undefined;
    expect(gain).toBeDefined();

    manager.setVolume(0.5);
    expect(gain?.gain.value).toBeCloseTo(0.5);

    manager.setMuted(true);
    expect(gain?.gain.value).toBe(0);

    manager.setMuted(false);
    expect(gain?.gain.value).toBeCloseTo(0.5);
  });

  it('returns false when attempting to play missing or muted sounds', async () => {
    await manager.unlock();
    expect(await manager.play('missing')).toBe(false);

    const buffer = {} as AudioBuffer;
    context.decodeAudioData.mockResolvedValueOnce(buffer);
    await manager.loadSample('hit', async () => new ArrayBuffer(1));
    manager.setMuted(true);

    expect(await manager.play('hit')).toBe(false);
  });

  it('disposes audio context and prevents further playback', async () => {
    await manager.unlock();
    await manager.dispose();

    expect(context.close).toHaveBeenCalledOnce();
    expect(await manager.play('anything')).toBe(false);
  });
});
