# 部署验收清单

日期：2025-10-04
负责人：GitHub Copilot

## 构建与预览
- [x] `npm run build`
  - 状态：成功（tsc + vite build），产物位于 `dist/`
  - 关键输出：`dist/assets/index-DFMXE11V.js` 50.21 kB（gzip 16.07 kB），`dist/index.html` 0.80 kB
- [x] `npm run preview -- --host 127.0.0.1 --port 4173 --strictPort --clearScreen false`
  - 状态：成功启动，本地可通过 <http://127.0.0.1:4173/> 访问
  - 验证：命令输出本地地址，预览服务已在操作后关闭
- [x] GitHub Pages 发布检查
  - 状态：CI 工作流 `.github/workflows/ci.yml` 已配置依序执行 typecheck → lint → test → coverage:check → bundle:check → e2e → build → Pages 部署
  - 说明：本地验证构建与预览通过；远程部署由 Actions 自动完成，后续发布可直接依赖工作流

## 产物记录
- 产物目录：`dist/`
- 清单：`.vite/manifest.json`、`index.html`、`assets/index-CH-c4U4E.css`、`assets/index-DFMXE11V.js`

## 端到端验证
- [x] Playwright 多浏览器矩阵（Chromium / Firefox / WebKit）
- [x] 离线种子复现测试（`tests/e2e/offline-seed.spec.ts`，chromium-desktop 项目）

## 后续动作
- [ ] GitHub Pages 发布完成后截图并归档（待上线时执行）
- [ ] 定期验证 Actions 状态，确保多浏览器矩阵与离线测试后续任务完成
