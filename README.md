# Tombola - Sistema de Sorteo con Tickets Ponderados

Sistema de sorteo/rifa donde los participantes se cargan mediante archivos Excel con tickets ponderados. Los ganadores se seleccionan con revelacion animada digito por digito y confetti para el ganador final. Todas las pestanas se sincronizan en tiempo real via SSE.

## Stack Tecnologico

- **Frontend:** Next.js 14 (App Router, TypeScript), Bootstrap 5, canvas-confetti
- **Backend:** Next.js API Routes (App Router)
- **Base de datos:** Redis (ioredis)
- **Utilidades:** xlsx (lectura de Excel/CSV)

## Requisitos Previos

- Node.js >= 18
- Docker y Docker Compose (para Redis)

## Instalacion

```bash
# 1. Clonar el repositorio
git clone <url-del-repo>
cd tombola

# 2. Instalar dependencias
npm install

# 3. Levantar Redis con Docker
docker compose up -d

# 4. Configurar variables de entorno
# El archivo .env.local ya incluye:
# REDIS_URL=redis://localhost:6379

# 5. Iniciar en modo desarrollo
npm run dev
```

La aplicacion estara disponible en `http://localhost:3000`.

## Comandos Disponibles

| Comando | Descripcion |
|---------|-------------|
| `npm run dev` | Inicia el servidor de desarrollo (Next.js) |
| `npm run build` | Genera el build de produccion |
| `npm run start` | Inicia el servidor de produccion |
| `npm run lint` | Ejecuta el linter (ESLint via Next.js) |
| `docker compose up -d` | Levanta Redis en segundo plano |
| `docker compose down` | Detiene Redis |

## Paginas

### `/` — Tombola (pantalla principal)

Pantalla de sorteo con 7 digitos animados. Cada digito se revela progresivamente durante 11 segundos. Un unico boton **"SORTEAR"** dispara el sorteo. Si el seleccionado es el ganador (segun la posicion configurada), se muestra "Cliente Ganador!" con confetti. Si no, se muestra "Cliente Al Agua".

### `/dashboard` — Panel de Administracion

Panel de control con las siguientes secciones:

- **Subir Archivo:** Carga participantes desde Excel/CSV con deteccion automatica de formato
- **Imagen de Fondo:** Configura la URL de imagen de fondo (o restaura la predeterminada)
- **Estadisticas:** Total de participantes, restantes, tickets, fecha de carga
- **Posicion del Ganador:** Define en que sorteo sale el ganador (ej: 3 = los primeros 2 son "Al Agua", el 3ro es "Ganador")
- **Seleccionados:** Lista de seleccionados con exportacion CSV y boton para limpiar el sorteo

### `/winners` — Pantalla de Seleccionados

Pagina publica que muestra la lista de seleccionados. Usa el mismo fondo configurable que la tombola. Se actualiza automaticamente via SSE con un retraso de 12 segundos (espera a que termine la animacion).

## Formatos de Excel Aceptados

El sistema detecta automaticamente el formato del archivo:

| Columnas | Formato | Ejemplo |
|----------|---------|---------|
| 1 | Solo ID | `12345` |
| 2 (texto) | ID + Nombre | `12345, Juan Perez` |
| 2 (numerico) | ID + Tickets | `12345, 5` |
| 3+ | ID + Nombre + Tickets | `12345, Juan Perez, 5` |

- Si la primera fila contiene solo texto no numerico, se interpreta como encabezado y se omite
- Cada participante recibe minimo 1 ticket
- Los tickets se redondean hacia abajo (solo enteros)

## API Routes

| Metodo | Ruta | Descripcion |
|--------|------|-------------|
| `POST` | `/api/upload` | Parsea archivo Excel/CSV y carga participantes en Redis |
| `POST` | `/api/winner` | Ejecuta sorteo aleatorio ponderado y notifica via SSE |
| `GET` | `/api/stats` | Devuelve estadisticas y lista de seleccionados con timestamps |
| `GET` | `/api/background` | Obtiene la URL de imagen de fondo actual |
| `POST` | `/api/background` | Establece o limpia la URL de imagen de fondo |
| `GET` | `/api/config` | Obtiene configuracion (posicion del ganador, sorteo actual) |
| `POST` | `/api/config` | Establece la posicion del ganador (reinicia contador) |
| `POST` | `/api/reset` | Limpia la lista de seleccionados (no restaura participantes al pool) |
| `GET` | `/api/events` | Stream SSE para sincronizacion en tiempo real |

## Modelo de Datos en Redis

