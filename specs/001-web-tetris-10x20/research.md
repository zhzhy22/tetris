# Research Notes: Web 俄罗斯方块（Tetris）

## 1. Canvas DPR 与最小重绘
- **Decision**: 初始化 Canvas 时乘以 `devicePixelRatio`，逻辑坐标仍使用 10×20 网格，绘制前通过 `ctx.scale(dpr, dpr)` 保证像素对齐；脏矩形刷新仅重绘受影响的行与 HUD 指示。
- **Rationale**: 避免模糊并减少无效重绘，有助于维持 60 FPS。
- **Alternatives considered**: 逐帧全局清屏 → 带来额外 fillRect 成本；使用 OffscreenCanvas → 兼容性与实现复杂度较高，暂不采用。

## 2. 官方 SRS 踢墙表与锁延迟
- **Decision**: 采用 Tetris Guideline SRS 表，I 方块与 O 方块使用各自特例；锁延迟设置为 500ms 或 15 帧（取较小值），软降/旋转/左右移动均可重置延迟。
- **Rationale**: 与玩家预期一致，便于端测验证。
- **Alternatives considered**: 自定义更宽松踢墙 → 会导致玩法偏差；完全禁锁延迟 → 难以进行冲刺式操作。

## 3. DAS≈170ms 与 ARR≈40ms 实现
- **Decision**: 使用键盘事件记录按下时间，在 `requestAnimationFrame` 循环中计算 elapsed，超过 DAS 再按 ARR 间隔重复移动；软降单独通道不受 ARR 影响。
- **Rationale**: 避免 `setInterval` 漂移，易与游戏步长同步。
- **Alternatives considered**: 纯事件驱动 → 不易控制重复速率；`setTimeout` 链式调用 → 受 Tab 休眠影响。

## 4. 触控手势阈值与事件策略
- **Decision**: 使用被动监听 `touchstart/move/end` 收集轨迹，左右滑判定阈值 15px，短下滑 <150ms 触发软降，长下滑 ≥150ms + 足够位移触发硬降；提供屏上按钮兜底。
- **Rationale**: 满足规范要求并兼容移动端滚动主线程。
- **Alternatives considered**: Hammer.js 等依赖 → 增加包体；非被动监听 → 阻塞滚动影响性能。

## 5. Web Audio 音效与静音政策
- **Decision**: 使用单一 `AudioContext` 管理音量节点，首次用户交互后解锁；音量设置映射至 gainNode，支持静音；音频资源使用轻量 OGG。
- **Rationale**: 控制播放延迟，满足可访问性中可调音量要求。
- **Alternatives considered**: `<audio>` 标签 → 延迟较高且难统一混音；第三方库（如 Howler）→ 增加依赖与包体。

## 6. GitHub Pages 严格 CSP
- **Decision**: 通过 Actions 构建时生成 `headers` 配置（Cloudflare Pages 风格）或在 `index.html` 内注入 `<meta http-equiv="Content-Security-Policy" ...>`，限制 `default-src 'self'`，允许 `media-src 'self' data:`，禁止 `unsafe-inline`，以 nonce 方式加载主脚本。
- **Rationale**: 满足宪章安全要求并与静态部署流程兼容。
- **Alternatives considered**: 关闭 CSP → 不满足宪章；使用外部 CDN → 违反 self-only 约束。

## 7. Soak 测试与 FPS 叠层
- **Decision**: 提供开发模式下可从设置面板开启调试叠层（显示 FPS、帧时间、锁延迟状态），并在 `package.json` 添加 `npm run soak` 脚本触发自动化 20 分钟模拟（基于预录输入脚本）。
- **Rationale**: 直接支撑宪章对性能与可观测性的要求。
- **Alternatives considered**: 手动测试 → 难以重复；引入重型分析库 → 增加包体。

## Open Questions
- 当前无未解决问题；计划阶段全部澄清完毕。如后续引入音效资产压缩方案，需在实现期重新评估许可证。
