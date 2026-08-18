# API Backend (Info_Diz)

Proyecto Django. El `manage.py` a usar es el de la **raíz** del repositorio (`Info_Diz/manage.py`), no otro.

```bash
cd Info_Diz
python manage.py runserver
```

## Autenticación

JWT vía `djangorestframework-simplejwt`. Todos los endpoints (salvo login) requieren el header:

```
Authorization: Bearer <access_token>
```

| Endpoint | Método | Descripción |
|---|---|---|
| `/api/auth/login/` | `POST` | Body `{"username": "...", "password": "..."}` → devuelve `{"access": "...", "refresh": "..."}` |
| `/api/auth/login/refresh/` | `POST` | Body `{"refresh": "..."}` → renueva el `access` token |
| `/api/auth/me/` | `GET` | Datos del usuario autenticado |

### `POST /api/auth/login/`

```bash
curl -X POST http://127.0.0.1:8000/api/auth/login/ \
  -H "Content-Type: application/json" \
  -d '{"username": "duvan", "password": "..."}'
```

Respuesta (`200`) — el rol del usuario va embebido en ambos tokens JWT (claim `role`):
```json
{"refresh": "eyJhbGci...", "access": "eyJhbGci..."}
```
Credenciales incorrectas → `401` `{"detail": "No active account found with the given credentials"}`.

### `POST /api/auth/login/refresh/`

El `access` token expira en 30 minutos (`SIMPLE_JWT.ACCESS_TOKEN_LIFETIME`). Se renueva con el `refresh` token (vigente 1 día) sin volver a pedir credenciales.

```bash
curl -X POST http://127.0.0.1:8000/api/auth/login/refresh/ \
  -H "Content-Type: application/json" \
  -d '{"refresh": "<REFRESH_TOKEN>"}'
```

Respuesta (`200`):
```json
{"access": "eyJhbGci..."}
```
Refresh token inválido o expirado → `401` `{"detail": "Token is invalid", "code": "token_not_valid"}`.

### `GET /api/auth/me/`

Devuelve el usuario autenticado actual (pensado para el `AuthContext` del Frontend).

```bash
curl -H "Authorization: Bearer <ACCESS_TOKEN>" http://127.0.0.1:8000/api/auth/me/
```

Respuesta (`200`):
```json
{"id": 1, "username": "duvan", "email": "duvan@example.com", "role": "PROVEEDOR"}
```
Sin token (o inválido) → `401` `{"detail": "Authentication credentials were not provided."}`.

## Rol `ADMIN` y control de acceso por proveedor

`ADMIN` es un rol de sistema, separado de la jerarquía de negocio (`PROVEEDOR`/`SUPERVISOR`/`DIRECTOR`) — administra usuarios y asignaciones, pero no participa de datos de ventas/cierres. Usuario local: `admin` / `Admin2026*`.

Un usuario con rol `PROVEEDOR` solo ve datos del proveedor que un `ADMIN` le haya asignado explícitamente (`Backend/apps/users/models.py::ProveedorAccess`, tabla local, no del mirror) — **exactamente 1, obligatorio**. `SUPERVISOR` también se restringe por proveedor, pero puede tener **varios** (0 o más), y además se restringe por **vendedor** (`VendedorAccess`, mismo criterio: 0 o más). **Ambas dimensiones se combinan con AND**: un `SUPERVISOR` solo ve ventas que sean a la vez de sus proveedores asignados Y de sus vendedores asignados — sin ninguno asignado en una dimensión, no ve nada por esa dimensión (no hay acceso total por defecto en ninguna). `DIRECTOR`/`ADMIN` nunca se filtran por esto. La lógica vive en `Backend/apps/users/scoping.py::scoped_proveedores(user)` / `scoped_vendedores(user)` y se aplica en `ventas-detalle` (lista + `por-vendedor`); `exports/sales` y `exports/prices` solo aplican `scoped_proveedores` (son exclusivos de `PROVEEDOR`, que no usa vendedor).

