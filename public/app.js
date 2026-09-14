const elementos = {
    cuadricula: document.querySelector('#cuadricula-pokemon'),
    campoBusqueda: document.querySelector('#entrada-busqueda'),
    filtroTipo: document.querySelector('#filtro-tipo'),
    botonLimpiar: document.querySelector('#boton-limpiar'),
    cantidadResultados: document.querySelector('#cantidad-resultados'),
    tituloResultados: document.querySelector('#titulo-resultados'),
    estadoVacio: document.querySelector('#estado-vacio'),
    formularioIdentificador: document.querySelector('#formulario-identificador'),
    entradaId: document.querySelector('#entrada-id'),
    resultadoIdentificador: document.querySelector('#resultado-identificador'),
    ventanaDetalle: document.querySelector('#ventana-detalle'),
    detalleNumero: document.querySelector('#detalle-numero'),
    detalleImagen: document.querySelector('#detalle-imagen'),
    detalleTipos: document.querySelector('#detalle-tipos'),
    detalleNombre: document.querySelector('#detalle-nombre'),
    detalleAltura: document.querySelector('#detalle-altura'),
    detallePeso: document.querySelector('#detalle-peso'),
    detalleAudio: document.querySelector('#detalle-audio'),
    botonCerrarDetalle: document.querySelector('.cerrar-detalle'),
    fondoVentana: document.querySelector('.fondo-ventana')
};

const coloresTipos = {
    normal: '#9c9c82', fire: '#ec6a3c', water: '#4f90db', electric: '#d9af20', grass: '#63a953', ice: '#77c8c8',
    fighting: '#bd4c43', poison: '#9951a0', ground: '#b68b4a', flying: '#8297dc', psychic: '#db5c83', bug: '#8fa52e',
    rock: '#9f8a59', ghost: '#705a88', dragon: '#6552b3'
};

const nombresTipos = {
    normal: 'Normal', fire: 'Fuego', water: 'Agua', electric: 'Eléctrico', grass: 'Planta', ice: 'Hielo',
    fighting: 'Lucha', poison: 'Veneno', ground: 'Tierra', flying: 'Volador', psychic: 'Psíquico', bug: 'Bicho',
    rock: 'Roca', ghost: 'Fantasma', dragon: 'Dragón'
};

let temporizadorBusqueda;

function formatearNombre(nombre) {
    return nombre.charAt(0).toUpperCase() + nombre.slice(1);
}

function crearTipos(tipos) {
    return tipos.map((tipo) => `
        <span class="tipo-pokemon" style="--color-tipo: ${coloresTipos[tipo] || '#76837a'}">
            ${nombresTipos[tipo] || tipo}
        </span>
    `).join('');
}

function crearTarjetaPokemon(pokemon, indice) {
    const audio = pokemon.audio
        ? `<audio class="audio-pokemon" controls preload="none" aria-label="Sonido de ${formatearNombre(pokemon.nombre)}" src="${pokemon.audio}"></audio>`
        : '';

    return `
        <article class="tarjeta-pokemon" data-id="${pokemon.id}" style="--acento: ${coloresTipos[pokemon.tipos[0]] || '#93c5db'}; animation-delay: ${Math.min(indice, 12) * 25}ms">
            <span class="numero-pokemon">N.º ${String(pokemon.id).padStart(3, '0')}</span>
            <img class="imagen-pokemon" src="${pokemon.imagen}" alt="${formatearNombre(pokemon.nombre)}" loading="lazy" />
            <h3 class="nombre-pokemon">${formatearNombre(pokemon.nombre)}</h3>
            <div class="tipos-pokemon">${crearTipos(pokemon.tipos)}</div>
            ${audio}
        </article>
    `;
}

function mostrarPokemones(pokemones) {
    elementos.cuadricula.innerHTML = pokemones
        .map((pokemon, indice) => crearTarjetaPokemon(pokemon, indice))
        .join('');
}

function mostrarDetalle(pokemon) {
    elementos.detalleNumero.textContent = `N.º ${String(pokemon.id).padStart(3, '0')}`;
    elementos.detalleImagen.src = pokemon.imagen;
    elementos.detalleImagen.alt = formatearNombre(pokemon.nombre);
    elementos.detalleTipos.innerHTML = crearTipos(pokemon.tipos);
    elementos.detalleNombre.textContent = formatearNombre(pokemon.nombre);
    elementos.detalleAltura.textContent = `${(pokemon.altura / 10).toFixed(1)} m`;
    elementos.detallePeso.textContent = `${(pokemon.peso / 10).toFixed(1)} kg`;
    elementos.detalleAudio.hidden = !pokemon.audio;
    elementos.detalleAudio.src = pokemon.audio || '';
    elementos.ventanaDetalle.hidden = false;
}

