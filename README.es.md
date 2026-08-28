# Continuity Studio By BURABEEH

Creado por **Mohammed Al Marzooqi (BURABEEH)**, Emiratos Árabes Unidos.

[English](README.md) · [العربية](README.ar.md) · [Español](README.es.md) · [中文](README.zh-CN.md)

Continuity Studio By BURABEEH es un espacio local de producción cinematográfica con IA y control de continuidad. Convierte una idea en registros estructurados de Movie DNA, Historia, Biblia de la película, personajes, referencias, activos, guion, secuencias, planos y prompts por plataforma.

![Sequence Workspace v3](docs/screenshots/39-sequence-detail.png)

## Versión actual v1.1.0

- Visual Movie DNA con 27 categorías y 629 opciones, comparación, versiones, bloqueo, fotograma maestro y localización global.
- Story v2 con Historia completa, Estructura, Línea temporal, Arcos de personajes, Desglose de secuencias, aprobación y bloqueo.
- Film Bible, análisis de personajes, referencias protegidas, hojas y estados de personaje por secuencia.
- Asset Manifest numerado, Image Asset Library, inspección, edición de prompt, versiones, aprobación y bloqueo.
- Full Script v2 con guion completo, solo diálogo, Shot Script y Production Script.
- Sequence Workspace v3 con Normal Prompt y JSON Prompt sincronizados, validación, versiones, Previous/Next y Storyboard Grid opcional.
- Perfiles versionados para Seedance, Higgsfield, MiniMax, Veo, Kling, Runway, Sora y Custom.
- IDs permanentes, numeración `@Image`, orden de subida y paquetes de referencias por secuencia.
- Modos Full y Phases, Production Agent, almacenamiento local JSON/Markdown/medios y exportación ZIP.

## Límite de la versión

La generación directa de vídeo, la importación de resultados, la inspección automática, la aprobación de intentos, la transferencia automática END→START, el panel de finalización y el montaje final no están terminados en v1.1.0. Consulta la [hoja de ruta](docs/ROADMAP.md).

## Instalación en español

Requisitos: Node.js 20.19 o posterior, npm 10 o posterior y Git para clonar.

```bash
git clone https://github.com/momorzq-oss/Continuity-Studio.git
cd Continuity-Studio
npm run setup -- --lang es
npm run desktop:dev
```

Para configuración no interactiva usa `npm run setup -- --lang es --yes`. También puedes descargar el instalador o la versión portátil de Windows desde [GitHub Releases](https://github.com/momorzq-oss/Continuity-Studio/releases). Los binarios no están firmados y Windows puede mostrar una advertencia de editor desconocido.

## Uso rápido

1. Crea un proyecto y elige Full o Phases.
2. Elige, revisa y bloquea Movie DNA.
3. Crea y aprueba Story v2, Film Bible, personajes, referencias y activos.
4. Revisa Full Script v2, bloquea el diálogo y planifica planos y secuencias.
5. Abre Sequence Workspace, elige un Platform Profile y valida Normal/JSON Prompt.
6. Revisa la numeración y el orden de referencias y transfiere el paquete manualmente al proveedor.
7. Exporta el ZIP estructurado del proyecto.

Consulta la [instalación](docs/i18n/es/INSTALLATION.md), el [inicio rápido](docs/i18n/es/QUICK_START.md), la [guía de usuario](docs/i18n/es/USER_GUIDE.md) y la [galería](docs/SCREENSHOTS.md).

Los proyectos, referencias y medios se guardan localmente y Git los ignora. Guarda secretos solo en `.env`. Los nombres de proveedores no implican patrocinio ni asociación oficial.

Copyright 2026 Mohammed Al Marzooqi. Licencia [Apache License 2.0](LICENSE).