| Endpoint | Método | Rol | Descripción |
|---|---|---|---|
| `/api/auth/admin/users/` | `GET` | `ADMIN` | Lista usuarios con sus proveedores/vendedores asignados (`{id, username, role, proveedores, vendedores}`) |
| `/api/auth/admin/users/` | `POST` | `ADMIN` | Body `{"username", "password", "role", "email"}` — crea un usuario nuevo |
| `/api/auth/admin/users/<id>/` | `PATCH` | `ADMIN` | Body con cualquiera de `{"username", "email", "role", "password"}` — edita el usuario; `password` es opcional (si no viene, no se cambia) |
| `/api/auth/admin/users/<id>/` | `DELETE` | `ADMIN` | Elimina el usuario. `400` si intenta eliminarse a sí mismo |
| `/api/auth/admin/users/<id>/proveedores/` | `PUT` | `ADMIN` | Body `{"proveedores": ["COLOMBINA", "..."]}` — **reemplaza** por completo el set asignado a ese usuario. `400` si el usuario es `PROVEEDOR` y la lista no tiene exactamente 1 elemento. |
| `/api/auth/admin/users/<id>/vendedores/` | `PUT` | `ADMIN` | Body `{"vendedores": ["1013-ADMINISTRATIVA", "..."]}` — **reemplaza** por completo el set asignado. `400` si el usuario no es `SUPERVISOR`. |
| `/api/mirror/proveedores/` | `GET` | `ADMIN`, `SUPERVISOR`, `DIRECTOR` | `ADMIN`/`DIRECTOR`: todos los proveedores distintos en `productos_precios_sap`. `SUPERVISOR`: solo los que tiene asignados. Alimenta el selector del admin y el filtro en `ventas-detalle` (`VentasDetalle.jsx`) |
| `/api/mirror/vendedores/` | `GET` | `ADMIN` | Todos los vendedores en la tabla `vendedores` del mirror. Alimenta el selector del admin para asignar a un `SUPERVISOR` |

```bash
curl -X POST http://127.0.0.1:8000/api/auth/admin/users/ \
  -H "Authorization: Bearer <TOKEN_ADMIN>" -H "Content-Type: application/json" \
  -d '{"username": "nuevo", "password": "ClaveSegura123", "role": "SUPERVISOR", "email": "nuevo@ejemplo.com"}'

curl -X PUT http://127.0.0.1:8000/api/auth/admin/users/2/proveedores/ \
  -H "Authorization: Bearer <TOKEN_ADMIN>" -H "Content-Type: application/json" \
  -d '{"proveedores": ["DISTRIBUIDORA COLOMBINA LIMITADA"]}'

curl -X PUT http://127.0.0.1:8000/api/auth/admin/users/2/vendedores/ \
  -H "Authorization: Bearer <TOKEN_ADMIN>" -H "Content-Type: application/json" \
  -d '{"vendedores": ["3044 WILLIAM MAURICIO CAMACHO"]}'
```

Verificado end-to-end: `ADMIN` lista 58 vendedores; asignar vendedor a un `PROVEEDOR` falla (`400`); un `SUPERVISOR` con 2 proveedores + 1 vendedor asignado solo ve ese vendedor en `por-vendedor`; quitándole el vendedor (dejando solo proveedores) pasa a ver 0 resultados (AND estricto, confirmado).

Verificado end-to-end: `ADMIN` crea usuarios (`201`, password hasheado correctamente) y otros roles reciben `403`; `PROVEEDOR` con 2 proveedores en el PUT falla (`400`), con 1 pasa, con 0 falla; `SUPERVISOR` con varios pasa y queda scopeado correctamente (28 de 52 vendedores en el rango probado); pedir un proveedor fuera de su alcance no filtra nada extra (0 resultados, no hay fuga de datos); editar (`PATCH`, incluye cambio de password) funciona y un no-`ADMIN` recibe `403`; eliminar funciona (`204`) y un `ADMIN` no puede eliminarse a sí mismo (`400`).

## Base de datos espejo (`mirror`)

Conexión de solo lectura a MySQL (Hostinger), configurada en `.env` (`MIRROR_DB_*`). Los modelos en `Backend/apps/mirror/models.py` son `managed = False` — nunca se migran ni se escriben desde Django (`save()`/`delete()` lanzan `NotImplementedError`).

### `GET /api/mirror/ventas-detalle/`

Consulta paginada sobre la tabla `ventas_detalle` (~2.7M filas). Requiere autenticación (`IsAuthenticated`).

**Paginación**

| Param | Descripción |
|---|---|
| `page` | Número de página |
| `page_size` | Resultados por página (default 50, máximo 500) |

**Filtros** (todos opcionales, combinables entre sí con AND)

| Param | Tipo | Campo real | Ejemplo |
|---|---|---|---|
| `fecha_desde` | fecha `YYYY-MM-DD` (`>=`) | `fecha` | `2026-08-01` |
| `fecha_hasta` | fecha `YYYY-MM-DD` (`<=`) | `fecha` | `2026-08-13` |
| `cod_producto` | exacto | `cod_producto` | `107036` |
| `cod_cliente` | exacto | `cod_cliente` | `PRE19600` |
| `nit_cliente` | exacto | `nit_cliente` | `1058668925` |
| `numero_documento` | exacto | `numero_documento` | `20391110` |
| `ciudad` | exacto | `ciudad` | `POPAYAN` |
| `unidad` | exacto | `unidad_medida` | `6` |
| `producto` | contiene (`icontains`) | `producto` | `DETER` |
| `nom_cliente` | contiene (`icontains`) | `nom_cliente` | `CRUZ` |
| `vendedor_nombre` | contiene (`icontains`) | `vendedor_nombre` | `WILLIAM` |
| `proveedor` | contiene (`icontains`) | `proveedor` | `COLOMBINA` |

