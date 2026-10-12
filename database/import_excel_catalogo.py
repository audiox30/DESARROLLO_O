"""
=================================================================================
SCRIPT DE IMPORTACIÓN DEL CATÁLOGO MAESTRO DO (EXCEL -> DESARROLLO_O)
Archivo origen: DOCS/CATALOGO DE EMPLEADOS Y BAJAS 2025 Tania.xlsx
Pestañas: ACTIVOS y BAJAS
Base de Datos: Microsoft SQL Server (DESARROLLO_O)
=================================================================================
"""
import openpyxl
import pyodbc
import re
import os
import sys
import datetime
from pathlib import Path

# Configuración de salida segura para consola Windows
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
if hasattr(sys.stderr, 'reconfigure'):
    sys.stderr.reconfigure(encoding='utf-8', errors='replace')

# Configuración de Rutas y Conexión
BASE_DIR = Path(__file__).resolve().parent.parent
EXCEL_PATH = BASE_DIR / 'DOCS' / 'CATALOGO DE EMPLEADOS Y BAJAS 2025 Tania.xlsx'

DB_SERVER = os.getenv('LOCAL_DB_SERVER', '192.168.20.15,1433')
DB_NAME = os.getenv('LOCAL_DB_NAME', 'DESARROLLO_O')
DB_USER = os.getenv('LOCAL_DB_USER', 'sa')
DB_PASS = os.getenv('LOCAL_DB_PASSWORD', 'Grupojama1')

CONN_STR = (
    f"DRIVER={{ODBC Driver 17 for SQL Server}};"
    f"SERVER={DB_SERVER};"
    f"DATABASE={DB_NAME};"
    f"UID={DB_USER};"
    f"PWD={DB_PASS};"
    f"TrustServerCertificate=yes;"
)

# 1. Mapeador exacto de EMPRESA a base de datos en dbo.EmpresasNomipaq (8 oficiales)
EMPRESA_MAPPING = {
    'CONSTRUJAMA DE MEXICO S.A. DE C.V.': 'ctCONSTRUJAMA_DE_',
    'LATINO CONCRETOS, S.A. DE C.V.': 'ctLATINO_CONCRETO',
    'TRAMO DEL CENTRO, SA DE CV': 'ctTRAMO_DEL_CENTR',
    'DISTRIBUIDOR DE CEMENTO DEL OCCIDENTE, S.A. DE C.V.': 'ctDISTRIBUIDOR_DE',
    'CONTROLADORA JAMA, S.C.': 'ctCONTROLADORA_JA',
    'CEMENTOS MOCTEZUMA DE SAN LUIS POTOSI S.A. DE C.V.': 'ctCEMENTOS_MOCTEZ',
    'IMPULSORA DE NEGOCIOS JAMA, S.A. DE C.V.': 'ctIMPULSORA_DE_NE',
    'DISTRIBUIDORA JAMA': 'ctDISTRIBUIDORA_J'
}

def clean_str(val, max_len=None):
    if val is None:
        return None
    s = str(val).strip()
    if s in ['', '#N/A', 'N/A', 'None', 'nan', 'null', 'NULL']:
        return None
    if max_len:
        s = s[:max_len]
    return s

def clean_date(v):
    if v is None:
        return None
    if isinstance(v, (datetime.datetime, datetime.date)):
        if v.year < 1920:
            return None
        return v.strftime('%Y-%m-%d')
    s = str(v).strip()
    if s in ['', '#N/A', 'N/A', 'None', 'nan', '0', '-', '00/00/0000']:
        return None
    for fmt in ['%Y-%m-%d', '%d/%m/%Y', '%d-%m-%Y', '%Y/%m/%d']:
        try:
            d = datetime.datetime.strptime(s, fmt)
            if d.year < 1920:
                return None
            return d.strftime('%Y-%m-%d')
        except:
            pass
    return None

def clean_decimal(v):
    if v is None:
        return None
    if isinstance(v, (int, float)):
        return float(v)
    s = str(v).strip().replace('$', '').replace(',', '').replace(' ', '')
    if s in ['', '#N/A', 'N/A', 'None', '-']:
        return None
    try:
        return float(s)
    except:
        return None

def clean_codigo_empleado(raw_num, subfijo, row_idx=None):
    """
    2. Limpieza de NUM DE NOMINA:
    - Tratar siempre como VARCHAR(30) (conserva 811*, CONS-972, 1006-CON).
    - Caso especial 'MOD 40': extraer número del subfijo (ej. de 'CONS-110' toma '110')
      o usar el texto completo del subfijo.
    """
    if raw_num is None:
        return None
    s_num = str(raw_num).strip()
    s_sub = str(subfijo).strip() if subfijo is not None else ""
    
    if not s_num or s_num.upper() in ['NONE', '#N/A', 'N/A']:
        return None

    if 'MOD 40' in s_num.upper():
        m = re.search(r'\d+', s_sub)
        if m:
            return m.group(0)
        elif s_sub:
            return s_sub
        else:
            return f"MOD-40-{row_idx}" if row_idx else "MOD-40"

    # Si Excel lo leyó como float 102.0
    if s_num.endswith('.0') and s_num[:-2].isdigit():
        return s_num[:-2]

    return s_num[:30]

def get_or_create_depto(cursor, id_empresa, depto_nombre):
    if not depto_nombre:
        return None
    name = str(depto_nombre).strip().upper()[:150]
    cursor.execute("SELECT IdDepartamento FROM dbo.Departamentos WHERE IdEmpresa = ? AND UPPER(Nombre) = ?", (id_empresa, name))
    row = cursor.fetchone()
    if row:
        return row[0]
    # Generar código único para el depto
    cursor.execute("SELECT ISNULL(MAX(IdDepartamento), 0) + 1 FROM dbo.Departamentos")
    code = f"DEP-{cursor.fetchone()[0]}"
    cursor.execute("""
        INSERT INTO dbo.Departamentos (IdEmpresa, CodigoNomipaq, Nombre, Activo)
        VALUES (?, ?, ?, 1)
    """, (id_empresa, code, name))
    cursor.execute("SELECT @@IDENTITY")
    return int(cursor.fetchone()[0])

