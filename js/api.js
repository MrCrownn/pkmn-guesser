const pokemonCache = new Map();
const CACHE_VERSION = 'poke_cache_v4'; // Nueva versión para asegurar limpieza de datos previos

// --- GESTIÓN DE ALMACENAMIENTO ---
try {
    const savedCache = localStorage.getItem(CACHE_VERSION);
    if (savedCache) {
        const parsed = JSON.parse(savedCache);
        parsed.forEach(p => pokemonCache.set(p.cacheKey, p.data));
        console.log("⚡ Caché restaurado:", pokemonCache.size, "Pokémon listos.");
    }
} catch (e) {
    console.warn("Caché local no disponible o corrupto.");
    localStorage.removeItem(CACHE_VERSION);
}

function saveCacheToLocal() {
    try {
        const cacheArray = Array.from(pokemonCache.entries()).map(([k, v]) => ({
            cacheKey: k,
            data: v
        }));
        const serialized = JSON.stringify(cacheArray);
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
            const timeoutId = setTimeout(() => controller.abort(), 10000); // Aumentado a 10s
            
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
 * Obtiene detalles manejando variantes regionales.
 */
async function getPokemonDetails(speciesUrl, region, pokedexName) {
    // Si la región es "kanto" o similar a las originales, no buscamos variante regional
    // para evitar falsos positivos y acelerar la carga.
    const isStandardRegion = ['kanto', 'johto', 'hoenn', 'sinnoh', 'unova', 'kalos'].includes(region);
    const searchRegion = isStandardRegion ? null : region;
    
    const cacheKey = `${speciesUrl}-${searchRegion || 'default'}`;
    
    if (pokemonCache.has(cacheKey)) {
        const details = pokemonCache.get(cacheKey);
        if (pokedexName && !details.pokedexes.some(p => p.name === pokedexName)) {
            details.pokedexes.push({ name: pokedexName, entry_number: 0 });
        }
        return details;
    }

    try {
        const speciesData = await fetchWithRetry(speciesUrl);
        if (!speciesData) return null;

        let varietyUrl = null;
        
        // Solo buscamos variantes regionales en regiones que las tengan (Alola, Galar, Hisui, Paldea)
        if (searchRegion) {
            const rLower = searchRegion.toLowerCase();
            const regionalVariety = speciesData.varieties.find(v => {
                const vName = v.pokemon.name.toLowerCase();
                return vName.includes(`-${rLower}`) || vName.includes(`${rLower}-`);
            });
            if (regionalVariety) varietyUrl = regionalVariety.pokemon.url;
        }
        
        // Fallback a la forma por defecto
        if (!varietyUrl) {
            const defaultVariety = speciesData.varieties.find(v => v.is_default);
            varietyUrl = defaultVariety ? defaultVariety.pokemon.url : null;
        }
        
        if (!varietyUrl) return null;

        const pokemonData = await fetchWithRetry(varietyUrl);
        if (!pokemonData) return null;

        const details = {
            id: pokemonData.id,
            name: pokemonData.name,
            types: pokemonData.types.map(t => t.type.name),
            image: pokemonData.sprites.other?.['official-artwork']?.front_default || 
                   pokemonData.sprites.other?.home?.front_default ||
                   pokemonData.sprites.front_default || "",
            pokedexes: [{ name: pokedexName, entry_number: 0 }] 
        };

        pokemonCache.set(cacheKey, details);
        return details;
    } catch (error) {
        console.error("Error cargando Pokémon:", speciesUrl, error.message);
        return null;
    }
}

/**
 * Carga masiva de Pokémon de las regiones seleccionadas.
 */
export async function loadAllPokemon(pokedexNames, onProgress, onComplete) {
    const allPokemonMap = new Map();
    const totalPokedexes = pokedexNames.length;

    for (let i = 0; i < totalPokedexes; i++) {
        const pokedexName = pokedexNames[i];
        onProgress(pokedexName, i + 1, totalPokedexes);

        try {
            const pokedexData = await fetchWithRetry(`https://pokeapi.co/api/v2/pokedex/${pokedexName}`);
            if (!pokedexData) continue;

            const entries = pokedexData.pokemon_entries;
            const batchSize = 12; // Lote más pequeño para mayor estabilidad
            
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
                    if (p) {
                        // Consolidación: si ya existe el ID, nos aseguramos de que herede las pokedexes
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
                    }
                });
            }
        } catch (error) {
            console.error(`Error en Pokédex ${pokedexName}:`, error);
        }
    }

    saveCacheToLocal();
    onComplete(Array.from(allPokemonMap.values()));
}