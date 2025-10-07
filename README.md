# Web 俄罗斯方块（Tetris）

现代浏览器上的单人俄罗斯方块体验，基于 Vite + TypeScript 构建。游戏核心采用纯函数模块化设计，覆盖 7-袋随机、SRS 旋转、锁延迟、幽灵、Hold、音效与响应式 UI，并提供完善的测试、性能与部署守护。

## 功能亮点
- 🎮 **完整玩法**：20×40 游戏井、七种方块、SRS 墙踢、锁延迟（500ms/15 帧）、软/硬降得分、Hold 交换与幽灵投影。
- 🧠 **可复现核心**：7-袋随机数支持注入种子，方便测试与离线复现。
- 🛠️ **模块解耦**：核心逻辑、渲染、输入、音频、存储、UI 独立实现，可单测覆盖。
- ♿ **可访问性**：高对比主题、aria-live 播报、完全键盘操作、音量与静音切换。
- 📱 **多端体验**：桌面键鼠 + 移动触控并行支持，设置面板可调 DAS/ARR 与触控阈值。
- 🛡️ **质量守护**：Vitest 覆盖率门槛（全局 ≥80%、`src/core` ≥90%）、Playwright 多视口巡检、构建体积与 CSP 脚本守护。
- 🚀 **部署自动化**：GitHub Actions 完成类型检查、Lint、单元/端到端测试、bundle 预算审计与 GitHub Pages 部署。

## 操作指南

### 键盘映射
| 功能 | 按键 |
| --- | --- |
| 左移 / 右移 | ← / → |
| 软降 | ↓ |
| 旋转顺时针 / 逆时针 | ↑ / X / Z |
| 硬降 | Space |
| Hold 交换 | C 或 Shift |
| 暂停 / 恢复 | P |
| 返回菜单 | Esc |

### 触控手势
| 功能 | 手势 |
| --- | --- |
| 左移 / 右移 | 左/右滑 ≥15px |
| 旋转 | 单指轻点或上滑 |
| 软降 | 短下滑（位移 ≥15px，持续 <150ms） |
| 硬降 | 长下滑（持续 ≥150ms 且位移充足） |
| Hold | 屏幕按钮或双击 |
| 暂停 | 顶部控制栏按钮 |

> 在设置面板中可将 DAS 调整到 150–220ms、ARR 30–60ms，触控短/长下滑阈值 10–25px / 120–200ms，并支持一键恢复默认。

## 设置与可访问性
- HUD 显示分数、等级、行数、当前种子、下一队列（3 个）与 Hold 状态。
- 设置项：音效开关、音量、幽灵显示、高对比模式、DAS/ARR、触控阈值、手势说明。
- `aria-live` 广播关键状态（开始、暂停、行消、Game Over），确保屏幕阅读器可用。
- 可启用调试叠层显示 FPS、帧时间、锁延迟状态（开发模式可用）。

## 本地运行
```bash
npm install
npm run dev
```
- 默认地址：<http://localhost:5173>
- 保存 TypeScript 文件会触发 HMR，调试叠层和手势说明可在 UI 内打开。

## 质量保障
```bash
npm run typecheck      # TS 严格类型检查
npm run lint           # ESLint + Prettier
npm run test           # Vitest + 覆盖率统计
npm run coverage:check # 覆盖率阈值校验（全局/核心）
npm run e2e            # Playwright 端到端巡检（含多视口、a11y、多浏览器矩阵）
npm run soak           # 20 分钟自动化耐久测试
npm run csp:verify     # 严格 CSP 规则验证
npm run bundle:check   # 构建体积审计（≤150 KB gzip）
```
- CI 与本地均要求覆盖率达到全局 ≥80%、`src/core` ≥90%，脚本 `scripts/verify-coverage.mjs` 会在 `coverage:check` 中强制门槛。
- Playwright 测试覆盖关键用户故事（开始→操作→Game Over→高分持久化）。
- 离线复现用例 `tests/e2e/offline-seed.spec.ts` 会在 `chromium-desktop` 项目下额外验证断网重载后仍可保留设置、高分与种子复现能力。

## 构建与部署
```bash
npm run build
npm run preview
```
- 构建结果输出到 `dist/`，包含严格 CSP `<meta>` 标头与预缓存策略。
- GitHub Actions 工作流（`.github/workflows/ci.yml`）在推送到 `main` 时依次执行：`typecheck → lint → test → coverage:check → bundle:check → e2e → build`，最后部署到 GitHub Pages。
- 首次部署前运行 `npx playwright install --with-deps` 以安装浏览器依赖。

## 离线与数据持久化
- 静态资源在首次加载后缓存，可在无网络时继续游玩。
- 使用 `localStorage` 持久化：
  - `tetris:settings`：音效、主题、DAS/ARR、触控阈值等偏好。
  - `tetris:highscores`：保存分数、行数、等级与时间戳，自动按分数排序。
- 通过设置面板的“重置数据”按钮可清空上述存储。

## 性能与诊断
- 游戏循环基于 `requestAnimationFrame`，仅对受影响的脏矩形进行 Canvas 重绘。
- 调试叠层提供 FPS、帧时间、锁延迟等指标，便于排查性能问题。
- `npm run soak` 自动加载预录输入，在 20 分钟运行后导出统计到 `reports/`。

## 种子复现与测试
- 所有对局均记录当前 7-袋种子，可在 HUD 查看并粘贴到调试入口进行复现。
- Unit 测试覆盖 7-袋 RNG、SRS、碰撞、重力、状态机、Hold、Next Queue 等核心模块。
- 端到端测试验证键盘与触控操作、HUD 更新、高分持久化、CSP、离线缓存等流程。

## 常见问题
- **音频未播放**：浏览器需先接收一次用户交互（点击或按键）以解锁 `AudioContext`。
- **触控硬降触发困难**：在设置中查看阈值；长下滑需满足最小时间与位移条件。
- **覆盖率检查失败**：确认新增模块位于 `src/` 并编写 Vitest。可运行 `npm run test -- --runInBand` 定位缺口。
- **Playwright 报依赖缺失**：执行 `npx playwright install --with-deps` 安装所需浏览器。

## 许可
- 本项目按照 [MIT License](./LICENSE) 发布。欢迎自由使用、修改与分发，但需保留版权与许可证声明。
