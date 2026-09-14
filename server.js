const express = require('express');
const path = require('path');

const aplicacion = express();
const puerto = process.env.PORT || 3000;
const limiteGeneracion = 151;
const urlPrimeraGeneracion = `https://pokeapi.co/api/v2/pokemon?limit=${limiteGeneracion}&offset=0`;

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

aplicacion.use(express.static(path.join(__dirname, 'public')));

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
    console.error('Error buscando Pokémon:', error.message);
    respuesta.status(502).json({ error: 'No fue posible consultar PokéAPI.' });
  }
});

aplicacion.listen(puerto, () => {
  console.log(`Pockedex disponible en http://localhost:${puerto}`);
});
