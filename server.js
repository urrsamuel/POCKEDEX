const express = require('express');
const path = require('path');

const aplicacion = express();
const puerto = process.env.PORT || 3000;
const limiteGeneracion = 151;
const limiteRespuestaCaracteres = 100;
const urlPrimeraGeneracion = `https://pokeapi.co/api/v2/pokemon?limit=${limiteGeneracion}&offset=0`;
const urlOpenAI = 'https://api.openai.com/v1/responses';


let pokemonesGuardados = null;

function normalizar(valor = '') {
  return valor
    .toLocaleLowerCase('es')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

function transformarPokemon(datos) {
  return {
    id: datos.id,
    nombre: datos.name,
    altura: datos.height,
    peso: datos.weight,
    tipos: datos.types.map(({ type }) => type.name),
    habilidades: datos.abilities.map(({ ability }) => ability.name),
    imagen: datos.sprites.other['official-artwork'].front_default || datos.sprites.front_default,
    audio: datos.cries?.latest || datos.cries?.legacy || null
  };
}

function limitarRespuesta(texto) {
  const respuesta = String(texto || '').trim();
  if (respuesta.length <= limiteRespuestaCaracteres) return respuesta;
  return `${respuesta.slice(0, limiteRespuestaCaracteres - 3).trimEnd()}...`;
}

async function obtenerPokemonDesdeUrl(url) {
  const respuesta = await fetch(url);
  if (!respuesta.ok) throw new Error(`No se pudo cargar ${url}`);
  return transformarPokemon(await respuesta.json());
}

async function obtenerPrimeraGeneracion() {
  if (pokemonesGuardados) return pokemonesGuardados;

  const respuesta = await fetch(urlPrimeraGeneracion);
  if (!respuesta.ok) throw new Error(`PokéAPI respondió con ${respuesta.status}`);

  const { results: resultados } = await respuesta.json();
  const pokemones = await Promise.all(resultados.map(({ url }) => obtenerPokemonDesdeUrl(url)));

  pokemonesGuardados = pokemones.sort((primero, segundo) => primero.id - segundo.id);
  return pokemonesGuardados;
}

function filtrarPokemones(pokemones, consulta) {
  const busqueda = normalizar(consulta.busqueda);
  const tipo = normalizar(consulta.tipo);
  const numero = Number.parseInt(consulta.numero, 10);

  return pokemones.filter((pokemon) => {
    const coincideBusqueda = !busqueda
      || normalizar(pokemon.nombre).includes(busqueda)
      || String(pokemon.id).includes(busqueda);
    const coincideTipo = !tipo
      || pokemon.tipos.some((tipoPokemon) => normalizar(tipoPokemon) === tipo);
    const coincideNumero = Number.isNaN(numero) || pokemon.id === numero;

    return coincideBusqueda && coincideTipo && coincideNumero;
  });
}

aplicacion.use(express.json());
aplicacion.use(express.static(path.join(__dirname, 'public')));

async function preguntarAOpenAI(pregunta, pokemon) {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('Falta configurar OPENAI_API_KEY en el archivo .env.');
  }

  const contexto = JSON.stringify({
    id: pokemon.id,
    nombre: pokemon.nombre,
    tipos: pokemon.tipos,
    altura: pokemon.altura,
    peso: pokemon.peso
  });

  const respuesta = await fetch(urlOpenAI, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      instructions: 'Eres PockeIA, un asistente breve y amable integrado en una Pokedex. Responde en español. Usa solamente los datos proporcionados y no inventes estadísticas.',
      input: `Pregunta del usuario: ${pregunta}\nDatos confirmados del Pokemon: ${contexto}`,
      max_output_tokens: 100
    })
  });

  if (!respuesta.ok) {
    const detalle = await respuesta.text();
    console.error('OpenAI respondió con un error:', detalle);
    throw new Error('No fue posible obtener una respuesta de la IA.');
  }

  const datos = await respuesta.json();
  return limitarRespuesta(datos.output_text || datos.output?.[0]?.content?.[0]?.text || 'La IA no devolvió una respuesta.');
}

async function buscarPokemonRelacionado(mensaje) {
  try {
    const pokemones = await obtenerPrimeraGeneracion();
    const consulta = normalizar(mensaje);
    const coincidenciaId = consulta.match(/\d+/);

    if (coincidenciaId) {
      const pokemonPorId = pokemones.find((pokemon) => pokemon.id === Number.parseInt(coincidenciaId[0], 10));
      if (pokemonPorId) return pokemonPorId;
    }

    return [...pokemones]
      .sort((primero, segundo) => segundo.nombre.length - primero.nombre.length)
      .find((pokemon) => consulta.includes(normalizar(pokemon.nombre))) || null;
  } catch (error) {
    console.error('No se pudo buscar el Pokémon relacionado:', error.message);
    return null;
  }
}

