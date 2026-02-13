const pokemonCache = new Map();

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

const regionToVarietyMap = {
    hisui: 'hisuian',
};

async function getPokemonDetails(speciesUrl, region, pokedexName) {
    const cacheKey = `${speciesUrl}-${region}`;
    let details;

    if (pokemonCache.has(cacheKey)) {
        details = pokemonCache.get(cacheKey);
    } else {
        const speciesData = await fetchFromApi(speciesUrl);
        if (!speciesData) return null;

        let varietyUrl;
        const defaultVariety = speciesData.varieties.find(v => v.is_default);
        if (region) {
            const varietyRegion = regionToVarietyMap[region] || region;
            const regionalVariety = speciesData.varieties.find(v => v.pokemon.name.endsWith(`-${varietyRegion}`));
            if (regionalVariety) {
                varietyUrl = regionalVariety.pokemon.url;
            }
        }
        if (!varietyUrl && defaultVariety) {
            varietyUrl = defaultVariety.pokemon.url;
        }
        if (!varietyUrl) return null;

        const pokemonData = await fetchFromApi(varietyUrl);
        if (!pokemonData) return null;

       
        details = {
            id: pokemonData.id,
            name: pokemonData.name,
            types: pokemonData.types.map(t => t.type.name),
            // CORRECCIÓN: Añadido || "" al final para evitar 'undefined' que rompe Firebase
            image: pokemonData.sprites.other?.['official-artwork']?.front_default || pokemonData.sprites.front_default || "",
            pokedexes: [] 
        };
        pokemonCache.set(cacheKey, details);
    }

   
    if (pokedexName && !details.pokedexes.some(p => p.name === pokedexName)) {
        details.pokedexes.push({ name: pokedexName, entry_number: 0 });
    }

    return details;
}

export async function loadAllPokemon(pokedexNames, onProgress, onComplete) {
    pokemonCache.clear();
    let allPokemon = [];

    for (let i = 0; i < pokedexNames.length; i++) {
        const pokedexName = pokedexNames[i];
        onProgress(pokedexName, i + 1, pokedexNames.length);

        const pokedexData = await fetchFromApi(`https://pokeapi.co/api/v2/pokedex/${pokedexName}`);
        if (!pokedexData) continue;

        const pokemonPromises = pokedexData.pokemon_entries.map(entry => {
            const region = pokedexName.replace('updated-', '').replace('original-', '').replace('-central', '');
            return getPokemonDetails(entry.pokemon_species.url, region, pokedexName);
        });

        const pokemonInPokedex = await Promise.all(pokemonPromises);
        allPokemon.push(...pokemonInPokedex.filter(p => p !== null));
    }

    
    const finalPokemonList = Array.from(pokemonCache.values());

    onComplete(finalPokemonList);
}