def get_or_create_puesto(cursor, id_empresa, puesto_nombre):
    if not puesto_nombre:
        return None
    name = str(puesto_nombre).strip().upper()[:150]
    cursor.execute("SELECT IdPuesto FROM dbo.Puestos WHERE IdEmpresa = ? AND UPPER(Nombre) = ?", (id_empresa, name))
    row = cursor.fetchone()
    if row:
        return row[0]
    # Generar código único para el puesto
    cursor.execute("SELECT ISNULL(MAX(IdPuesto), 0) + 1 FROM dbo.Puestos")
    code = f"PUE-{cursor.fetchone()[0]}"
    cursor.execute("""
        INSERT INTO dbo.Puestos (IdEmpresa, CodigoNomipaq, Nombre, Activo)
        VALUES (?, ?, ?, 1)
    """, (id_empresa, code, name))
    cursor.execute("SELECT @@IDENTITY")
    return int(cursor.fetchone()[0])

def main():
    print("=" * 77)
    print("      IMPORTACION MAESTRA DE COLABORADORES Y BAJAS (GRUPO JAMA)")
    print("=" * 77)
    print(f"Archivo origen: {EXCEL_PATH}")
    print(f"Servidor BD:    {DB_SERVER} ({DB_NAME})")
    print("-" * 77)

    if not EXCEL_PATH.exists():
        print(f"[ERROR] No se encontro el archivo Excel en: {EXCEL_PATH}")
        sys.exit(1)

    print("Conectando a base de datos...")
    conn = pyodbc.connect(CONN_STR, autocommit=False)
    cursor = conn.cursor()

    # Regla: NO crear empresa GONZALO RAMIREZ GALLARDO en dbo.EmpresasNomipaq
    cursor.execute("SELECT IdEmpresa FROM dbo.EmpresasNomipaq WHERE NombreBaseDatos = 'ctGONZALO_RAMIREZ'")
    g_emp = cursor.fetchone()
    if g_emp:
        cursor.execute("DELETE FROM dbo.ColaboradorHijos WHERE IdColaborador IN (SELECT IdColaborador FROM dbo.Colaboradores WHERE IdEmpresa = ?)", (g_emp[0],))
        cursor.execute("DELETE FROM dbo.SaldosVacaciones WHERE IdColaborador IN (SELECT IdColaborador FROM dbo.Colaboradores WHERE IdEmpresa = ?)", (g_emp[0],))
        cursor.execute("DELETE FROM dbo.Colaboradores WHERE IdEmpresa = ?", (g_emp[0],))
        cursor.execute("DELETE FROM dbo.Departamentos WHERE IdEmpresa = ?", (g_emp[0],))
        cursor.execute("DELETE FROM dbo.Puestos WHERE IdEmpresa = ?", (g_emp[0],))
        cursor.execute("DELETE FROM dbo.EmpresasNomipaq WHERE IdEmpresa = ?", (g_emp[0],))
        conn.commit()
        print("[OK] Limpieza de empresa no oficial 'ctGONZALO_RAMIREZ' completada.")

    # Cargar mapa de Empresas
    cursor.execute("SELECT NombreBaseDatos, IdEmpresa FROM dbo.EmpresasNomipaq")
    db_to_id = {row[0].strip(): row[1] for row in cursor.fetchall()}
    print(f"Empresas registradas en catalogo: {len(db_to_id)}")

    # Cargar colaboradores existentes para matching inteligente
    def refresh_colabs_cache():
        cursor.execute("SELECT IdColaborador, IdEmpresa, CodigoEmpleado, CURP FROM dbo.Colaboradores")
        exact_map = {}
        int_map = {}
        curp_map = {}
        for id_c, id_e, cod, curp in cursor.fetchall():
            exact_map[(id_e, cod.strip())] = id_c
            try:
                int_map[(id_e, int(cod.strip()))] = id_c
            except:
                pass
            if curp and curp.strip() and curp.strip() != '#N/A':
                curp_map[(id_e, curp.strip().upper())] = id_c
        return exact_map, int_map, curp_map

    exact_map, int_map, curp_map = refresh_colabs_cache()
    print(f"Colaboradores preexistentes en base de datos: {len(exact_map)}")

    print("\nAbriendo libro Excel...")
    wb = openpyxl.load_workbook(EXCEL_PATH, data_only=True)

    # Variables de control y logging
    stats = {
        'ACTIVOS': {'leidos': 0, 'duplicados': 0, 'insertados': 0, 'actualizados': 0, 'hijos': 0, 'rechazados': []},
        'BAJAS': {'leidos': 0, 'duplicados': 0, 'insertados': 0, 'actualizados': 0, 'bajas_registradas': 0, 'financieros': 0, 'hijos': 0, 'rechazados': []}
    }

    # =========================================================================
    # PASO 1: PROCESAR PESTAÑA 'ACTIVOS'
    # =========================================================================
    print("\n" + "-" * 77)
    print("PROCESANDO PESTANA: ACTIVOS (Marcados con EstatusNomina = 'ALTA', Activo = 1)")
    print("-" * 77)

    sheet_activos = wb['ACTIVOS']
    seen_activos_keys = set()
    jefes_to_resolve = []

    for r_idx, row in enumerate(sheet_activos.iter_rows(min_row=2, values_only=True), start=2):
        if all(c is None or str(c).strip() == '' for c in row):
            continue
        stats['ACTIVOS']['leidos'] += 1

        raw_num = row[0]
        raw_sub = row[1]
        raw_emp = row[2]
        
        emp_str = str(raw_emp).strip() if raw_emp is not None else ""
        
        # Regla de protección: Si aparece GONZALO RAMIREZ GALLARDO o SUB FIJO es LAT-1077,
        # reasignar directamente a LATINO CONCRETOS, S.A. DE C.V. (ctLATINO_CONCRETO)
        if emp_str.upper() == 'GONZALO RAMIREZ GALLARDO' or (raw_sub and 'LAT-1077' in str(raw_sub).upper()):
            emp_str = 'LATINO CONCRETOS, S.A. DE C.V.'

        if not emp_str:
            stats['ACTIVOS']['rechazados'].append({'fila': r_idx, 'motivo': 'Columna EMPRESA vacia', 'datos': row[:5]})
            continue

        db_name = None
        for k, v in EMPRESA_MAPPING.items():
            if k.upper() == emp_str.upper():
                db_name = v
                break

        if not db_name or db_name not in db_to_id:
            stats['ACTIVOS']['rechazados'].append({'fila': r_idx, 'motivo': f'Empresa desconocida: {emp_str}', 'datos': row[:5]})
            continue

        id_empresa = db_to_id[db_name]
        codigo_emp = clean_codigo_empleado(raw_num, raw_sub, r_idx)
        if not codigo_emp:
            stats['ACTIVOS']['rechazados'].append({'fila': r_idx, 'motivo': f'NUM DE NOMINA invalido: {raw_num}', 'datos': row[:5]})
            continue

        # Desduplicación dentro de la hoja ACTIVOS
        dup_key = (id_empresa, codigo_emp)
        if dup_key in seen_activos_keys:
            stats['ACTIVOS']['duplicados'] += 1
            continue
        seen_activos_keys.add(dup_key)

        # Extracción y limpieza de columnas
        subfijo = clean_str(raw_sub, 20)
        nss = clean_str(row[4], 15)
        fecha_alta = clean_date(row[5]) or '2022-01-01'
        fecha_alta_imss = clean_date(row[6])
        fecha_eval = clean_date(row[7])
        tipo_nomina = clean_str(row[8], 30)
        paterno = clean_str(row[9], 100) or 'PENDIENTE'
        materno = clean_str(row[10], 100)
        nombre = clean_str(row[11], 100) or 'COLABORADOR'
        curp = clean_str(row[13], 18)
        rfc = clean_str(row[14], 13)
        sexo = clean_str(row[15], 1)
        if sexo: sexo = sexo.upper()[:1]
        fecha_nac = clean_date(row[16])
        estado_civil = clean_str(row[21], 20)
        domicilio = clean_str(row[22], 250)
        escolaridad = clean_str(row[23], 80)
        puesto_str = clean_str(row[24])
        centro_costos = clean_str(row[25], 50)
        depto_str = clean_str(row[26])
        jefe_inmediato = clean_str(row[27])
        nacionalidad = clean_str(row[28], 50) or 'MEXICANA'
        tipo_contrato = clean_str(row[29], 50)
        periodicidad_pago = clean_str(row[32], 30)
        domicilio_laboral = clean_str(row[33], 250)
        dias_descanso = clean_str(row[35], 50)
        telefono = clean_str(row[36], 30)
        email = clean_str(row[37], 150)
        beneficiario = clean_str(row[38], 150)
        parentesco_beneficiario = clean_str(row[39], 50)
        tiene_infonavit = clean_str(row[40], 10)
        tiene_fonacot = clean_str(row[41], 10)
        municipio = clean_str(row[45], 100)
        estado = clean_str(row[46], 100)
        cp = clean_str(row[47], 10)
        fuente_rec = clean_str(row[48], 100)
        avisar_emergencia = clean_str(row[55], 120)
        parentesco_emergencia = clean_str(row[56], 50)
        telefono_emergencia = clean_str(row[57], 30)
        tipo_sangre = clean_str(row[58], 10)
        alergias = clean_str(row[59], 200)
        sucursal = clean_str(row[3], 100)

        # Departamentos y Puestos
        id_depto = get_or_create_depto(cursor, id_empresa, depto_str)
        id_puesto = get_or_create_puesto(cursor, id_empresa, puesto_str)

        # Determinar si ya existe por (IdEmpresa, CodigoEmpleado), por int(codigo) o por CURP
        matched_id = None
        if (id_empresa, codigo_emp) in exact_map:
            matched_id = exact_map[(id_empresa, codigo_emp)]
        else:
            try:
                if (id_empresa, int(codigo_emp)) in int_map:
                    matched_id = int_map[(id_empresa, int(codigo_emp))]
            except:
                pass
            if not matched_id and curp and (id_empresa, curp.upper()) in curp_map:
                matched_id = curp_map[(id_empresa, curp.upper())]

        if matched_id:
            # UPDATE sin sobreescribir IdJefeDirecto ni RolApp
            cursor.execute("""
                UPDATE dbo.Colaboradores
                SET 
                    Subfijo = COALESCE(?, Subfijo),
                    NSS = COALESCE(?, NSS),
                    Sexo = COALESCE(?, Sexo),
                    FechaNacimiento = COALESCE(?, FechaNacimiento),
                    EstadoCivil = COALESCE(?, EstadoCivil),
                    Nacionalidad = COALESCE(?, Nacionalidad),
                    Escolaridad = COALESCE(?, Escolaridad),
                    Domicilio = COALESCE(?, Domicilio),
                    Municipio = COALESCE(?, Municipio),
                    EstadoProvincia = COALESCE(?, EstadoProvincia),
                    CodigoPostal = COALESCE(?, CodigoPostal),
                    Email = COALESCE(?, Email),
                    Telefono = COALESCE(?, Telefono),
                    DiasDescanso = COALESCE(?, DiasDescanso),
                    CentroCostos = COALESCE(?, CentroCostos),
                    TipoNomina = COALESCE(?, TipoNomina),
                    TipoContrato = COALESCE(?, TipoContrato),
                    PeriodicidadPago = COALESCE(?, PeriodicidadPago),
                    FechaAltaImss = COALESCE(?, FechaAltaImss),
                    FechaEvaluacion = COALESCE(?, FechaEvaluacion),
                    DomicilioLaboral = COALESCE(?, DomicilioLaboral),
                    AvisarEmergencia = COALESCE(?, AvisarEmergencia),
                    ParentescoEmergencia = COALESCE(?, ParentescoEmergencia),
                    TelefonoEmergencia = COALESCE(?, TelefonoEmergencia),
                    TipoSangre = COALESCE(?, TipoSangre),
                    AlergiasPadecimientos = COALESCE(?, AlergiasPadecimientos),
                    Beneficiario = COALESCE(?, Beneficiario),
                    ParentescoBeneficiario = COALESCE(?, ParentescoBeneficiario),
                    TieneInfonavit = COALESCE(?, TieneInfonavit),
                    TieneFonacot = COALESCE(?, TieneFonacot),
                    FuenteReclutamiento = COALESCE(?, FuenteReclutamiento),
                    Sucursal = COALESCE(?, Sucursal),
                    IdDepartamento = COALESCE(?, IdDepartamento),
                    IdPuesto = COALESCE(?, IdPuesto),
                    EstatusNomina = 'ALTA',
                    Activo = 1,
                    FechaModificacion = SYSDATETIME()
                WHERE IdColaborador = ?;
            """, (
                subfijo, nss, sexo, fecha_nac, estado_civil, nacionalidad, escolaridad,
                domicilio, municipio, estado, cp, email, telefono,
                dias_descanso, centro_costos, tipo_nomina, tipo_contrato, periodicidad_pago,
                fecha_alta_imss, fecha_eval, domicilio_laboral,
                avisar_emergencia, parentesco_emergencia, telefono_emergencia, tipo_sangre, alergias,
                beneficiario, parentesco_beneficiario, tiene_infonavit, tiene_fonacot, fuente_rec,
                sucursal, id_depto, id_puesto, matched_id
            ))
            stats['ACTIVOS']['actualizados'] += 1
            colab_id = matched_id
        else:
            # INSERT directo
            rol_default = 'ADMIN_DO' if any(w in (puesto_str or '').upper() for w in ['DESARROLLO ORGANIZACIONAL', 'DIRECTOR']) else 'COLABORADOR'
            cursor.execute("""
                INSERT INTO dbo.Colaboradores (
                    IdEmpresa, CodigoEmpleado, Subfijo, Nombre, ApellidoPaterno, ApellidoMaterno,
                    CURP, RFC, NSS, Sexo, FechaNacimiento, EstadoCivil, Nacionalidad, Escolaridad,
                    Email, Telefono, Domicilio, Municipio, EstadoProvincia, CodigoPostal,
                    FechaAlta, FechaAltaImss, FechaEvaluacion, EstatusNomina, DiasDescanso, CentroCostos,
                    TipoNomina, TipoContrato, PeriodicidadPago, DomicilioLaboral,
                    AvisarEmergencia, ParentescoEmergencia, TelefonoEmergencia, TipoSangre, AlergiasPadecimientos,
                    Beneficiario, ParentescoBeneficiario, TieneInfonavit, TieneFonacot,
                    FuenteReclutamiento, Empresa, Sucursal, Activo, IdDepartamento, IdPuesto, RolApp,
                    FechaCreacion
                )
                VALUES (
                    ?, ?, ?, ?, ?, ?,
                    ?, ?, ?, ?, ?, ?, ?, ?,
                    ?, ?, ?, ?, ?, ?,
                    ?, ?, ?, 'ALTA', ?, ?,
                    ?, ?, ?, ?,
                    ?, ?, ?, ?, ?,
                    ?, ?, ?, ?,
                    ?, ?, ?, 1, ?, ?, ?,
                    SYSDATETIME()
                );
            """, (
                id_empresa, codigo_emp, subfijo, nombre, paterno, materno,
                curp, rfc, nss, sexo, fecha_nac, estado_civil, nacionalidad, escolaridad,
                email, telefono, domicilio, municipio, estado, cp,
                fecha_alta, fecha_alta_imss, fecha_eval, dias_descanso, centro_costos,
                tipo_nomina, tipo_contrato, periodicidad_pago, domicilio_laboral,
                avisar_emergencia, parentesco_emergencia, telefono_emergencia, tipo_sangre, alergias,
                beneficiario, parentesco_beneficiario, tiene_infonavit, tiene_fonacot,
                fuente_rec, emp_str, sucursal, id_depto, id_puesto, rol_default
            ))
            cursor.execute("SELECT @@IDENTITY")
            colab_id = int(cursor.fetchone()[0])
            stats['ACTIVOS']['insertados'] += 1

            # Actualizar índices locales
            exact_map[(id_empresa, codigo_emp)] = colab_id
            try: int_map[(id_empresa, int(codigo_emp))] = colab_id
            except: pass
            if curp: curp_map[(id_empresa, curp.upper())] = colab_id

        if jefe_inmediato:
            jefes_to_resolve.append((colab_id, jefe_inmediato, id_empresa))

        # Procesar Hijos (columnas 61 a 78 en ACTIVOS)
        for h_idx in range(6):
            col_fn = 61 + (h_idx * 3)
            col_sx = 62 + (h_idx * 3)
            h_fn = clean_date(row[col_fn]) if col_fn < len(row) else None
            h_sx = clean_str(row[col_sx], 1) if col_sx < len(row) else None
            if h_sx: h_sx = h_sx.upper()[:1]

            if h_fn or h_sx:
                cursor.execute("""
                    MERGE dbo.ColaboradorHijos AS Target
                    USING (SELECT ? AS IdColaborador, ? AS NumeroHijo) AS Source
                    ON (Target.IdColaborador = Source.IdColaborador AND Target.NumeroHijo = Source.NumeroHijo)
                    WHEN MATCHED THEN
                        UPDATE SET FechaNacimiento = ?, Sexo = ?, FechaRegistro = SYSUTCDATETIME()
                    WHEN NOT MATCHED THEN
                        INSERT (IdColaborador, NumeroHijo, FechaNacimiento, Sexo)
                        VALUES (?, ?, ?, ?);
                """, (colab_id, h_idx + 1, h_fn, h_sx, colab_id, h_idx + 1, h_fn, h_sx))
                stats['ACTIVOS']['hijos'] += 1

    conn.commit()
    print("[OK] Hoja ACTIVOS procesada con exito:")
    print(f"   * Total leidos:      {stats['ACTIVOS']['leidos']}")
    print(f"   * Duplicados:        {stats['ACTIVOS']['duplicados']}")
    print(f"   * Nuevos insertados: {stats['ACTIVOS']['insertados']}")
    print(f"   * Actualizados:      {stats['ACTIVOS']['actualizados']}")
    print(f"   * Hijos registrados: {stats['ACTIVOS']['hijos']}")

    # =========================================================================
    # PASO 2: PROCESAR PESTAÑA 'BAJAS'
    # =========================================================================
    print("\n" + "-" * 77)
    print("PROCESANDO PESTANA: BAJAS (Marcados con EstatusNomina = 'BAJA', Activo = 0)")
    print("Prevalece sobre ACTIVOS si un colaborador aparece en ambas hojas.")
    print("-" * 77)

    sheet_bajas = wb['BAJAS']

    # Re-sincronizar cache de colaboradores para que contemple altas recientes
    exact_map, int_map, curp_map = refresh_colabs_cache()
    seen_bajas_keys = set()

    for r_idx, row in enumerate(sheet_bajas.iter_rows(min_row=2, values_only=True), start=2):
        if all(c is None or str(c).strip() == '' for c in row):
            continue
        stats['BAJAS']['leidos'] += 1

        raw_num = row[0]
        raw_emp = row[1]
        emp_str = str(raw_emp).strip() if raw_emp is not None else ""
        
        # Regla de protección: Si aparece GONZALO RAMIREZ GALLARDO, reasignar a LATINO CONCRETOS
        if emp_str.upper() == 'GONZALO RAMIREZ GALLARDO':
            emp_str = 'LATINO CONCRETOS, S.A. DE C.V.'

        if not emp_str:
            stats['BAJAS']['rechazados'].append({'fila': r_idx, 'motivo': 'Columna EMPRESA vacia', 'datos': row[:5]})
            continue

        db_name = None
        for k, v in EMPRESA_MAPPING.items():
            if k.upper() == emp_str.upper():
                db_name = v
                break

        if not db_name or db_name not in db_to_id:
            stats['BAJAS']['rechazados'].append({'fila': r_idx, 'motivo': f'Empresa desconocida: {emp_str}', 'datos': row[:5]})
            continue

        id_empresa = db_to_id[db_name]
        codigo_emp = clean_codigo_empleado(raw_num, None, r_idx)
        if not codigo_emp:
            stats['BAJAS']['rechazados'].append({'fila': r_idx, 'motivo': f'NUM DE NOMINA invalido: {raw_num}', 'datos': row[:5]})
            continue

        # Desduplicación en BAJAS
        dup_key = (id_empresa, codigo_emp)
        if dup_key in seen_bajas_keys:
            stats['BAJAS']['duplicados'] += 1
            continue
        seen_bajas_keys.add(dup_key)

        # Campos generales en BAJAS
        nss = clean_str(row[3], 15)
        fecha_alta = clean_date(row[4]) or '2022-01-01'
        fecha_eval = clean_date(row[5])
        fecha_alta_imss = clean_date(row[6])
        tipo_nomina = clean_str(row[7], 30)
        paterno = clean_str(row[8], 100) or 'PENDIENTE'
        materno = clean_str(row[9], 100)
        nombre = clean_str(row[10], 100) or 'COLABORADOR'
        curp = clean_str(row[12], 18)
        rfc = clean_str(row[13], 13)
        sexo = clean_str(row[14], 1)
        if sexo: sexo = sexo.upper()[:1]
        fecha_nac = clean_date(row[15])
        estado_civil = clean_str(row[20], 20)
        domicilio = clean_str(row[21], 250)
        escolaridad = clean_str(row[22], 80)
        puesto_str = clean_str(row[23])
        centro_costos = clean_str(row[24], 50)
        depto_str = clean_str(row[25])
        jefe_inmediato = clean_str(row[26])
        salario_mensual_neto = clean_decimal(row[27])
        salario_diario_real = clean_decimal(row[28])
        salario_diario_imss = clean_decimal(row[29])
        salario_diario_integrado = clean_decimal(row[30])
        nacionalidad = clean_str(row[31], 50) or 'MEXICANA'
        tipo_contrato = clean_str(row[32], 50)
        periodicidad_pago = clean_str(row[35], 30)
        domicilio_laboral = clean_str(row[36], 250)
        dias_descanso = clean_str(row[38], 50)
        institucion_bancaria = clean_str(row[39], 100)
        num_cuenta = clean_str(row[40], 30)
        clabe = clean_str(row[41], 18)
        telefono = clean_str(row[42], 30)
        email = clean_str(row[43], 150)
        beneficiario = clean_str(row[44], 150)
        parentesco_beneficiario = clean_str(row[45], 50)
        rfc_beneficiario = clean_str(row[46], 13)
        tiene_infonavit = clean_str(row[47], 10)
        municipio = clean_str(row[51], 100)
        estado = clean_str(row[52], 100)
        cp = clean_str(row[53], 10)
        
        # Columnas específicas de BAJA
        fecha_baja = clean_date(row[62]) or datetime.date.today().strftime('%Y-%m-%d')
        tipo_baja = clean_str(row[63], 100)
        comentarios_baja = clean_str(row[64], 500)
        renuncia_vol = clean_str(row[65], 50)
        convenio_finiquito = clean_str(row[66], 50)
        convenio_confidencialidad = clean_str(row[67], 50)
        avisar_emergencia = clean_str(row[68], 120)
        parentesco_emergencia = clean_str(row[69], 50)
        telefono_emergencia = clean_str(row[70], 30)
        tipo_sangre = clean_str(row[71], 10)
        alergias = clean_str(row[72], 200)
        sucursal = clean_str(row[2], 100)

        id_depto = get_or_create_depto(cursor, id_empresa, depto_str)
        id_puesto = get_or_create_puesto(cursor, id_empresa, puesto_str)

        matched_id = None
        if (id_empresa, codigo_emp) in exact_map:
            matched_id = exact_map[(id_empresa, codigo_emp)]
        else:
            try:
                if (id_empresa, int(codigo_emp)) in int_map:
                    matched_id = int_map[(id_empresa, int(codigo_emp))]
            except:
                pass
            if not matched_id and curp and (id_empresa, curp.upper()) in curp_map:
                matched_id = curp_map[(id_empresa, curp.upper())]

        if matched_id:
            # UPDATE a EstatusNomina = 'BAJA', Activo = 0 (Prevalencia de BAJAS)
            cursor.execute("""
                UPDATE dbo.Colaboradores
                SET 
                    NSS = COALESCE(?, NSS),
                    Sexo = COALESCE(?, Sexo),
                    FechaNacimiento = COALESCE(?, FechaNacimiento),
                    EstadoCivil = COALESCE(?, EstadoCivil),
                    Nacionalidad = COALESCE(?, Nacionalidad),
                    Escolaridad = COALESCE(?, Escolaridad),
                    Domicilio = COALESCE(?, Domicilio),
                    Municipio = COALESCE(?, Municipio),
                    EstadoProvincia = COALESCE(?, EstadoProvincia),
                    CodigoPostal = COALESCE(?, CodigoPostal),
                    Email = COALESCE(?, Email),
                    Telefono = COALESCE(?, Telefono),
                    DiasDescanso = COALESCE(?, DiasDescanso),
                    CentroCostos = COALESCE(?, CentroCostos),
                    TipoNomina = COALESCE(?, TipoNomina),
                    TipoContrato = COALESCE(?, TipoContrato),
                    PeriodicidadPago = COALESCE(?, PeriodicidadPago),
                    FechaAltaImss = COALESCE(?, FechaAltaImss),
                    FechaEvaluacion = COALESCE(?, FechaEvaluacion),
                    DomicilioLaboral = COALESCE(?, DomicilioLaboral),
                    AvisarEmergencia = COALESCE(?, AvisarEmergencia),
                    ParentescoEmergencia = COALESCE(?, ParentescoEmergencia),
                    TelefonoEmergencia = COALESCE(?, TelefonoEmergencia),
                    TipoSangre = COALESCE(?, TipoSangre),
                    AlergiasPadecimientos = COALESCE(?, AlergiasPadecimientos),
                    Beneficiario = COALESCE(?, Beneficiario),
                    ParentescoBeneficiario = COALESCE(?, ParentescoBeneficiario),
                    RfcBeneficiario = COALESCE(?, RfcBeneficiario),
                    TieneInfonavit = COALESCE(?, TieneInfonavit),
                    Sucursal = COALESCE(?, Sucursal),
                    IdDepartamento = COALESCE(?, IdDepartamento),
                    IdPuesto = COALESCE(?, IdPuesto),
                    EstatusNomina = 'BAJA',
                    Activo = 0,
                    FechaModificacion = SYSDATETIME()
                WHERE IdColaborador = ?;
            """, (
                nss, sexo, fecha_nac, estado_civil, nacionalidad, escolaridad,
                domicilio, municipio, estado, cp, email, telefono,
                dias_descanso, centro_costos, tipo_nomina, tipo_contrato, periodicidad_pago,
                fecha_alta_imss, fecha_eval, domicilio_laboral,
                avisar_emergencia, parentesco_emergencia, telefono_emergencia, tipo_sangre, alergias,
                beneficiario, parentesco_beneficiario, rfc_beneficiario, tiene_infonavit,
                sucursal, id_depto, id_puesto, matched_id
            ))
            stats['BAJAS']['actualizados'] += 1
            colab_id = matched_id
        else:
            # INSERT directo como BAJA
            cursor.execute("""
                INSERT INTO dbo.Colaboradores (
                    IdEmpresa, CodigoEmpleado, Nombre, ApellidoPaterno, ApellidoMaterno,
                    CURP, RFC, NSS, Sexo, FechaNacimiento, EstadoCivil, Nacionalidad, Escolaridad,
                    Email, Telefono, Domicilio, Municipio, EstadoProvincia, CodigoPostal,
                    FechaAlta, FechaAltaImss, FechaEvaluacion, EstatusNomina, DiasDescanso, CentroCostos,
                    TipoNomina, TipoContrato, PeriodicidadPago, DomicilioLaboral,
                    AvisarEmergencia, ParentescoEmergencia, TelefonoEmergencia, TipoSangre, AlergiasPadecimientos,
                    Beneficiario, ParentescoBeneficiario, RfcBeneficiario, TieneInfonavit,
                    Empresa, Sucursal, Activo, IdDepartamento, IdPuesto, RolApp,
                    FechaCreacion
                )
                VALUES (
                    ?, ?, ?, ?, ?,
                    ?, ?, ?, ?, ?, ?, ?, ?,
                    ?, ?, ?, ?, ?, ?,
                    ?, ?, ?, 'BAJA', ?, ?,
                    ?, ?, ?, ?,
                    ?, ?, ?, ?, ?,
                    ?, ?, ?, ?,
                    ?, ?, 0, ?, ?, 'COLABORADOR',
                    SYSDATETIME()
                );
            """, (
                id_empresa, codigo_emp, nombre, paterno, materno,
                curp, rfc, nss, sexo, fecha_nac, estado_civil, nacionalidad, escolaridad,
                email, telefono, domicilio, municipio, estado, cp,
                fecha_alta, fecha_alta_imss, fecha_eval, dias_descanso, centro_costos,
                tipo_nomina, tipo_contrato, periodicidad_pago, domicilio_laboral,
                avisar_emergencia, parentesco_emergencia, telefono_emergencia, tipo_sangre, alergias,
                beneficiario, parentesco_beneficiario, rfc_beneficiario, tiene_infonavit,
                emp_str, sucursal, id_depto, id_puesto
            ))
            cursor.execute("SELECT @@IDENTITY")
            colab_id = int(cursor.fetchone()[0])
            stats['BAJAS']['insertados'] += 1

            # Actualizar índices locales
            exact_map[(id_empresa, codigo_emp)] = colab_id
            try: int_map[(id_empresa, int(codigo_emp))] = colab_id
            except: pass
            if curp: curp_map[(id_empresa, curp.upper())] = colab_id

        if jefe_inmediato:
            jefes_to_resolve.append((colab_id, jefe_inmediato, id_empresa))

        # Registrar en dbo.ColaboradorBajas (Idempotente)
        cursor.execute("DELETE FROM dbo.ColaboradorBajas WHERE IdColaborador = ?", (colab_id,))
        cursor.execute("""
            INSERT INTO dbo.ColaboradorBajas (
                IdColaborador, FechaBaja, TipoBaja, Comentarios,
                RenunciaVoluntaria, ConvenioFiniquito, ConvenioConfidencialidad, FechaRegistro
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, SYSUTCDATETIME());
        """, (
            colab_id, fecha_baja, tipo_baja, comentarios_baja,
            renuncia_vol, convenio_finiquito, convenio_confidencialidad
        ))
        stats['BAJAS']['bajas_registradas'] += 1

        # Registrar en dbo.ColaboradorDatosFinancieros si tiene información
        if any(v is not None for v in [salario_mensual_neto, salario_diario_real, salario_diario_imss, institucion_bancaria, clabe]):
            cursor.execute("""
                MERGE dbo.ColaboradorDatosFinancieros AS Target
                USING (SELECT ? AS IdColaborador) AS Source
                ON (Target.IdColaborador = Source.IdColaborador)
                WHEN MATCHED THEN
                    UPDATE SET
                        SalarioMensualNeto = COALESCE(?, SalarioMensualNeto),
                        SalarioDiarioReal = COALESCE(?, SalarioDiarioReal),
                        SalarioDiarioImss = COALESCE(?, SalarioDiarioImss),
                        SalarioDiarioIntegrado = COALESCE(?, SalarioDiarioIntegrado),
                        InstitucionBancaria = COALESCE(?, InstitucionBancaria),
                        NumeroCuenta = COALESCE(?, NumeroCuenta),
                        ClabeInterbancaria = COALESCE(?, ClabeInterbancaria),
                        FechaUltimaModificacion = SYSUTCDATETIME()
                WHEN NOT MATCHED THEN
                    INSERT (
                        IdColaborador, SalarioMensualNeto, SalarioDiarioReal, SalarioDiarioImss,
                        SalarioDiarioIntegrado, InstitucionBancaria, NumeroCuenta, ClabeInterbancaria
                    )
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?);
            """, (
                colab_id, salario_mensual_neto, salario_diario_real, salario_diario_imss,
                salario_diario_integrado, institucion_bancaria, num_cuenta, clabe,
                colab_id, salario_mensual_neto, salario_diario_real, salario_diario_imss,
                salario_diario_integrado, institucion_bancaria, num_cuenta, clabe
            ))
            stats['BAJAS']['financieros'] += 1

        # Procesar Hijos en BAJAS (columnas 74 a 91)
        for h_idx in range(6):
            col_fn = 74 + (h_idx * 3)
            col_sx = 75 + (h_idx * 3)
            h_fn = clean_date(row[col_fn]) if col_fn < len(row) else None
            h_sx = clean_str(row[col_sx], 1) if col_sx < len(row) else None
            if h_sx: h_sx = h_sx.upper()[:1]

            if h_fn or h_sx:
                cursor.execute("""
                    MERGE dbo.ColaboradorHijos AS Target
                    USING (SELECT ? AS IdColaborador, ? AS NumeroHijo) AS Source
                    ON (Target.IdColaborador = Source.IdColaborador AND Target.NumeroHijo = Source.NumeroHijo)
                    WHEN MATCHED THEN
                        UPDATE SET FechaNacimiento = ?, Sexo = ?, FechaRegistro = SYSUTCDATETIME()
                    WHEN NOT MATCHED THEN
                        INSERT (IdColaborador, NumeroHijo, FechaNacimiento, Sexo)
                        VALUES (?, ?, ?, ?);
                """, (colab_id, h_idx + 1, h_fn, h_sx, colab_id, h_idx + 1, h_fn, h_sx))
                stats['BAJAS']['hijos'] += 1

    conn.commit()
    print("[OK] Hoja BAJAS procesada con exito:")
    print(f"   * Total leidos:           {stats['BAJAS']['leidos']}")
    print(f"   * Duplicados:             {stats['BAJAS']['duplicados']}")
    print(f"   * Nuevos insertados:      {stats['BAJAS']['insertados']}")
    print(f"   * Actualizados a BAJA:    {stats['BAJAS']['actualizados']}")
    print(f"   * Bajas registradas:      {stats['BAJAS']['bajas_registradas']}")
    print(f"   * Financieros guardados:  {stats['BAJAS']['financieros']}")
    print(f"   * Hijos registrados:      {stats['BAJAS']['hijos']}")

    # =========================================================================
    # PASO 3: RESOLUCIÓN DE JEFE INMEDIATO (IdJefeDirecto)
    # =========================================================================
    print("\n" + "-" * 77)
    print("RESOLVIENDO JERARQUIA OPERATIVA (IdJefeDirecto)...")
    print("-" * 77)
    
    # Cargar todos los nombres de colaboradores para matching de jefes
    cursor.execute("""
        SELECT IdColaborador, UPPER(RTRIM(LTRIM(NombreCompleto))) AS FullName,
               UPPER(RTRIM(LTRIM(Nombre + ' ' + ApellidoPaterno))) AS ShortName,
               IdEmpresa
        FROM dbo.Colaboradores
    """)
    boss_candidates = cursor.fetchall()
    
    jefes_asignados = 0
    for colab_id, boss_str, id_emp in jefes_to_resolve:
        b_str = boss_str.strip().upper()
        tokens = [t for t in b_str.split() if len(t) > 2]
        if not tokens:
            continue
            
        matched_boss_id = None
        # 1. Búsqueda exacta en misma empresa
        for c_id, full, short, emp in boss_candidates:
            if c_id != colab_id and emp == id_emp and (b_str in full or full in b_str):
                matched_boss_id = c_id
                break
                
        # 2. Búsqueda global si no encontró local
        if not matched_boss_id:
            for c_id, full, short, emp in boss_candidates:
                if c_id != colab_id and (b_str in full or full in b_str):
                    matched_boss_id = c_id
                    break
                    
        # 3. Coincidencia por al menos 2 tokens
        if not matched_boss_id and len(tokens) >= 2:
            for c_id, full, short, emp in boss_candidates:
                if c_id != colab_id and all(t in full for t in tokens[:2]):
                    matched_boss_id = c_id
                    break

        if matched_boss_id:
            cursor.execute("UPDATE dbo.Colaboradores SET IdJefeDirecto = ? WHERE IdColaborador = ? AND IdJefeDirecto IS NULL", (matched_boss_id, colab_id))
            jefes_asignados += 1

    conn.commit()
    print(f"[OK] Jefes inmediatos resueltos y asignados: {jefes_asignados}")

    # =========================================================================
    # PASO 4: RECALCULAR SALDOS DE VACACIONES PARA ACTIVOS
    # =========================================================================
    print("\n" + "-" * 77)
    print("RECALCULANDO SALDOS DE VACACIONES LFT...")
    print("-" * 77)
    cursor.execute("EXEC dbo.sp_CalcularSaldosVacaciones;")
    conn.commit()
    print("[OK] Saldos de vacaciones recalculados exitosamente.")

    # =========================================================================
    # PASO 5: AUDITORÍA FINAL Y REPORTE DE RESULTADOS
    # =========================================================================
    print("\n" + "=" * 77)
    print("                    AUDITORIA FINAL EN DESARROLLO_O")
    print("=" * 77)

    cursor.execute("""
        SELECT 
            (SELECT COUNT(*) FROM dbo.Colaboradores) AS TotalColaboradores,
            (SELECT COUNT(*) FROM dbo.Colaboradores WHERE Activo = 1) AS ColaboradoresActivos,
            (SELECT COUNT(*) FROM dbo.Colaboradores WHERE Activo = 0) AS ColaboradoresBajas,
            (SELECT COUNT(*) FROM dbo.ColaboradorHijos) AS TotalHijos,
            (SELECT COUNT(*) FROM dbo.ColaboradorBajas) AS TotalRegistrosBajas,
            (SELECT COUNT(*) FROM dbo.ColaboradorDatosFinancieros) AS TotalRegistrosFinancieros,
            (SELECT COUNT(*) FROM dbo.SaldosVacaciones) AS TotalSaldosLFT;
    """)
    r = cursor.fetchone()
    print(f"- Total Colaboradores en Sistema:       {r[0]}")
    print(f"- Colaboradores Activos (ALTA):         {r[1]}")
    print(f"- Colaboradores Inactivos (BAJA):       {r[2]}")
    print(f"- Total Hijos Registrados:              {r[3]}")
    print(f"- Registros de Baja Detallados:         {r[4]}")
    print(f"- Registros Financieros Confidenciales: {r[5]}")
    print(f"- Registros de Saldos Vacaciones LFT:   {r[6]}")

    print("\nCenso por Razon Social:")
    cursor.execute("""
        SELECT e.IdEmpresa, e.AliasEmpresa,
               COUNT(c.IdColaborador) AS Total,
               SUM(CASE WHEN c.Activo = 1 THEN 1 ELSE 0 END) AS Activos,
               SUM(CASE WHEN c.Activo = 0 THEN 1 ELSE 0 END) AS Bajas
        FROM dbo.EmpresasNomipaq e
        LEFT JOIN dbo.Colaboradores c ON c.IdEmpresa = e.IdEmpresa
        GROUP BY e.IdEmpresa, e.AliasEmpresa
        ORDER BY e.IdEmpresa;
    """)
    for row in cursor.fetchall():
        print(f"  [{row[0]}] {row[1]:<35} | Total: {row[2]:>4} | Activos: {row[3]:>4} | Bajas: {row[4]:>4}")

    # Reporte de Filas Rechazadas
    total_rechazados = len(stats['ACTIVOS']['rechazados']) + len(stats['BAJAS']['rechazados'])
    print(f"\nTotal de Filas Rechazadas: {total_rechazados}")
    if total_rechazados > 0:
        print("Detalle de filas rechazadas:")
        for r in stats['ACTIVOS']['rechazados']:
            print(f"  [ACTIVOS] Fila {r['fila']}: {r['motivo']} | Datos: {r['datos']}")
        for r in stats['BAJAS']['rechazados']:
            print(f"  [BAJAS] Fila {r['fila']}: {r['motivo']} | Datos: {r['datos']}")
    else:
        print("  [OK] Cero filas rechazadas. Toda la informacion del Excel fue procesada al 100%.")

    print("\n" + "=" * 77)
    print("               PROCESO DE IMPORTACION CONCLUIDO CON EXITO")
    print("=" * 77)
    conn.close()

if __name__ == '__main__':
    main()
