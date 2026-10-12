# Sistema de Control de Vacaciones (Desarrollo Organizacional)
**Organización:** Grupo JAMA  
**Entorno:** Red Local (LAN / Intranet On-Premise)  
**Base de Datos:** Microsoft SQL Server (`ControlVacaciones_DO`)  
**Fuente de Datos:** CONTPAQi Nóminas (`nom10001`, `nom10002`, `nom10003`)  
**Normativa Laboral:** Ley Federal del Trabajo (LFT México - Reforma Vacaciones Dignas 2023+)  

---

## 1. Arquitectura Técnica y Desacoplamiento

El sistema implementa una arquitectura desacoplada para garantizar máxima disponibilidad en la intranet corporativa sin interferir con las operaciones transaccionales del ERP CONTPAQi Nóminas:

```
[CONTPAQi Nóminas] (Solo Lectura)
  ├── nom10001 (Empleados)
  ├── nom10002 (Puestos)
  └── nom10003 (Departamentos)
          │
          │ (Vistas Desacopladas vw_Nomipaq_*)
          ▼
[Base de Datos Operativa: ControlVacaciones_DO] (Microsoft SQL Server)
  ├── Departamentos
  ├── Puestos
  ├── Colaboradores (con atributos locales: RolApp, IdJefeDirecto)
  ├── DiasInhabiles (Festivos oficiales LFT México 2024-2027)
  ├── SaldosVacaciones (Cálculo histórico por períodos LFT)
  ├── SolicitudesVacaciones (Folios consecutivos, rangos de fechas)
  └── HistorialAprobaciones (Trazabilidad inmutable: Web / Teams)
          │
          │ (Pool de conexiones MSSQL / Transacciones atómicas)
          ▼
[Backend REST API: Node.js / Express]
  ├── Cálculo de días hábiles omitiendo descansos y festivos
  ├── Validación estricta de saldos contra sobregiros
  ├── MERGE incremental conservando jerarquías locales
  └── Generador de tarjetas adaptables para Microsoft Teams
          │
          │ (REST JSON / CORS Intranet)
          ▼
[Frontend Web Responsive: React + Vite + Tailwind CSS]
  ├── Portal del Colaborador (Autoservicio, simulador, kárdex)
  ├── Bandeja del Líder (Aprobación 1-clic, rechazo obligatorio)
  └── Panel DO (Admin, Sincronizador NOMIPAQ, exportación nómina)
```

---

## 2. Estructura del Proyecto

```
C:\_DESARROLLO\DESARROLLO_O\
├── database/
│   ├── 01_schema.sql                # DDL: Tablas, PKs, FKs, Índices y Restricciones
│   ├── 02_functions_and_sps.sql     # fn_CalcularDiasHabiles, sp_CalcularSaldosVacaciones, sp_SincronizarNomipaq
│   ├── 03_seed_data.sql             # Festivos oficiales México LFT 2024-2027 y cuentas demo
│   ├── 04_mock_nomipaq_source.sql   # Esquema fuente NOMIPAQ y vistas desacopladas
│   └── extract_excel_catalogo.py    # ETL para extraer los 601 colaboradores de Grupo JAMA
├── server/
│   ├── src/
│   │   ├── config/database.js       # Pool de conexiones a SQL Server con fallback local
│   │   ├── controllers/             # Controladores REST modulares
│   │   ├── services/                # LFT Vacaciones Dignas y motor de días hábiles
│   │   ├── middleware/              # Seguridad JWT y validación de roles
│   │   ├── routes/api.js            # Enrutador de la API
│   │   └── app.js                   # Servidor Express y host del portal unificado
│   ├── .env                         # Variables de entorno SQL Server
│   └── package.json
├── client/
│   ├── src/
│   │   ├── components/              # Calendario interactivo, StatCards, Kárdex, Modales
│   │   ├── pages/                   # Portal Colaborador, Líder y Admin DO
│   │   └── api/client.js            # Cliente fetch con soporte CSV
│   └── dist/                        # Build de producción para intranet
├── start-app.bat                    # Script ejecutable 1-clic para Windows
└── README.md
```

---

## 3. Despliegue de Base de Datos en Microsoft SQL Server

Para desplegar la base de datos en su servidor local o instancia corporativa de SQL Server (a través de SQL Server Management Studio o Azure Data Studio), ejecute los scripts en orden:

