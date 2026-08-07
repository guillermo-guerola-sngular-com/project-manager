# Revisión de código — Project Management MVP

> **Actualización:** los dos hallazgos de prioridad alta (acoplamiento `chat.py`→`board.py` y el banner de error que no se limpiaba) y los dos de prioridad media (despacho de operaciones de IA y extracción del algoritmo de colisiones de drag-and-drop) ya están resueltos — ver el detalle al final de cada sección correspondiente y la tabla de priorización.

Revisión del backend (FastAPI/SQLAlchemy) y frontend (Next.js/React) centrada en principios SOLID, arquitectura y organización de archivos. El objetivo es identificar problemas reales de acoplamiento y responsabilidad, no imponer capas innecesarias: dado el tamaño actual del proyecto (8 módulos backend, ~15 componentes frontend), varias recomendaciones se marcan explícitamente como "esperar a que duela" en vez de aplicarse ya.

## Resumen ejecutivo

El código es pequeño, legible y con buena cobertura de tests. El problema más importante no es de tamaño de archivo sino de **límites de encapsulación rotos**: `app/chat.py` llama directamente a funciones privadas (`_get_user_board`, `_column_out`) y a funciones-ruta de `app/board.py`, es decir, un módulo depende de los internos de otro en vez de depender de una interfaz estable. En el frontend, `KanbanBoard.tsx` concentra fetching, el algoritmo de detección de colisiones de drag-and-drop y todos los manejadores de CRUD en un único componente de 283 líneas, mezclando lógica de dominio con presentación.

También se encontró un hallazgo de correctitud fuera del alcance de SOLID pero relevante: `password_hash` se genera y guarda en el seed pero **nunca se lee** — el login compara contra constantes hardcodeadas, no contra la base de datos.

## Backend

### 1. SRP — `app/board.py` mezcla cuatro responsabilidades distintas

[board.py](backend/app/board.py) contiene en un solo archivo:
- DTOs Pydantic (`CardOut`, `ColumnOut`, `BoardOut`, `*Request`) — líneas 12-42
- Helpers de acceso a datos con verificación de ownership (`_get_user_board`, `_get_owned_column`, `_get_owned_card`) — líneas 45-72
- Lógica de negocio de reordenamiento (`_insert_at_position`, `_compact_positions`) — líneas 84-105
- Los propios endpoints HTTP — líneas 108-186

A este tamaño no es grave, pero es la raíz del problema del punto 2. Cuando el archivo crezca (más entidades, más reglas de posición), separar en `schemas.py` (DTOs), `board_service.py` (lógica de ownership + reordenamiento) y `board.py` (solo rutas, delgadas) evitará que siga creciendo como un único archivo con cuatro roles.

### 2. DIP/SRP — `app/chat.py` depende de los internos de `app/board.py`, no de una interfaz

```python
# backend/app/chat.py:7-18
from app.board import (
    BoardOut, CreateCardRequest, RenameColumnRequest, UpdateCardRequest,
    _column_out, _get_user_board,          # <- funciones privadas (prefijo _)
    create_card, delete_card, rename_column, update_card,   # <- funciones-ruta HTTP
)
```

Esto es el hallazgo más importante de la revisión:

- `_column_out` y `_get_user_board` llevan guion bajo porque son detalles internos de `board.py`; que otro módulo las importe rompe la encapsulación que el propio prefijo declara.
- `create_card`, `update_card`, `delete_card`, `rename_column` son **funciones decoradas como endpoints** (`@router.post(..., status_code=201)`, etc.). `chat.py` las invoca en proceso pasando `db=`/`username=` a mano, saltándose sus `Depends(...)`. Funciona hoy, pero es frágil: si una ruta cambia de firma por motivos puramente HTTP (añadir un `Request`, un header de respuesta, otro `Depends`), `chat.py` se rompe en silencio porque nada en el tipado obliga a mantener esa firma "de servicio" estable.
- Es una inversión de DIP al revés: en vez de que ambos módulos dependan de una abstracción común (un servicio de dominio), el módulo de más alto nivel (`chat.py`, que orquesta IA) depende del módulo de detalle (`board.py`, HTTP).

