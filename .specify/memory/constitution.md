<!--<!--

Sync Impact ReportSync Impact Report

Version change: 0.0.0 → 1.0.0Version change: 0.0.0 → 1.0.0

Modified principles: 初始发布Modified principles: 初始发布

Added sections: Core Principles, Operational Standards, Delivery Workflow, GovernanceAdded sections: Core Principles, Operational Standards, Delivery Workflow, Governance

Removed sections: 无Removed sections: 无

Templates requiring updates:Templates requiring updates:

- ✅ .specify/templates/plan-template.md (更新 Constitution Check 与版本号)- ✅ .specify/templates/plan-template.md (更新 Constitution Check 与版本号)

- ✅ .specify/templates/spec-template.md (复核，无需修改)- ✅ .specify/templates/spec-template.md (复核，无需修改)

- ✅ .specify/templates/tasks-template.md (复核，无需修改)- ✅ .specify/templates/tasks-template.md (复核，无需修改)

- ✅ .specify/templates/agent-file-template.md (复核，无需修改)- ✅ .specify/templates/agent-file-template.md (复核，无需修改)

Follow-up TODOs: 无Follow-up TODOs: 无

-->-->



# Web 俄罗斯方块（Tetris） Constitution# Web 俄罗斯方块（Tetris） Constitution



## Core Principles## Core Principles



### I. TypeScript 严谨代码质量### I. TypeScript 严谨代码质量



- 项目 MUST 使用 TypeScript 严格模式并保持 CI 中零类型错误。- 项目 MUST 使用 TypeScript 严格模式并保持 CI 中零类型错误。

- 核心玩法逻辑（旋转、碰撞检测、消行、计分、关卡推进）必须以纯函数实现，并提供可独立测试的输入输出。- 核心玩法逻辑（旋转、碰撞检测、消行、计分、关卡推进）必须以纯函数实现，并提供可独立测试的输入输出。

- 禁止魔法数字：改用命名常量或配置表，并在模块顶部记录来源。- 禁止魔法数字：改用命名常量或配置表，并在模块顶部记录来源。

- 关键模块（玩法、状态管理、渲染、输入）必须提供文档注释说明约束与数据流。- 关键模块（玩法、状态管理、渲染、输入）必须提供文档注释说明约束与数据流。

- 引入第三方依赖前必须在 plan.md 中说明必要性，首选零或低依赖实现。- 引入第三方依赖前必须在 plan.md 中说明必要性，首选零或低依赖实现。



Rationale: 确保核心玩法行为可预测、易回归与可复用。Rationale: 确保核心玩法行为可预测、易回归与可复用。



### II. 测试覆盖与可复现性### II. 测试覆盖与可复现性



- 全仓单元测试覆盖率 MUST ≥80%，核心玩法纯函数覆盖率 MUST ≥90%。- 全仓单元测试覆盖率 MUST ≥80%，核心玩法纯函数覆盖率 MUST ≥90%。

- 采用 TDD：每个实现前先提交失败的测试，合并前测试必须全部通过。- 采用 TDD：每个实现前先提交失败的测试，合并前测试必须全部通过。

- 端到端测试 MUST 覆盖开局、移动、旋转、软降、硬降、暂存、暂停、游戏结束、本地高分流程。- 端到端测试 MUST 覆盖开局、移动、旋转、软降、硬降、暂存、暂停、游戏结束、本地高分流程。

- 7-袋随机数生成器必须支持种子输入以复现对局，并在测试中验证。- 7-袋随机数生成器必须支持种子输入以复现对局，并在测试中验证。

- CI 不得放行覆盖率下降或关键路径测试缺失的 PR。- CI 不得放行覆盖率下降或关键路径测试缺失的 PR。



Rationale: 高覆盖与可复现性保证玩法演进不破坏基础体验。Rationale: 高覆盖与可复现性保证玩法演进不破坏基础体验。



### III. 一致的 60 FPS 交互体验### III. 一致的 60 FPS 交互体验



- 渲染目标为 60 FPS，掉帧诊断需能在开发态快速定位。- 渲染目标为 60 FPS，掉帧诊断需能在开发态快速定位。

- 键盘绑定固定为 ←/→ 移动、↓ 软降、↑ 或 X 顺时针、Z 逆时针、Space 硬降、Shift 或 C 暂存、P 或 Esc 暂停，并在 UI 清晰展示。- 键盘绑定固定为 ←/→ 移动、↓ 软降、↑ 或 X 顺时针、Z 逆时针、Space 硬降、Shift 或 C 暂存、P 或 Esc 暂停，并在 UI 清晰展示。

- 触控手势：左右滑动移动，轻点或上滑旋转，短下滑软降，长下滑硬降。- 触控手势：左右滑动移动，轻点或上滑旋转，短下滑软降，长下滑硬降。

- 状态变化（暂存成功、消行、关卡提升、Game Over）必须即时反馈并与输入事件同步。- 状态变化（暂存成功、消行、关卡提升、Game Over）必须即时反馈并与输入事件同步。



Rationale: 一致的输入与反馈是竞技型 Tetris 的核心体验。Rationale: 一致的输入与反馈是竞技型 Tetris 的核心体验。



### IV. 渲染性能与稳定性### IV. 渲染性能与稳定性



- 游戏循环 MUST 以 `requestAnimationFrame` 驱动，禁止 `setInterval` 等非同步刷新方案用于帧渲染。- 游戏循环 MUST 以 `requestAnimationFrame` 驱动，禁止 `setInterval` 等非同步刷新方案用于帧渲染。

