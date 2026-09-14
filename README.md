# Pockedex

Pockedex de la primera generacion. Usa Express para crear una API propia y obtiene los datos reales desde [PokeAPI](https://pokeapi.co/).

Esta guia explica el proyecto con el **metodo Feynman**: primero lo explicamos de forma sencilla y despues mostramos el codigo importante.

## 1. Que hace la aplicacion?

Imagina que la aplicacion es un restaurante:

1. El navegador es el cliente que pide Pokemon.
2. Express es el camarero que recibe la peticion.
3. PokeAPI es la cocina que tiene todos los datos.
4. Express trae los datos, filtra lo que se pidio y lo devuelve al navegador.
5. El navegador muestra cada Pokemon como una tarjeta.

El recorrido es:

```text
Usuario escribe un filtro
        |
        v
public/app.js crea una peticion
        |
        v
GET /api/pokemon?tipo=fire
        |
        v
server.js consulta PokeAPI
        |
        v
Express filtra los 151 Pokemon
        |
        v
app.js recibe JSON y crea las tarjetas
```

## 2. Estructura del proyecto

```text
POCKEDEX/
|-- server.js          # Servidor Express y conexion con PokeAPI
|-- package.json       # Dependencias y comandos
|-- public/
|   |-- index.html     # Estructura de la pagina
|   |-- styles.css     # Diseno visual
|   `-- app.js         # Peticiones y filtros del navegador
`-- README.md
```

## 3. Instalacion y ejecucion

Desde CMD o PowerShell:

```bash
cd /d C:\Users\jaurr\OneDrive\Desktop\POCKEDEX
npm install
npm run dev
```

Despues abre `http://localhost:3000`.

- `npm install` instala Express.
- `npm run dev` ejecuta `node --watch server.js`.
- `npm start` ejecuta el servidor sin modo de observacion.

Si aparece `EADDRINUSE`, el puerto 3000 ya esta ocupado:

```cmd
netstat -ano | findstr :3000
taskkill /PID NUMERO_DEL_PID /F
```

## 4. Como se limita a la primera generacion?

La primera generacion tiene 151 Pokemon. El servidor envia ese limite a PokeAPI:

```js
const limiteGeneracion = 151;
const urlPokeApi =
  `https://pokeapi.co/api/v2/pokemon?limit=${limiteGeneracion}&offset=0`;
```

- `limit=151`: pide solo 151 Pokemon.
- `offset=0`: empieza desde el Pokemon numero 1.

Por eso la aplicacion no obtiene Pokemon de otras generaciones.

## 5. Como obtiene Express los datos?

La funcion `obtenerPrimeraGeneracion` hace la peticion principal:

```js
solicitudPokemon = fetch(urlPokeApi)
  .then((respuesta) => {
    if (!respuesta.ok) {
      throw new Error(`PokeAPI respondio con ${respuesta.status}`);
    }
    return respuesta.json();
  })
  .then(async ({ results: resultados }) => {
    // Aqui se obtienen los detalles de cada Pokemon.
  });
```

La primera respuesta de PokeAPI contiene nombres y URLs, por ejemplo:

```json
{
  "name": "bulbasaur",
  "url": "https://pokeapi.co/api/v2/pokemon/1/"
}
```

Por eso Express hace otra peticion para obtener los detalles:

```js
const pokemones = await Promise.all(
  resultados.map(async ({ url }) => {
    const respuesta = await fetch(url);
    const datos = await respuesta.json();

    return {
      id: datos.id,
      nombre: datos.name,
      altura: datos.height,
      peso: datos.weight,
      tipos: datos.types.map(({ type }) => type.name),
      habilidades: datos.abilities.map(({ ability }) => ability.name),
      imagen: datos.sprites.other['official-artwork'].front_default
    };
  })
);
```

Aqui traducimos los nombres recibidos de PokeAPI a nombres mas faciles para nuestro proyecto:

- `name` se convierte en `nombre`.
- `types` se convierte en `tipos`.
- `image` se convierte en `imagen`.
- `abilities` se convierte en `habilidades`.

## 6. Por que se usa una cache?

La cache guarda los datos despues de la primera consulta. Asi no hacemos las mismas peticiones cada vez que el usuario cambia un filtro:

```js
let cachePokemon = null;

async function obtenerPrimeraGeneracion() {
  if (cachePokemon) return cachePokemon;

  // Aqui se consulta PokeAPI por primera vez.
  // ...

  cachePokemon = pokemones.sort(
    (primero, segundo) => primero.id - segundo.id
  );
  return cachePokemon;
}
```

La primera carga puede tardar un poco. Las siguientes usan los datos guardados en memoria.

## 7. Donde esta el filtro de Express?

El filtro esta en `server.js`, dentro de la ruta `GET /api/pokemon`, justo despues de obtener los datos de PokeAPI.

Primero Express lee los filtros enviados por el navegador:

```js
const busqueda = normalizar(solicitud.query.busqueda);
const tipo = normalizar(solicitud.query.tipo);
const numero = Number.parseInt(solicitud.query.numero, 10);
```

Despues aplica el filtro principal:

```js
// Este es el filtro principal de Express.
const pokemonesFiltrados = pokemones.filter((pokemon) => {
  const coincideBusqueda =
    !busqueda ||
    normalizar(pokemon.nombre).includes(busqueda) ||
    String(pokemon.id).includes(busqueda);

  const coincideTipo =
    !tipo || pokemon.tipos.some(
      (tipoPokemon) => normalizar(tipoPokemon) === tipo
    );

  const coincideNumero =
    !Number.isNaN(numero) ? pokemon.id === numero : true;

  return coincideBusqueda && coincideTipo && coincideNumero;
});
```

Explicado de forma sencilla:

- Si no hay busqueda, todos los Pokemon pasan.
- Si hay busqueda, coincide el nombre o el numero.
- Si hay tipo, el Pokemon debe tener ese tipo.
- Si hay numero, debe coincidir exactamente.
- Si se usan varios filtros, todos deben cumplirse.

La funcion `normalizar` ayuda a comparar el texto:

```js
function normalizar(valor = '') {
  return valor
    .toLocaleLowerCase('es')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}
```

## 8. Como devuelve los datos Express?

Despues del filtro, Express responde con JSON:

```js
respuesta.json({
  generacion: 1,
  total: pokemones.length,
  cantidad: pokemonesFiltrados.length,
  resultados: pokemonesFiltrados
});
```

Una respuesta se ve asi:

```json
{
  "generacion": 1,
  "total": 151,
  "cantidad": 12,
  "resultados": []
}
```

- `generacion`: generacion utilizada.
- `total`: total disponible antes del filtro.
- `cantidad`: cantidad despues del filtro.
- `resultados`: Pokemon que cumplen las condiciones.

## 9. Como pide datos el navegador?

En `public/app.js`, el navegador lee los controles:

```js
const parametros = new URLSearchParams();

if (campoBusqueda.value.trim()) {
  parametros.set('busqueda', campoBusqueda.value.trim());
}

if (filtroTipo.value) {
  parametros.set('tipo', filtroTipo.value);
}
```

Luego llama a la API de Express:

```js
const respuesta = await fetch(`/api/pokemon?${parametros}`);
const datos = await respuesta.json();
mostrarPokemones(datos.resultados);
```

El navegador no consulta directamente PokeAPI. Consulta a Express y Express se encarga de obtener y filtrar la informacion.

## 10. Como se muestran los tipos en espanol?

PokeAPI envia los tipos con nombres internos en ingles, por ejemplo `fire`. No los cambiamos en el servidor porque esos valores sirven para filtrar y elegir colores. En el navegador usamos un diccionario para mostrar el texto traducido:

```js
const nombresTipos = {
  fire: 'Fuego',
  water: 'Agua',
  grass: 'Planta',
  electric: 'Electrico'
};
```

La tarjeta conserva `fire` para la logica, pero muestra `Fuego` al usuario:

```js
nombresTipos[tipo] || tipo
```

## 11. Como se muestran y encajan las imagenes?

### Paso 1: Express obtiene la URL

En `server.js`, la imagen se toma de la ilustracion oficial de PokeAPI:

```js
imagen: datos.sprites.other['official-artwork'].front_default
  || datos.sprites.front_default
```

El resultado queda guardado en `pokemon.imagen`.

### Paso 2: JavaScript crea la etiqueta HTML

En `public/app.js`, esa URL se coloca en `src`:

```js
<img
  class="imagen-pokemon"
  src="${pokemon.imagen}"
  alt="${formatearNombre(pokemon.nombre)}"
  loading="lazy"
/>
```

### Paso 3: CSS reserva el espacio

En `public/styles.css`, todas las imágenes tienen el mismo cuadro:

```css
.imagen-pokemon {
  display: block;
  width: 145px;
  height: 145px;
  object-fit: contain;
}
```

`width` y `height` hacen que todas ocupen el mismo espacio. `object-fit: contain` mantiene la proporcion original y evita que el Pokemon se deforme. El margen automatico lo centra dentro de la tarjeta.

Al pasar el cursor, la imagen sube y crece un poco:

```css
.tarjeta-pokemon:hover .imagen-pokemon {
  transform: translateY(-7px) scale(1.05);
}
```

## 12. Como aparecen las tarjetas?

La funcion `mostrarPokemones` recorre la respuesta y crea HTML:

```js
elementos.cuadricula.innerHTML = pokemones.map((pokemon) => `
  <article class="tarjeta-pokemon">
    <span>N.º ${pokemon.id}</span>
    <img src="${pokemon.imagen}" alt="${pokemon.nombre}" />
    <h3>${pokemon.nombre}</h3>
    <div>${pokemon.tipos.join(', ')}</div>
  </article>
`).join('');
```

Cada objeto termina dentro de este elemento de `index.html`:

```html
<section id="cuadricula-pokemon"></section>
```

## 13. Como se cargan los audios?

PokeAPI incluye el sonido de cada Pokemon en `cries.latest`. Express guarda esa URL en el campo `audio`:

```js
audio: datos.cries?.latest || datos.cries?.legacy || null
```

Se usa `latest` primero y `legacy` como respaldo. Si no existe ninguno, el valor queda en `null`.

Cuando Express filtra los Pokemon, el campo `audio` viaja dentro de cada elemento de `resultados`. El navegador recibe esos datos y crea un reproductor:

```js
${pokemon.audio ? `<audio
  class="audio-pokemon"
  controls
  preload="none"
  src="${pokemon.audio}">
</audio>` : ''}
```

- `controls` muestra los botones de reproducir y pausar.
- `preload="none"` evita descargar todos los sonidos antes de usarlos.
- El audio aparece dentro de cada tarjeta filtrada.

El tamaño del reproductor se ajusta con CSS:

```css
.audio-pokemon {
  width: 100%;
  height: 30px;
  margin-top: 14px;
}
```

El flujo completo es:

```text
PokeAPI entrega cries.latest
  |
  v
Express lo guarda como pokemon.audio
  |
  v
Express filtra y devuelve resultados
  |
  v
app.js crea <audio controls>
  |
  v
El usuario reproduce el sonido
```

## 14. Que ocurre al escribir en el buscador?

El evento `input` detecta cada cambio y espera 250 milisegundos antes de pedir datos otra vez:

```js
campoBusqueda.addEventListener('input', () => {
  clearTimeout(temporizadorBusqueda);
  temporizadorBusqueda = setTimeout(cargarPokemones, 250);
});
```

El selector de tipos funciona asi:

```js
filtroTipo.addEventListener('change', cargarPokemones);
```

## 15. Rutas disponibles

| Ruta | Que hace |
| --- | --- |
| `GET /` | Abre la interfaz de la Pockedex. |
| `GET /api/pokemon` | Devuelve los 151 Pokemon. |
| `GET /api/pokemon?busqueda=char` | Busca por nombre o numero. |
| `GET /api/pokemon?tipo=fire` | Filtra por tipo fuego. |
| `GET /api/pokemon?numero=25` | Busca el Pokemon numero 25. |
| `GET /api/health` | Comprueba que el servidor esta activo. |

Puedes probar un filtro en el navegador:

```text
http://localhost:3000/api/pokemon?tipo=fire
```

## 16. Resumen en una frase

La Pockedex pide los primeros 151 Pokemon a PokeAPI, Express convierte y filtra los datos, y el JavaScript del navegador transforma la respuesta en tarjetas.

## 17. Detalle al hacer clic e identificador por ID

Cada tarjeta se puede pulsar. Al hacer clic, el frontend toma su ID y consulta esta ruta:

```js
fetch(`/api/pokemon/${id}`)
  .then((respuesta) => respuesta.json())
  .then(mostrarDetalle);
```

Express busca ese ID dentro de los 151 Pokemon:

```js
aplicacion.get('/api/pokemon/:id', async (solicitud, respuesta) => {
  const id = Number.parseInt(solicitud.params.id, 10);
  const pokemon = (await obtenerPrimeraGeneracion())
    .find((entrada) => entrada.id === id);

  respuesta.json(pokemon);
});
```

El panel de detalle muestra:

- Numero del Pokemon.
- Nombre.
- Imagen oficial.
- Tipos.
- Altura y peso.
- Audio.

La seccion **Identificador Pokedex** funciona como una IA sencilla de reconocimiento por ID. El usuario escribe un numero del 1 al 151 y la aplicacion responde cual Pokemon es:

```js
const respuesta = await fetch(`/api/pokemon/${id}`);
const pokemon = await respuesta.json();

resultadoIdentificador.innerHTML = `
  <img src="${pokemon.imagen}" alt="${pokemon.nombre}" />
  <strong>${pokemon.nombre}</strong>
`;
```

No es un modelo de inteligencia artificial que adivina una imagen. Es un identificador inteligente: recibe un ID, busca el registro correcto en PokéAPI y muestra sus datos reales.
