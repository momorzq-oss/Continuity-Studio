# 中文用户指南

## 1. 项目与模式

创建项目时，创意是全流程的输入。Full 模式连续执行故事到导出；Phases 模式在每个主要产物后等待审批。可以在代理未运行时切换模式。

### 自动模式

选择 **AUTOMATIC MOVIE** 后，输入电影简介、时长、语言和主角偏好，然后按 **CREATE MY MOVIE**。Studio Brain 会选择 Movie DNA 与 Platform Profile，创建 Story、Film Bible 和角色分析，并在必需的主角身份检查点暂停。你可以上传受保护的身份图并创建中性角色表，也可以选择由 AI 生成的虚构角色。每个阶段和决定都会保存；Pause、Resume、Stop、Manual Override 和重启恢复都不会丢失已完成的工作。

### 手动引导模式

选择 **MANUAL PRODUCTION** 后，应用先显示简洁的 **DESCRIBE YOUR MOVIE** 页面。输入可选片名、电影简介、预计时长、影片语言、对白语言，以及可选的首选平台，然后按 **NEXT**。Studio Brain 会分析简介，自动填写可编辑的 Project Setup 和 Visual Movie DNA 建议，但不会自动批准。

固定进度栏显示从 Brief 到 Export 的 14 个阶段。使用 **BACK**、**SAVE**、**NEXT**、**APPROVE AND NEXT** 和 **LOCK AND NEXT**。如果缺少必需信息，NEXT 会停用并明确说明原因。重新打开项目时会显示 **CONTINUE WHERE YOU LEFT OFF**，可选择 **RESUME** 或 **VIEW PROJECT**。Manual 与 Automatic 模式可以互相切换，并保留所有项目数据、批准状态和参考图。

## 2. 写作前参考设置

- **AI First：** 先由系统设计故事与资产。
- **Reference First：** 参考资料决定故事约束。
- **Hybrid：** 参考资料锁定关键身份，其余由系统扩展。

原始上传文件保持不变。角色、用途、优先级和来源关系记录在项目中。主角参考会绑定到永久角色身份。

## 3. 故事、电影圣经与规则

Story 定义剧情和角色；Film Bible 锁定世界、视觉语言和限制；Rules 把连续性原则变成可执行检查。修改或覆盖规则时应记录理由。

## 4. 资产和设定表

Characters、Creatures、Locations 和 Props 使用稳定 ID。生成工作会写入 PNG、状态、版本和来源链。批准后锁定版本，避免后续场景意外改变身份。

## 5. 场景与故事板

Scene Assets 在依赖资产就绪后生成主场景图以及 START/MID/END 状态。Storyboard 是单独的镜头层，不能用它覆盖场景主图。重复生成默认复用现有结果；强制重生成会创建新版本。

## 6. 序列、帧和连续性

Sequence Planner 组织时间单元，Frame Planner 保存开始、中间和结束锚点。Continuity Inspector 检查身份、位置、光线、道具和损伤。阻断问题必须解决或带理由覆盖。

## 7. 平台提示词

系统先建立与平台无关的 Canonical Prompt，再按照模型配置编译。永久 ID 与临时标签分离。例如 `CHAR_MAIN_001` 可以在一次请求中映射为 `@Image 1`，下一次请求仍保留同一内部身份。

OpenAI 文本和 Codex 监督可按配置工作。Sequence Workspace v3 提供同步 Normal/JSON 提示词、版本和参考图编号。Seedance、Higgsfield、MiniMax、Veo、Kling、Runway 和 Sora 在 v1.1.0 中是手动提示词与参考包交接，不是直接生成 API。

## 8. 导出与隐私

导出前检查阻断问题。ZIP 包含结构化 JSON、Markdown 和项目媒体。`data/`、`.env`、日志、上传参考和生成媒体都不会提交到 Git。共享前仍应检查 ZIP 是否包含私人素材。
