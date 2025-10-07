import { describe, expect, it, vi } from 'vitest';
import {
  createStateMachine,
  type GamePhase,
  type StateEvent,
  type StateMachine,
} from '../../../src/core/state-machine';

function startMachine(overrides?: Partial<StateEvent>) {
  const machine = createStateMachine();
  machine.dispatch({ type: 'start', ...overrides });
  return machine;
}

describe('state machine phases', () => {
  it('transitions from ready to playing on start and notifies listeners', () => {
    const machine = createStateMachine();
    const listener = vi.fn();
    machine.subscribe(listener);

    expect(machine.getSnapshot().phase).toBe('ready');
    machine.dispatch({ type: 'start' });

    expect(machine.getSnapshot().phase).toBe('playing');
    expect(machine.canHold()).toBe(true);
    expect(listener).toHaveBeenCalled();
    expect(listener.mock.calls.at(-1)?.[0].phase).toBe('playing');
  });

  it('pauses and resumes gameplay', () => {
    const machine = startMachine();

    machine.dispatch({ type: 'pause' });
    expect(machine.getSnapshot().phase).toBe('paused');

    machine.dispatch({ type: 'resume' });
    expect(machine.getSnapshot().phase).toBe('playing');
  });

  it('marks game over and prevents further hold usage', () => {
    const machine = startMachine();
    machine.dispatch({ type: 'gameOver' });

    expect(machine.getSnapshot().phase).toBe('gameOver');
    expect(machine.canHold()).toBe(false);
  });
});

describe('hold limitations', () => {
  it('allows hold once per turn until piece locks', () => {
    const machine = startMachine();
    expect(machine.canHold()).toBe(true);

    machine.dispatch({ type: 'useHold' });
    expect(machine.canHold()).toBe(false);

    machine.dispatch({ type: 'lock' });
    expect(machine.canHold()).toBe(true);
  });

  it('fires listeners when lock resets hold availability', () => {
    const machine = startMachine();
    const listener = vi.fn();
    machine.subscribe(listener);

    machine.dispatch({ type: 'useHold' });
    machine.dispatch({ type: 'lock' });

    const snapshots = listener.mock.calls.map((call) => call[0]);
    const phases: GamePhase[] = snapshots.map((snap) => snap.phase);
    expect(phases).toContain('playing');
    const lastSnapshot = snapshots.at(-1);
    expect(lastSnapshot?.holdAvailable).toBe(true);
  });
});
