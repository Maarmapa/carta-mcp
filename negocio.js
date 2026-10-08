// La única pieza que cambia de un negocio a otro. Todo lo demás —el servidor
// JSON-RPC, el motor de búsqueda, el registro de tools en la página— es igual
// para cualquier carta.
module.exports = {
  id: 'ejemplo-mcp',
  nombre: 'Casa Ejemplo',
  tipo: 'Restaurante de ejemplo',
  direccion: 'Una calle 123, Una ciudad',
  horarios: 'Martes a sábado 13:00 a 15:00 y 19:00 a 22:00. Domingo solo almuerzo. Lunes cerrado.',
  web: 'https://ejemplo.test',
  como_reservar: 'Formulario en la web; confirmación inmediata.',
  especialidad: 'Producto del día, cambia según lo que llegue de la caleta.',
  moneda: 'CLP',

  // Las secciones de la carta, en el orden en que se muestran. El enum de la
  // tool get_carta sale de acá, así que el agente nunca pide una que no existe.
  secciones: ['Comida', 'Barra', 'Vinos'],

  // Instrucción que el servidor le entrega al agente al conectarse. Vale la pena
  // escribirla con cuidado: es lo único que el modelo lee antes de decidir.
  instrucciones:
    'MCP de Casa Ejemplo. SOLO LECTURA: carta con precios reales, información y ' +
    'horarios. Ninguna tool reserva, cobra ni escribe. Para reservar, dirigir a la web.',
};
