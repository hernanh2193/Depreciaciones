# Sistema de Depreciaciones — EPQ

Migración del sistema de Depreciaciones (Java/ZK) a **React + NestJS**, usando la misma base de datos Oracle 19c (esquema `DEPRECIACIONES`).

| Carpeta | Contenido |
|---|---|
| `backend/` | API NestJS + `oracledb` (modo thin, no requiere Instant Client) |
| `frontend/` | React + Vite + TypeScript |
| `Depreciaciones/` | Sistema Java original (repo propio en Bitbucket, ignorado aquí) |

## Requisitos

- Node.js 22 (`nvm use 22`)

## Levantar en desarrollo

```powershell
# 1. Backend
cd backend
copy .env.example .env      # y llenar DB_HOST, DB_USER, DB_PASSWORD, JWT_SECRET
npm install
npm run start:dev           # http://localhost:3000/api/salud

# 2. Frontend (en otra terminal)
cd frontend
npm install
npm run dev                 # http://localhost:5173
```

En desarrollo, Vite redirige `/api` al backend, por lo que no hace falta configurar CORS.

## Pruebas

```powershell
cd backend
npm test            # unitarias
npm run test:e2e    # endpoints (sin base de datos)
```

## Estado de la migración

| Fase | Rama | Estado |
|---|---|---|
| 1. Autenticación (login, cambio de clave, menú por rol) | `feature/auth` | ✅ |
| 2. Catálogos (cuentas, subcuentas, división, relación, periodos) | `feature/catalogos` | Pendiente |
| 3. Activos (registro, modificación, otros %, traslados) | `feature/activos` | Pendiente |
| 4. Proceso de generación mensual | `feature/proceso-mensual` | Pendiente |
| 5. Consultas | `feature/consultas` | Pendiente |
| 6. Reportes PDF | `feature/reportes` | Pendiente |
| 7. Gráficas | `feature/graficas` | Pendiente |

## Notas de compatibilidad con el sistema Java

- Las contraseñas en `DEP_USUARIOS` están en **texto plano** y el sistema Java comparte la tabla, por eso se siguen comparando igual. Toda la lógica está en `backend/src/auth/password.ts` para migrar a bcrypt cuando se retire Java.
- Los usuarios con `USU_ESTADO = 'I'` no pueden ingresar (el sistema Java no lo validaba).
- La clave inicial (`CLAVE_INICIAL`) obliga al usuario a cambiarla al entrar.
- "Olvidé mi clave" por correo está pendiente de rediseño: el token del sistema Java no estaba ligado a un usuario.
- Todas las consultas usan bind variables (`:param`); el sistema Java concatenaba valores en el SQL.
