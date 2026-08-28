# Continuity Studio By BURABEEH

由阿联酋创作者 **Mohammed Al Marzooqi（BURABEEH）** 创建。

[English](README.md) · [العربية](README.ar.md) · [Español](README.es.md) · [中文](README.zh-CN.md)

Continuity Studio By BURABEEH 是一个本地优先的 AI 电影制作与连续性工作区。它把一个创意转换为结构化的 Movie DNA、故事、电影圣经、角色、参考图、资产、剧本、序列、镜头和平台提示词记录。

![Sequence Workspace v3](docs/screenshots/39-sequence-detail.png)

## 当前版本 v1.1.0

- Visual Movie DNA：27 个类别、629 个选项，并支持比较、版本、锁定、主画面和全局地点。
- Story v2：完整故事、故事结构、时间线、角色弧、序列拆分、审批和锁定。
- Film Bible、角色分析、受保护参考图、角色设定表和逐序列角色状态。
- 编号 Asset Manifest、Image Asset Library、检查、定向提示词编辑、版本、审批和锁定。
- Full Script v2：完整剧本、仅对白、Shot Script 和 Production Script。
- Sequence Workspace v3：同步的 Normal Prompt 与 JSON Prompt、验证、版本、Previous/Next 和可选 Storyboard Grid。
- Seedance、Higgsfield、MiniMax、Veo、Kling、Runway、Sora 和 Custom 的版本化 Platform Profiles。
- 永久 ID、`@Image` 编号、上传顺序和序列参考包。
- Full 与 Phases 模式、Production Agent、本地 JSON/Markdown/媒体存储和 ZIP 导出。

## 版本边界

v1.1.0 尚未完成直接视频生成、生成视频导入、自动视频检查、尝试审批、自动 END→START 转移、完成度仪表板和最终影片合成。请查看[路线图](docs/ROADMAP.md)。

## 中文安装

要求：Node.js 20.19 或更高版本、npm 10 或更高版本；克隆时需要 Git。

```bash
git clone https://github.com/momorzq-oss/Continuity-Studio.git
cd Continuity-Studio
npm run setup -- --lang zh
npm run desktop:dev
```

非交互配置使用 `npm run setup -- --lang zh --yes`。也可以从 [GitHub Releases](https://github.com/momorzq-oss/Continuity-Studio/releases) 下载 Windows 安装版或便携版。当前文件未进行商业代码签名，因此 Windows 可能显示未知发布者警告。

## 快速使用

1. 创建项目并选择 Full 或 Phases。
2. 选择、检查并锁定 Movie DNA。
3. 创建并审批 Story v2、Film Bible、角色、参考图和资产。
4. 检查 Full Script v2，锁定对白并规划镜头与序列。
5. 打开 Sequence Workspace，选择 Platform Profile，并验证 Normal/JSON Prompt。
6. 检查参考图编号和上传顺序，再手动把提示词与参考包传到提供方。
7. 导出结构化项目 ZIP。

请参阅[中文安装指南](docs/i18n/zh-CN/INSTALLATION.md)、[快速入门](docs/i18n/zh-CN/QUICK_START.md)、[用户指南](docs/i18n/zh-CN/USER_GUIDE.md)和[截图画廊](docs/SCREENSHOTS.md)。

项目、参考图和媒体保存在本地并被 Git 忽略。密钥只能放在 `.env` 中。平台名称不表示赞助、认可或正式合作。

Copyright 2026 Mohammed Al Marzooqi；采用 [Apache License 2.0](LICENSE) 许可证。
