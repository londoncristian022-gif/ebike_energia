import os
import re
import sys
from pathlib import Path

from docx import Document
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.shared import Inches, Pt, RGBColor
from docx.oxml import OxmlElement
from docx.oxml.ns import qn


COLOR_INK = '0F172A'
COLOR_BLUE = '2563EB'
COLOR_MUTED = '64748B'
COLOR_BORDER = 'CBD5E1'
COLOR_NOTE = 'EFF6FF'
COLOR_WARN = 'FEF2F2'


def aplicar_sombreado(celda, color):
    propiedades = celda._tc.get_or_add_tcPr()
    sombreado = OxmlElement('w:shd')
    sombreado.set(qn('w:fill'), color)
    propiedades.append(sombreado)


def agregar_texto_formateado(parrafo, texto):
    """Renderiza negritas y código en línea sin eliminar el texto restante."""
    patron = re.compile(r'(\*\*.+?\*\*|`[^`]+`)')
    cursor = 0
    for coincidencia in patron.finditer(texto):
        if coincidencia.start() > cursor:
            parrafo.add_run(texto[cursor:coincidencia.start()])
        token = coincidencia.group(0)
        if token.startswith('**'):
            parrafo.add_run(token[2:-2]).bold = True
        else:
            run = parrafo.add_run(token[1:-1])
            run.font.name = 'Consolas'
            run.font.size = Pt(9)
            run.font.color.rgb = RGBColor(37, 99, 235)
        cursor = coincidencia.end()
    if cursor < len(texto):
        parrafo.add_run(texto[cursor:])


def procesar_tabla(doc, filas):
    if len(filas) < 2:
        return
    encabezados = [celda.strip() for celda in filas[0].strip('|').split('|')]
    datos = [
        [celda.strip() for celda in fila.strip('|').split('|')]
        for fila in filas[2:]
    ]
    tabla = doc.add_table(rows=1, cols=len(encabezados))
    tabla.style = 'Table Grid'
    tabla.autofit = True
    propiedades_fila = tabla.rows[0]._tr.get_or_add_trPr()
    repetir = OxmlElement('w:tblHeader')
    repetir.set(qn('w:val'), 'true')
    propiedades_fila.append(repetir)
    for indice, texto in enumerate(encabezados):
        celda = tabla.rows[0].cells[indice]
        celda.text = ''
        aplicar_sombreado(celda, COLOR_INK)
        run = celda.paragraphs[0].add_run(texto.replace('**', ''))
        run.bold = True
        run.font.color.rgb = RGBColor(255, 255, 255)
        run.font.size = Pt(9)
    for fila in datos:
        celdas = tabla.add_row().cells
        for indice, celda in enumerate(celdas):
            texto = fila[indice] if indice < len(fila) else ''
            celda.text = texto.replace('**', '')
            for run in celda.paragraphs[0].runs:
                run.font.size = Pt(9)
    doc.add_paragraph()


