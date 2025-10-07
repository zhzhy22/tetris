import type { GameSessionState } from '../core/game-loop';

export {};

declare global {
  interface Window {
    __TETRIS_E2E__?: boolean;
    __TETRIS_TEST_UTILS__?: {
      pause(): void;
      resume(): void;
      forceGameOver(): void;
      getState(): GameSessionState;
    };
  }
}
