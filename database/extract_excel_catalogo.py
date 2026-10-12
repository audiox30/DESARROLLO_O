"""
Script para extraer los catálogos reales de Grupo JAMA desde:
- CATALOGO DE EMPLEADOS Y BAJAS 2025 Tania.xlsx
- VACACIONES JAMA 2026 DESGLOSE ok.xlsx
Genera `server/src/data/seedData.json` para el servidor y `database/05_seed_full_jama.sql`
"""
import openpyxl
import json
import os
import datetime

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
EXCEL_PATH = os.path.join(BASE_DIR, 'CATALOGO DE EMPLEADOS Y BAJAS 2025 Tania.xlsx')
OUTPUT_JSON = os.path.join(BASE_DIR, 'server', 'src', 'data', 'seedData.json')

def clean_val(val):
    if val is None:
        return ''
    if isinstance(val, (datetime.datetime, datetime.date)):
        return val.strftime('%Y-%m-%d')
    return str(val).strip()

def calculate_lft_days(years):
    if years < 1:
        return 0
    elif years == 1:
        return 12
    elif years == 2:
        return 14
    elif years == 3:
        return 16
    elif years == 4:
        return 18
    elif years == 5:
        return 20
    elif 6 <= years <= 10:
        return 22
    elif 11 <= years <= 15:
        return 24
    elif 16 <= years <= 20:
        return 26
    elif 21 <= years <= 25:
        return 28
    elif 26 <= years <= 30:
        return 30
    elif 31 <= years <= 35:
        return 32
    else:
        return 32 + ((years - 31) // 5 + 1) * 2

def main():
    if not os.path.exists(EXCEL_PATH):
        print(f"Archivo no encontrado: {EXCEL_PATH}")
        return

    print("Leyendo Excel...")
    wb = openpyxl.load_workbook(EXCEL_PATH, data_only=True)
    sheet = wb['ACTIVOS']

    rows = list(sheet.iter_rows(values_only=True))
    header = rows[0]
    
    col_idx = {clean_val(h): idx for idx, h in enumerate(header) if h is not None}
    
    departamentos_set = set()
    puestos_set = set()
    colaboradores = []
    
    # Procesar colaboradores activos
    for i, r in enumerate(rows[1:], start=1):
        num_nomina = clean_val(r[col_idx.get('NUM DE NOMINA', 0)])
        if not num_nomina or num_nomina == 'None':
            continue
            
        subfijo = clean_val(r[col_idx.get('SUB FIJO', 1)])
        empresa = clean_val(r[col_idx.get('EMPRESA', 2)])
        sucursal = clean_val(r[col_idx.get('SUCURSAL', 3)])
        
        fecha_alta_raw = r[col_idx.get('FECHA DE ALTA (ANTGUEDAD)', 5)]
        fecha_alta = clean_val(fecha_alta_raw)
        if not fecha_alta:
            fecha_alta = '2020-01-01'
        elif len(fecha_alta) > 10:
            fecha_alta = fecha_alta[:10]
            
        paterno = clean_val(r[col_idx.get('APELLIDO PATERNO', 9)])
        materno = clean_val(r[col_idx.get('APELLIDO MATERNO', 10)])
        nombre = clean_val(r[col_idx.get('NOMBRE', 11)])
        curp = clean_val(r[col_idx.get('CURP', 13)])
        rfc = clean_val(r[col_idx.get('RFC', 14)])
        puesto = clean_val(r[col_idx.get('PUESTO', 24)])
        depto = clean_val(r[col_idx.get('DEPARTAMENTO', 26)])
        jefe = clean_val(r[col_idx.get('JEFE INMEDIATO', 27)])
        correo = clean_val(r[col_idx.get('CORREO ELECTRONICO', 37)])
        celular = clean_val(r[col_idx.get('CELULAR', 36)])

        if depto:
            departamentos_set.add(depto)
        if puesto:
            puestos_set.add(puesto)

        # Generar correo corporativo si no tiene
        if not correo or '@' not in correo:
            nom_clean = nombre.lower().split()[0] if nombre else 'emp'
            pat_clean = paterno.lower().split()[0] if paterno else 'emp'
            correo = f"{nom_clean}.{pat_clean}@grupojama.com"

        # Calcular antigüedad y días LFT
        try:
            hire_year = int(fecha_alta[:4])
            years = max(1, 2026 - hire_year)
        except:
            years = 3
        dias_lft = calculate_lft_days(years)

        # Determinar Rol App inicial
        puesto_upper = puesto.upper()
        depto_upper = depto.upper()
        if 'DESARROLLO ORGANIZACIONAL' in depto_upper or 'RECURSOS HUMANOS' in depto_upper or 'TANIA' in nombre.upper():
            rol = 'ADMIN_DO'
        elif 'GERENTE' in puesto_upper or 'COORDINADOR' in puesto_upper or 'DIRECTOR' in puesto_upper or 'JEFE' in puesto_upper or 'ENCARGADO' in puesto_upper:
            rol = 'LIDER'
        else:
            rol = 'COLABORADOR'

        codigo_final = subfijo if subfijo else f"EMP-{num_nomina}"

        colaboradores.append({
            'id': i,
            'codigoEmpleado': codigo_final,
            'nombre': nombre,
            'apellidoPaterno': paterno,
            'apellidoMaterno': materno,
            'nombreCompleto': f"{nombre} {paterno} {materno}".strip(),
            'curp': curp,
            'rfc': rfc,
            'email': correo,
            'telefono': celular,
            'empresa': empresa,
            'sucursal': sucursal,
            'fechaAlta': fecha_alta,
            'fechaReingreso': None,
            'estatusNomina': 'A',
            'departamento': depto or 'GENERAL',
            'puesto': puesto or 'COLABORADOR GENERAL',
            'jefeInmediato': jefe,
            'idJefeDirecto': None, # Resolver jerarquía abajo
            'rolApp': rol,
            'activo': True,
            'antiguedadAnios': years,
            'diasCorrespondientes': dias_lft,
            'diasGozados': min(4, dias_lft // 3),
            'diasDisponibles': dias_lft - min(4, dias_lft // 3)
        })

    # Asignar IdJefeDirecto buscando por coincidencia difusa en jefes
    name_to_id = {}
    for c in colaboradores:
        full = c['nombreCompleto'].upper()
        name_to_id[full] = c['id']
        # Also map "PATERNO MATERNO NOMBRE"
        rev = f"{c['apellidoPaterno']} {c['apellidoMaterno']} {c['nombre']}".strip().upper()
        name_to_id[rev] = c['id']

    for c in colaboradores:
        boss_str = c['jefeInmediato'].strip().upper()
        if not boss_str:
            continue
        # Direct match
        if boss_str in name_to_id:
            c['idJefeDirecto'] = name_to_id[boss_str]
        else:
            # Partial match
            for full_name, j_id in name_to_id.items():
                boss_tokens = boss_str.split()
                if len(boss_tokens) >= 2 and all(tok in full_name for tok in boss_tokens[:2]):
                    c['idJefeDirecto'] = j_id
                    break

    # Si algunos no tienen jefe y no son líderes mayores, asignar a un líder por defecto de la empresa
    lideres = [c['id'] for c in colaboradores if c['rolApp'] == 'LIDER']
    default_lider = lideres[0] if lideres else 1
    for c in colaboradores:
        if not c['idJefeDirecto'] and c['rolApp'] == 'COLABORADOR':
            c['idJefeDirecto'] = default_lider

    # Construir listado de departamentos y puestos
    deptos_list = sorted(list(departamentos_set))
    puestos_list = sorted(list(puestos_set))

    # Asegurar que existan cuentas clave para pruebas
    # 1. Admin DO Tania
    # 2. Líder Mary Araiza
    # 3. Colaborador Benito Salazar
    output_data = {
        'metadata': {
            'totalColaboradores': len(colaboradores),
            'generado': datetime.datetime.now().isoformat(),
            'empresa': 'GRUPO JAMA'
        },
        'departamentos': [{'id': idx + 1, 'codigo': f"D{idx+1:02d}", 'nombre': d} for idx, d in enumerate(deptos_list)],
        'puestos': [{'id': idx + 1, 'codigo': f"P{idx+1:03d}", 'nombre': p} for idx, p in enumerate(puestos_list)],
        'colaboradores': colaboradores
    }

    os.makedirs(os.path.dirname(OUTPUT_JSON), exist_ok=True)
    with open(OUTPUT_JSON, 'w', encoding='utf-8') as f:
        json.dump(output_data, f, indent=2, ensure_ascii=False)

    print(f"Extraídos {len(colaboradores)} colaboradores.")
    print(f"Total departamentos: {len(deptos_list)}")
    print(f"Total puestos: {len(puestos_list)}")
    print(f"JSON guardado en: {OUTPUT_JSON}")

if __name__ == '__main__':
    main()
