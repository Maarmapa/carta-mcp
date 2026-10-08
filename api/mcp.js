// Servidor MCP (Model Context Protocol) sobre Streamable HTTP, sin dependencias.
// Expone la carta de un negocio como tools para agentes. Endpoint: POST /api/mcp
// con JSON-RPC 2.0. SOLO LECTURA: ninguna tool escribe, cobra ni reserva.
//
// Lo unico que cambia entre un negocio y otro es negocio.js y datos/. Este
// archivo no se toca.
const NEG = require('../negocio.js');
const CARTA = require('../datos/carta.js');
const GUIAS = require('../datos/guias.js');

// ---------------------------------------------------------------- busqueda
const strip = (s) => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

// Tolerancia de plural: "postres" y "postre" son la misma cosa.
const sing = (w) => (w.length > 4 && /(es|s)$/.test(w) ? w.replace(/(es|s)$/, '') : w);

// La carta vive en un idioma; el agente pregunta en el que quiera. Este
// diccionario se aplica a la CONSULTA, nunca a los datos, para que la carta siga
// teniendo una sola fuente de verdad. Ampliarlo es barato y no rompe nada.
const SINONIMOS = {
  tuna: 'atun', salmon: 'salmon', shrimp: 'camaron', prawn: 'camaron',
  eel: 'anguila', octopus: 'pulpo', squid: 'calamar', scallop: 'ostion',
  crab: 'jaiba', clam: 'almeja', fish: 'pescado', beef: 'vacuno',
  chicken: 'pollo', pork: 'cerdo', rice: 'arroz', soup: 'sopa',
  dessert: 'postre', sweet: 'postre', starter: 'comenzar', appetizer: 'comenzar',
  main: 'fondo', wine: 'vino', red: 'tinto', white: 'blanco',
  sparkling: 'espumante', beer: 'cerveza', cocktail: 'cocteleria',
  drink: 'bebida', water: 'agua', coffee: 'cafe', tea: 'te',
  raw: 'crudo', grilled: 'parrilla', fried: 'frito', spicy: 'picante',
  vegetarian: 'vegetariano', vegan: 'vegano', food: 'comida', menu: 'carta',
  bar: 'barra', glass: 'copa', bottle: 'botella',
};

// Palabras completas, normalizadas y sin plural. Comparar por palabra y no por
// subcadena es lo que evita que "tuna" matchee "aceitunas".
const palabras = (s) => strip(s).split(/[^a-z0-9]+/).filter(Boolean).map(sing);
const traducir = (q) =>
  strip(q).split(/\s+/).filter(Boolean)
    .map((w) => SINONIMOS[w] || SINONIMOS[sing(w)] || w).join(' ');

// Coincide si CADA termino de la consulta aparece como palabra completa, o como
// prefijo de 4 letras o mas, en nombre, descripcion, categoria o seccion.
function coincide(item, consulta) {
  const campos = palabras(`${item.n} ${item.d || ''} ${item.c} ${item.s}`);
  return consulta.split(/\s+/).filter(Boolean).every((t) => {
    const term = sing(t);
    return campos.some((w) => w === term || (term.length >= 4 && w.startsWith(term)));
  });
}

const fmt = (i) => `${i.n} — ${i.p}${i.chef ? ' ★' : ''}${i.d ? ` · ${i.d}` : ''} [${i.s} / ${i.c}]`;

// ------------------------------------------------------------------- tools
const TOOLS = [
  {
    name: 'get_carta',
    description:
      `Official menu of ${NEG.nombre} with real prices in ${NEG.moneda}. ` +
      `Carta oficial con precios reales. Sin argumentos devuelve el indice de ` +
      `secciones y categorias; con {seccion} o {categoria}, el detalle.`,
    inputSchema: {
      type: 'object',
      properties: {
        seccion: { type: 'string', enum: NEG.secciones, description: 'Seccion de la carta' },
        categoria: { type: 'string', description: 'Categoria dentro de la seccion' },
      },
    },
  },
  {
    name: 'buscar_plato',
    description:
      'Search the menu. Busca en nombre, descripcion y categoria. Acepta ingles o ' +
      'espanol: tuna, dessert, wine funcionan contra una carta en espanol.',
    inputSchema: {
      type: 'object',
      properties: { query: { type: 'string', description: 'Texto a buscar' } },
      required: ['query'],
    },
  },
  {
    name: 'get_info',
    description: `Address, hours and how to book at ${NEG.nombre}. Direccion, horarios y como reservar.`,
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'get_guia',
    description:
      'Full text of a guide written by the business. Texto completo de una guia. ' +
      'Sin argumentos lista las disponibles.',
    inputSchema: {
      type: 'object',
      properties: { slug: { type: 'string', enum: Object.keys(GUIAS) } },
    },
  },
];