**Recomendación concreta:** extraer las funciones de `board.py` (menos las firmas `Depends`) a `app/board_service.py` como funciones planas (`get_user_board`, `rename_column`, `create_card`, `update_card`, `delete_card`, sin guion bajo, sin acoplamiento a `status_code`). `app/board.py` queda como capa de adaptación HTTP: parsea el request, llama al servicio, devuelve la respuesta con el código HTTP correcto. `app/chat.py` pasa a depender del servicio, no de las rutas. Esto no añade una capa nueva conceptual — ya existe la separación de facto, solo hay que hacer explícito el límite y quitar el guion bajo de lo que en la práctica ya es una API pública compartida.

**Resuelto.** Se creó [board_service.py](backend/app/board_service.py) con los DTOs (`CardOut`, `ColumnOut`, `BoardOut`), los lookups con verificación de ownership, los mappers a DTO (`card_to_out`, `column_to_out`, `board_to_out`) y las mutaciones (`rename_column`, `create_card`, `update_card`, `delete_card`), todo sin ningún import de FastAPI salvo `HTTPException` como señal de error de dominio. [board.py](backend/app/board.py) quedó reducido a los modelos de request y rutas de una línea que delegan en el servicio. [chat.py](backend/app/chat.py) ya no importa nada de `app.board` — depende únicamente de `board_service`. Verificado con la suite completa: 37/37 tests de backend en Docker (incluidos los que golpean la API real de OpenRouter).

### 3. OCP — el despacho de operaciones de IA obliga a modificar código existente

```python
# backend/app/chat.py:45-68
def _apply_operation(op: Operation, db: Session, username: str) -> bool:
    try:
        if op.type == "rename_column": ...
        elif op.type == "add_card": ...
        elif op.type == "edit_card": ...
        elif op.type == "move_card": ...
        elif op.type == "delete_card": ...
```

Cada `Operation` nueva en [ai.py](backend/app/ai.py) (líneas 30-65) obliga a tocar esta cadena `if/elif`. El propio `Operation` ya es una unión discriminada por `type` — el tipado está bien diseñado (buena base de ISP: cada operación solo expone los campos que necesita), pero el despacho no lo aprovecha. Una tabla `dict[str, Callable]` indexada por `op.type` reduciría el punto de modificación a "añadir una entrada al dict" en vez de "insertar un `elif` más", sin introducir un patrón de registro más pesado que no se justifica a 5 operaciones.

**Resuelto.** `_apply_operation` en [chat.py](backend/app/chat.py) ahora indexa `_OPERATION_HANDLERS`, un `dict[str, Callable[[Session, Board, Operation], None]]` con una entrada (lambda) por tipo de operación, usando el mismo discriminador `type` que ya define `Operation` en `ai.py`. Añadir una operación futura es una línea nueva en el dict, no una rama nueva en una cadena de condicionales. Verificado: 37/37 tests de backend en Docker.

### 4. LSP — no aplica de forma significativa

No hay jerarquías de herencia relevantes: los modelos SQLAlchemy no se subclasean entre sí y las operaciones de IA son una unión discriminada (composición), no herencia. Nada que corregir aquí; se menciona por completitud.

### 5. Hallazgo de correctitud: `password_hash` es campo muerto

[models.py:14](backend/app/models.py) define `password_hash` y [seed.py:76](backend/app/seed.py) lo rellena con `hashlib.sha256(...).hexdigest()` (sin salt). Pero [auth.py:41](backend/app/auth.py) nunca consulta la base de datos para el login:

```python
# backend/app/auth.py:39-42
def login(credentials: Credentials, response: Response):
    if credentials.username != USERNAME or credentials.password != PASSWORD:
        raise HTTPException(status_code=401, detail="Invalid username or password")
```

El esquema está preparado para múltiples usuarios (como pide AGENTS.md), pero la autenticación real sigue completamente hardcodeada y ni siquiera pasa por el modelo `User` que ella misma siembra. No es urgente arreglarlo para el MVP actual (login sigue siendo 1 usuario fijo), pero si en el futuro se activa selección de usuario, hoy no hay ningún camino de código que lea `password_hash` — habría que escribirlo, no solo "activarlo".

### 6. SRP — `app/auth.py` mezcla cuatro conceptos sin separación de módulo

JWT (creación/verificación), gestión de cookie, credenciales hardcodeadas y rutas HTTP viven en el mismo archivo de 62 líneas. A este tamaño es razonable no separarlo; se menciona solo como referencia para cuando el modelo de auth crezca (p. ej. múltiples usuarios reales), momento en el que separar `jwt_utils.py` de las rutas tendrá sentido.