```
tombola:weights       HASH    {participantId: ticketCount}
tombola:names         HASH    {participantId: nombre}
tombola:winners       LIST    [winnerId, ...] (mas reciente primero)
tombola:timestamps    HASH    {winnerId: isoTimestamp}
tombola:meta          HASH    {totalTickets, totalParticipants, uploadedAt}
tombola:config        HASH    {winnerPosition, currentDraw}
tombola:background    STRING  URL de imagen de fondo
```

**Nota:** Cuando un participante es seleccionado, se elimina de `tombola:weights` (sale del pool). El reset limpia la lista de seleccionados pero **no** restaura los participantes eliminados al pool. Para reiniciar completamente, hay que volver a subir el archivo Excel.

## Logica del Sorteo

1. Se leen todos los participantes restantes con sus tickets desde `tombola:weights`
2. Se genera un numero aleatorio en el rango `[0, totalTickets)`
3. Se recorre la lista acumulando tickets hasta superar el numero aleatorio (seleccion ponderada)
4. El seleccionado se elimina del pool y se agrega a la lista de ganadores
5. Se verifica `currentDraw` vs `winnerPosition`:
   - Si `currentDraw >= winnerPosition` → es **Ganador** (confetti + "Cliente Ganador!"), se reinicia el contador
   - Si no → es **Al Agua** (sin confetti), se incrementa el contador
6. Se notifica a todos los clientes conectados via SSE

## Sincronizacion en Tiempo Real (SSE)

El sistema usa Server-Sent Events para mantener sincronizadas todas las pestanas:

- **Evento `draw`:** Se dispara al sortear. Todas las pestanas ven la animacion de digitos
- **Evento `upload`:** Se dispara al cargar participantes. El dashboard actualiza estadisticas
- **Evento `reset`:** Se dispara al limpiar el sorteo. Todas las pestanas actualizan sus listas
- **Heartbeat:** Cada 15 segundos para mantener la conexion activa
- **Reconexion automatica:** Si la conexion SSE se pierde, se reconecta despues de 3 segundos

## Estructura del Proyecto

```
tombola/
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── background/route.ts   # GET/POST imagen de fondo
│   │   │   ├── config/route.ts        # GET/POST configuracion del ganador
│   │   │   ├── events/route.ts        # SSE stream + notifyClients()
│   │   │   ├── reset/route.ts         # POST limpiar seleccionados
│   │   │   ├── stats/route.ts         # GET estadisticas + lista
│   │   │   ├── upload/route.ts        # POST carga de Excel
│   │   │   └── winner/route.ts        # POST sorteo ponderado
│   │   ├── dashboard/page.tsx         # Panel de administracion
│   │   ├── winners/page.tsx           # Pantalla publica de seleccionados
│   │   ├── globals.css                # Estilos globales (tema oscuro/dorado)
│   │   ├── layout.tsx                 # Layout raiz (Bootstrap + Titillium Web)
│   │   └── page.tsx                   # Pagina principal (monta Tombola)
│   ├── components/
│   │   └── Tombola.tsx                # Componente principal del sorteo
│   └── lib/
│       ├── redis.ts                   # Cliente Redis singleton (ioredis)
│       └── useSSE.ts                  # Hook de React para SSE con reconexion
├── public/
│   ├── fondo_2.png                    # Imagen de fondo predeterminada
│   └── loading.gif                    # Spinner para la animacion de digitos
├── docker-compose.yml                 # Redis 7 Alpine con persistencia AOF
├── next.config.js                     # Configuracion de Next.js (imagenes remotas)
├── package.json                       # Dependencias y scripts
└── tsconfig.json                      # Configuracion de TypeScript
```

## Variables de Entorno

| Variable | Descripcion | Valor por defecto |
|----------|-------------|-------------------|
| `REDIS_URL` | URL de conexion a Redis | `redis://localhost:6379` |

## Notas de Diseno

- **Eficiencia en Redis:** 1 entrada por participante en un HASH (no 1 fila por ticket). Un participante con 1000 tickets ocupa la misma memoria que uno con 1 ticket.
- **Idioma:** Toda la interfaz esta en espanol. Textos clave: "Seleccionados" (lista), "Cliente Ganador!" (ganador), "Al Agua" (no ganador), "SORTEAR" (boton).
- **Animacion:** La revelacion de digitos dura 11 segundos (1s entre los primeros 3 digitos, 2s entre los ultimos 4). La pagina de winners espera 12 segundos antes de mostrar un nuevo seleccionado.
- **Fondo configurable:** Se almacena en Redis, se aplica via CSS `background-image` en el body. Si no hay URL, se usa `fondo_2.png`.
- **Sin autenticacion:** El dashboard no tiene proteccion de acceso. Hay un TODO para implementar Azure AD (Microsoft Entra ID) con NextAuth.
