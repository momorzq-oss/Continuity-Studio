# Continuity Studio

由阿联酋创作者 **Mohammed Al Marzooqi（Burabeeh）** 创建。

[English](README.md) · [العربية](README.ar.md) · [Español](README.es.md) · [中文](README.zh-CN.md)

Continuity Studio 是一个开源的 AI 电影制作与连续性管理系统。它把一个创意转化为可在本机检查的完整项目，包括故事、电影圣经、视觉资产、连续性设定表、场景、故事板、序列、平台提示词、验证和导出。

它的核心目标是在 AI 辅助制作中保持角色身份、服装、道具、动物、地点、地理关系、光线和损伤状态的一致。

## 完整工作流

创意 → 参考资料 → 故事 → 电影圣经 → 资产清单 → 角色/生物/动物/地点/道具设定表 → 场景资产 → 故事板与图像 → 序列 → START/MID/END 帧 → 标准提示词 → 平台提示词编译器 → 生成流程 → 连续性检查 → 审批 → 导出。

## v1.0.0 已实现功能

- Full（完整自动流程）与 Phases（分阶段审批）模式。
- 写作前的 AI First、Reference First 和 Hybrid 参考模式。
- 受保护的原始参考资料和主角永久参考来源。
- Story Engine、Film Bible 以及 53 条可执行制作规则。
- 稳定资产 ID、关系、来源链、版本、审批和锁定状态。
- 能生成真实本地 PNG 文件的预可视化任务和自适应连续性设定表。
- 带依赖检查、主图和 START/MID/END 状态的场景资产。
- 与场景主图分离的 Storyboard 图像。
- 标准提示词，以及 Seedance、MiniMax、Higgsfield 和 Generic 的可编辑模型配置。
- 临时平台参考标签不会改变项目内部永久 ID。
- 内置离线引擎、可选 OpenAI 兼容本地模型、Codex 监督和可选 OpenAI 文本提供方。
- 本地持久化和 ZIP 导出。
- Windows 安装程序和便携版。

## 提供方的真实状态

- **OpenAI API：** 文本集成可用，需要 `OPENAI_API_KEY`。
- **Codex：** 可通过 Codex/ChatGPT 登录进行监督。
- **本地模型：** 可选的 OpenAI 兼容文本服务器。
- **Seedance 2.5：** 支持提示词编译、参考标签和手动导出；没有直接生成 API。
- **MiniMax S2V-01：** 支持主体参考、提示词编译和手动导出；没有直接 API。
- **Higgsfield：** 支持参考计划、专用提示词和手动导出；没有直接 API。
- **KimiBrain：** 未来计划，v1.0.0 尚未集成。
- **本地渲染器：** 生成预可视化 PNG，不是照片级生成模型。

上述品牌未赞助、认可或正式合作 Continuity Studio。

## 中文 CLI 安装

要求：Node.js 20.19 或更高版本（推荐 Node.js 22 LTS）、npm 10 或更高版本；克隆仓库时需要 Git。v1.0.0 不需要 Python、FFmpeg 或外部数据库。

```bash
git clone https://github.com/momorzq-oss/Continuity-Studio.git
cd Continuity-Studio
npm run setup -- --lang zh
npm run desktop:dev
```

非交互模式：`npm run setup -- --lang zh --yes`。

安装助手会检查 Node.js，并询问是否安装依赖、创建 `.env` 和运行类型检查及测试。它不会请求或显示任何密钥。请参阅[中文安装指南](docs/i18n/zh-CN/INSTALLATION.md)、[快速入门](docs/i18n/zh-CN/QUICK_START.md)和[用户指南](docs/i18n/zh-CN/USER_GUIDE.md)。

Windows 用户也可以从 GitHub Releases 下载安装程序或便携版。二进制文件没有商业代码签名证书，因此 Windows 可能显示“未知发布者”警告。

## 基本使用

1. 创建项目并设置时代、格式、时长和故事模式。
2. 添加可选参考资料和角色；需要时把一张图指定为主角参考。
3. 完成 Reference Setup，然后运行 Production Agent。
4. 审阅 Story、Film Bible 和 Asset Manifest。
5. 生成设定表，并锁定已批准版本。
6. 生成 Scene Assets、Storyboard、序列和 START/MID/END 状态。
7. 编译提示词，检查标签和限制，然后手动提交到外部平台。
8. 解决连续性问题并导出 ZIP。

## 与提供方无关的身份系统

`CHAR_MAIN_001` 永久属于项目，而 `@Image 1` 只是某一次平台请求中的临时标签。系统保留稳定 ID，并为各个平台生成所需格式。

## 隐私

本地项目、参考资料、生成媒体和日志都被 Git 忽略。密钥只能放在同样被忽略的 `.env` 中。请勿把私人照片或未公开项目提交到公共仓库。

## 创建者与许可证

Mohammed Al Marzooqi（Burabeeh）是来自阿联酋的 AI 创作者、独立电影人、软件实验者和科技爱好者。Continuity Studio 源自他为 AI 电影解决身份与连续性问题的实际工作。Copyright 2026 Mohammed Al Marzooqi；采用 [Apache-2.0](LICENSE) 许可证。
