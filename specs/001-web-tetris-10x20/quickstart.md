# Quickstart: Web 俄罗斯方块（Tetris）

## 前置条件
- Node.js 20.x（含 npm 10 或 pnpm 8）
- 支持 Canvas/Web Audio 的现代浏览器（Chromium 120+ / Firefox 120+ / Safari 17+）
- Playwright 依赖（`npx playwright install --with-deps`）

## 安装
```bash
npm install
# 或 pnpm install
```

## 开发调试
```bash
npm run dev
```
- 默认监听 `http://localhost:5173`
- 开发菜单包含：FPS/步长叠层开关、手势说明、设置快捷入口
- 保存 TypeScript 文件后启用 HMR

## 质量校验
```bash
npm run typecheck
npm run lint
npm run test   # Vitest + 覆盖率
npm run e2e    # Playwright，多视口巡检
```
- 覆盖率在 CI 中要求全局 ≥80%、`src/core` ≥90%
- Playwright 测试覆盖：开局、移动/旋转/软降/硬降、Hold、暂停、Game Over、本地高分

## 构建与部署
```bash
npm run build
npm run preview  # 本地预览生产构建
```
- GitHub Actions 在 `main` 分支执行：typecheck → lint → test → e2e → build → 部署到 GitHub Pages
- 构建产物位于 `dist/`，附带严格 CSP `<meta>` 标头；静态资源可离线缓存以实现脱机可玩

## 离线与数据管理
- 首次成功加载后，Service Worker（或静态缓存策略）保证离线可玩
- localStorage 键：`tetris:settings`、`tetris:highscores`
- 清空数据：在设置面板点击 “重置数据” 并二次确认

## Soak 测试
```bash
npm run soak
```
- 启动自动化输入脚本模拟 20 分钟游玩
- 输出 FPS、内存占用与锁延迟统计到 `reports/soak-[timestamp].json`

## 可访问性检查
```bash
npm run e2e -- --project=a11y
```
- 使用 Playwright Axe 插件对关键界面进行 WCAG 2.1 AA 审核

## 常见问题
- **音频无法播放**：需先与页面交互（点击或按键）以解锁 AudioContext
- **触控下滑无响应**：确认是否在“设置 → 手势说明”中查看阈值；过短距离不会触发硬降
- **覆盖率不足**：检查 `src/core` 模块是否新增未测案例，优先补齐 Vitest 单元测试
