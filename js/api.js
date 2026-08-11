const pokemonCache = new Map();
const speciesCache = new Map();
const CACHE_VERSION = 'poke_cache_v6'; // v6: base de datos completa en una sola descarga

let fullDatabase = null;
let isComplete = false;

// --- GESTIÓN DE ALMACENAMIENTO ---
try {
    const savedCache = localStorage.getItem(CACHE_VERSION);
    if (savedCache) {
        const parsed = JSON.parse(savedCache);
        if (parsed && Array.isArray(parsed.list) && parsed.list.length > 0) {
            fullDatabase = parsed.list;
            isComplete = parsed.complete === true;
            console.log("⚡ Caché restaurado:", fullDatabase.length, "Pokémon listos.");
        }
    }
} catch (e) {
    console.warn("Caché local no disponible o corrupto.");
    localStorage.removeItem(CACHE_VERSION);
}

function saveCacheToLocal(complete) {
    try {
        if (!fullDatabase) return;
        const serialized = JSON.stringify({ version: 1, complete, list: fullDatabase });
        // Límite de seguridad para LocalStorage (habitualmente 5MB)
        if (serialized.length < 4800000) {
            localStorage.setItem(CACHE_VERSION, serialized);
        }
    } catch (e) {
        console.error("Error al persistir caché:", e.name);
    }
}

// --- UTILIDADES DE RED CON REINTENTOS ---
async function fetchWithRetry(url, retries = 3, delay = 1000) {
    for (let i = 0; i < retries; i++) {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 10000);

            const response = await fetch(url, { signal: controller.signal });
            clearTimeout(timeoutId);

            if (!response.ok) throw new Error(`Status ${response.status}`);
            return await response.json();
        } catch (error) {
            if (i === retries - 1) throw error;
            await new Promise(resolve => setTimeout(resolve, delay * (i + 1)));
        }
    }
}

/**
 * Obtiene detalles manejando variantes regionales (solo usado como FALLBACK a PokeAPI).
 * Regiones estándar: la variedad por defecto comparte ID con la especie, así que se
 * construye la URL de pokemon directamente y se evita el fetch de species.
 * Caché por URL de pokemon: las Pokédex solapadas comparten la misma descarga.
 */
async function getPokemonDetails(speciesUrl, region, pokedexName) {
    const isStandardRegion = ['kanto', 'johto', 'hoenn', 'sinnoh', 'unova', 'kalos'].includes(region);
    const speciesId = speciesUrl.split('/').filter(Boolean).pop();

    let varietyUrl;

    if (isStandardRegion) {
        varietyUrl = `https://pokeapi.co/api/v2/pokemon/${speciesId}`;
    } else {
        if (!speciesCache.has(speciesUrl)) {
            const speciesData = await fetchWithRetry(speciesUrl);
            if (!speciesData) return null;
            speciesCache.set(speciesUrl, speciesData.varieties || []);
        }

        const varieties = speciesCache.get(speciesUrl);
        const rLower = region.toLowerCase();
        const regionalVariety = varieties.find(v => {
            const vName = v.pokemon.name.toLowerCase();
            return vName.includes(`-${rLower}`) || vName.includes(`${rLower}-`);
        });
        varietyUrl = (regionalVariety && regionalVariety.pokemon.url) || `https://pokeapi.co/api/v2/pokemon/${speciesId}`;
    }

    let details = pokemonCache.get(varietyUrl);
    if (!details) {
        const pokemonData = await fetchWithRetry(varietyUrl);
        if (!pokemonData) return null;

        details = {
            id: pokemonData.id,
            name: pokemonData.name,
            types: pokemonData.types.map(t => t.type.name),
            image: pokemonData.sprites.other?.['official-artwork']?.front_default || 
                   pokemonData.sprites.other?.home?.front_default ||
                   pokemonData.sprites.front_default || "",
            pokedexes: []
        };

        pokemonCache.set(varietyUrl, details);
    }

    if (pokedexName && !details.pokedexes.some(p => p.name === pokedexName)) {
        details.pokedexes.push({ name: pokedexName, entry_number: 0 });
    }
    return details;
}