async function enviarChatAOpenAI(mensajes) {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('Falta configurar OPENAI_API_KEY en el archivo .env.');
  }

  const ultimoMensaje = mensajes[mensajes.length - 1]?.content || '';
  const pokemonRelacionado = await buscarPokemonRelacionado(ultimoMensaje);
  let contextoPokemon = 'Habla de forma general sobre Pokemon de la primera generacion.';

  if (pokemonRelacionado) {
    contextoPokemon = `Si la pregunta se refiere a este Pokemon, usa estos datos confirmados: ${JSON.stringify({
      id: pokemonRelacionado.id,
      nombre: pokemonRelacionado.nombre,
      tipos: pokemonRelacionado.tipos,
      altura: pokemonRelacionado.altura,
      peso: pokemonRelacionado.peso
    })}`;
  }

  const respuesta = await fetch(urlOpenAI, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      instructions: `Eres PockeIA, un asistente breve, amable y educativo que solo habla de Pokemon, la Pokedex, tipos, habilidades, movimientos, evoluciones, combates y datos de entrenamiento. Responde en espanol, explica con claridad y no inventes datos. Si el usuario pregunta por cualquier otro tema, no lo desarrolles y responde exactamente que solo puedes hablar sobre Pokemon. ${contextoPokemon}`,
      input: mensajes,
      max_output_tokens: 180
    })
  });

  if (!respuesta.ok) {
    console.error('OpenAI respondió con un error:', await respuesta.text());
    throw new Error('No fue posible obtener una respuesta de la IA.');
  }

  const datos = await respuesta.json();
  return {
    respuesta: limitarRespuesta(datos.output_text || datos.output?.[0]?.content?.[0]?.text || 'La IA no devolvió una respuesta.'),
    pokemon: pokemonRelacionado
  };
}

aplicacion.get('/api/pokemon', async (solicitud, respuesta) => {
  try {
    const pokemones = await obtenerPrimeraGeneracion();
    const resultados = filtrarPokemones(pokemones, solicitud.query);

    respuesta.json({
      generacion: 1,
      total: pokemones.length,
      cantidad: resultados.length,
      resultados
    });
  } catch (error) {
    console.error('Error cargando Pokémon:', error.message);
    respuesta.status(502).json({ error: 'No fue posible conectar con PokéAPI.' });
  }
});

aplicacion.get('/api/pokemon/:id', async (solicitud, respuesta) => {
  try {
    const id = Number.parseInt(solicitud.params.id, 10);
    const pokemon = (await obtenerPrimeraGeneracion()).find((entrada) => entrada.id === id);

    if (!pokemon) {
      return respuesta.status(404).json({ error: 'No existe un Pokémon con ese ID en la primera generación.' });
    }

    respuesta.json(pokemon);
  } catch (error) {
    console.error('Error buscando Pokémon:', error.message ,error);
    respuesta.status(502).json({ error: 'No fue posible consultar PokéAPI.' });
  }
});

aplicacion.post('/api/ia', async (solicitud, respuesta) => {
  try {
    const pregunta = String(solicitud.body?.pregunta || '').trim();
    const pokemon = await buscarPokemonRelacionado(pregunta);

    if (!pregunta || !pokemon) {
      return respuesta.status(400).json({ error: 'Escribe una pregunta con el nombre o el ID de un Pokémon del 1 al 151.' });
    }

    const respuestaIA = await preguntarAOpenAI(pregunta, pokemon);

    respuesta.json({ respuesta: respuestaIA, pokemon });
  } catch (error) {
    console.error('Error consultando la IA:', error.message);
    const faltaClave = error.message.includes('OPENAI_API_KEY');
    respuesta.status(faltaClave ? 503 : 502).json({ error: error.message });
  }
});

aplicacion.post('/api/chat', async (solicitud, respuesta) => {
  try {
    const mensajes = Array.isArray(solicitud.body?.mensajes) ? solicitud.body.mensajes : [];
    const mensajesValidos = mensajes
      .filter((mensaje) => ['user', 'assistant'].includes(mensaje.role) && typeof mensaje.content === 'string')
      .slice(-10)
      .map((mensaje) => ({ role: mensaje.role, content: mensaje.content.slice(0, 800) }));

    if (!mensajesValidos.length || mensajesValidos[mensajesValidos.length - 1].role !== 'user') {
      return respuesta.status(400).json({ error: 'Escribe un mensaje para comenzar el chat.' });
    }

    const resultado = await enviarChatAOpenAI(mensajesValidos);
    respuesta.json(resultado);
  } catch (error) {
    console.error('Error en el chat de IA:', error.message);
    const faltaClave = error.message.includes('OPENAI_API_KEY');
    respuesta.status(faltaClave ? 503 : 502).json({ error: error.message });
  }
});

aplicacion.listen(puerto, () => {
  console.log(`Pockedex disponible en http://localhost:${puerto}`);
});
