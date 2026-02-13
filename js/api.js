const pokemonCache = new Map();

// --- OPTIMIZACIÓN: Cargar caché desde LocalStorage al iniciar ---
// Usamos una versión de caché para forzar la actualización si hay cambios estructurales
const CACHE_VERSION = 'poke_cache_v2'; 

try {
    const savedCache = localStorage.getItem(CACHE_VERSION);
    if (savedCache) {
        const parsed = JSON.parse(savedCache);
        parsed.forEach(p => pokemonCache.set(p.cacheKey, p.data));
        console.log("⚡ Caché restaurado:", pokemonCache.size, "Pokémon listos.");
    }
} catch (e) {
    console.warn("No se pudo cargar caché local", e);
}

function saveCacheToLocal() {
    try {
        const cacheArray = Array.from(pokemonCache.entries()).map(([k, v]) => ({
            cacheKey: k,
            data: v
        }));
        localStorage.setItem(CACHE_VERSION, JSON.stringify(cacheArray));
    } catch (e) {
        console.warn("LocalStorage lleno o error al guardar:", e);
    }
}

async function fetchFromApi(url) {
    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return await response.json();
    } catch (error) {
        console.error(`Error fetching from ${url}:`, error);
        return null;
    }
}

/**
 * Obtiene los detalles de un Pokémon manejando variantes regionales (Hisui, Alola, etc.)
 */
async function getPokemonDetails(speciesUrl, region, pokedexName) {
    // Clave de caché única por especie y región para evitar que Arcanine-Kanto sobrescriba a Arcanine-Hisui
    const cacheKey = `${speciesUrl}-${region || 'default'}`;
    let details;

    if (pokemonCache.has(cacheKey)) {
        details = pokemonCache.get(cacheKey);
    } else {
        const speciesData = await fetchFromApi(speciesUrl);
        if (!speciesData) return null;

        let varietyUrl = null;
        
        if (region) {
            const rLower = region.toLowerCase();
            // Buscamos una variedad que coincida con la región (ej. -hisui, -alola, -galar)
            // PokeAPI es consistente con estos sufijos para formas regionales.
            const regionalVariety = speciesData.varieties.find(v => {
                const vName = v.pokemon.name.toLowerCase();
                return vName.includes(`-${rLower}`) || vName.includes(`${rLower}-`);
            });
            
            if (regionalVariety) {
                varietyUrl = regionalVariety.pokemon.url;
            }
        }
        
        // Si no hay variante regional para este Pokémon en esta pokedex, usamos la versión por defecto
        if (!varietyUrl) {
            const defaultVariety = speciesData.varieties.find(v => v.is_default);
            varietyUrl = defaultVariety ? defaultVariety.pokemon.url : null;
        }
        
        if (!varietyUrl) return null;

        const pokemonData = await fetchFromApi(varietyUrl);
        if (!pokemonData) return null;

        details = {
            id: pokemonData.id,
            name: pokemonData.name,
            types: pokemonData.types.map(t => t.type.name),
            // Prioridad: Official Artwork -> Home -> Default Sprite
            image: pokemonData.sprites.other?.['official-artwork']?.front_default || 
                   pokemonData.sprites.other?.home?.front_default ||
                   pokemonData.sprites.front_default || "",
            pokedexes: [] 
        };
        pokemonCache.set(cacheKey, details);
    }

    // Registrar la pertenencia a la Pokédex actual para el filtrado en game.js
    if (pokedexName && !details.pokedexes.some(p => p.name === pokedexName)) {
        details.pokedexes.push({ name: pokedexName, entry_number: 0 });
    }

    return details;
}

/**
 * Carga todos los Pokémon de las Pokédex solicitadas.
 */
export async function loadAllPokemon(pokedexNames, onProgress, onComplete) {
    let allPokemon = [];
    let hasNewData = false;

    for (let i = 0; i < pokedexNames.length; i++) {
        const pokedexName = pokedexNames[i];
        onProgress(pokedexName, i + 1, pokedexNames.length);

        const pokedexData = await fetchFromApi(`https://pokeapi.co/api/v2/pokedex/${pokedexName}`);
        if (!pokedexData) continue;

        const entries = pokedexData.pokemon_entries;
        const batchSize = 35; // Ligeramente más grande para optimizar
        
        for (let j = 0; j < entries.length; j += batchSize) {
            const batch = entries.slice(j, j + batchSize);
            const pokemonPromises = batch.map(entry => {
                // Mapeo inteligente de región basado en el nombre técnico de la Pokédex
                let region = '';
                const pName = pokedexName.toLowerCase();
                
                if (pName.includes('alola')) region = 'alola';
                else if (pName.includes('galar') || pName.includes('armor') || pName.includes('tundra')) region = 'galar';
                else if (pName.includes('hisui')) region = 'hisui';
                else if (pName.includes('paldea')) region = 'paldea';
                else {
                    // Limpieza para regiones estándar (kanto, johto, etc.)
                    region = pokedexName.replace('updated-', '').replace('original-', '').replace('-central', '').split('-')[0];
                }
                
                return getPokemonDetails(entry.pokemon_species.url, region, pokedexName);
            });

            const batchResults = await Promise.all(pokemonPromises);
            const validResults = batchResults.filter(p => p !== null);
            allPokemon.push(...validResults);
        }
        hasNewData = true;
    }

    if (hasNewData) {
        saveCacheToLocal();
    }

    // Retornamos solo los Pokémon cargados en esta sesión para evitar inconsistencias con el caché global
    onComplete(allPokemon);
}