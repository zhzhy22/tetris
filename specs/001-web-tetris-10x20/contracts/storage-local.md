# Contract: storage/local

## Responsibility
- 以持久化方式存储设置与高分列表，提供类型安全的读写 API，并处理 JSON 序列化错误。

## Keys
- `tetris:settings`
- `tetris:highscores`

## API
```ts
interface StorageProvider<T> {
  load(): Promise<T | null>;
  save(value: T): Promise<void>;
  clear(): Promise<void>;
}

type SettingsStore = StorageProvider<Settings>;
type HighScoresStore = StorageProvider<HighScoreEntry[]>;
```

## Requirements
- 写入前先序列化并捕获 `QuotaExceededError`，必要时提示用户清理存储。
- `load` 失败时需返回默认值并记录 warning（使用可观测性通道）。
- 提供 `migrate()` 钩子以便未来 schema 扩展。
- 所有调用必须在浏览器环境下延迟到 `window` 可用后执行。

## Testing Guidance
- 使用 Vitest 模拟 `localStorage`，验证：
  - 首次加载时返回 `null` 并不会抛错。
  - 保存/读取设置与高分后可复现同一对象。
  - `clear()` 会删除两个键并复位默认设置。
