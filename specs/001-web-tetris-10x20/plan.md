# Implementation Plan: Web 俄罗斯方块（Tetris）

**Branch**: `001-web-tetris-10x20` | **Date**: 2025-10-03 | **Spec**: `/specs/001-web-tetris-10x20/spec.md`
**Input**: Feature specification from `/specs/001-web-tetris-10x20/spec.md`

## Summary
- 交付基于 Vite + TypeScript(strict) + Canvas 2D 的单页俄罗斯方块游戏，核心逻辑模块化可复用。
- 核心玩法由纯函数驱动（7-袋随机、SRS 旋转/踢墙、重力/锁延迟、计分、状态机），输入层支持键鼠与触控，并通过渲染、UI、音频、存储层解耦呈现。
- 性能目标 60 FPS，保障响应式布局、可访问性（WCAG 2.1 AA）、种子复现与本地持久化，CI 使用 GitHub Actions + Pages 自动化测试与部署。

## Technical Context
**Language/Version**: TypeScript 5.x（strict）  
**Primary Dependencies**: Vite, Vitest, Playwright, ESLint, Prettier, Canvas 2D API, Web Audio API  
**Storage**: 浏览器 `localStorage` (`tetris:settings`, `tetris:highscores`)  
**Testing**: Vitest（含 jsdom 环境）+ Playwright（多视口端到端）  
**Target Platform**: 现代桌面与移动浏览器（Chromium、Firefox、Safari）  
**Project Type**: Web 单项目（前端静态站点）  
**Performance Goals**: 渲染稳定 60 FPS，20 分钟 soak 无明显泄漏，首屏包体 ≤150 KB gzip（不含音频）  
**Constraints**: 严格 TypeScript、零/低依赖核心、严格 CSP（self-only）、离线可玩、CI 覆盖 typecheck/lint/unit/e2e/build（Chromium/Firefox/WebKit）、输入参数可在受控区间内调节但默认值需符合宪章
**Scale/Scope**: 单人玩法；HUD/设置/触控/Hold/幽灵等完整功能；阶段性里程碑 7 个冲刺

## Constitution Check
*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- ✅ TypeScript 严格模式已在脚手架步骤规划，并为核心纯函数编写单元测试。
- ✅ 覆盖率策略：Vitest 覆盖核心模块（≥90%），全局≥80%，7-袋随机支持种子复现；Playwright 覆盖关键路径。
- ✅ 交互设计：键盘映射固定、触控阈值明确、状态反馈通过 HUD/aria-live 体现，支持 60 FPS 目标。
- ✅ 渲染方案：基于 `requestAnimationFrame` 与 Δt 重力，提供 20 分钟 soak 脚本与开发态 FPS 叠层。
- ✅ 可访问性：高对比主题、完整键盘操作、aria-live 播报、音量控制与简洁模式纳入 UI/设置设计。
- ✅ 安全/隐私/可观测性：纯前端，localStorage 范围受控，严格 CSP、错误提示与调试开关纳入计划。
- ✅ 版本控制/文档：Conventional Commits、README/CHANGELOG 更新、评审验收清单执行纳入里程碑与 CI。

## Project Structure

### Documentation (this feature)
```
specs/001-web-tetris-10x20/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
└── contracts/
```

### Source Code (repository root)
```
.
├── public/
│   ├── index.html
│   └── assets/
├── src/
│   ├── core/
│   │   ├── types/
│   │   ├── rng/
│   │   ├── srs/
│   │   ├── collision/
│   │   ├── board/
│   │   ├── gravity/
│   │   ├── scoring/
│   │   └── state/
│   ├── input/
│   ├── render/
│   ├── audio/
│   ├── ui/
│   ├── storage/
│   └── utils/
├── tests/
│   ├── unit/
│   │   ├── core/
│   │   └── ui/
│   └── e2e/
├── playwright.config.ts
├── vite.config.ts
├── tsconfig.json
└── package.json
```

**Structure Decision**: 单页前端项目，`src/` 以功能域分层；`tests/` 区分 unit（Vitest）与 e2e（Playwright）；公共静态资源置于 `public/`。CI、配置文件位于根目录。

