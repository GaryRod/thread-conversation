# Mapa de conversación para OpenCode Terminal

Plugin de interfaz para **OpenCode 1.18.35**, creado con TypeScript, Solid y
OpenTUI. Muestra un índice numerado de tus preguntas **justo encima del cuadro
de escritura**, dentro de la conversación.

## Funciones

- Solo incluye mensajes del usuario, en orden cronológico.
- Cada entrada muestra una vista previa de la consulta.
- **Hover durante 250 ms:** abre un cuadro flotante sobre el historial con la
  pregunta y las primeras **6 líneas visuales** de su respuesta. Si hay más
  contenido aparece `…`; las respuestas cortas se muestran completas.
- El popup se actualiza mientras el agente escribe y se cierra al retirar el
  cursor. Antes de recibir texto muestra «Esperando respuesta…».
- **Clic izquierdo:** desplaza el historial hasta la pregunta original.
- El índice ocupa como máximo cuatro filas; la rueda permite recorrerlo.
- `/mapa` abre un selector con búsqueda y vista previa, utilizable con teclado.
- `/mapa-eliminar` permite borrar una pregunta y sus respuestas asociadas,
  después de confirmar, conservando los demás turnos de la conversación.
- Se actualiza al cambiar de sesión y respeta el punto de deshacer de OpenCode.
- Excluye razonamiento, herramientas y prompts sintéticos de compactación.

## Abrir en esta carpeta

El archivo `tui.json` ya registra `./dist/tui.js` como plugin local.
El paquete compilado se ha generado en esta carpeta.

1. **Cierra y reinicia OpenCode** para cargar la configuración y el plugin.
2. Desde una terminal, abre este proyecto:

   ```powershell
   opencode "C:\MCP\MapaConversacion"
   ```

3. Abre o continúa una conversación. El mapa aparece sobre el cuadro de entrada.
4. Pasa el cursor por una pregunta para ver la respuesta; haz clic para ir a ella.

El mapa necesita una terminal que envíe eventos de movimiento del ratón.
Si el hover no está disponible en tu terminal, puedes consultar la vista previa
con `/mapa`, flechas y Enter. Escape cierra el selector.

### Comandos

| Acción | Comando | Atajo |
| --- | --- | --- |
| Buscar preguntas y navegar | `/mapa` | `Ctrl+Alt+M` |
| Mostrar u ocultar el mapa | `/mapa-toggle` | `Ctrl+Alt+H` |
| Elegir un turno para eliminar | `/mapa-eliminar` | — |

También puedes hacer clic en `ocultar [×]`. La preferencia se conserva entre
reinicios. Los atajos dependen de que la terminal los transmita a OpenCode.

### Eliminar una pregunta y su respuesta

1. Espera a que el agente termine de trabajar.
2. Ejecuta `/mapa-eliminar`, busca la pregunta y selecciónala con Enter o clic.
   También puedes seleccionarla en `/mapa` y hacer clic en
   **Eliminar pregunta y respuesta…**, debajo de la vista previa.
3. Revisa la consulta y el número de mensajes en el diálogo de confirmación.
4. Confirma para borrar o pulsa Escape/cancelar para conservar el turno.

Se elimina la pregunta y todos los mensajes del agente cuyo `parentID` apunta
a ella, incluidas sus partes de texto y herramientas. La asociación es por ID,
no por posición: se conservan las otras preguntas y respuestas, aunque haya
consultas en cola. El mapa se actualiza mediante los eventos de OpenCode.

**El borrado es permanente y no revierte los cambios realizados en archivos.**
No es equivalente a `/undo` ni a ocultar una entrada del mapa. Si un mensaje
posterior hace referencia al turno borrado, ese mensaje se conserva, pero el
contenido eliminado ya no estará disponible para futuras consultas al modelo.

OpenCode elimina un mensaje por petición. El plugin elimina primero los
mensajes del agente y deja la pregunta para el final. Si falla una petición,
se detiene y avisa cuántos mensajes llegaron a eliminarse; revisa el mapa antes
de reintentar. Si el agente está trabajando o el turno cambia antes de confirmar,
el plugin solicita volver a seleccionarlo en lugar de iniciar el borrado.

## Instalación global (todos los proyectos)

La instalación global permite usar el mapa y `/mapa` al abrir OpenCode desde
cualquier carpeta. Estos pasos corresponden a **OpenCode Terminal 1.18.35**.

### 1. Preparar el plugin

Mantén el proyecto en una ubicación permanente, por ejemplo
`C:\MCP\MapaConversacion`. Si todavía no existe `dist/tui.js`, abre una terminal
en esa carpeta y ejecuta:

```powershell
npm.cmd ci
npm.cmd run build
```

### 2. Registrar la ruta en la configuración global

Abre `%USERPROFILE%\.config\opencode\tui.jsonc`. En este equipo corresponde a:

```text
C:\Users\NB-155.NB-155\.config\opencode\tui.jsonc
```

