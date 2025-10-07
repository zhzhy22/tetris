# Data Model: Web 俄罗斯方块（Tetris）

## 概览
- 单人俄罗斯方块核心由纯函数驱动的状态机组成，围绕 10×20 `Board`、`ActivePiece`、`HoldPiece`、`NextQueue`、`GameStats` 与 `Settings` 七大实体。
- 所有状态快照均为不可变数据结构，方便单元测试与状态回放。

## 核心类型

### Board & Cells
- `BoardCell = { occupied: boolean; type?: TetrominoType; lockFrame?: number }`
- `Board = BoardCell[40][20]` （按行存储，索引从底部向上方便硬降计算）。

### Tetromino & Rotation
- `TetrominoType = 'I' | 'O' | 'T' | 'S' | 'Z' | 'J' | 'L'`
- `RotationState = 0 | 1 | 2 | 3`
- `PieceShape = boolean[4][4]`
- `ActivePiece = { type: TetrominoType; position: { row: number; col: number }; rotation: RotationState; kicks: KickTable }`

### Game Stats & Progression
- `GameStats = { score: number; level: number; lines: number; dropDistanceSoft: number; dropDistanceHard: number }`
- `SpeedProfile = { gravityMs: number; lockDelayMs: number }`，其中 `gravityMs = max(50, round(1000 * 0.85^level))`。

### Random Bag & Queue
- `RandomSeed = string`（十六进制种子），`RandomState = { seed: RandomSeed; bag: TetrominoType[]; history: TetrominoType[] }`
- `NextQueue = TetrominoType[3]` 固定长度。
- `RngOutput = { nextPiece: TetrominoType; nextState: RandomState }`

### Settings & Storage
- `Settings = { soundEnabled: boolean; highContrast: boolean; showGhost: boolean; showDebugOverlay: boolean }`
- `SettingsStorage = { key: 'tetris:settings'; value: Settings }`
- `HighScoreEntry = { score: number; lines: number; level: number; date: string }`
- `HighScoresStorage = { key: 'tetris:highscores'; value: HighScoreEntry[] }`

### Game Session State
- `GamePhase = 'ready' | 'playing' | 'paused' | 'gameOver'`
- `LockState = { isLocking: boolean; elapsedMs: number }`
- `InputState = { dasTimerMs: number; arrTimerMs: number; activeKeys: Set<ControlKey>; touchGesture?: TouchGesture }`
- `GameSessionState = {
    board: Board;
    active: ActivePiece | null;
    hold: TetrominoType | null;
    holdUsedThisTurn: boolean;
    nextQueue: NextQueue;
    rng: RandomState;
    stats: GameStats;
    speed: SpeedProfile;
    lock: LockState;
    phase: GamePhase;
    ghost: { row: number; col: number } | null;
    seed: RandomSeed;
  }`

## 状态机与转换
1. `ready → playing`: 用户开始游戏；初始化 RNG、Board、ActivePiece、NextQueue。
2. `playing → paused`: 用户触发暂停或失去焦点；冻结输入与计时。
3. `playing → gameOver`: `Board` 生成时检测顶部冲突。
4. `paused → playing`: 恢复计时器与输入状态。
5. `gameOver → ready`: 用户选择重新开始；保留设置与高分。

锁延迟规则：`lock.elapsedMs` 累积 ≤500ms 时可通过移动/旋转重置；硬降立即锁定并清空锁延迟。

## 计分与升级
- 行消：`linesCleared` 为 1/2/3/4 时分别加 `100/300/500/800 * (level + 1)`。
- 软降：每格 +1 分，累积在 `stats.dropDistanceSoft`。
- 硬降：每格 +2 分，累积在 `stats.dropDistanceHard`。
- 升级：每 10 行提升一级，重新计算 `SpeedProfile`。

## 输入控制状态
- `ControlKey = 'left' | 'right' | 'softDrop' | 'hardDrop' | 'rotateCW' | 'rotateCCW' | 'hold' | 'pause'`
- `TouchGesture = { type: 'swipe'|'tap'|'longSwipe'; deltaX: number; deltaY: number; durationMs: number }`
- DAS/ARR 使用 `InputState` 中的计时器在渲染循环中评估是否触发连续移动。

## 持久化与序列化
- `localStorage` 存储 JSON：`Settings` 与 `HighScores` 序列化，读写前使用 `JSON.parse`/`stringify` 并带 schema 验证。
- 提供 `storage.clear()` API，调用时触发确认对话并重置游戏状态。

## 调试与遥测
- `DebugOverlayState = { fps: number; frameTimeMs: number; lockDelayMs: number; queuePreview: TetrominoType[] }`
- 仅在开发模式或设置开启时计算，避免影响生产性能。
