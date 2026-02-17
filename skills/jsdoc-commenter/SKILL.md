---
name: jsdoc-commenter
description: Generar y aplicar comentarios JSDoc para funciones JavaScript/TypeScript existentes. Usar cuando se solicite documentar funciones, agregar anotaciones `@param`/`@returns`, estandarizar documentación técnica del código, o auditar archivos JS/TS con documentación faltante.
---

# JSDoc Commenter

Documentar funciones con bloques JSDoc claros y consistentes para mejorar calidad.

## Workflow

1. Identificar archivos objetivo con `rg --files -g '*.js' -g '*.ts' -g '*.tsx' -g '*.mjs'`.
2. Ejecutar `node scripts/suggest_jsdoc.mjs <archivo...>` para detectar funciones sin JSDoc y obtener sugerencias base.
3. Revisar la intención real de cada función antes de insertar comentarios.
4. Completar descripciones accionables (que expliquen comportamiento, no implementacion linea por linea).
5. Mantener este orden en cada bloque:
   - Resumen en una linea.
   - Linea en blanco.
   - `@param` por parametro (en orden de firma).
   - `@returns` solo si aplica.
6. Aplicar los cambios en el archivo fuente y conservar estilo consistente de sangria.
7. Si el bloque sugerido no refleja tipos reales, ajustarlo segun el codigo.

## Commands

```bash
node scripts/suggest_jsdoc.mjs index.js
node scripts/suggest_jsdoc.mjs src/**/*.ts --json
node scripts/suggest_jsdoc.mjs src/file.js --write
node scripts/suggest_jsdoc.mjs src/file.js --out /tmp/file.commented.js
```

- `--write`: inserta los bloques JSDoc en el mismo archivo.
- `--out <ruta>`: escribe una copia comentada en otro archivo (un solo archivo de entrada).

## Style Reference

Seguir `references/jsdoc-style.md` para convenciones de redaccion y tipos.
