export async function fetchPokemon(id) {
    try {
        const r = await fetch(`https://pokeapi.co/api/v2/pokemon/${id}`);
        const d = await r.json();
        return {
            id: d.id,
            name: d.name,
            types: d.types.map(t => t.type.name),
            image: d.sprites.other['official-artwork'].front_default
        };
    } catch { return null; }
}

export async function loadPokemonData(regionData, callbackSuccess, callbackError) {
    try {
        const promises = [];
        for (let i = regionData.start; i <= regionData.end; i++) promises.push(fetchPokemon(i));
        const results = await Promise.all(promises);
        const list = results.filter(p => p);
        callbackSuccess(list);
    } catch (e) {
        callbackError(e);
    }
}