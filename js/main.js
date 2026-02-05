import { auth, signInAnonymously, onAuthStateChanged } from './firebase.js';
import { gameState } from './state.js';
import { Game } from './game.js';
import { UI } from './ui.js';

// Init
window.onload = async () => {
    UI.initTheme();
    try {
        await signInAnonymously(auth);
        onAuthStateChanged(auth, (u) => {
            if (u) {
                gameState.online.myId = u.uid;
                UI.setConnectionStatus(true);
                
                const hash = window.location.hash;
                if (hash.includes('game=')) {
                    const code = hash.split('game=')[1];
                    if (code) { 
                        Game.selectMode('online'); 
                        Game.joinGame(code); 
                    }
                }
            }
        });
    } catch (e) {
        UI.setConnectionStatus(false);
        console.error(e);
    }
};

// Event Listeners
document.getElementById('btn-header-reset').addEventListener('click', () => {
    UI.showModal('¿Volver al Lobby?', 'Se perderá el progreso actual.', () => Game.resetGame());
});

document.getElementById('resetGameBtn').addEventListener('click', () => {
    UI.showModal('¿Salir?', 'Volverás a la selección de sala.', () => Game.resetGame());
});

document.getElementById('themeToggleBtn').addEventListener('click', UI.updateTheme);

// Mode Selection
document.getElementById('btn-mode-local').addEventListener('click', () => Game.selectMode('local'));
document.getElementById('btn-mode-online').addEventListener('click', () => Game.selectMode('online'));

// Lobby
document.getElementById('btn-create-room').addEventListener('click', () => {
    if (!auth.currentUser) return UI.showModal("Error", "No estás conectado.", null, true);
    gameState.online.role = 'host';
    UI.elements.lobbyScreen.classList.add('hidden');
    UI.elements.setupScreen.classList.remove('hidden');
});

document.getElementById('btn-join-room').addEventListener('click', () => {
    Game.joinGame(null); // Will take input value
});

document.getElementById('btn-lobby-back').addEventListener('click', Game.resetGame);

// Region Selection
document.getElementById('region-buttons-container').addEventListener('click', (e) => {
    if(e.target.classList.contains('region-btn')) {
        const ranges = {
            kanto: [1, 151], johto: [152, 251], hoenn: [252, 386], sinnoh: [387, 493],
            unova: [494, 649], kalos: [650, 721], alola: [722, 809], galar: [810, 905], paldea: [906, 1025]
        };
        const region = e.target.dataset.region;
        const range = ranges[region];
        const name = e.target.textContent;
        Game.initGame(range[0], range[1], name);
    }
});

// Waiting Room
document.getElementById('btn-copy-code').addEventListener('click', () => {
    const url = `${window.location.origin}${window.location.pathname}#game=${gameState.online.gameId}`;
    navigator.clipboard.writeText(url); 
    UI.showModal("Copiado", "Enlace copiado al portapapeles", null, true);
});

// Interstitial (Local)
document.getElementById('btn-local-next-turn').addEventListener('click', () => {
    UI.elements.interstitialScreen.classList.add('hidden');
    Game.renderLocalBoard();
});

// Game Board Actions
document.getElementById('btn-open-filter').addEventListener('click', () => {
    gameState.selectedFilters.clear();
    const types = ["normal", "fire", "water", "grass", "electric", "ice", "fighting", "poison", "ground", "flying", "psychic", "bug", "rock", "ghost", "dragon", "steel", "fairy"];
    UI.elements.filterTypeGrid.innerHTML = '';
    
    const typeTranslations = {
        normal: "Normal", fire: "Fuego", water: "Agua", grass: "Planta", electric: "Eléctrico", ice: "Hielo", fighting: "Lucha", poison: "Veneno", ground: "Tierra", flying: "Volador", psychic: "Psíquico", bug: "Bicho", rock: "Roca", ghost: "Fantasma", dragon: "Dragón", steel: "Acero", fairy: "Hada"
    };

    types.forEach(t => {
        const btn = document.createElement('button');
        btn.className = `p-2 rounded-xl font-bold text-white uppercase text-[10px] shadow-sm type-badge border-2 border-transparent t-${t} opacity-80 hover:opacity-100 transition flex items-center justify-center h-10`;
        btn.textContent = typeTranslations[t] || t;
        btn.onclick = () => {
            if (gameState.selectedFilters.has(t)) {
                gameState.selectedFilters.delete(t);
                btn.classList.remove('filter-selected');
                btn.classList.add('opacity-80');
            } else {
                gameState.selectedFilters.add(t);
                btn.classList.add('filter-selected');
                btn.classList.remove('opacity-80');
            }
            UI.updateFilterButton(gameState.selectedFilters.size);
        };
        UI.elements.filterTypeGrid.appendChild(btn);
    });
    
    UI.updateFilterButton(0);
    UI.elements.filterModal.classList.remove('hidden');
});

