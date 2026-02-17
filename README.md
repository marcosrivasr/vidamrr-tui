# VidaMRR Manager

TUI en Node.js para administrar videos de YouTube.

## Requisitos

- Node.js 18+
- macOS (`pbcopy`) o Linux con `xclip` para copiar al portapapeles

## Uso

```bash
npm start
```

## Comandos

- `/new <url>`: registra un video (extrae titulo + thumbnail)
- `/new`: entra en modo captura de URL
- `/view`: lista videos guardados
- `/help`: muestra ayuda
- `/quit`: cierra la app

## Atajos en vista

- `Flecha arriba/abajo`: navegar
- `Tab`: cambiar foco entre lista y detalle
- `Enter`: copiar URL/titulo/thumbnail segun item seleccionado
- `Esc` o `q`: volver al modo comando

Los videos se guardan en `videos.json` en la raiz del proyecto.
