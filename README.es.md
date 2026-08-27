# Continuity Studio

Creado por **Mohammed Al Marzooqi**, **Burabeeh**, Emiratos Árabes Unidos.

[English](README.md) · [العربية](README.ar.md) · [Español](README.es.md) · [中文](README.zh-CN.md)

Continuity Studio es un sistema abierto de producción cinematográfica con IA y control de continuidad. Convierte una idea en un proyecto local e inspeccionable con historia, biblia de la película, activos visuales, hojas de continuidad, escenas, storyboard, secuencias, prompts por plataforma, validación y exportación.

Su objetivo es mantener coherentes la identidad, vestuario, utilería, animales, localizaciones, geografía, iluminación y daños durante una producción asistida por IA.

## Flujo completo

Idea → Referencias → Historia → Biblia de la película → Manifiesto de activos → Hojas de personajes/criaturas/animales/localizaciones/utilería → Activos de escena → Storyboard e imágenes → Secuencias → Fotogramas START/MID/END → Prompt canónico → Compilador de plataforma → Flujo de generación → Inspección de continuidad → Aprobación → Exportación.

## Funciones de v1.0.0

- Modos Full y Phases.
- Preparación AI First, Reference First e Hybrid.
- Referencias protegidas y fuente permanente del personaje principal.
- Story Engine, Film Bible y 53 reglas operativas.
- Identificadores permanentes, relaciones, linaje, versiones, aprobación y bloqueo.
- Trabajos locales que producen archivos PNG reales de previsualización y hojas adaptativas.
- Escenas con dependencias, imagen maestra y START/MID/END.
- Storyboard separado de la escena maestra.
- Prompt canónico y perfiles editables para Seedance, MiniMax, Higgsfield y Generic.
- Mapeo temporal de referencias sin cambiar el ID interno.
- Motor integrado sin conexión, modelo local compatible con OpenAI, supervisión Codex y proveedor textual OpenAI opcionales.
- Persistencia local y exportación ZIP.
- Instalador y versión portátil para Windows.

## Estado real de proveedores

- **OpenAI API:** integración textual operativa; requiere `OPENAI_API_KEY`.
- **Codex:** supervisión operativa mediante inicio de sesión Codex/ChatGPT.
- **Modelo local:** proveedor textual opcional para un servidor compatible con OpenAI.
- **Seedance 2.5:** compilación, etiquetas y exportación manual; sin generación API directa.
- **MiniMax S2V-01:** referencia de sujeto, compilación y exportación manual; sin API directa.
- **Higgsfield:** plan de referencias/prompt y exportación manual; sin API directa.
- **KimiBrain:** futuro, no integrado.
- **Renderer local:** genera PNG de previsualización; no es un modelo fotorealista.

Las marcas mencionadas no patrocinan ni respaldan oficialmente Continuity Studio.

## Instalación CLI en español

Requisitos: Node.js 20.19+ (recomendado Node.js 22 LTS), npm 10+ y Git para clonar. Python, FFmpeg y una base de datos externa no son necesarios en v1.0.0.

```bash
git clone https://github.com/momorzq-oss/Continuity-Studio.git
cd Continuity-Studio
npm run setup -- --lang es
npm run desktop:dev
```

Modo no interactivo: `npm run setup -- --lang es --yes`.

El instalador comprueba Node.js, pregunta si debe instalar dependencias, crea opcionalmente `.env` y ejecuta pruebas. Nunca solicita ni imprime secretos. Consulta la [instalación en español](docs/i18n/es/INSTALLATION.md), el [inicio rápido](docs/i18n/es/QUICK_START.md) y la [guía de usuario](docs/i18n/es/USER_GUIDE.md).

Para Windows también puedes descargar el instalador o ejecutable portátil desde GitHub Releases. Los binarios no tienen certificado de firma comercial y Windows puede mostrar una advertencia de editor desconocido.

## Uso resumido

1. Crea un proyecto con época, formato, duración y modo de historia.
2. Añade referencias opcionales y roles; marca una imagen como personaje principal si corresponde.
3. Completa Reference Setup y ejecuta Production Agent.
4. Revisa Historia, Film Bible y Asset Manifest.
5. Genera hojas y bloquea las versiones aprobadas.
6. Genera Scene Assets, Storyboard, secuencias y estados START/MID/END.
7. Compila prompts, revisa etiquetas/límites y exporta manualmente al proveedor.
8. Resuelve continuidad y exporta el ZIP.

## Identidad independiente del proveedor

`CHAR_MAIN_001` pertenece al proyecto. `@Image 1` es solo una etiqueta temporal para una solicitud concreta. El sistema conserva el ID estable y crea el formato que cada plataforma necesita.

## Privacidad

Los proyectos, referencias, medios y logs locales están excluidos de Git. Guarda claves solo en `.env`, que también está ignorado. No publiques imágenes personales ni proyectos privados.

## Creador y licencia

Mohammed Al Marzooqi (Burabeeh) es un creador emiratí de IA, cineasta independiente, experimentador de software y entusiasta tecnológico. Continuity Studio nació de su trabajo resolviendo identidad y continuidad en películas con IA. Copyright 2026 Mohammed Al Marzooqi; licencia [Apache-2.0](LICENSE).