def markdown_a_docx(ruta_md, ruta_docx):
    entrada = Path(ruta_md)
    salida = Path(ruta_docx)
    if not entrada.is_file():
        print(f'Error: no se encontró el archivo Markdown: {entrada}', file=sys.stderr)
        return 1

    doc = Document()
    for section in doc.sections:
        section.top_margin = Inches(0.7)
        section.bottom_margin = Inches(0.7)
        section.left_margin = Inches(0.75)
        section.right_margin = Inches(0.75)
        pie = section.footer.paragraphs[0]
        pie.alignment = WD_ALIGN_PARAGRAPH.CENTER
        run = pie.add_run('E-Bike Energy  ·  ')
        run.font.size = Pt(8)
        run.font.color.rgb = RGBColor(100, 116, 139)
        campo = OxmlElement('w:fldSimple')
        campo.set(qn('w:instr'), 'PAGE')
        pie._p.append(campo)
    base_dir = entrada.resolve().parent
    normal = doc.styles['Normal']
    normal.font.name = 'Calibri'
    normal.font.size = Pt(10.5)
    normal.font.color.rgb = RGBColor(51, 65, 85)
    normal.paragraph_format.space_after = Pt(6)
    for nombre in ('Heading 1', 'Heading 2', 'Heading 3'):
        doc.styles[nombre].font.name = 'Calibri'
        doc.styles[nombre].paragraph_format.keep_with_next = True
    doc.styles['Heading 1'].font.size = Pt(20)
    doc.styles['Heading 2'].font.size = Pt(14)
    doc.styles['Heading 3'].font.size = Pt(11.5)
    doc.styles['Heading 1'].font.color.rgb = RGBColor(15, 23, 42)
    doc.styles['Heading 2'].font.color.rgb = RGBColor(37, 99, 235)

    with entrada.open('r', encoding='utf-8-sig') as archivo:
        lineas = archivo.readlines()

    en_codigo = False
    filas_tabla = []
    frontmatter = bool(lineas and lineas[0].strip() == '---')
    dentro_frontmatter = False

    for linea in lineas:
        limpia = linea.strip()
        if frontmatter:
            if limpia == '---':
                dentro_frontmatter = not dentro_frontmatter
                continue
            if dentro_frontmatter:
                continue

        if limpia.startswith('```'):
            en_codigo = not en_codigo
            continue
        if en_codigo:
            parrafo = doc.add_paragraph()
            parrafo.paragraph_format.left_indent = Inches(0.2)
            run = parrafo.add_run(linea.rstrip('\r\n'))
            run.font.name = 'Consolas'
            run.font.size = Pt(9)
            run.font.color.rgb = RGBColor(30, 41, 59)
            continue

        if limpia.startswith('|') and limpia.endswith('|'):
            filas_tabla.append(limpia)
            continue
        if filas_tabla:
            procesar_tabla(doc, filas_tabla)
            filas_tabla = []

        imagen = re.match(r'^!\[(.*?)\]\(([^)]+)\)$', limpia)
        if imagen:
            descripcion, ruta_relativa = imagen.groups()
            ruta_imagen = (base_dir / ruta_relativa).resolve()
            if ruta_imagen.is_file():
                parrafo = doc.add_paragraph()
                parrafo.alignment = WD_ALIGN_PARAGRAPH.CENTER
                parrafo.add_run().add_picture(str(ruta_imagen), width=Inches(5.8))
                if descripcion:
                    pie = doc.add_paragraph()
                    pie.alignment = WD_ALIGN_PARAGRAPH.CENTER
                    run = pie.add_run(f'Figura: {descripcion}')
                    run.italic = True
                    run.font.size = Pt(9)
                    run.font.color.rgb = RGBColor(100, 116, 139)
            else:
                parrafo = doc.add_paragraph()
                run = parrafo.add_run(f'[IMAGEN PENDIENTE: {ruta_relativa} - {descripcion}]')
                run.bold = True
                run.font.color.rgb = RGBColor(220, 38, 38)
            continue

        if not limpia or limpia == '---':
            continue
        if limpia.startswith('# '):
            agregar_texto_formateado(doc.add_heading('', level=1), limpia[2:])
        elif limpia.startswith('## '):
            agregar_texto_formateado(doc.add_heading('', level=2), limpia[3:])
        elif limpia.startswith('### '):
            agregar_texto_formateado(doc.add_heading('', level=3), limpia[4:])
        elif limpia.startswith('> '):
            texto = limpia[2:]
            tipo = 'note'
            if texto.startswith('**Advertencia:**'):
                tipo = 'warning'
                texto = texto[len('**Advertencia:**'):].strip()
            elif texto.startswith('**Nota:**'):
                texto = texto[len('**Nota:**'):].strip()
            parrafo = doc.add_paragraph()
            parrafo.paragraph_format.left_indent = Inches(0.15)
            agregar_texto_formateado(parrafo, texto)
            color = COLOR_WARN if tipo == 'warning' else COLOR_NOTE
            sombreado = OxmlElement('w:shd')
            sombreado.set(qn('w:fill'), color)
            parrafo._p.get_or_add_pPr().append(sombreado)
            for run in parrafo.runs:
                run.font.color.rgb = RGBColor(153, 27, 27) if tipo == 'warning' else RGBColor(30, 64, 175)
        elif re.match(r'^\d+\.\s+', limpia):
            agregar_texto_formateado(doc.add_paragraph(style='List Number'), re.sub(r'^\d+\.\s+', '', limpia))
        elif limpia.startswith(('- ', '* ')):
            agregar_texto_formateado(doc.add_paragraph(style='List Bullet'), limpia[2:])
        else:
            agregar_texto_formateado(doc.add_paragraph(), limpia)

    if filas_tabla:
        procesar_tabla(doc, filas_tabla)

    salida.parent.mkdir(parents=True, exist_ok=True)
    doc.save(salida)
    print(f'Manual generado: {salida}')
    return 0


if __name__ == '__main__':
    if len(sys.argv) < 3:
        print('Uso: python md_to_docx.py <entrada.md> <salida.docx>')
        sys.exit(2)
    sys.exit(markdown_a_docx(sys.argv[1], sys.argv[2]))
