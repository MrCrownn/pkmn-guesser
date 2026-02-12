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

async function getPokemonDetails(pokemonUrl) {
    if (pokemonCache.has(pokemonUrl)) {
        return pokemonCache.get(pokemonUrl);
    }

    const pokemonData = await fetchFromApi(pokemonUrl);
    if (!pokemonData) return null;

    const speciesData = await fetchFromApi(pokemonData.species.url);
    if (!speciesData) return null;
    
    const pokedexes = speciesData.pokedex_numbers.map(p => ({
        name: p.pokedex.name,
        entry_number: p.entry_number
    }));

    const details = {
        id: pokemonData.id,
        name: pokemonData.name,
        types: pokemonData.types.map(t => t.type.name),
        image: pokemonData.sprites.other?.['official-artwork']?.front_default || pokemonData.sprites.front_default,
        pokedexes: pokedexes
    };

    pokemonCache.set(pokemonUrl, details);
    return details;
}

export async function loadAllPokemon(pokedexNames, onProgress, onComplete) {
    pokemonCache.clear();
    let allPokemon = [];
    const fetchedUrls = new Set();

    for (let i = 0; i < pokedexNames.length; i++) {
        const pokedexName = pokedexNames[i];
        onProgress(pokedexName, i + 1, pokedexNames.length);

        const pokedexData = await fetchFromApi(`https://pokeapi.co/api/v2/pokedex/${pokedexName}`);
        if (!pokedexData) continue;

        const pokemonPromises = pokedexData.pokemon_entries.map(entry => {
            if (!fetchedUrls.has(entry.pokemon_species.url)) {
                fetchedUrls.add(entry.pokemon_species.url);
                return getPokemonDetails(entry.pokemon_species.url.replace('pokemon-species', 'pokemon'));
            }
            return Promise.resolve(null);
        });

        const pokemonInPokedex = await Promise.all(pokemonPromises);
        allPokemon.push(...pokemonInPokedex.filter(p => p !== null));
    }

    // Since a pokemon can be in multiple pokedexes, we need to merge the data
    const finalPokemonList = Array.from(pokemonCache.values());

    onComplete(finalPokemonList);
}
