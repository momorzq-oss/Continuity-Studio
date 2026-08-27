# Instalación

## Métodos disponibles

1. Instalador NSIS para Windows desde GitHub Releases.
2. Ejecutable portátil para Windows.
3. `git clone` para desarrollo en Windows, macOS y Linux.
4. ZIP de GitHub y extracción manual.

Solo los paquetes Windows 10/11 x64 están construidos y probados. macOS/Linux pueden ejecutar el flujo web desde el código fuente, pero v1.0.0 no incluye paquetes de escritorio nativos para ellos.

## Requisitos

- Node.js 20.19+; se recomienda Node.js 22 LTS.
- npm 10+.
- Git solo para clonar.
- No se requieren Python, FFmpeg ni base de datos externa.
- Las claves de IA son opcionales.

## Instalador CLI

```bash
git clone https://github.com/momorzq-oss/Continuity-Studio.git
cd Continuity-Studio
npm run setup -- --lang es
```

Automático: `npm run setup -- --lang es --yes`.

Después ejecuta `npm run desktop:dev` en Windows, o `npm run dev` y abre `http://127.0.0.1:8787` para desarrollo web.

Copia `.env.example` a `.env` únicamente si usarás un proveedor opcional. `OPENAI_API_KEY` sí se usa para texto; `LOCAL_LLM_API_KEY` solo es necesario si tu servidor local exige autenticación. Las variables de MiniMax, Seedance y Higgsfield están reservadas para adaptadores futuros; v1.0.0 no llama a sus APIs. Codex se conecta desde Settings.

```bash
npm run typecheck
npm test
npm run build
```
