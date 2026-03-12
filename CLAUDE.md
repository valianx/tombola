# CLAUDE.md — Guia para Agentes IA

## Descripcion del Proyecto

Tombola es un sistema de sorteo/rifa con tickets ponderados. Los participantes se cargan via Excel, se extraen mediante sorteo aleatorio ponderado con animacion de 7 digitos, y los resultados se sincronizan en tiempo real via SSE. Construido con Next.js 14 (App Router) + Redis.

## Comandos

```bash
# Desarrollo
npm run dev          # Inicia servidor de desarrollo en localhost:3000
npm run build        # Build de produccion
npm run start        # Inicia servidor de produccion
npm run lint         # Ejecuta ESLint

# Infraestructura
docker compose up -d   # Levanta Redis (requerido antes de npm run dev)
docker compose down    # Detiene Redis
```

## Arquitectura

### Stack
- **Next.js 14** con App Router (NO Pages Router)
- **TypeScript** con strict mode
- **Redis** via ioredis (cliente singleton en `src/lib/redis.ts`)
- **Bootstrap 5** (CSS only, sin JS de Bootstrap)
- **canvas-confetti** para animaciones de celebracion
- **xlsx** para parseo de archivos Excel/CSV

### Estructura de archivos
```
src/
  app/
    api/{route}/route.ts    # API Routes (App Router format: export async function GET/POST)
    {page}/page.tsx          # Paginas (todas son "use client")
    layout.tsx               # Layout raiz
    globals.css              # Estilos globales
  components/
    Tombola.tsx              # Componente principal del sorteo
  lib/
    redis.ts                 # Singleton Redis (reutiliza conexion en hot reload)
    useSSE.ts                # Hook React para Server-Sent Events
```

### Patrones clave

- **API Routes:** Usan el formato App Router (`route.ts` con funciones exportadas `GET`/`POST`). No hay middleware. No hay autenticacion.
- **Redis singleton:** `src/lib/redis.ts` usa `globalThis` para reutilizar la conexion durante hot reload en desarrollo. Importar siempre como `import redis from "@/lib/redis"`.
- **SSE (Server-Sent Events):** `src/app/api/events/route.ts` mantiene un `Set<ReadableStreamDefaultController>` en memoria. La funcion `notifyClients(event, data)` se importa desde este archivo para emitir eventos. Eventos: `draw`, `upload`, `reset`.
- **Hook useSSE:** `src/lib/useSSE.ts` conecta al stream SSE, escucha los eventos y reconecta automaticamente tras 3 segundos en caso de error.
- **Componentes client-side:** Todas las paginas usan `"use client"`. No hay Server Components con logica (solo `page.tsx` raiz que monta `<Tombola />`).

### Modelo de datos Redis

```
tombola:weights       HASH    {id: tickets}        # Pool de participantes activos
tombola:names         HASH    {id: nombre}          # Nombres (opcional)
tombola:winners       LIST    [id, ...]             # Seleccionados (LPUSH = mas reciente primero)
tombola:timestamps    HASH    {id: isoTimestamp}     # Momento del sorteo
tombola:meta          HASH    {totalTickets, totalParticipants, uploadedAt}
tombola:config        HASH    {winnerPosition, currentDraw}
tombola:background    STRING  URL de fondo
```

### Flujo del sorteo
1. `POST /api/winner` lee `tombola:weights` y hace seleccion ponderada
2. El seleccionado se elimina del HASH (sale del pool permanentemente)
3. Se verifica `currentDraw` vs `winnerPosition` para determinar si es "Ganador" o "Al Agua"
4. Se emite evento SSE `draw` con `{id, name, isWinner, drawNumber, winnerPosition}`
5. Todas las pestanas reciben el evento y animan los digitos

## Convenciones

### Idioma
- **UI:** Todo en espanol
- **Codigo:** Variables y funciones en ingles, strings UI en espanol
- **Terminologia UI:**
  - "Seleccionados" = lista de participantes extraidos
  - "Cliente Ganador!" = el ganador real (posicion N del ciclo)
  - "Al Agua" = seleccionado que no es ganador (antes de la posicion N)
  - "SORTEAR" = boton para ejecutar el sorteo

### Estilos
- Tema oscuro: fondo `#001C31`, texto blanco, acentos dorados `#ffd700` / `#ffa800`
- Fuente: Titillium Web (Google Fonts)
- Bootstrap 5 para grid y utilidades basicas
- CSS custom en `globals.css` para componentes del sorteo
- Estilos inline en dashboard y winners (no hay CSS modules ni styled-components)

### API
- Todas las rutas devuelven JSON
- Errores: `{ error: "mensaje" }` con status HTTP apropiado (400, 404, 500)
- Sin autenticacion ni middleware
- Sin rate limiting
- Las rutas que modifican estado notifican via `notifyClients()` de `events/route.ts`

### Path aliases
- `@/*` mapea a `./src/*` (configurado en tsconfig.json)
- Ejemplo: `import redis from "@/lib/redis"`

## Variables de Entorno

```
REDIS_URL=redis://localhost:6379    # Unica variable requerida
```

Archivo: `.env.local` (incluido en `.gitignore`)

## Dependencias Principales

| Paquete | Uso |
|---------|-----|
| `next` (14.x) | Framework web (App Router) |
| `react` / `react-dom` (18.x) | UI |
| `ioredis` (5.x) | Cliente Redis |
| `bootstrap` (5.x) | CSS framework |
| `canvas-confetti` (1.x) | Animacion de confetti |
| `xlsx` (0.18.x) | Parseo de Excel/CSV |

## Cosas a Tener en Cuenta

- **Redis debe estar corriendo** antes de iniciar la app. Sin Redis, todas las API routes fallan.
- **SSE usa memoria en proceso.** Los controladores de clientes SSE se almacenan en un `Set` en memoria del proceso Node. Esto funciona con una instancia, pero no escala horizontalmente sin un pub/sub externo (ej: Redis Pub/Sub).
- **El reset no restaura participantes.** `POST /api/reset` limpia la lista de ganadores pero los participantes ya sorteados no vuelven al pool. Para reiniciar completamente, hay que subir el Excel de nuevo.
- **No hay autenticacion.** El dashboard esta abierto. Hay un TODO en `dashboard/page.tsx` para Azure AD con NextAuth.
- **Animacion de 11 segundos.** La revelacion de digitos bloquea nuevos sorteos durante la animacion (el boton se deshabilita). La pagina `/winners` espera 12 segundos antes de mostrar un nuevo seleccionado.
- **next.config.js permite imagenes remotas de cualquier dominio** (`hostname: "**"`). Esto es necesario para el fondo configurable pero es permisivo en seguridad.
- **Sin tests.** El proyecto no tiene tests configurados.
