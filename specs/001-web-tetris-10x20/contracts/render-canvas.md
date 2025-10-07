# Contract: render/canvas

## Responsibility
- 使用 Canvas 2D 渲染游戏井、活动方块、幽灵投影、锁定块以及 HUD 中与画布相关的元素。

## Initialization
```ts
interface CanvasRendererOptions {
  canvas: HTMLCanvasElement;
  dpr?: number; // 默认读取 window.devicePixelRatio
  theme: 'default' | 'high-contrast';
}

interface CanvasRenderer {
  init(options: CanvasRendererOptions): void;
  resize(width: number, height: number): void;
  render(state: RenderSnapshot): void;
  destroy(): void;
}
```

## RenderSnapshot
- `board`: `Board`
- `active`: `ActivePiece | null`
- `ghost`: `{ row: number; col: number } | null`
- `nextQueue`: `NextQueue`
- `hold`: `TetrominoType | null`
- `effects`: `{ lineClearRows?: number[]; warning?: boolean }`

## Constraints
- 初始化时根据 DPR 调整画布大小 (`canvas.width = logicalWidth * dpr`) 并调用 `ctx.scale(dpr, dpr)`。
- 采用脏矩形策略，只有在变更的行或 HUD 部分重绘。
- 所有颜色在高对比模式下需满足 WCAG 2.1 AA。
- 禁止在渲染循环中分配大型对象；使用预先分配的缓冲区域。

## Testing Guidance
- Vitest + jsdom 中通过 `OffscreenCanvas` 或 `canvas` mock 驗證：
  - DPR 缩放正确（调用 `canvas.width/height`）。
  - 幽灵投影与 Next Queue 渲染的坐标计算。
  - 脏矩形更新不会触发全画布 `clearRect`。