## Frontend

### 1. SRP — `KanbanBoard.tsx` concentra fetching, algoritmo de DnD y todos los CRUD handlers

[KanbanBoard.tsx](frontend/src/components/KanbanBoard.tsx) (283 líneas) es el componente que más responsabilidades acumula:

- Fetching y estado del tablero (líneas 37-41)
- El algoritmo `collisionDetectionStrategy` completo, con su lógica de refinamiento por tarjeta (líneas 63-89) — lógica pura, bien documentada, pero enterrada dentro del componente
- Los cinco manejadores de mutación: rename, add, edit, delete, move (líneas 116-208)
- El layout y el JSX de la cabecera/fondo decorativo (líneas 212-282)

Esto ya es un problema práctico documentado en `frontend/AGENTS.md` (Known Gaps): el reordenamiento en la misma columna no se ha podido verificar con un drag real, y parte de la dificultad de depurar ese código es que `collisionDetectionStrategy` no es una unidad aislada y testeable — solo se ejerce indirectamente a través de tests de integración del componente completo.

**Recomendación concreta, en dos pasos independientes (no hace falta hacer ambos a la vez):**
1. Mover `collisionDetectionStrategy` a `lib/dndCollision.ts` como función pura `resolveCollision(board, args)`. Esto permite escribir un test unitario directo para el caso de reordenamiento en la misma columna sin necesidad de un drag real en el navegador — probablemente destraba el gap documentado en Known Gaps más rápido que seguir iterando sobre Playwright.
2. Extraer un hook `useKanbanBoard()` que devuelva `{ board, error, handlers }`, dejando `KanbanBoard.tsx` como componente de presentación que solo consume el hook y monta `DndContext`/`KanbanColumn`. Esto separa "qué pasa cuando se edita una tarjeta" (lógica) de "cómo se ve el tablero" (JSX), que hoy están intercalados en el mismo archivo.

**Resuelto (paso 1 de 2 — ver punto 1 de la tabla de priorización para el paso 2, que se mantiene en baja prioridad).** Se extrajo `createCollisionDetectionStrategy(columns)` a [lib/dndCollision.ts](frontend/src/lib/dndCollision.ts) como función pura (fábrica de `CollisionDetection`), sin ninguna dependencia de React ni del componente. `KanbanBoard.tsx` pasó de contener el algoritmo completo a una única línea: `createCollisionDetectionStrategy(board?.columns ?? [])`. Se añadió [lib/dndCollision.test.ts](frontend/src/lib/dndCollision.test.ts), que construye a mano los argumentos que dnd-kit pasaría en un drag real (`ClientRect`/`DroppableContainer`/`Active`) y verifica directamente, sin necesidad de un drag real en el navegador: (a) que un drop en el hueco entre dos tarjetas resuelve a la tarjeta más cercana y no a la columna, y (b) que la tarjeta que se está arrastrando queda excluida del refinamiento de su propia columna incluso cuando su rect es geométricamente el más cercano — exactamente el bug que hacía que el reordenamiento en la misma columna fallara en silencio. Esto no resuelve por sí solo el gap documentado en `frontend/AGENTS.md` (seguir sin poder confirmar con un drag real de ratón), pero cubre con un test la parte de la lógica con más riesgo de regresión silenciosa. Verificado: 18/18 tests unitarios del frontend, incluidos los 2 nuevos.

### 2. Buen ejemplo ya presente de SRP/DIP: `lib/kanban.ts` vs `lib/api.ts`

Vale la pena señalarlo como patrón a mantener: [kanban.ts](frontend/src/lib/kanban.ts) contiene únicamente lógica de dominio pura (`moveCard`, sin I/O), y [api.ts](frontend/src/lib/api.ts) contiene únicamente las llamadas `fetch`. Es la misma separación que se recomienda para `KanbanBoard.tsx` en el punto anterior, ya aplicada correctamente a nivel de módulo — falta aplicarla a nivel de componente.

### 3. Hallazgo de correctitud: el banner de error nunca se limpia