Si el archivo no existe, créalo junto con sus carpetas. Añade la ruta compilada
al array **`plugin`**, conservando las entradas que ya tengas. Por ejemplo, si
ya utilizas otro plugin:

```jsonc
{
  "$schema": "https://opencode.ai/tui.json",
  "plugin": [
    "./otro-plugin.js",
    "file:///C:/MCP/MapaConversacion/dist/tui.js"
  ]
}
```

`./otro-plugin.js` representa una entrada existente: conserva tus rutas reales;
si no tienes otros plugins, deja únicamente la entrada de `dist/tui.js`.
Si el array `plugin` ya existe, añade la nueva entrada separada por una coma,
sin duplicar el array ni la ruta del mapa.

Usa una URL de archivo absoluta con barras `/`, como
`file:///C:/MCP/MapaConversacion/dist/tui.js`. Si guardaste el proyecto en otra
ubicación, adapta esa ruta.

### 3. Reiniciar y comprobar

1. **Cierra completamente OpenCode y vuelve a abrirlo** desde cualquier proyecto.
2. Abre o continúa una conversación.
3. Ejecuta `/mapa`: debe abrir el selector de preguntas con la vista previa de
   la respuesta. El mapa también aparece encima del cuadro de escritura.
4. Si habías ocultado el mapa, usa `/mapa-toggle` para mostrarlo.

En este equipo, la entrada global ya está registrada en `tui.jsonc`.

### Actualizar o desinstalar

- **Actualizar:** después de modificar el código, ejecuta `npm.cmd run build`
  desde la carpeta del proyecto y reinicia OpenCode. No necesitas registrar
  otra vez la ruta si la ubicación no cambia.
- **Mover el proyecto:** actualiza la URL en la configuración global para que
  apunte al nuevo `dist/tui.js` y reinicia OpenCode.
- **Desinstalar globalmente:** elimina únicamente la entrada del mapa del array
  `plugin` global y reinicia OpenCode. Si lo abres desde esta carpeta, seguirá
  disponible por su registro local en `tui.json`; elimina también esa entrada
  si quieres desactivarlo aquí.

## Desarrollo

Requiere Node.js y npm. No necesita .NET ni un servidor MCP.
Se usan los tipos y versiones de OpenTUI correspondientes a OpenCode 1.18.35.

```powershell
npm.cmd ci
npm.cmd run check
npm.cmd test
npm.cmd run build
npm.cmd run test:tui
```

`test:tui` descarga/ejecuta Bun mediante npm si hace falta. La prueba usa el
renderizador real de OpenTUI con un host OpenCode simulado: comprueba el mapa,
hover de seis líneas, actualización en vivo, cierre del popup, salto al mensaje,
conservación del cuadro de escritura y cambio de tamaño.
También ejecuta el comando `/mapa`, cambia de pregunta, verifica las seis líneas
del panel de respuesta y selecciona un mensaje para navegar. El selector simulado
respeta la restricción de OpenCode 1.18.35: el `footer` de cada opción se inserta
dentro de un nodo de texto; la vista previa se renderiza en un panel separado.
La prueba de interfaz también comprueba la selección y confirmación del borrado,
la cancelación, el bloqueo mientras el agente trabaja, la protección frente a
doble confirmación y la conservación de los demás turnos. Las pruebas del modelo
cubren respuestas múltiples, preguntas en cola y fallos parciales del servidor.

El build transforma JSX con el renderer universal de Solid y genera
`dist/tui.js`. Mantiene Solid y OpenTUI externos para utilizar las instancias
del host y no duplicar su sistema reactivo.

### Estructura

```text
src/
  tui.tsx              Interfaz, popup, comandos y conexión con OpenCode
  conversation.ts      Preguntas, asociación de respuestas y recorte por columnas
  navigation.ts        Adaptador de salto al mensaje
  deletion.ts          Selección y borrado secuencial del turno
scripts/build.mjs      Compilación del plugin
tests/                 Pruebas del modelo y del renderizador TUI
tui.json               Activación local
dist/tui.js            Plugin compilado
```

## Compatibilidad y navegación

La integración está dirigida a **OpenCode 1.18.35**. Esta versión no proporciona
una API pública de plugin para saltar a un ID de mensaje. `src/navigation.ts`
localiza su ScrollBox y aplica el mismo cálculo que el timeline integrado de
esa versión. Esta dependencia del árbol visual está aislada: una actualización
de OpenCode puede requerir ajustar el adaptador. Si no encuentra el mensaje,
el plugin muestra una notificación y sugiere `/timeline`.

El slot público `session_prompt` permite situar el mapa antes del cuadro de
entrada; se renderiza de nuevo el componente Prompt público con los callbacks
del host. Durante solicitudes de permiso o preguntas de herramientas OpenCode
puede ocultar temporalmente ese cuadro y, por tanto, también el mapa.

Las pruebas automatizadas no sustituyen la comprobación interactiva en tu
terminal concreta. No se ha enviado ninguna consulta a un modelo para verificar
este proyecto.
