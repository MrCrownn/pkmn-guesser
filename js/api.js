const regionCache= new Map();


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
    const cacheKey= `${regionData.start}-${regionData.end}`;
    if (regionCache.has(cacheKey)) {
        console.log(`[Optimización] Cargando ${regionData.name} desde caché instantánea.`);
        callbackSuccess(regionCache.get(cacheKey));
        return;
    }

    try {

        const promises = [];
        for (let i = regionData.start; i <= regionData.end; i++) promises.push(fetchPokemon(i));
        const results = await Promise.all(promises);
        const list = results.filter(p => p);
        
        regionCache.set(cacheKey, list);
        callbackSuccess(list);
    } catch (e) {
        callbackError(e);
    }
}