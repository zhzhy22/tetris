# Tasks: Web 俄罗斯方块（Tetris）

**Input**: Design documents from `/specs/001-web-tetris-10x20/`
**Prerequisites**: plan.md (required), research.md, data-model.md, contracts/

## Execution Flow (main)
```
1. Load plan.md from feature directory
   → If not found: ERROR "No implementation plan found"
   → Extract: tech stack, libraries, structure
2. Load optional design documents:
   → data-model.md: Extract entities → model tasks
   → contracts/: Each file → contract test task
   → research.md: Extract decisions → setup tasks
   → quickstart.md: Extract run/test commands → quality tasks
3. Generate tasks by category:
   → Setup: project init, dependencies, linting
   → Tests: contract tests, integration tests
   → Core: models, services, loops
   → Integration: input, render, storage
   → Polish: performance, docs, deployment
4. Apply task rules:
   → Different files = mark [P] for parallel
   → Same file = sequential (no [P])
   → Tests before implementation (TDD)
5. Number tasks sequentially (T001, T002...)
6. Generate dependency graph
7. Create parallel execution examples
8. Validate task completeness:
   → All contracts have tests
   → All entities have model tasks
   → All tests come before implementation
   → Parallel tasks truly independent
   → Each task specifies exact file path
   → No task modifies same file as another [P] task
9. Return: SUCCESS (tasks ready for execution)
```

## Phase 0: 环境初始化
- [X] T001 创建 Vite + TypeScript(strict) 项目骨架并提交基础结构（`package.json`, `tsconfig.json`, `vite.config.ts`, `public/index.html`, `src/main.ts`)。
- [X] T002 安装并配置 ESLint + Prettier（含 TypeScript 插件），添加 `npm run lint`（新增 `eslint.config.mjs`, 更新 `.prettierrc`, `package.json`）。
- [X] T003 安装 Vitest + jsdom 环境，编写基础配置与 `npm run test` 脚本（更新 `vite.config.ts`, 新建 `vitest.config.ts`, `tests/unit/.gitkeep`）。
- [X] T004 安装 Playwright 并生成多视口配置，新增 `npm run e2e`、`playwright.config.ts` 与样例测试（`tests/e2e/smoke.spec.ts`）。
- [X] T005 配置 GitHub Actions 工作流，执行 `typecheck → lint → test → e2e → build` 并部署 GitHub Pages，包含严格 CSP 元标头（`.github/workflows/ci.yml`, `index.html`）。

## Phase 1: 核心逻辑（测试优先）
- [X] T006 [P] 为 7-袋 RNG 编写 Vitest 单元测试，验证种子复现与袋穷尽（`tests/unit/core/rng.test.ts`）。
- [X] T007 [P] 为 SRS 踢墙与旋转编写测试，覆盖 I/O 特例与失败回退（`tests/unit/core/srs.test.ts`）。
- [X] T008 [P] 为碰撞检测与边界判定编写测试（`tests/unit/core/collision.test.ts`）。
- [X] T009 [P] 为 Board 行消、堆叠与清行逻辑编写测试（`tests/unit/core/board.test.ts`）。
- [X] T057 更新 Board 默认尺寸相关单元测试以覆盖 40×20 井（`tests/unit/core/board.test.ts`）。
- [X] T010 [P] 为计分、升级、软/硬降加分编写测试（`tests/unit/core/scoring.test.ts`）。
- [X] T011 [P] 为重力与锁延迟（500ms 或 15 帧）编写测试（`tests/unit/core/gravity.test.ts`）。
- [X] T012 [P] 为游戏状态机（ready/playing/paused/gameOver）编写测试，覆盖 Hold 限制与事件触发（`tests/unit/core/state-machine.test.ts`）。
- [X] T048 [P] 为 Next Queue 固定 3 格及与活动方块同步编写测试（`tests/unit/core/next-queue.test.ts`）。
- [X] T013 实现 `src/core/rng` 模块，确保通过 T006。
- [X] T014 实现 `src/core/srs` 模块，确保通过 T007。
- [X] T015 实现 `src/core/collision` 模块，确保通过 T008。
- [X] T016 实现 `src/core/board` 模块，确保通过 T009。
- [X] T058 更新 Board 与 Game Loop 默认棋盘尺寸为 40×20，并同步核心常量（`src/core/board/index.ts`, `src/core/game-loop/index.ts`）。
- [X] T017 实现 `src/core/scoring` 模块，确保通过 T010。
- [X] T018 实现 `src/core/gravity` 与锁延迟工具，确保通过 T011。
- [X] T019 汇总以上模块，构建 `src/core/game-loop`（契约实现），确保通过 T012。