document.getElementById('btn-visibility').addEventListener('click', () => {
    gameState.hideEliminated = !gameState.hideEliminated;
    UI.updateVisibilityBtn();
    UI.toggleEliminatedVisibility(); // Re-render
});

document.getElementById('btn-open-guess').addEventListener('click', () => {
    if (gameState.hasGuessedThisTurn) return UI.showModal("Espera", "Solo puedes arriesgar 1 vez por turno.", null, true);
    
    // Filter candidates
    let eliminated;
    if (gameState.mode === 'local') {
        const p = gameState.local.turn;
        eliminated = p === 1 ? gameState.local.p1.eliminated : gameState.local.p2.eliminated;
    } else {
        const myRole = gameState.online.role === 'host' ? 'player1' : 'player2';
        eliminated = new Set(gameState.online.data[myRole].eliminated || []);
    }
    const candidates = gameState.pokemonList.filter(pk => !eliminated.has(pk.id));
    
    UI.renderGrid(UI.elements.guessGrid, candidates, (poke) => Game.makeGuess(poke));
    UI.elements.guessModal.classList.remove('hidden');
});

document.getElementById('btn-end-turn').addEventListener('click', Game.handleEndTurn);

// Modals
document.getElementById('btn-close-guess').addEventListener('click', () => UI.elements.guessModal.classList.add('hidden'));
document.getElementById('guessModalOverlay').addEventListener('click', () => UI.elements.guessModal.classList.add('hidden'));

document.getElementById('btn-close-filter').addEventListener('click', () => UI.elements.filterModal.classList.add('hidden'));
document.getElementById('filterModalOverlay').addEventListener('click', () => UI.elements.filterModal.classList.add('hidden'));

document.getElementById('uiModalOverlay').addEventListener('click', UI.closeModal);
document.getElementById('uiModalCancel').addEventListener('click', UI.closeModal);

document.getElementById('askTypesBtn').addEventListener('click', () => {
    const types = Array.from(gameState.selectedFilters);
    UI.elements.filterModal.classList.add('hidden');
    
    // Construct question text
    const typeTranslations = {
        normal: "Normal", fire: "Fuego", water: "Agua", grass: "Planta", electric: "Eléctrico", ice: "Hielo", fighting: "Lucha", poison: "Veneno", ground: "Tierra", flying: "Volador", psychic: "Psíquico", bug: "Bicho", rock: "Roca", ghost: "Fantasma", dragon: "Dragón", steel: "Acero", fairy: "Hada"
    };
    const translatedTypes = types.map(t => typeTranslations[t] || t);
    let questionText = translatedTypes.length === 1 ? `¿Es tipo ${translatedTypes[0]}?` : `¿Es tipo ${translatedTypes.join(' o ')}?`;

    UI.showModal("¿Qué respondió tu rival?", questionText, () => {
        Game.applyFilter(types, true, true);
    });
    // Swap buttons hack for Yes/No
    setTimeout(() => {
        const cancelBtn = document.getElementById('uiModalCancel');
        cancelBtn.textContent = "Dijo NO";
        cancelBtn.classList.remove('hidden');
        cancelBtn.onclick = () => {
            UI.elements.uiModal.classList.add('hidden');
            Game.applyFilter(types, true, false);
        };
        const confirmBtn = document.getElementById('uiModalConfirm');
        confirmBtn.textContent = "Dijo SÍ";
    }, 50);
});

document.getElementById('btn-filter-single').addEventListener('click', () => triggerFilterStruct('single', "¿Tiene UN solo tipo?"));
document.getElementById('btn-filter-dual').addEventListener('click', () => triggerFilterStruct('dual', "¿Tiene DOS tipos?"));

function triggerFilterStruct(type, text) {
    UI.elements.filterModal.classList.add('hidden');
    UI.showModal("¿Qué respondió tu rival?", text, () => {
        Game.applyFilter([type], false, true);
    });
    setTimeout(() => {
        const cancelBtn = document.getElementById('uiModalCancel');
        cancelBtn.textContent = "Dijo NO";
        cancelBtn.classList.remove('hidden');
        cancelBtn.onclick = () => {
            UI.elements.uiModal.classList.add('hidden');
            Game.applyFilter([type], false, false);
        };
        const confirmBtn = document.getElementById('uiModalConfirm');
        confirmBtn.textContent = "Dijo SÍ";
    }, 50);
}

// Winner Modal
document.getElementById('btn-rematch').addEventListener('click', Game.triggerRematch);
document.getElementById('btn-back-lobby').addEventListener('click', Game.resetGame);