1. `database/01_schema.sql`: Crea la base de datos `ControlVacaciones_DO`, tablas con índices clustered/non-clustered y constraints.
2. `database/02_functions_and_sps.sql`: Registra la función escalar `fn_CalcularDiasHabiles`, `fn_CalcularDiasLFT`, la función en tabla `tvf_ObtenerDetalleDiasSolicitud` y los Stored Procedures `sp_CalcularSaldosVacaciones`, `sp_SincronizarDesdeNomipaq` y `sp_RegistrarSolicitudVacaciones`.
3. `database/03_seed_data.sql`: Carga el catálogo de días festivos oficiales de México (Art. 74 LFT) para 2024, 2025, 2026 y 2027, y usuarios de prueba.
4. `database/04_mock_nomipaq_source.sql`: Crea las vistas de extracción de solo lectura hacia la base de NOMIPAQ (`vw_Nomipaq_Empleados`, `vw_Nomipaq_Puestos`, `vw_Nomipaq_Departamentos`).

---

## 4. Configuración del Servidor (.env)

Abra el archivo `server/.env` y configure las credenciales de su instancia de SQL Server:

```env
PORT=5000
NODE_ENV=production

# Conexión a Microsoft SQL Server
DB_SERVER=localhost
DB_PORT=1433
DB_NAME=ControlVacaciones_DO
DB_USER=sa
DB_PASSWORD=TuPasswordSeguro123!
DB_ENCRYPT=false
DB_TRUST_SERVER_CERTIFICATE=true

# Base de datos fuente CONTPAQi Nóminas
NOMIPAQ_DB=nomipaq_jama

# Clave de seguridad JWT
JWT_SECRET=jama_secret_vacaciones_do_2026_jwt_token

# Fallback automático a motor local si SQL Server no está levantado
USE_MOCK_FALLBACK=true
```

---

## 5. Ejecución Rápida en Windows

Haga doble clic en el archivo:
```
start-app.bat
```
O desde la consola PowerShell / CMD:
```powershell
cd C:\_DESARROLLO\DESARROLLO_O\server
node src/app.js
```
El portal estará disponible inmediatamente en:  
**http://localhost:5000**

---

## 6. Módulos y Flujos de Autorización

### A. Portal del Colaborador (Autoservicio)
- **Vista de saldos en tiempo real:** Días por Ley LFT, disfrutados, en trámite y saldo neto disponible.
- **Simulador de días hábiles:** Selector interactivo de rango de fechas con desglose automático que excluye fines de semana y festivos oficiales (LFT Art. 74).
- **Registro con Folio Consecutivo:** Generación de folio único (ej. `VAC-2026-00001`) y validación inmediata contra sobregiros.
- **Kárdex Histórico:** Detalle de períodos por año cumplido y fechas de expiración (18 meses conforme a LFT Art. 81).

### B. Portal del Líder / Gerencia
- **Bandeja de solicitudes pendientes:** Filtradas automáticamente según `IdJefeDirecto`.
- **Aprobación en 1 Clic:** Envío al siguiente nivel de aprobación o aplicación formal.
- **Rechazo con Motivo Obligatorio:** Formulario con validación estricta que exige justificación para notificar al colaborador.
- **Integración con Microsoft Teams:** Generador de tarjetas adaptables (Adaptive Cards) para autorizaciones ágiles.
- **Directorio de equipo:** Consulta del saldo actual de la plantilla a su cargo.

### C. Panel de Desarrollo Organizacional (Admin DO)
- **Bandeja Global & VoBo Final:** Supervisión de todas las solicitudes de Grupo JAMA con filtros por Empresa, Sucursal, Departamento y Estado.
- **Centro de Sincronización NOMIPAQ:**
  - Diagnóstico de enlace con tablas `nom10001`, `nom10002` y `nom10003`.
  - Previsualización de cambios pendientes (nuevas altas, cambios de puesto).
  - Botón de disparo manual del Stored Procedure de sincronización incremental (`MERGE`).
  - Bitácora inmutable de auditoría.
- **Administrador de Días Inhábiles:** Registro de feriados oficiales y asuetos corporativos.
- **Kárdex General y Exportación:** Listado completo de los 601 colaboradores con botón de descarga a archivo CSV/Excel para el departamento de nómina.

---

## 7. Cuentas de Demostración Rápida
Utilice el selector interactivo en la cabecera del portal para alternar instantáneamente entre los 3 roles:
1. **Colaborador:** Benito Salazar (`CONS-100`) - Montacarguista 6 (San Luis, Construjama).
2. **Líder:** Mary Araiza (`CONS-103`) - Gerente de Sucursal (Guadalajara).
3. **Admin DO:** Tania Ramírez (`DO-010`) - Especialista de Desarrollo Organizacional.
