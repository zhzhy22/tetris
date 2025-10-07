# Contract: core/game-loop

## Responsibility
- 驱动游戏状态机、重力、锁延迟与输入处理，向渲染/UI 层广播状态变更。

## Public API
```ts
interface GameLoop {
  start(): void;
  stop(): void;
  tick(deltaMs: number): void; // 主要用于测试注入
  applyInput(input: ControlInput): void;
  subscribe(listener: (snapshot: GameSessionState) => void): () => void;
  getState(): GameSessionState;
}
```

## Events
- `snapshot`：每帧或状态变更时触发，携带不可变 `GameSessionState`。
- `lineClear`：用于触发音效与 HUD 动画。
- `gameOver`：游戏结束时发出。

## Requirements
- `tick` 必须以纯函数组合实现，确保给定输入和状态产生确定输出。
- 硬降立即锁定；软降、移动、旋转会重置锁延迟（上限 500ms/15 帧）。
- 监听器需按注册顺序调用，返回的取消函数必须 idempotent。

## Testing Guidance
- 使用 Vitest 模拟 deltaMs 和输入序列，验证锁延迟、等级提升、Hold 限制。
- 为可复现性注入 RNG 种子，并在测试中断言 `GameSessionState.seed`。
