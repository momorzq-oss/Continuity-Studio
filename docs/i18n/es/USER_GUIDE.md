# Guía de usuario en español

## Proyecto y modos

La idea inicial alimenta todo el flujo. **Full** ejecuta las fases en cadena; **Phases** espera aprobación después de cada artefacto importante. El modo se puede cambiar cuando el agente no está ejecutándose.

### Modo Automático

Al elegir **AUTOMATIC MOVIE**, introduce la idea, duración, idiomas y preferencia para el protagonista, y pulsa **CREATE MY MOVIE**. Studio Brain selecciona Movie DNA y Platform Profile, crea Story, Film Bible y el análisis de personajes, y se detiene en el punto obligatorio de identidad del protagonista. Puedes subir una identidad protegida y crear una hoja neutral, o elegir un personaje ficticio generado por IA. Cada etapa y decisión se guarda; Pause, Resume, Stop, Manual Override y la recuperación tras reiniciar conservan el trabajo completado.

### Modo Manual Guiado

Al elegir **MANUAL PRODUCTION** aparece primero la pantalla sencilla **DESCRIBE YOUR MOVIE**. Introduce un título opcional, una descripción breve, duración aproximada, idioma, idioma del diálogo y una plataforma preferida opcional; después pulsa **NEXT**. Studio Brain analiza el texto y rellena Project Setup y Visual Movie DNA con recomendaciones editables, pero no las aprueba automáticamente.

Una barra persistente muestra 14 etapas, desde Brief hasta Export. Usa **BACK**, **SAVE**, **NEXT**, **APPROVE AND NEXT** y **LOCK AND NEXT**. Si falta un requisito, NEXT queda desactivado y explica exactamente qué falta. Al reabrir el proyecto aparece **CONTINUE WHERE YOU LEFT OFF**, con **RESUME** y **VIEW PROJECT**. Se puede cambiar entre Manual y Automatic sin perder datos, aprobaciones ni referencias.

## Referencias antes de la historia

AI First deja que el sistema diseñe primero; Reference First convierte las referencias en restricciones; Hybrid bloquea identidades clave y permite expansión creativa. El archivo original no se modifica. Sus roles, prioridad y linaje quedan registrados, y una referencia principal se vincula a la identidad permanente del protagonista.

## Historia, biblia y reglas

Story define la narración; Film Bible bloquea mundo, lenguaje visual y límites; Rules convierte principios de continuidad en controles ejecutables. Documenta el motivo de cualquier excepción.

## Activos, escenas y storyboard

Personajes, criaturas, localizaciones y utilería reciben IDs estables, versiones y estados de aprobación. Bloquea las versiones aprobadas antes de crear escenas. Scene Assets produce una imagen maestra y estados START/MID/END; Storyboard es una capa de planos independiente. La regeneración forzada crea una versión nueva.

## Secuencias, prompts y continuidad

Sequence Planner organiza unidades temporales y Sequence Workspace v3 ofrece editores Normal/JSON sincronizados, versiones y numeración de referencias. En v1.1.0 Seedance, Higgsfield, MiniMax, Veo, Kling, Runway y Sora usan transferencia manual; no son APIs directas. Los problemas bloqueantes deben resolverse antes de exportar.

## Exportación y privacidad

El ZIP contiene JSON, Markdown y medios del proyecto. `data/`, `.env`, logs, referencias subidas y medios generados están excluidos de Git. Revisa siempre un paquete antes de compartirlo.
