#!/usr/bin/env node
import { copyFileSync, existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";

const messages = {
  en: {
    name: "English", title: "Continuity Studio CLI setup", node: "Checking Node.js version", badNode: "Node.js 20.19+ is required; Node.js 22 LTS is recommended.",
    install: "Install npm dependencies now?", env: "Create .env from .env.example?", checks: "Run type checking and automated tests?",
    installed: "Dependencies installed.", envMade: ".env created. Add only the provider keys you choose to use.", envExists: ".env already exists; it was not changed.",
    done: "Setup complete.", failed: "Setup stopped because a command failed.", next: "Start the desktop development app with: npm run desktop:dev",
  },
  ar: {
    name: "العربية", title: "إعداد Continuity Studio عبر سطر الأوامر", node: "جارٍ التحقق من إصدار Node.js", badNode: "يلزم Node.js 20.19 أو أحدث، ويُنصح بإصدار Node.js 22 LTS.",
    install: "هل تريد تثبيت حزم npm الآن؟", env: "هل تريد إنشاء ملف .env من .env.example؟", checks: "هل تريد تشغيل فحص الأنواع والاختبارات الآلية؟",
    installed: "تم تثبيت الحزم.", envMade: "تم إنشاء .env. أضف فقط مفاتيح مزودي الخدمة الذين تختارهم.", envExists: "ملف .env موجود مسبقًا ولم يتم تغييره.",
    done: "اكتمل الإعداد.", failed: "توقف الإعداد بسبب فشل أحد الأوامر.", next: "لتشغيل نسخة سطح المكتب للتطوير: npm run desktop:dev",
  },
  es: {
    name: "Español", title: "Instalación de Continuity Studio por CLI", node: "Comprobando la versión de Node.js", badNode: "Se requiere Node.js 20.19 o posterior; se recomienda Node.js 22 LTS.",
    install: "¿Instalar ahora las dependencias de npm?", env: "¿Crear .env a partir de .env.example?", checks: "¿Ejecutar la comprobación de tipos y las pruebas automáticas?",
    installed: "Dependencias instaladas.", envMade: ".env creado. Añade únicamente las claves de los proveedores que decidas usar.", envExists: ".env ya existe y no se modificó.",
    done: "Instalación completada.", failed: "La instalación se detuvo porque falló un comando.", next: "Inicia la aplicación de escritorio en desarrollo con: npm run desktop:dev",
  },
  zh: {
    name: "中文", title: "Continuity Studio 命令行安装", node: "正在检查 Node.js 版本", badNode: "需要 Node.js 20.19 或更高版本，推荐使用 Node.js 22 LTS。",
    install: "现在安装 npm 依赖项吗？", env: "从 .env.example 创建 .env 吗？", checks: "运行类型检查和自动化测试吗？",
    installed: "依赖项已安装。", envMade: "已创建 .env。请仅添加你选择使用的服务商密钥。", envExists: ".env 已存在，未作更改。",
    done: "安装完成。", failed: "由于命令执行失败，安装已停止。", next: "使用以下命令启动桌面开发版：npm run desktop:dev",
  },
};

const args = new Set(process.argv.slice(2));
const valueAfter = (flag) => {
  const values = process.argv.slice(2);
  const index = values.indexOf(flag);
  return index >= 0 ? values[index + 1] : undefined;
};
if (args.has("--help") || args.has("-h")) {
  console.log(`Continuity Studio CLI setup / إعداد سطر الأوامر / Instalación CLI / 命令行安装

Usage: npm run setup -- [--lang en|ar|es|zh] [--yes]
  --lang  Select prompt language / اختر اللغة / Elige idioma / 选择语言
  --yes   Accept setup steps / قبول خطوات الإعداد / Aceptar pasos / 接受安装步骤`);
  process.exit(0);
}

const rl = createInterface({ input: stdin, output: stdout });
let language = valueAfter("--lang");
if (!messages[language]) {
  console.log("1. English\n2. العربية\n3. Español\n4. 中文");
  const choice = (await rl.question("Language / اللغة / Idioma / 语言 [1]: ")).trim() || "1";
  language = ({ "1": "en", "2": "ar", "3": "es", "4": "zh" })[choice] || "en";
}
const text = messages[language];
const automatic = args.has("--yes") || args.has("-y");
const yes = async (question) => {
  if (automatic) return true;
  const answer = (await rl.question(`${question} [Y/n] `)).trim().toLowerCase();
  return !answer || ["y", "yes", "نعم", "ن", "s", "si", "sí", "是"].includes(answer);
};
const run = (command, commandArgs) => {
  const executable = process.platform === "win32" && command === "npm" ? "npm.cmd" : command;
  const result = spawnSync(executable, commandArgs, { stdio: "inherit", shell: false });
  if (result.status !== 0) {
    console.error(`\n${text.failed}`);
    rl.close();
    process.exit(result.status || 1);
  }
};

console.log(`\n${text.title}\n${"=".repeat(48)}`);
console.log(`${text.node}: ${process.version}`);
const [major, minor] = process.versions.node.split(".").map(Number);
if (major < 20 || (major === 20 && minor < 19)) {
  console.error(text.badNode);
  rl.close();
  process.exit(1);
}

if (await yes(text.install)) {
  run("npm", ["install"]);
  console.log(text.installed);
}
if (await yes(text.env)) {
  if (existsSync(".env")) console.log(text.envExists);
  else {
    copyFileSync(".env.example", ".env");
    console.log(text.envMade);
  }
}
if (await yes(text.checks)) {
  run("npm", ["run", "typecheck"]);
  run("npm", ["test"]);
}
rl.close();
console.log(`\n${text.done}\n${text.next}\n`);