- 渲染与状态更新应批处理以最小化重排/重绘，并在性能分析中持续验证。- 渲染与状态更新应批处理以最小化重排/重绘，并在性能分析中持续验证。

- 项目需提供 20 分钟持续游玩的 soak 测试指引，确保无显著内存泄漏或帧率衰减。- 项目需提供 20 分钟持续游玩的 soak 测试指引，确保无显著内存泄漏或帧率衰减。

- 开发模式下需可开启 FPS 与步长叠层以辅助诊断。- 开发模式下需可开启 FPS 与步长叠层以辅助诊断。



Rationale: 稳定帧率与可诊断性确保长时间游玩质量。Rationale: 稳定帧率与可诊断性确保长时间游玩质量。



### V. 全面可访问性### V. 全面可访问性



- 颜色与排版必须满足 WCAG 2.1 AA 对比度要求，并提供高对比主题切换。- 颜色与排版必须满足 WCAG 2.1 AA 对比度要求，并提供高对比主题切换。

- 全部操作可通过键盘完成，焦点状态清晰可见。- 全部操作可通过键盘完成，焦点状态清晰可见。

- 关键状态（消行、关卡变更、警报）使用 `aria-live` 进行播报，避免信息遗漏。- 关键状态（消行、关卡变更、警报）使用 `aria-live` 进行播报，避免信息遗漏。

- 提供音量调节与静音支持，并附加简洁模式降低闪烁与粒子特效。- 提供音量调节与静音支持，并附加简洁模式降低闪烁与粒子特效。



Rationale: 可访问的体验让更多玩家公平参与。Rationale: 可访问的体验让更多玩家公平参与。



## Operational Standards## Operational Standards



- **安全与隐私**：应用是纯前端，无服务端写操作；仅允许在 `localStorage` 中保存设置与高分；配置严格 CSP（self-only，禁止内联脚本与 eval）；不得请求敏感浏览器权限。- **安全与隐私**：应用是纯前端，无服务端写操作；仅允许在 `localStorage` 中保存设置与高分；配置严格 CSP（self-only，禁止内联脚本与 eval）；不得请求敏感浏览器权限。

- **可观测性**：提供可切换的开发调试面板，用于显示 FPS、帧时间、错误堆栈；运行时错误需弹出非阻塞提示并指向排查文档。- **可观测性**：提供可切换的开发调试面板，用于显示 FPS、帧时间、错误堆栈；运行时错误需弹出非阻塞提示并指向排查文档。

- **依赖与许可**：仓库授权为 MIT；所有三方依赖必须保证许可证兼容并维护清单；按季度执行体积与安全审计并记录结论。- **依赖与许可**：仓库授权为 MIT；所有三方依赖必须保证许可证兼容并维护清单；按季度执行体积与安全审计并记录结论。



## Delivery Workflow## Delivery Workflow



- **版本控制**：遵循 Conventional Commits；核心逻辑改动必须通过 Pull Request 并附带测试；分支命名格式 `feature/###-web-tetris-xxx`。- **版本控制**：遵循 Conventional Commits；核心逻辑改动必须通过 Pull Request 并附带测试；分支命名格式 `feature/###-web-tetris-xxx`。

- **文档管理**：`README` 覆盖玩法说明、操作映射、构建与部署；维护 `CHANGELOG` 并在破坏性变更中提供迁移指导。- **文档管理**：`README` 覆盖玩法说明、操作映射、构建与部署；维护 `CHANGELOG` 并在破坏性变更中提供迁移指导。

- **AI 代理协作**：AI 修改前先执行 `/clarify` 获取上下文，再 `/plan`、`/implement`；新增超出宪章范围的功能需说明动机与资料来源，并获得维护者批准；自动生成代码必须遵循本宪章并补齐测试。- **AI 代理协作**：AI 修改前先执行 `/clarify` 获取上下文，再 `/plan`、`/implement`；新增超出宪章范围的功能需说明动机与资料来源，并获得维护者批准；自动生成代码必须遵循本宪章并补齐测试。

- **验收流程**：以“评审与验收清单”为准，功能合并前需验证测试、性能（60 FPS／20 分钟 soak）、可访问性与文档全部达标。- **验收流程**：以“评审与验收清单”为准，功能合并前需验证测试、性能（60 FPS／20 分钟 soak）、可访问性与文档全部达标。



## Governance## Governance



- 本宪章高于其他开发约定；所有计划、任务与评审必须引用并验证相关原则。- 本宪章高于其他开发约定；所有计划、任务与评审必须引用并验证相关原则。

- 修订流程：提出者需在 PR 中列出拟改动、影响分析与模板同步项；经核心维护者双人批准后生效，并更新版本与“Sync Impact Report”。- 修订流程：提出者需在 PR 中列出拟改动、影响分析与模板同步项；经核心维护者双人批准后生效，并更新版本与“Sync Impact Report”。

- 宪章版本遵循语义化：新增或扩展原则为 MINOR，破坏性调整或原则删除为 MAJOR，文字澄清为 PATCH。- 宪章版本遵循语义化：新增或扩展原则为 MINOR，破坏性调整或原则删除为 MAJOR，文字澄清为 PATCH。

- 每季度进行一次合规巡检，记录执行情况与待改善项并存档。- 每季度进行一次合规巡检，记录执行情况与待改善项并存档。



**Version**: 1.0.0 | **Ratified**: 2025-10-03 | **Last Amended**: 2025-10-03**Version**: 1.0.0 | **Ratified**: 2025-10-03 | **Last Amended**: 2025-10-03
