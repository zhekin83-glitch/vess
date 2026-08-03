
<h1 align="center">器灵 Vess</h1>

<p align="center">
  <strong>桌面端 AI Agent 运行时 — 别人的 AI 只会聊天，器灵帮你把事做完</strong>
</p>

<p align="center">
  <a href="https://github.com/zhekin83-glitch/vess"><img src="https://img.shields.io/badge/GitHub-zhekin83--glitch%2Fvess-181717?style=for-the-badge&logo=github" alt="GitHub" height="28" /></a>
  &nbsp;
  <a href="http://agent.lanmeiti.cn"><img src="https://img.shields.io/badge/管理端-agent.lanmeiti.cn-3DDC97?style=for-the-badge" alt="Admin" height="28" /></a>
  &nbsp;
  <a href="README.md"><img src="https://img.shields.io/badge/English-README-gray?style=for-the-badge" alt="English" height="28" /></a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/license-AGPL--3.0--only-blue.svg?style=flat-square" alt="License" />
  <img src="https://img.shields.io/badge/python-3.11+-blue.svg?style=flat-square" alt="Python" />
  <img src="https://img.shields.io/badge/desktop-Tauri-orange.svg?style=flat-square" alt="Tauri" />
  <img src="https://img.shields.io/badge/version-1.27.32-green.svg?style=flat-square" alt="Version" />
</p>

<p align="center">
  本地运行 · 会做事 · 可扩展 · 企业可管控 · 多 IM · 技能 / MCP / 插件
</p>

<p align="center">
  <a href="#什么是器灵-vess">产品简介</a> ·
  <a href="#六大能力">六大能力</a> ·
  <a href="#企业能做什么">企业场景</a> ·
  <a href="#monaco-tauri">Monaco-Tauri</a> ·
  <a href="#快速开始">快速开始</a> ·
  <a href="#仓库与上游">仓库</a>
</p>

---

## 什么是器灵 Vess？

**器灵 Vess** 是一款运行在本机的 **AI Agent 桌面终端**：多模型对话、工具调用、多 IM 接入、技能与插件扩展、长期记忆与计划任务。企业场景下可通过管理端统一账号、模型能力、配额与更新分发。

它不是「又一个网页聊天框」，而是 **可配置、可扩展、可管控的本地 Agent 运行时**。