function cerrarDetalle(evento) {
    evento?.preventDefault();
    evento?.stopPropagation();
    elementos.ventanaDetalle.hidden = true;
    elementos.detalleAudio.pause();
    elementos.detalleAudio.currentTime = 0;
}

async function consultarPokemon(id) {
    const respuesta = await fetch(`/api/pokemon/${id}`);
    if (!respuesta.ok) throw new Error('No se pudo cargar la información del Pokémon.');
    return respuesta.json();
}

async function abrirDetalle(id) {
    try {
        mostrarDetalle(await consultarPokemon(id));
    } catch (error) {
        mostrarError(error.message);
    }
}

async function identificarPokemon(evento) {
    evento.preventDefault();
    const id = Number.parseInt(elementos.entradaId.value, 10);

    if (!id || id < 1 || id > 151) {
        elementos.resultadoIdentificador.hidden = false;
        elementos.resultadoIdentificador.textContent = 'Escribe un ID entre 1 y 151.';
        return;
    }

    elementos.resultadoIdentificador.hidden = false;
    elementos.resultadoIdentificador.textContent = 'Buscando...';

    try {
        const pokemon = await consultarPokemon(id);
        elementos.resultadoIdentificador.innerHTML = `
            <img src="${pokemon.imagen}" alt="${formatearNombre(pokemon.nombre)}" />
            <div>
                <span>N.º ${String(pokemon.id).padStart(3, '0')}</span>
                <strong>${formatearNombre(pokemon.nombre)}</strong>
            </div>
        `;
    } catch (error) {
        elementos.resultadoIdentificador.textContent = error.message;
    }
}

function mostrarError(mensaje) {
    elementos.cuadricula.innerHTML = '';
    elementos.cantidadResultados.textContent = 'Error de conexión';
    elementos.estadoVacio.textContent = mensaje;
    elementos.estadoVacio.hidden = false;
}

async function cargarPokemones() {
    const parametros = new URLSearchParams();
    const busqueda = elementos.campoBusqueda.value.trim();
    const tipo = elementos.filtroTipo.value;

    if (busqueda) parametros.set('busqueda', busqueda);
    if (tipo) parametros.set('tipo', tipo);

    elementos.cantidadResultados.textContent = 'Consultando archivo...';

    try {
        const respuesta = await fetch(`/api/pokemon?${parametros}`);
        if (!respuesta.ok) throw new Error('No se pudo cargar el archivo.');

        const datos = await respuesta.json();
        mostrarPokemones(datos.resultados);
        elementos.cantidadResultados.textContent = `${datos.cantidad} de ${datos.total} especies`;
        elementos.tituloResultados.textContent = datos.cantidad === datos.total
            ? 'Exploradores de la región'
            : 'Resultados de búsqueda';
        elementos.estadoVacio.hidden = datos.resultados.length > 0;
    } catch (error) {
        mostrarError(error.message);
    }
}

function limpiarFiltros() {
    elementos.campoBusqueda.value = '';
    elementos.filtroTipo.value = '';
    cargarPokemones();
}

function configurarEventos() {
    elementos.campoBusqueda.addEventListener('input', () => {
        clearTimeout(temporizadorBusqueda);
        temporizadorBusqueda = setTimeout(cargarPokemones, 250);
    });

    elementos.filtroTipo.addEventListener('change', cargarPokemones);
    elementos.botonLimpiar.addEventListener('click', limpiarFiltros);
    elementos.formularioIdentificador.addEventListener('submit', identificarPokemon);
    elementos.botonCerrarDetalle.addEventListener('click', cerrarDetalle);
    elementos.fondoVentana.addEventListener('click', cerrarDetalle);

    elementos.cuadricula.addEventListener('click', (evento) => {
        if (evento.target.closest('audio')) return;

        const tarjeta = evento.target.closest('.tarjeta-pokemon');
        if (tarjeta) abrirDetalle(tarjeta.dataset.id);
    });

    document.addEventListener('keydown', (evento) => {
        if (evento.key === 'Escape') cerrarDetalle();
    });
}

configurarEventos();
cargarPokemones();
