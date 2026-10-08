# carta-mcp

Una carta de restaurante expuesta como herramientas para agentes de IA, por dos
caminos que leen los mismos datos. Sin dependencias, sin build.

> **In short:** a restaurant menu exposed to AI agents over MCP (JSON-RPC,
> Streamable HTTP) *and* in-page via WebMCP (`document.modelContext`), sharing a
> single source of truth. Zero dependencies.

## El problema

Cuando alguien le pregunta a un asistente "¿tienen postres sin gluten?", el
asistente hace una de dos cosas: scrapea el HTML y adivina, o inventa. Las dos
terminan igual — el comensal llega con una expectativa que el negocio no puso.

La carta ya existe y es la fuente de verdad. Lo que falta es una puerta.

## Las dos puertas

| | para quién | cómo |
|---|---|---|
| **MCP** | el agente que no está en la página | `POST /api/mcp`, JSON-RPC 2.0 |
| **WebMCP** | el agente que ya la tiene abierta | `document.modelContext` |

Las tools de la página son proxies finos al mismo endpoint. **Una sola
implementación, dos puertas.** Si divergieran, el agente que está adentro de la
página y el que está afuera darían respuestas distintas sobre el mismo plato.

## Las tools

| tool | qué hace |
|---|---|
| `get_carta` | la carta con precios reales; sin argumentos devuelve el índice |
| `buscar_plato` | busca en nombre, descripción y categoría; acepta inglés o español |
| `get_info` | dirección, horarios, cómo reservar |
| `get_guia` | texto completo de las guías que escribe el negocio |

Todas de **solo lectura**. Ninguna reserva, cobra ni escribe. Un agente que
puede reservar sin que la persona confirme es un agente que te llena la sala de
reservas falsas.

## Dos decisiones que importan

**El índice en vez de la carta entera.** `get_carta` sin argumentos no vuelca los
250 platos: devuelve las secciones y sus categorías. El agente pide el detalle de
lo que necesita. Volcar todo gasta el contexto del modelo en comida que nadie
preguntó.

**Los sinónimos se aplican a la consulta, nunca a los datos.** La carta está en
español; el diccionario traduce lo que llega (`tuna` → `atun`, `dessert` →
`postre`) antes de buscar. Así la carta sigue teniendo una sola forma de
escribirse y el agente igual encuentra preguntando en inglés.

La búsqueda compara por palabra completa, no por subcadena, con tolerancia de
plural. Sin eso, `tuna` encuentra `aceitunas`.

## Adaptarlo a otro negocio

Se tocan dos cosas y nada más:

```
negocio.js        nombre, dirección, horarios, secciones, instrucciones
datos/carta.js    los ítems: n, p, d, s, c
datos/guias.js    los textos largos, si hay
```

`api/mcp.js` no se toca. Los datos de ejemplo son inventados.

## Probarlo

```bash
node -e "const m=require('./api/mcp.js'); console.log(m.runTool('buscar_plato',{query:'wine'}))"
```

Desplegado en Vercel, un agente se conecta a `https://tu-dominio/api/mcp`.

## Origen

Salió de un sitio de restaurante real donde esto se construyó primero. Este repo
es la parte genérica: el servidor, el motor de búsqueda y el registro en la
página. Los datos, las fotos y la carta de aquel negocio no están acá y no son
parte de la licencia.

MIT.