Una fecha con formato inválido devuelve `400` con detalle del error, no un `500`.

```bash
curl -H "Authorization: Bearer <TOKEN>" \
  "http://127.0.0.1:8000/api/mirror/ventas-detalle/?fecha_desde=2026-08-01&fecha_hasta=2026-08-13&proveedor=COLOMBINA&page_size=100"
```

**Advertencia de performance:** la tabla real solo tiene índice en `vendedor_nombre` y en la PK compuesta (`id_interno_documento`, `numero_linea`). No hay índice en `fecha` ni en el resto de campos filtrables, así que consultas amplias (rangos de fecha grandes o sin filtro) escanean la tabla completa y pueden ser lentas.

### `GET /api/mirror/ventas-detalle/por-vendedor/`

Venta neta acumulada por vendedor: agrupa por `vendedor_nombre` y suma `line_total_final` (→ `total_venta`) y `total_cant_final` (→ `total_cantidad`); ambos campos ya traen las devoluciones/notas crédito restadas, a diferencia de `venta_bruta`/`cantidad`. También incluye `num_lineas` (conteo de líneas). Admite los mismos filtros que el listado, pero **`fecha_desde` y `fecha_hasta` son obligatorios** — sin ellos devuelve `400`:

```json
{"fecha_desde": "Este filtro es obligatorio.", "fecha_hasta": "Este filtro es obligatorio."}
```

```bash
curl -H "Authorization: Bearer <TOKEN>" \
  "http://127.0.0.1:8000/api/mirror/ventas-detalle/por-vendedor/?fecha_desde=2026-08-01&fecha_hasta=2026-08-13&proveedor=COLOMBINA"
```

Respuesta: lista (sin paginar, ~58 vendedores como máximo) ordenada por `total_venta` descendente.

## Exports (planos)

Descarga de planos en CSV o XLSX. Requiere autenticación **y** rol `PROVEEDOR` (`IsProveedor`) — cualquier otro rol recibe `403`.

| Endpoint | Archivo | Columnas | Fuente | Filtros |
|---|---|---|---|---|
| `GET /api/exports/inventory/` | `inventario.csv` / `.xlsx` | SKU, Descripcion, Cantidad | — (placeholder, `get_rows()` devuelve `[]`) | — |
| `GET /api/exports/sales/` | `ventas.csv` / `.xlsx` | 32 columnas, orden y nombres calcados de `VENTA U-P-V-C-A CON DEV V3.xlsx` | `ventas_detalle` (mirror) | `fecha_desde`, `fecha_hasta` **(obligatorios, igual que `por-vendedor`)** |
| `GET /api/exports/prices/` | `precios.csv` / `.xlsx` | Todas las columnas de `productos_precios_sap` (11) | `productos_precios_sap` (mirror) | `proveedor` (contiene) |

**Formato de archivo**

| Param | Valores | Default |
|---|---|---|
| `filetype` | `csv`, `xlsx` | `csv` |

> Ojo: el parámetro es `filetype`, **no** `format` — `format` está reservado por Django REST Framework para su propia negociación de contenido (`?format=json`/`api`), y si se usa para esto DRF corta la petición con `404` antes de que llegue a la vista.

```bash
curl -H "Authorization: Bearer <TOKEN>" \
  -o inventario.csv "http://127.0.0.1:8000/api/exports/inventory/"

curl -H "Authorization: Bearer <TOKEN>" \
  -o ventas.xlsx "http://127.0.0.1:8000/api/exports/sales/?fecha_desde=2026-08-01&fecha_hasta=2026-08-13&filetype=xlsx"

curl -H "Authorization: Bearer <TOKEN>" \
  -o precios.csv "http://127.0.0.1:8000/api/exports/prices/?proveedor=COLOMBINA"
```

Una fecha con formato inválido en `sales` devuelve `400` (mismo comportamiento que `ventas-detalle`), no `500`.

**`sales` vs el plano de referencia:** comparado contra `VENTA U-P-V-C-A CON DEV V3.xlsx` (38 columnas), 3 no existen como dato crudo en `ventas_detalle` y por eso faltan en el export: `Nombre de serie` (serie del documento), `PRECIOTTLSINDCTO` y `VLRDTO` (ambas parecen calculadas, no columnas de la tabla origen). Ese Excel también trae `TIPOLOGIA` duplicada dos veces; aquí aparece una sola vez.

**Tope de filas:** cada descarga trae como máximo `MAX_EXPORT_ROWS = 100000` filas (constante en `apps/exports/views.py`), para evitar que una descarga sin filtro intente volcar la tabla completa (`ventas_detalle` tiene ~2.7M filas) en un solo archivo. Si necesitas más, filtra por fecha en varios rangos.

**Pendiente:** `inventory` sigue siendo un placeholder (`get_rows()` → `[]`) — falta identificar cuál tabla del mirror representa el inventario.