/**
 * FALLBACK: carga desde PokeAPI solo las regiones seleccionadas.
 */
async function loadAllPokemonFromPokeAPI(pokedexNames, onProgress) {
    const allPokemonMap = new Map();
    const totalPokedexes = pokedexNames.length;

    for (let i = 0; i < totalPokedexes; i++) {
        const pokedexName = pokedexNames[i];
        if (onProgress) onProgress(pokedexName, i + 1, totalPokedexes);

        try {
            const pokedexData = await fetchWithRetry(`https://pokeapi.co/api/v2/pokedex/${pokedexName}`);
            if (!pokedexData) continue;

            const entries = pokedexData.pokemon_entries;
            const batchSize = 12;

            for (let j = 0; j < entries.length; j += batchSize) {
                const batch = entries.slice(j, j + batchSize);

                const pokemonPromises = batch.map(entry => {
                    let region = '';
                    const pName = pokedexName.toLowerCase();

                    if (pName.includes('alola')) region = 'alola';
                    else if (pName.includes('galar') || pName.includes('armor') || pName.includes('tundra')) region = 'galar';
                    else if (pName.includes('hisui')) region = 'hisui';
                    else if (pName.includes('paldea')) region = 'paldea';
                    else if (pName === 'kanto') region = 'kanto';
                    else if (pName.includes('johto')) region = 'johto';
                    else if (pName.includes('hoenn')) region = 'hoenn';
                    else if (pName.includes('sinnoh')) region = 'sinnoh';
                    else if (pName.includes('unova')) region = 'unova';
                    else if (pName.includes('kalos')) region = 'kalos';
                    else region = pokedexName.split('-')[0];

                    return getPokemonDetails(entry.pokemon_species.url, region, pokedexName);
                });

                const results = await Promise.all(pokemonPromises);
                results.forEach(p => {
                    if (!p) return;
                    if (allPokemonMap.has(p.id)) {
                        const existing = allPokemonMap.get(p.id);
                        p.pokedexes.forEach(px => {
                            if (!existing.pokedexes.some(epx => epx.name === px.name)) {
                                existing.pokedexes.push(px);
                            }
                        });
                    } else {
                        allPokemonMap.set(p.id, p);
                    }
                });
            }
        } catch (error) {
            console.error(`Error en Pokédex ${pokedexName}:`, error);
        }
    }

    return Array.from(allPokemonMap.values());
}

/**
 * Descarga la base completa desde data/pokemon-db.json (UNA sola petición).
 */
async function fetchFullDatabase() {
    const response = await fetch('data/pokemon-db.json');
    if (!response.ok) throw new Error(`Status ${response.status}`);
    const data = await response.json();
    if (!data || !Array.isArray(data.pokemon) || data.pokemon.length === 0) {
        throw new Error('JSON inválido');
    }
    return data.pokemon;
}

/**
 * Carga la base de Pokémon de las regiones seleccionadas.
 * Orden: caché local (instantáneo) → data/pokemon-db.json (1 descarga) → PokeAPI (fallback).
 */
export async function loadAllPokemon(pokedexNames, onProgress, onComplete) {
    if (!fullDatabase) {
        try {
            if (onProgress) onProgress('base de datos', 1, 1);
            fullDatabase = await fetchFullDatabase();
            isComplete = true;
            saveCacheToLocal(true);
        } catch (error) {
            console.warn("No se pudo cargar pokemon-db.json, usando PokeAPI:", error.message);
            fullDatabase = await loadAllPokemonFromPokeAPI(pokedexNames, onProgress);
            isComplete = false;
            saveCacheToLocal(false);
        }
    } else if (!isComplete) {
        try {
            if (onProgress) onProgress('base de datos', 1, 1);
            fullDatabase = await fetchFullDatabase();
            isComplete = true;
            saveCacheToLocal(true);
        } catch (e) {
            console.warn("No se pudo mejorar la caché a la base completa:", e.message);
        }
    }

    onComplete(fullDatabase);
}