## Phase 2: 渲染与输入
- [X] T020 在 `tests/unit/utils/raf-loop.test.ts` 为 rAF 主循环控制编写测试（模拟 deltaMs、暂停/恢复）。
- [X] T021 实现 `src/utils/raf-loop.ts`，提供启动、暂停、订阅 API。
- [X] T022 在 `tests/unit/input/control-scheme.test.ts` 为 DAS/ARR、手势阈值编写测试（使用 jsdom 事件）。
- [X] T023 实现 `src/input/control-scheme.ts`，整合键盘、触控、屏上按钮逻辑。
- [X] T024 在 `tests/unit/render/canvas-renderer.test.ts` 为 Canvas 渲染脏矩形、DPR 适配编写测试（使用 OffscreenCanvas fallback）。
- [X] T025 实现 `src/render/canvas-renderer.ts`，满足 contract 并连接 ghost/active/clear 流程。
- [X] T026 创建 `src/ui/app.tsx`（或 .ts），集成 game loop、渲染器、输入，建立基础 UI 结构。
- [X] T059 调整 UI 渲染器尺寸与布局以适配 40×20 井（`src/ui/app.ts`, `src/style.css`）。

## Phase 3: 功能模块
- [X] T027 [P] 为幽灵方块投影逻辑编写测试（`tests/unit/core/ghost.test.ts`）。
- [X] T028 [P] 为 Hold 功能编写测试，确保每周期一次与状态重置（`tests/unit/core/hold.test.ts`）。
- [X] T029 [P] 为设置、高对比、幽灵开关、音效开关编写测试（`tests/unit/ui/settings.test.ts`）。
- [X] T050 为设置面板新增 DAS/ARR 与触控阈值调节测试用例（`tests/unit/ui/settings.test.ts`）。
- [X] T030 实现幽灵渲染与 `game-loop` 结合（`src/core/ghost.ts` + UI 集成）。
- [X] T031 实现 Hold 管线与 UI 提示（`src/core/hold.ts`, `src/ui/hud.tsx`）。
- [X] T032 实现 HUD（分数/等级/行数/种子/状态）与 `aria-live` 播报，并展示 Next Queue 三格预览（`src/ui/hud.tsx`）。
- [X] T033 实现设置面板与状态同步（`src/ui/settings-panel.tsx`），包含手势说明。
- [X] T051 实现输入调节逻辑与持久化（`src/input/control-scheme.ts`, `src/ui/settings-panel.tsx`, `src/storage/local.ts`），确保与 `ControlTuning` 契约一致。
- [X] T034 实现本地高分存储 provider（`src/storage/local.ts`）并在 HUD/设置中接入。
- [X] T035 实现基础音效模块（`src/audio/sfx.ts`），使用 Web Audio 控制音量与静音。
- [X] T049 校准 Canvas 渲染与 HUD 预览同步（`src/render/canvas-renderer.ts`, `src/ui/hud.tsx`），确保通过 T048 与 T032。

## Phase 4: 触控与响应式
- [X] T036 [P] 为触控手势在不同视口的 Playwright 测试编写脚本（`tests/e2e/touch.gesture.spec.ts`）。
- [X] T037 [P] 为响应式布局（桌面/平板/手机）编写 Playwright 可视快照测试（`tests/e2e/responsive.spec.ts`）。
- [X] T038 实现 UI 响应式布局（CSS Grid/Flex，`src/ui/styles.css`），确保屏上按钮可聚焦。
- [X] T039 完成触控反馈 UI（手势提示、高亮），接入控制方案。
- [X] T052 编写触控阈值调节端到端测试（桌面/移动视口），验证设置变更即时生效（`tests/e2e/touch-tuning.spec.ts`）。

