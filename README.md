# Sistema de Control de Vacaciones (Desarrollo Organizacional)
**Organización:** Grupo JAMA  
**Entorno:** Red Local (LAN / Intranet On-Premise)  
**Base de Datos Operativa Local:** Microsoft SQL Server (`DESARROLLO_O`)  
**Servidor Remoto Desacoplado:** CONTPAQi Nóminas (8 Razones Sociales sin Linked Server ni MSDTC)  
**Normativa Laboral:** Ley Federal del Trabajo (LFT México - Reforma Vacaciones Dignas 2023+)  

---

## 1. Arquitectura Técnica e Integración Multi-Empresa

El sistema opera con dos motores SQL Server completamente independientes comunicados por el backend a través de TCP/IP nativo:

```
[SERVIDOR REMOTO CONTPAQi NÓMINAS] (Lectura No Transaccional con NOLOCK)
  ├── 1. ctCEMENTOS_MOCTEZ      (Cementos Moctezuma)
  ├── 2. ctCONSTRUJAMA_DE_      (Construjama de México S.A. de C.V.)
  ├── 3. ctCONTROLADORA_JA      (Controladora JAMA, S.C.)
  ├── 4. ctDISTRIBUIDOR_DE      (Distribuidor de Cemento del Occidente S.A. de C.V. - DICOSA)
  ├── 5. ctDISTRIBUIDORA_J      (Distribuidora JAMA)
  ├── 6. ctIMPULSORA_DE_NE      (Impulsora de Negocios)
  ├── 7. ctLATINO_CONCRETO      (Latino Concretos)
  └── 8. ctTRAMO_DEL_CENTR      (Tramo del Centro)
          │
          │ (Extracción segura: SET TRANSACTION ISOLATION LEVEL READ UNCOMMITTED)
          ▼
[BACKEND REST API (Node.js / Express)]
  ├── Servicio de Sincronización Desacoplado (`nomipaqSyncService.js`)
  ├── Tareas en Segundo Plano (`POST /api/admin/sincronizar-empleados`)
  ├── Consulta no bloqueante con WITH (NOLOCK) sobre nom10001, nom10002, nom10003
  └── Staging local temporal (#StagingEmpleados) con sentencias MERGE
          │
          │ (Escritura Atómica Local con BEGIN TRANSACTION / COMMIT / ROLLBACK)
          ▼
[BASE DE DATOS LOCAL: DESARROLLO_O] (Microsoft SQL Server)
  ├── dbo.EmpresasNomipaq       (Catálogo de las 8 razones sociales)
  ├── dbo.Departamentos         (FK: IdEmpresa, Código)
  ├── dbo.Puestos               (FK: IdEmpresa, Código)
  ├── dbo.Colaboradores         (Llave Compuesta: IdEmpresa + CodigoEmpleado)
  │    └── Integridad: NUNCA se sobreescribe IdJefeDirecto ni RolApp
  ├── dbo.DiasInhabiles         (Festivos oficiales LFT México 2024-2027)
  ├── dbo.SaldosVacaciones      (Devengo acumulado por períodos anuales LFT)
  ├── dbo.SolicitudesVacaciones (Folios consecutivos, validación de sobregiro)
  └── dbo.BitacoraSincronizacionNomipaq (Auditoría inmutable de ingestas)
```

---

## 2. Ajustes al Modelo de Datos (`DESARROLLO_O`)

1. **Catálogo de Empresas:** `dbo.EmpresasNomipaq` (`IdEmpresa`, `NombreBaseDatos`, `AliasEmpresa`, `Activa`, `UltimaSincronizacion`).
2. **Llaves Foráneas Multi-Empresa:** `IdEmpresa` incorporado en `dbo.Departamentos`, `dbo.Puestos` y `dbo.Colaboradores`.
3. **Llave Natural Compuesta:** `(IdEmpresa, CodigoEmpleado)` garantiza la unicidad de cada trabajador entre las diferentes empresas del grupo.
4. **Regla de Integridad en el MERGE:** Al actualizar un colaborador existente desde CONTPAQi Nóminas, **se protegen estrictamente `IdJefeDirecto` y `RolApp`**, preservando la gobernanza interna definida en la aplicación web.

---

## 3. Despliegue de Base de Datos en SQL Server

Ejecute los scripts de la carpeta `database/` en SQL Server Management Studio (SSMS):

