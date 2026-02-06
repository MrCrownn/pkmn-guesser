export const gameState = {
    mode: null, // 'local' | 'online'
    pokemonList: [],
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
    selectedFilters: new Set()
};

export const resetGameState = () => {
    gameState.pokemonList = [];
    gameState.local = { turn: 1, p1: { secret: null, eliminated: new Set() }, p2: { secret: null, eliminated: new Set() } };
    gameState.online.gameId = null;
    gameState.online.role = null;
    gameState.online.data = null;
    gameState.online.currentTurnOwner = null;
    gameState.hasGuessedThisTurn = false;
    gameState.hideEliminated = false;
    gameState.selectedFilters.clear();
};