function runTool(name, args) {
  const a = args || {};

  if (name === 'get_info') {
    const { id, secciones, instrucciones, ...info } = NEG;
    return JSON.stringify(info, null, 2);
  }

  if (name === 'get_guia') {
    if (!a.slug) {
      return 'Guias disponibles:\n' +
        Object.entries(GUIAS).map(([s, g]) => `- ${s}: ${g.titulo}`).join('\n');
    }
    const g = GUIAS[a.slug];
    if (!g) throw Object.assign(new Error(`No existe la guia "${a.slug}"`), { code: -32602 });
    return `# ${g.titulo}\n\n${g.texto}`;
  }

  if (name === 'get_carta') {
    let items = CARTA;
    if (a.seccion) items = items.filter((i) => strip(i.s) === strip(a.seccion));
    if (a.categoria) items = items.filter((i) => strip(i.c) === strip(a.categoria));

    // Sin filtro no se vuelca la carta entera: un indice sirve mas y gasta
    // muchisimos menos tokens del contexto del agente.
    if (!a.seccion && !a.categoria) {
      const idx = {};
      for (const i of CARTA) (idx[i.s] = idx[i.s] || new Set()).add(i.c);
      return `Carta de ${NEG.nombre} — ${CARTA.length} items.\n\n` +
        Object.entries(idx).map(([s, cs]) =>
          `${s}: ${[...cs].join(', ')}`).join('\n') +
        '\n\nPedir {seccion} o {categoria} para el detalle.';
    }
    if (!items.length) throw Object.assign(new Error('Sin resultados para ese filtro'), { code: -32602 });
    return items.map(fmt).join('\n');
  }

  if (name === 'buscar_plato') {
    if (!a.query) throw Object.assign(new Error('Falta "query"'), { code: -32602 });
    const q = traducir(a.query);
    const hits = CARTA.filter((i) => coincide(i, q));
    if (!hits.length) return `Sin resultados para "${a.query}".`;
    return `${hits.length} resultado(s):\n` + hits.map(fmt).join('\n');
  }

  throw Object.assign(new Error(`Tool desconocida: ${name}`), { code: -32601 });
}

// ----------------------------------------------------------------- JSON-RPC
module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers',
    'Content-Type, Accept, Authorization, Mcp-Session-Id, MCP-Protocol-Version');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST')
    return res.status(405).json({ error: 'Usar POST con JSON-RPC 2.0 (Streamable HTTP).' });

  const msg = req.body;
  const ok = (id, result) => res.status(200).json({ jsonrpc: '2.0', id, result });
  const err = (id, code, message) => res.status(200).json({ jsonrpc: '2.0', id, error: { code, message } });

  try {
    if (!msg || !msg.method) return err(msg && msg.id, -32600, 'Request invalida');
    // Una notificacion no lleva respuesta: 202 y nada mas.
    if (msg.method.startsWith('notifications/')) return res.status(202).end();

    switch (msg.method) {
      case 'initialize':
        return ok(msg.id, {
          protocolVersion: (msg.params && msg.params.protocolVersion) || '2025-06-18',
          capabilities: { tools: {} },
          serverInfo: { name: NEG.id, version: '1.0.0' },
          instructions: NEG.instrucciones,
        });
      case 'ping': return ok(msg.id, {});
      case 'tools/list': return ok(msg.id, { tools: TOOLS });
      case 'tools/call': {
        const { name, arguments: args } = msg.params || {};
        try {
          return ok(msg.id, { content: [{ type: 'text', text: runTool(name, args) }], isError: false });
        } catch (e) {
          if (e && e.code) return err(msg.id, e.code, e.message);
          return ok(msg.id, { content: [{ type: 'text', text: 'Error interno del tool.' }], isError: true });
        }
      }
      default:
        return err(msg.id, -32601, `Metodo no soportado: ${msg.method}`);
    }
  } catch (e) {
    return err(null, -32603, 'Error interno');
  }
};

// Se exporta para poder probarlo sin levantar el servidor.
module.exports.runTool = runTool;
module.exports.TOOLS = TOOLS;