`frontend/AGENTS.md` documenta el error banner como "dismissable-by-next-action", pero revisando cada sitio donde se llama `setError` en [KanbanBoard.tsx](frontend/src/components/KanbanBoard.tsx) (líneas 40, 133, 148, 168, 186, 207), ninguno de los manejadores hace `setError(null)` en el camino de éxito. Una vez que una mutación falla, el banner queda visible de forma permanente hasta que se recarga la página, incluso si las siguientes acciones tienen éxito. Es una discrepancia entre lo documentado y el comportamiento real, y un fix trivial: añadir `setError(null)` al inicio de cada handler (u optimistamente, antes de llamar a la API).

**Resuelto.** Se añadió `setError(null)` al inicio de los cinco handlers (`handleDragEnd`, `handleRenameColumn`, `handleAddCard`, `handleEditCard`, `handleDeleteCard`) y del efecto de `fetchBoard`, de forma que cualquier acción nueva —éxito o no— descarta el error anterior, tal como describe `frontend/AGENTS.md`. Verificado: 16/16 tests unitarios del frontend siguen en verde.

### 4. ISP — `UpdateCardRequest`/`updateCard` combinan "editar" y "mover" en una interfaz

[api.ts:52-69](frontend/src/lib/api.ts) y el `UpdateCardRequest` de [board.py:38-42](backend/app/board.py) exponen `title`, `details`, `columnId`, `position` como un único conjunto opcional. Comparado con el propio backend de IA, que sí separa `EditCardOp` de `MoveCardOp` en [ai.py](backend/app/ai.py), esto es una interfaz algo más ancha de lo que cada llamador necesita. No es grave (los campos son opcionales y cada llamador solo rellena los que usa), pero es una inconsistencia de diseño entre dos partes del mismo backend que resuelven el mismo problema de forma distinta.

### 5. DIP — aceptado como trade-off, no como defecto

Los componentes importan funciones concretas basadas en `fetch` desde `lib/api.ts` en vez de recibir un cliente inyectado. Los tests mockean `global.fetch` directamente (patrón documentado en `frontend/AGENTS.md`). Para una app de este tamaño, introducir una abstracción de cliente HTTP inyectable sería sobre-ingeniería sin beneficio real — se señala aquí solo para dejar constancia de que es una decisión consciente, no un descuido.

## Organización de archivos

**Backend:** estructura plana en `app/` (8 archivos) razonable a este tamaño. El único cambio de organización que se recomienda ya (no condicionado a crecimiento futuro) es la extracción del servicio descrita en el punto 2 del backend — no porque el archivo sea grande, sino porque `chat.py` ya está importando internos de `board.py` hoy.

**Frontend:** `components/` plano (12 componentes) y tests colocados junto al código fuente (`*.test.tsx`) es una buena práctica ya aplicada. Cuando se extraiga el hook `useKanbanBoard()` sugerido arriba, tiene sentido crear un directorio `hooks/` en ese momento (no antes, no hay un segundo hook que lo justifique todavía).

**Dockerfile/scripts:** correctamente separados por responsabilidad (build multi-stage, scripts start/stop por plataforma). Sin observaciones.

## Priorización sugerida

| Prioridad | Cambio | Motivo |
|---|---|---|
| ~~Alta~~ Resuelto | Extraer `board_service.py`; que `chat.py` deje de importar funciones con `_` de `board.py` | Es el único acoplamiento que ya duele hoy, no una previsión a futuro |
| ~~Alta~~ Resuelto | Arreglar el banner de error que no se limpia en `KanbanBoard.tsx` | Bug de UX real, un `setError(null)` por handler |
| ~~Media~~ Resuelto | Mover `collisionDetectionStrategy` a un módulo puro y testeable | Ahora testeado en aislamiento; el gap de e2e con drag real sigue documentado en Known Gaps, sin cambios |
| ~~Media~~ Resuelto | Sustituir el `if/elif` de `_apply_operation` por un dict de despacho | Bajo esfuerzo, hace el punto de extensión explícito |
| Baja | Extraer hook `useKanbanBoard()` | Mejora de legibilidad, no bloquea nada hoy — con `dndCollision.ts` ya extraído, es lo único que le queda por sacar a `KanbanBoard.tsx` |
| Baja | Unificar `EditCardOp`/`MoveCardOp` vs `UpdateCardRequest` | Inconsistencia menor, sin impacto funcional |
| Informativo | `password_hash` no se usa en el login | No urgente mientras el login siga hardcodeado a 1 usuario; documentarlo evita que alguien asuma que ya funciona multiusuario |