## Phase 5: 可访问性与性能
- [X] T040 在 Playwright a11y 项目中编写场景：开局、设置、Game Over，校验 WCAG 2.1 AA（`tests/e2e/a11y.spec.ts`）。
- [X] T041 实现并验证 FPS/步长调试叠层开关（`src/ui/debug-overlay.ts`），确保默认关闭。
- [X] T042 完成 soak 测试脚本与报告（`scripts/soak-runner.ts` + `npm run soak`），验证 20 分钟稳定性。
- [X] T043 调整构建产物与 CSP 元标头，验证离线缓存策略（`public/index.html`, `vite.config.ts`）。
- [X] T053 创建构建体积审计脚本并在 CI 中执行（`scripts/bundle-budget.mjs`, `package.json`, `.github/workflows/ci.yml`），强制首屏包体 ≤150 KB gzip。
- [X] T054 自动化验证严格 CSP（Playwright 或脚本检查 meta/headers），集成 CI（`scripts/verify-csp.mjs`, `.github/workflows/ci.yml`）。

## Phase 6: 端到端验收与交付
- [X] T044 编写 Playwright 端到端脚本覆盖关键用户故事（开始、移动/旋转/软降/硬降、Hold、暂停、Game Over、高分保存），确保通过（`tests/e2e/gameplay.spec.ts`）。
- [X] T045 汇总测试覆盖率，确保全局≥80%、`src/core` ≥90%，如不足补充测试（`package.json`, CI 报告）。已配置覆盖率验证脚本并通过 `npm run coverage:check`（全局 85.6%，`src/core` 90.7%）。
- [X] T046 更新 README（玩法、操作、构建、部署、手势说明、离线说明），新增 CHANGELOG 项（`README.md`, `CHANGELOG.md`）。新增 README 覆盖操作指南/质量守护/离线说明，并创建 CHANGELOG 记录覆盖率与文档更新。
- [X] T047 提交部署流程验证：`npm run build` → `npm run preview` → GitHub Pages 预览，记录验收清单勾选（`docs/acceptance-checklist.md`）。已完成构建与本地预览，新增验收清单记录 CI 部署流程。
- [X] T060 更新数据模型与 README 以注明 40×20 井尺寸（`specs/001-web-tetris-10x20/data-model.md`, `README.md`, `CHANGELOG.md`）。
- [X] T055 在 Playwright/CI 中启用 Chromium + Firefox + WebKit 矩阵运行（`playwright.config.ts`, `.github/workflows/ci.yml`）。Playwright 配置新增 Firefox/WebKit 项并在 CI 中执行多浏览器端到端测试。
- [X] T056 编写离线种子复现端到端测试：预录输入 → 离线刷新 → 验证设置/高分持久化（`tests/e2e/offline-seed.spec.ts`）。新增离线测试构建静态离线响应、校验设置与高分在断网重载后仍复现原种子。

## Dependencies
- Phase 0 完成后才能进入后续阶段。
- 所有测试任务（T006-T012, T020, T022, T024, T027-T029, T036-T037, T040, T042, T044, T048, T050, T052, T054, T056）需在实现任务前完成。
- Core 模块（T013-T019, T049）依赖对应测试；UI/功能实现（T026-T035, T051）依赖核心模块稳定。
- Playwright 测试（T036, T037, T040, T044, T052, T054, T056）依赖 Phase 3 功能完成。
- 质量守护任务（T053, T055）依赖 CI 基础设施（T005, T004），在全部测试通过后执行。

## Parallel Execution Examples
```
# 核心测试阶段并行运行：
/implement T006
/implement T007
/implement T008
/implement T009
/implement T010
/implement T011
/implement T012

# 功能实现阶段并行（文件无冲突）：
/implement T030
/implement T031
/implement T032
/implement T033
/implement T034
/implement T035
/implement T051
```

## Validation Checklist
- [X] 所有合约文件与输入渲染契约对应测试齐全（T006, T007, T022, T024, T048, T050）。
- [X] 数据模型实体均有对应实现与测试（Board/State/Settings/HighScores）。
- [X] 预览队列、输入调节与触控阈值在测试与实现中保持同步（T048, T049, T050, T051, T052）。
- [X] 测试在实现之前完成（TDD 顺序保持）。
- [X] 标注 [P] 的任务互不冲突，路径独立。
- [X] 全局与核心覆盖率阈值任务已列出（T045）。
- [X] 性能、a11y、离线与文档任务全部覆盖（T040, T041, T042, T043, T046, T047）。
- [X] 构建体积守护与严格 CSP 校验已集成 CI（T053, T054）。
- [X] Playwright 多浏览器矩阵执行并记录结果（T055）。
- [X] 离线种子复现端到端测试通过（T056）。

```%
```
