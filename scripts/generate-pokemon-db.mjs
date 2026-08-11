/**
 * Genera data/pokemon-db.json con todos los Pokémon de las regiones soportadas.
 * Uso: node scripts/generate-pokemon-db.mjs
 *
 * Replica la lógica del cliente (variantes regionales, consolidación por ID)
 * para que el juego pueda descargar la base completa en UNA sola petición
 * en lugar de golpear PokeAPI con ~1700 requests.
 */

import { writeFile, mkdir, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ALL_POKEDEXES = [
    'kanto', 'original-johto', 'hoenn', 'original-sinnoh', 'original-unova',
    'kalos-central', 'updated-alola', 'galar', 'isle-of-armor', 'crown-tundra',
    'hisui', 'paldea'
];

async function fetchJson(url, retries = 4, delay = 1500) {
    for (let i = 0; i < retries; i++) {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 15000);
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

function detectRegion(pokedexName) {
    const pName = pokedexName.toLowerCase();
    if (pName.includes('alola')) return 'alola';
    if (pName.includes('galar') || pName.includes('armor') || pName.includes('tundra')) return 'galar';
    if (pName.includes('hisui')) return 'hisui';
    if (pName.includes('paldea')) return 'paldea';
    if (pName === 'kanto') return 'kanto';
    if (pName.includes('johto')) return 'johto';
    if (pName.includes('hoenn')) return 'hoenn';
    if (pName.includes('sinnoh')) return 'sinnoh';
    if (pName.includes('unova')) return 'unova';
    if (pName.includes('kalos')) return 'kalos';
    return pokedexName.split('-')[0];
}

const pokemonCache = new Map();
const speciesCache = new Map();

async function getPokemonDetails(speciesUrl, region, pokedexName) {
    const isStandardRegion = ['kanto', 'johto', 'hoenn', 'sinnoh', 'unova', 'kalos'].includes(region);
    const speciesId = speciesUrl.split('/').filter(Boolean).pop();

    let varietyUrl;

    if (isStandardRegion) {
        varietyUrl = `https://pokeapi.co/api/v2/pokemon/${speciesId}`;
    } else {
        if (!speciesCache.has(speciesUrl)) {
            try {
                const speciesData = await fetchJson(speciesUrl);
                speciesCache.set(speciesUrl, (speciesData && speciesData.varieties) || []);
            } catch (e) {
                console.warn(`    ✗ species ${speciesUrl} falló: ${e.message}`);
                return null;
            }
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
        let pokemonData;
        try {
            pokemonData = await fetchJson(varietyUrl);
        } catch (e) {
            console.warn(`    ✗ pokemon ${varietyUrl} falló: ${e.message}`);
            return null;
        }
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

function addPokemon(map, p) {
    if (map.has(p.id)) {
        const existing = map.get(p.id);
        p.pokedexes.forEach(px => {
            if (!existing.pokedexes.some(epx => epx.name === px.name)) {
                existing.pokedexes.push(px);
            }
        });
    } else {
        map.set(p.id, p);
    }
}

async function loadAll(pokedexNames) {
    const allPokemonMap = new Map();
    const failedEntries = [];

    for (const pokedexName of pokedexNames) {
        process.stdout.write(`  ${pokedexName}... `);
        let pokedexData;
        try {
            pokedexData = await fetchJson(`https://pokeapi.co/api/v2/pokedex/${pokedexName}`);
        } catch (e) {
            console.log(`✗ error: ${e.message}`);
            continue;
        }
        const entries = pokedexData.pokemon_entries;
        const region = detectRegion(pokedexName);

        for (let j = 0; j < entries.length; j += 20) {
            const batch = entries.slice(j, j + 20);
            const settled = await Promise.allSettled(batch.map(entry =>
                getPokemonDetails(entry.pokemon_species.url, region, pokedexName)
            ));

            settled.forEach((result, idx) => {
                if (result.status !== 'fulfilled' || !result.value) {
                    failedEntries.push({ speciesUrl: batch[idx].pokemon_species.url, region, pokedexName });
                    return;
                }
                addPokemon(allPokemonMap, result.value);
            });

            await new Promise(resolve => setTimeout(resolve, 200));
        }

        console.log(`${allPokemonMap.size} únicos`);
    }

    return { allPokemonMap, failedEntries };
}

console.log('Descargando Pokédex desde PokeAPI...');
const { allPokemonMap, failedEntries } = await loadAll(ALL_POKEDEXES);

const RETRY_WAITS = [15000, 30000, 60000];

for (let pass = 0; failedEntries.length > 0 && pass < RETRY_WAITS.length; pass++) {
    console.log(`\nReintentando ${failedEntries.length} Pokémon fallidos (espera ${RETRY_WAITS[pass] / 1000}s)...`);
    await new Promise(resolve => setTimeout(resolve, RETRY_WAITS[pass]));
    const batch = failedEntries.splice(0);
    for (const f of batch) {
        await new Promise(resolve => setTimeout(resolve, 1500));
        const p = await getPokemonDetails(f.speciesUrl, f.region, f.pokedexName);
        if (p) {
            addPokemon(allPokemonMap, p);
        } else {
            failedEntries.push(f);
        }
    }
}

if (failedEntries.length > 0) {
    console.log(`⚠️ Quedaron ${failedEntries.length} Pokémon sin descargar: ${failedEntries.map(f => f.speciesUrl).join(', ')}`);
}

const pokemon = Array.from(allPokemonMap.values()).sort((a, b) => a.id - b.id);

const output = {
    version: 1,
    generatedAt: new Date().toISOString(),
    pokemon
};

const dir = path.dirname(fileURLToPath(import.meta.url));
const outFile = path.resolve(dir, '..', 'data', 'pokemon-db.json');
await mkdir(path.dirname(outFile), { recursive: true });
await writeFile(outFile, JSON.stringify(output));

const { size } = await stat(outFile);
console.log(`\nListo: ${outFile}`);
console.log(`Pokémon: ${pokemon.length}`);
console.log(`Tamaño: ${(size / 1024).toFixed(1)} KB`);
