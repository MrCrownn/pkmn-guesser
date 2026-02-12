export const gameState = {
    mode: null, // 'local' | 'online'
    fullPokemonDB: [], // Base completa
    pokemonList: [],   // Base filtrada para el juego
    
    // CONFIGURACIÓN DE PARTIDA
    config: {
        selectedRegions: new Set(),
        selectedTypes: new Set() // Vacío = Todos
    },

    local: {
        turn: 1,
        p1: { secret: null, eliminated: new Set() },
        p2: { secret: null, eliminated: new Set() }
    },
    online: {
        gameId: null,
        role: null, // 'host' | 'guest'
        myId: null,
        data: null,
        currentTurnOwner: null
    },
    hasGuessedThisTurn: false,
    hideEliminated: false,
    selectedFilters: new Set(),
    selectedGenerationFilters: new Set()
};



export const resetGameState = () => {
    gameState.pokemonList = [];
    gameState.config.selectedRegions.clear();
    gameState.config.selectedTypes.clear();
    gameState.local = { turn: 1, p1: { secret: null, eliminated: new Set() }, p2: { secret: null, eliminated: new Set() } };
    gameState.online.gameId = null;
    gameState.online.role = null;
    gameState.online.data = null;
    gameState.online.currentTurnOwner = null;
    gameState.hasGuessedThisTurn = false;
    gameState.hideEliminated = false;
    gameState.selectedFilters.clear();
    gameState.selectedGenerationFilters.clear();
};