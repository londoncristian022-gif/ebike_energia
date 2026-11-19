---
name: manuales
description: Audita el cÃ³digo, los permisos y el esquema SQL reales de E-Bike Energy y mantiene manuales precisos en espaÃ±ol, en Markdown y Word.
---

# Skill: manuales de E-Bike Energy

## Entregables

- `docs/manual_usuario_por_roles.md` y `docs/manual_usuario_por_roles.docx`.
- `docs/manual_instalacion_y_tecnico.md` y `docs/manual_instalacion_y_tecnico.docx`.

## Procedimiento obligatorio

1. **AuditorÃ­a cruzada:** inspeccionar `api/api.php`, `config/conexion.php`, todos los controladores, `public/index.html`, `public/js/`, `ems_base.sql` y el README. Confirmar cada ruta, mÃ©todo HTTP, validaciÃ³n, rol, tabla, columna, Ã­ndice, clave forÃ¡nea y procedimiento almacenado en su definiciÃ³n real.
2. **Verificar el recorrido completo:** seguir cada acciÃ³n desde el formulario o botÃ³n hasta el JavaScript, la ruta PHP y la consulta SQL. Una funciÃ³n escrita pero inalcanzable por el enrutador, una pantalla sin endpoint o un control que no persiste datos se documenta como limitaciÃ³n con `[PENDIENTE DE CONFIRMACIÃ“N: ...]`; no se presenta como funciÃ³n operativa.
3. **Separar lo dinÃ¡mico de lo ilustrativo:** verificar si cada KPI, grÃ¡fico y cifra se alimenta de una respuesta del servidor. Etiquetar cifras codificadas como ejemplos estÃ¡ticos; no presentarlas como telemetrÃ­a ni datos actuales.
4. **Manual de usuario:** incluir propÃ³sito, acceso, roles reales, matriz de permisos, pasos por pantalla, interpretaciÃ³n de indicadores, reportes y formatos de descarga. Describir por separado lo que el usuario ve y lo que el servidor guarda. No aÃ±adir roles sugeridos que no existan en `usuarios.rol`.
5. **Manual tÃ©cnico:** incluir arquitectura y estructura actual de carpetas, requisitos comprobables, versiones de librerÃ­as, importaciÃ³n del Ãºnico esquema `ems_base.sql`, tablas/columnas clave, claves forÃ¡neas, endpoints y mÃ©todos, validaciones, seguridad y limitaciones. AÃ±adir un diagrama simple de componentes y un modelo de datos que no dibuje relaciones sin FK.
6. **Pendientes:** usar exactamente `[PENDIENTE DE CONFIRMACIÃ“N: descripciÃ³n concreta]` para versiones no declaradas, capacidades no conectadas o decisiones de producciÃ³n sin evidencia. No convertir recomendaciones ni datos de ejemplo en hechos.
7. **Consistencia:** actualizar los dos `.md` como fuente principal. Mantener tÃ­tulos, nombres de archivo, cifras, roles y capacidades coherentes entre ambos. El SQL descrito debe ser el archivo que exista en la raÃ­z.

8. **ExportaciÃ³n Word:** si `docs/` no contiene archivos temporales `~$*.docx` abiertos, ejecutar:

   Verificar e incrustar capturas de pantalla en `docs/img/` mediante sintaxis Markdown `![Descripción](img/archivo.png)` antes de exportar a Word. Las capturas ausentes se indican como pendientes.

   ```powershell
   python skills/manuales/scripts/md_to_docx.py docs/manual_usuario_por_roles.md docs/manual_usuario_por_roles.docx
   python skills/manuales/scripts/md_to_docx.py docs/manual_instalacion_y_tecnico.md docs/manual_instalacion_y_tecnico.docx
   ```

   Si hay un archivo temporal de Word, no sobrescribir el documento abierto: informar del archivo que lo bloquea y generar los demÃ¡s entregables que no estÃ©n bloqueados. No cerrar procesos de Word automÃ¡ticamente.

9. **Informe de cambios:** enumerar archivos actualizados, cambios de cÃ³digo documentados y pendientes. No ejecutar SQL ni modificar funcionalidad de la aplicaciÃ³n durante una tarea de documentaciÃ³n.