|||  
|--|--|
| **品牌** | 器灵 Vess |
| **定位** | 桌面终端 · 能做事的 AI Agent |
| **口号** |别人的AI只会聊天，器灵帮你把事做完|
| **数据目录** | `~/.vess` |
| **本地服务** | 默认端口 `18900` |
| **技术底座** | 基于开源 [OpenAkita](https://github.com/openakita/openakita) 引擎 |

---

## 六大能力

### 1. 本地 Agent 运行时

- Windows 一键安装（NSIS），安装包内置运行时引导，无需用户预装 Python
- 图形化配置向导，约 5 分钟完成工作区与模型接入
- 本机常驻，会话与配置可控；支持局域网 Web 访问（密码保护）
- 国内友好默认：镜像源、搜索与中文安装体验

### 2. 全能对话与多模态

- 流式对话、思考链、附件与图片交互
- 模型能力可配置：文本 / 思考 / 图片 / 视频 / 工具 等
- **管理端默认同步模型与能力**，同时支持用户 **自建第三方端点**
- Token / 技能用量可视，便于成本观察

### 3. 会做事的工具栈

- Shell、文件、浏览器、桌面操作、联网搜索等
- 高危操作进入 **待审批** 队列，人在回路
- 多 Agent / 组织编排（部分能力标 Beta）

### 4. 技能 · MCP · 插件

- **技能**：本地管理与市场安装，沉淀可复用 SOP
- **MCP**：stdio / HTTP / SSE，动态接入外部工具
- **工作台插件**：以应用形式扩展垂直能力

### 5. 连接真实工作流

- IM：飞书 / 钉钉 / 企微 / 微信 / QQ / Telegram / OneBot 等
- 计划任务：Cron / 间隔 / 一次性 Agent 任务
- 通知 Inbox：系统公告与客户端更新推送

### 6. 企业级管控与安全

- 管理端：账号登录、审核注册、角色模型授权、配额
- 模型中转与能力下发；客户端自动检查更新
- **六层沙箱**：路径分区、确认门、命令策略、快照、OS 隔离等

---

## 企业能做什么？

对企业而言，Vess = **本地 Agent 工作台 + 企业管控面**：

| 诉求 | 交付 |
|------|------|
| **管得住** | 统一账号、模型上架/下线、能力与配额、角色授权 |
| **用得上** | 桌面端常驻、IM 接入业务群、计划任务、技能 SOP |
| **做得成** | 工具真正执行；高危操作审批；沙箱隔离 |
| **扩得开** | MCP / 插件 / 垂直工作台对接内部系统 |
| **放得心** | 本地运行时；可私有化管理端与模型中转 |
| **带得动研发** | Monaco-Tauri：历史对话 + 问答编程 |

### 典型场景（节选）

| 分区 | 场景 |
|------|------|
| 治理安全 | 统一模型与合规、配额经营、高危操作人在回路、版本与公告分发 |
| 协同服务 | 飞书/钉钉/企微数字同事、对外客服问答、会议纪要与催办 |
| 研发工程 | Monaco-Tauri 问答编程、运维巡检、内部 API（MCP）编排 |
| 业务运营 | 经营日报自动化、企业知识助手、垂直业务工作台、敏感办公本地优先 |

更完整的场景说明见宣传站开发文档：`docs/` 或内部站点「使用场景」页。

---

## Monaco-Tauri

**Monaco-Tauri** 是基于 Vess Agent 能力的 **桌面开发编辑器**（产品线规划）：

- Monaco 级代码编辑体验
- 与 Vess 同源的 **历史对话** 与上下文
- **问答式编程**：自然语言生成 / 解释 / 重构代码
- 复用 Vess 模型、工具与安全策略

> 源码仓库独立发布后，将在本 README 与页脚补充 Git 地址。

---

## 产品矩阵

| 产品 | 说明 |
|------|------|
| **器灵 Vess** | 桌面 Agent 运行时（本仓库） |
| **Monaco-Tauri** | 基于 Vess 的开发编辑器 |
| **管理端** | 账号、模型、能力、配额、公告与更新 · [agent.lanmeiti.cn]|

---

## 快速开始

### 方式一：安装包（推荐）

1. 获取 Windows x64 安装包（如 `Vess_x.y.z_x64-setup.exe`）
2. 双击安装（当前用户模式，一般无需管理员）
3. 首次启动按向导完成工作区；企业用户使用管理端账号登录后自动同步授权模型
4. 开始对话、配置 IM / 技能 / 计划任务

> 未签名安装包可能触发 SmartScreen，选择「仍要运行」即可。首次启动可能需联网拉取运行依赖。

### 方式二：从源码开发

```bash
# 环境：Python 3.11+、Node 20+、Rust（桌面端）
git clone https://github.com/zhekin83-glitch/vess.git
cd vess

# 后端依赖（示例）
pip install -e .

# 桌面前端
cd apps/setup-center
npm install
npm run tauri dev
```

详细桌面打包与 bootstrap 说明见 `apps/setup-center/` 与 `build/`。

### 配置提示

- 复制 `.env.example` 为 `.env`，**不要提交真实密钥**
- 企业模式：登录管理端后，模型与能力由后台下发；仍可自建第三方 LLM 端点
- 数据默认落在 `~/.vess`

---

## 仓库与上游

| 项目 | 地址 |
|------|------|
| **本仓库（器灵 Vess）** | https://github.com/zhekin83-glitch/vess |
| **上游引擎 OpenAkita** | https://github.com/openakita/openakita |
| **管理端** | http://agent.lanmeiti.cn |

Vess 在 OpenAkita 开源能力之上，叠加桌面发行、国内默认体验与企业管理端对接（账号 / 模型中转 / 公告更新等）。请遵循本仓库 `LICENSE` / `NOTICE`，并对上游保留应有致谢。

---

## 文档与目录速览

```
vess/
├── apps/setup-center/     # Tauri 桌面端（器灵Vess UI）
├── src/openakita/         # Agent 运行时核心
├── plugins/               # 插件
├── skills/                # 技能
├── build/                 # 打包 / bootstrap
├── docs/                  # 文档与指南
└── README_CN.md           # 本文件
```

更多架构与模块说明见 `docs/`、`AGENTS.md`、`CONTRIBUTING.md`。

---

## 许可证

AGPL-3.0-only。详见 [LICENSE](LICENSE)、[NOTICE](NOTICE)。

---

<p align="center">
  <strong>器灵 Vess</strong> · 桌面终端 · 能做事的 AI Agent<br/>
  <sub>管得住 · 用得上 · 做得成</sub>
</p>