1. [**`01_schema.sql`**](file:///C:/_DESARROLLO/DESARROLLO_O/database/01_schema.sql): Crea la base de datos `DESARROLLO_O`, tablas, llaves foráneas, índices no agrupados y restricciones de llave compuesta.
2. [**`02_functions_and_sps.sql`**](file:///C:/_DESARROLLO/DESARROLLO_O/database/02_functions_and_sps.sql): Instala las funciones `fn_CalcularDiasLFT`, `fn_CalcularDiasHabiles`, `tvf_ObtenerDetalleDiasSolicitud`, y los procedimientos `sp_CalcularSaldosVacaciones`, `sp_AplicarStagingNomipaq`, `sp_RegistrarSolicitudVacaciones` y `sp_ProcesarAprobacionSolicitud`.
3. [**`03_seed_data.sql`**](file:///C:/_DESARROLLO/DESARROLLO_O/database/03_seed_data.sql): Inicializa las 8 razones sociales en `dbo.EmpresasNomipaq`, los festivos oficiales de México (2024-2027) y cuentas demo.

---

## 4. Configuración de Cadenas de Conexión (`server/.env`)

El archivo [**`server/.env`**](file:///C:/_DESARROLLO/DESARROLLO_O/server/.env) cuenta con parámetros separados para cada servidor:

```env
PORT=5000
NODE_ENV=production

# -----------------------------------------------------------------------
# 1. SERVIDOR LOCAL (Base de datos operativa: DESARROLLO_O)
# -----------------------------------------------------------------------
LOCAL_DB_SERVER=localhost
LOCAL_DB_PORT=1433
LOCAL_DB_NAME=DESARROLLO_O
LOCAL_DB_USER=sa
LOCAL_DB_PASSWORD=TuPasswordLocalSeguro123!
LOCAL_DB_ENCRYPT=false
LOCAL_DB_TRUST_SERVER_CERTIFICATE=true

# -----------------------------------------------------------------------
# 2. SERVIDOR REMOTO CONTPAQi NÓMINAS (Instancia independiente de Nóminas)
# -----------------------------------------------------------------------
NOMIPAQ_REMOTE_SERVER=192.168.1.50
NOMIPAQ_REMOTE_PORT=1433
NOMIPAQ_REMOTE_USER=sa_nomipaq
NOMIPAQ_REMOTE_PASSWORD=TuPasswordNomipaqRemoto123!
NOMIPAQ_REMOTE_ENCRYPT=false
NOMIPAQ_REMOTE_TRUST_SERVER_CERTIFICATE=true

# Lista de las 8 bases de datos remotas en CONTPAQi Nóminas
NOMIPAQ_DATABASES=ctCEMENTOS_MOCTEZ,ctCONSTRUJAMA_DE_,ctCONTROLADORA_JA,ctDISTRIBUIDOR_DE,ctDISTRIBUIDORA_J,ctIMPULSORA_DE_NE,ctLATINO_CONCRETO,ctTRAMO_DEL_CENTR

# -----------------------------------------------------------------------
# 3. SEGURIDAD Y RESILIENCIA
# -----------------------------------------------------------------------
JWT_SECRET=jama_secret_vacaciones_desarrollo_o_2026_jwt_token
USE_MOCK_FALLBACK=true
```

---

## 5. Endpoints de Sincronización en Segundo Plano

- **Iniciar Sincronización Multi-Empresa:**
  `POST /api/admin/sincronizar-empleados`
  - Responde de inmediato con `HTTP 202 Accepted` y el `taskId` generado.
  - Ejecuta la extracción de las 8 bases de datos remotas en segundo plano sin congelar la interfaz ni bloquear el servidor.
- **Consultar Estado del Progreso:**
  `GET /api/admin/sincronizar-empleados/status/:taskId`
  - Devuelve el progreso detallado (ej. `3/8 bases completadas`, empresa actual en proceso, conteo de insertados y actualizados).
- **Consultar Bitácora Histórica:**
  `GET /api/sync-nomipaq/logs`

---

## 6. Ejecución y Acceso

Haga doble clic en el archivo:
👉 [**`C:\_DESARROLLO\DESARROLLO_O\start-app.bat`**](file:///C:/_DESARROLLO/DESARROLLO_O/start-app.bat)

O abra su navegador en:
👉 **`http://localhost:5000`**
