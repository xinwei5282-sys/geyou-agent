# 格优代理端

本目录是独立Git仓库，唯一入口`web/src/geyou/AgentApp.tsx`。主端口5197；`/__project`应返回本目录及`mode=local-agent-prototype`。不要将旧5187工作树作为本项目修改目标。

先读`PROJECT_RULES.md`、`.codex/`及`docs/codex/handoff.md`。验证使用`npm test`、`npm run typecheck`、`npm run build`；页面变化按实际影响真实渲染。入口`/#/agent`，不提供总工作台或后台导航。主PRD是`docs/codex/prd/geyou-agent-prd.md`；原总纲只作拆分来源。

使用当前仓库本身的node_modules、锁文件和源码，不建立指向旧工程的软链。公开演示账号仅限本地原型；不要提交真实资料、密钥、浏览器状态、图像任务数据库或生成输出。commit与push分开处理，未获授权不发布远端。
