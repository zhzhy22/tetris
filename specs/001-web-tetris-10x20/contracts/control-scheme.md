# Contract: input/control-scheme

## Responsibility
- 将设备事件（键盘、触控、屏上按钮）映射为 `ControlInput`，并管理 DAS/ARR/锁延迟相关状态。

## Keyboard Mapping
| Key | Action | Notes |
|-----|--------|-------|
| ArrowLeft / A | `moveLeft` | 默认 DAS 170ms，ARR 40ms，可在允许区间内调节 |
| ArrowRight / D | `moveRight` | 同上 |
| ArrowDown / S | `softDrop` | 连续触发但不受 ARR 限制；每格 +1 分 |
| ArrowUp / X | `rotateCW` | 與 Space 不冲突 |
| Z | `rotateCCW` | |
| Space | `hardDrop` | 立即锁定，+2 分/格 |
| Shift / C | `hold` | 每周期一次 |
| P / Escape | `togglePause` | 暂停或恢复 |

## Touch Gestures
- `swipeHorizontal`: |Δx| ≥ default 15px（可调 10–25px）, |Δy| < 10px → `moveLeft/Right`
- `tap` or `swipeUp`: duration < 200ms, Δy ≤ -10px → `rotateCW`
- `shortSwipeDown`: duration < default 150ms（可调 120–200ms）, Δy ≥ 15px → `softDrop`
- `longSwipeDown`: duration ≥ default 150ms（可调 120–200ms）且 Δy ≥ 30px → `hardDrop`
- 屏上按钮：提供 `left/right/soft/hard/rotateCW/rotateCCW/hold/pause`

## ControlInput Shape
```ts
type ControlInput =
  | { type: 'move'; direction: 'left' | 'right'; repeat: boolean }
  | { type: 'softDrop'; repeat: boolean }
  | { type: 'hardDrop' }
  | { type: 'rotate'; direction: 'cw' | 'ccw' }
  | { type: 'hold' }
  | { type: 'pause' }
  | { type: 'settings'; panel: 'toggle' };

type ControlTuning = {
  dasMs: number; // default 170, min 150, max 220
  arrMs: number; // default 40, min 30, max 60
  swipeThresholdPx: number; // default 15, min 10, max 25
  softDropDurationMs: number; // default 150, min 120, max 200
  hardDropDurationMs: number; // default 150, min 120, max 200
};
```

## Timers & State
- `dasTimer`：记录按下开始到首次重复的毫秒数，默认阈值 170ms，可由 `ControlTuning.dasMs` 调整。
- `arrTimer`：每 `ControlTuning.arrMs` 触发一次重复移动；松键时重置。
- `softDrop` 连续按住时每帧下落一格。
- 多输入冲突优先级：`hardDrop > rotate > move > softDrop`。

## Settings Integration
- `ControlTuning` 由设置面板维护，初始值来源于常量表；当用户调整后需立即广播到输入调度器，并持久化到 `localStorage`（与 `storage/local` 契约一致）。
- 提供 `resetToDefault()` API，恢复宪章默认阈值并通知订阅者。
- 输入模块需保证调节不会影响正在执行的动作：动态更新应在下一帧生效。

## Accessibility
- 所有键位与手势在设置面板列出；允许用户查看说明但 V1 不提供自定义。
- 保留屏幕按钮以满足辅助技术需求（可聚焦，支持键盘激活）。
- 设置面板中展示当前 DAS/ARR/阈值，并提供 aria-label 描述默认值与可调范围。
