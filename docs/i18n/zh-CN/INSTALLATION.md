# 中文安装指南

## 系统要求

- Node.js 20.19+；推荐 Node.js 22 LTS。
- npm 10+。
- 从 GitHub 克隆时需要 Git。
- Windows 10/11 x64 可构建和运行桌面包。
- v1.0.0 不要求 Python、FFmpeg 或外部数据库。

## 交互式 CLI 安装

```bash
git clone https://github.com/momorzq-oss/Continuity-Studio.git
cd Continuity-Studio
npm run setup -- --lang zh
```

安装助手会检查 Node.js，然后询问是否：

1. 运行 `npm install`；
2. 从 `.env.example` 创建本地 `.env`；
3. 执行类型检查和自动测试。

它不会要求输入密钥，也不会输出密钥。请在本地用文本编辑器把可选密钥写入 `.env`。

全部接受的非交互式命令：

```bash
npm run setup -- --lang zh --yes
```

查看帮助：

```bash
npm run setup -- --help
```

## 启动

浏览器开发模式：`npm run dev`，然后打开 `http://localhost:8787`。

桌面开发模式：`npm run desktop:dev`。

生产模式：先运行 `npm run build`，再运行 `npm start`。

## Windows 安装包

可以从 GitHub Releases 下载 NSIS 安装程序或 portable 便携版。公开的 v1.0.0 文件没有商业代码签名；Windows 可能要求你确认未知发布者。仅从官方 GitHub 仓库下载并校验 Release 信息。

从源码构建 Windows 包：

```bash
npm run desktop:package
```

输出位于 `release/windows-v1.0.0/`，该目录不会提交到 Git。

## 可选配置

复制 `.env.example` 为 `.env`。`OPENAI_API_KEY` 只用于可选 OpenAI 文本提供方；仅当本地模型服务器要求认证时才需要 `LOCAL_LLM_API_KEY`。MiniMax、Seedance 和 Higgsfield 的变量为未来直接适配器预留，v1.0.0 不会使用它们调用 API。
