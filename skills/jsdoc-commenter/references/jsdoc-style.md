# JSDoc Style

## Writing rules

- Escribir en imperativo o descripcion directa y breve.
- Evitar repetir literalmente el nombre de la funcion en la descripcion.
- Describir el efecto observable y expectativas de entrada/salida.
- Mantener una sola frase corta para el resumen.

## Type hints

- Usar tipos primitivos cuando sean obvios: `string`, `number`, `boolean`.
- Usar `Array<T>` para arreglos cuando el tipo de elemento sea claro.
- Usar `Object` cuando no haya suficiente informacion para algo mas preciso.
- Usar `Promise<T>` para funciones asincronas.
- Usar `void` cuando no retorna valor.
- Usar `unknown` si el retorno existe pero no puede inferirse con seguridad.

## Params and returns

- Crear una linea `@param` por parametro y mantener el orden de la firma.
- Para parametros opcionales, usar `[name]`.
- Agregar `@returns` solo si la funcion retorna un valor.