## Phase 0: Outline & Research
1. 研究议题
   - Canvas 2D 在高 DPI（DPR>1）下的像素对齐策略与最小重绘方案。
   - 官方 SRS 踢墙表（含 I/O 形状特例）与锁延迟行为确认。
   - DAS≈170ms、ARR≈40ms 的实现方式（键盘事件节流 vs requestAnimationFrame 驱动），以及允许调节时的上下限与复位策略。
   - Touch 手势阈值与事件冲突（被动监听 vs preventDefault）。
   - 触控短/长下滑阈值的可调区间和与键盘参数的同步。
   - Web Audio 音效延迟与音量控制方案（兼容静音政策）。
   - GitHub Pages + Actions 部署严格 CSP 配置（self-only + asset hash）。
2. 研究方法
   - 调研 Tetris Guideline 文档、社区实现（例如 Tetris Concept Wiki）。
   - 验证 Canvas DPR 渲染实验，记录像素缩放策略。
   - 汇总浏览器触控与键盘可访问性指南。
3. 成果交付
   - 在 `research.md` 中针对每个议题记录 Decision / Rationale / Alternatives。
   - 列出后续里程碑所需的依赖或工具（如 `@playwright/test`）。

## Phase 1: Design & Contracts
1. 数据模型 (`data-model.md`)
   - 定义核心类型：`TetrominoType`、`RotationState`、`BoardCell`、`GameStats`、`Settings`、`HighScoreEntry`、`GameState`。
   - 描述状态机（`playing`/`paused`/`gameOver`）以及锁延迟状态（soft/ hard drop 行为）。
   - 说明 7-袋 RNG 与种子序列结构、Next Queue 固定 3 个。
2. 模块接口契约 (`contracts/`)
   - `core/game-loop.md`：定义 `GameLoop` 接口、`tick(deltaMs)`、`applyInput`、`subscribe` 事件。
   - `input/control-scheme.md`：键盘 DAS/ARR、触控阈值、屏上按钮交互流程。
   - `render/canvas.md`：Canvas 初始化（DPR 适配、最小重绘策略）与 HUD DOM 更新。
   - `storage/local.md`：localStorage key、序列化格式、清除流程。
3. 快速上手 (`quickstart.md`)
   - 环境要求（Node 20.x、pnpm/npm）。
   - 安装、运行、测试、构建、Playwright 依赖下载步骤。
   - 离线模拟与 Pages 部署预览说明。
4. 设计要点
   - 记录模块依赖关系图（core 为底层，input/render/audio/ui/storage/utils 分层）。
   - 指明调试工具（FPS overlay、Playwright 视口矩阵）。
   - 说明设置面板在调节 DAS/ARR/触控阈值时如何广播到输入层并持久化。
5. 再次评估宪章
   - 确认所有原则在设计中有落地方案（见下一节 Constitution Check 复验）。

## Phase 2: Task Planning Approach
- `/tasks` 将基于 data-model、contracts、quickstart 生成 25-30 个任务。
- 分类：
- Setup（Vite 脚手架、ESLint/Prettier、CSP 设置、CI 工作流）。
- Core 测试优先（RNG、SRS、collision、scoring、state machine、Next Queue 长度校验）。
- 渲染 & 输入（Canvas 循环、键盘、触控、HUD、音效、输入调节设置）。
- 功能整合（Hold、幽灵、预览、设置、高分存储、Soak 工具、预览同步验证、离线种子复现）。
- 性能/a11y 验证与文档更新（含 bundle 体积审计、严格 CSP 校验、多浏览器矩阵）。
- 任务遵循 TDD：单元测试 → Playwright 脚本 → 实现 → 文档。
- 覆盖率与性能检查任务必须显式标注，保证宪章合规。

## Phase 3+: Future Implementation
- Phase 3：执行 `/tasks` 生成的任务清单。
- Phase 4：按任务完成实现与测试；关键阶段结束前运行 soak 脚本与 a11y 审核。
- Phase 5：最终验收，核对 README、CHANGELOG、评审清单，提交部署。

## Complexity Tracking
*当前无偏离宪章的复杂度请求，无需记录。*

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| _None_ | — | — |

## Progress Tracking
**Phase Status**:
- [x] Phase 0: Research complete (/plan command)
- [x] Phase 1: Design complete (/plan command)
- [x] Phase 2: Task planning complete (/plan command - describe approach only)
- [ ] Phase 3: Tasks generated (/tasks command)
- [ ] Phase 4: Implementation complete
- [ ] Phase 5: Validation passed

**Gate Status**:
- [x] Initial Constitution Check: PASS
- [x] Post-Design Constitution Check: PASS
- [x] All NEEDS CLARIFICATION resolved
- [x] Complexity deviations documented（无偏离）

---
*Based on Constitution v1.0.0 - See `/memory/constitution.md`*
