# Guía de usuario en español

## Proyecto y modos

La idea inicial alimenta todo el flujo. **Full** ejecuta las fases en cadena; **Phases** espera aprobación después de cada artefacto importante. El modo se puede cambiar cuando el agente no está ejecutándose.

## Referencias antes de la historia

AI First deja que el sistema diseñe primero; Reference First convierte las referencias en restricciones; Hybrid bloquea identidades clave y permite expansión creativa. El archivo original no se modifica. Sus roles, prioridad y linaje quedan registrados, y una referencia principal se vincula a la identidad permanente del protagonista.

## Historia, biblia y reglas

Story define la narración; Film Bible bloquea mundo, lenguaje visual y límites; Rules convierte principios de continuidad en controles ejecutables. Documenta el motivo de cualquier excepción.

## Activos, escenas y storyboard

Personajes, criaturas, localizaciones y utilería reciben IDs estables, versiones y estados de aprobación. Bloquea las versiones aprobadas antes de crear escenas. Scene Assets produce una imagen maestra y estados START/MID/END; Storyboard es una capa de planos independiente. La regeneración forzada crea una versión nueva.

## Secuencias, prompts y continuidad

Sequence Planner organiza unidades temporales y Frame Planner conserva anclas. El compilador transforma un prompt canónico en formatos de plataforma sin cambiar el ID interno. En v1.0.0 Seedance, MiniMax e Higgsfield usan exportación manual; no son APIs directas. Continuity Inspector exige resolver o justificar los problemas bloqueantes.

## Exportación y privacidad

El ZIP contiene JSON, Markdown y medios del proyecto. `data/`, `.env`, logs, referencias subidas y medios generados están excluidos de Git. Revisa siempre un paquete antes de compartirlo.
