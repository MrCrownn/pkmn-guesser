import { auth, signInAnonymously, onAuthStateChanged } from './firebase.js';
import { gameState } from './state.js';
import { Game, REGION_RANGES } from './game.js';
import { UI, typeTranslations } from './ui.js';

const GENERATION_NAMES = {
    kanto: 'Gen 1', johto: 'Gen 2', hoenn: 'Gen 3', sinnoh: 'Gen 4',
    unova: 'Gen 5', kalos: 'Gen 6', alola: 'Gen 7', galar: 'Gen 8', paldea: 'Gen 9'
};

// --- NUEVO SISTEMA DE CARGA DE DATOS (Soporte Gen 9/Paldea) ---
import { loadAllPokemon } from './api.js';

// ... (el resto de tus imports)

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
                    if (code) { Game.selectMode('online'); Game.joinGame(code); }
                }
            }
        });
    } catch (e) {
        UI.setConnectionStatus(false);
        console.error("Error init:", e);
    }
};

const checkTurn = () => {
    if (gameState.mode === 'local') return true;
    if (gameState.online.data && gameState.online.data.turn === auth.currentUser.uid) return true;
    UI.showModal("Espera", "No es tu turno.", null, true);
    return false;
};

// LISTENERS
document.getElementById('btn-header-reset')?.addEventListener('click', () => UI.showModal('¿Volver al Lobby?', 'Se perderá el progreso.', () => Game.resetGame()));
document.getElementById('resetGameBtn')?.addEventListener('click', () => UI.showModal('¿Salir?', 'Volverás al inicio.', () => Game.resetGame()));
document.getElementById('themeToggleBtn')?.addEventListener('click', UI.updateTheme);
document.getElementById('btn-mode-local')?.addEventListener('click', () => Game.selectMode('local'));
document.getElementById('btn-mode-online')?.addEventListener('click', () => Game.selectMode('online'));
document.getElementById('btn-create-room')?.addEventListener('click', () => Game.createOnlineRoom());
document.getElementById('btn-join-room')?.addEventListener('click', () => {
    const v = document.getElementById('joinCodeInput').value.trim();
    if(v) Game.joinGame(v); 
});
document.getElementById('btn-lobby-back')?.addEventListener('click', Game.resetGame);

// Toggle Regiones
document.getElementById('region-buttons-container')?.addEventListener('click', (e) => {
    const btn = e.target.closest('.region-btn');
    if(btn) Game.toggleRegion(btn.dataset.region, btn);
});

// Toggle Todos los Tipos
document.getElementById('btn-toggle-all-types')?.addEventListener('click', Game.toggleAllTypes);

// Botón Jugar (Start)
document.getElementById('btn-start-game')?.addEventListener('click', Game.startGameConfirmed);

document.getElementById('btn-copy-code')?.addEventListener('click', () => {
    const url = `${window.location.origin}${window.location.pathname}#game=${gameState.online.gameId}`;
    navigator.clipboard.writeText(url); 
    UI.showModal("Copiado", "Enlace copiado.", null, true);
});

document.getElementById('btn-local-next-turn')?.addEventListener('click', () => {
    UI.elements.interstitialScreen.classList.add('hidden');
    Game.renderLocalBoard();
});

// Acciones de Juego (con chequeo de turno)
document.getElementById('btn-open-filter')?.addEventListener('click', () => {
    if (!checkTurn()) return;
    gameState.selectedFilters.clear();
    const grid = UI.elements.filterTypeGrid;
    if(!grid) return;
    grid.innerHTML = '';
    
    // Calcular tipos disponibles
    const availableTypes = new Set();
    gameState.pokemonList.forEach(p => {
        p.types.forEach(t => availableTypes.add(t.toLowerCase()));
    });

    Object.keys(typeTranslations).forEach(t => {
        if (!availableTypes.has(t)) return;

        const btn = document.createElement('button');
        btn.className = `p-2 rounded-xl font-bold uppercase text-[10px] shadow-sm transition h-10 t-${t} bg-type-filled opacity-80 hover:opacity-100 text-white`;
        btn.textContent = typeTranslations[t];
        btn.onclick = () => {
            if (gameState.selectedFilters.has(t)) {
                gameState.selectedFilters.delete(t);
                btn.classList.remove('filter-selected');
                btn.classList.add('opacity-80');
            } else {
                if (gameState.selectedFilters.size >= 2) return UI.showModal("Límite", "Máximo 2 tipos.", null, true);
                gameState.selectedFilters.add(t);
                btn.classList.add('filter-selected');
                btn.classList.remove('opacity-80');
            }
            UI.updateFilterButton(gameState.selectedFilters.size);
        };
        grid.appendChild(btn);
    });
    
    // Generaciones
    gameState.selectedGenerationFilters.clear();
    const genGrid = document.getElementById('filterGenGrid');
    genGrid.innerHTML = '';
    const askGenBtn = document.getElementById('askGenerationBtn');

    Object.keys(REGION_RANGES).forEach(gen => {
        if (gameState.config.selectedRegions.has(gen)) {
            const btn = document.createElement('button');
            btn.className = 'bg-slate-100 dark:bg-slate-800 p-3 rounded-xl text-xs font-bold hover:bg-slate-200 dark:hover:bg-slate-700 opacity-80';
            btn.textContent = GENERATION_NAMES[gen];
            btn.onclick = () => {
                if (gameState.selectedGenerationFilters.has(gen)) {
                    gameState.selectedGenerationFilters.delete(gen);
                    btn.classList.remove('filter-selected');
                    btn.classList.add('opacity-80');
                } else {
                    gameState.selectedGenerationFilters.add(gen);
                    btn.classList.add('filter-selected');
                    btn.classList.remove('opacity-80');
                }
                askGenBtn.disabled = gameState.selectedGenerationFilters.size === 0;
            };
            genGrid.appendChild(btn);
        }
    });

    askGenBtn.disabled = true;
    UI.updateFilterButton(0);
    UI.elements.filterModal.classList.remove('hidden');
});

document.getElementById('btn-visibility')?.addEventListener('click', () => Game.toggleVisibility());

document.getElementById('btn-open-guess')?.addEventListener('click', () => {
    if (!checkTurn()) return;
    if (gameState.hasGuessedThisTurn) return UI.showModal("Espera", "Solo 1 intento por turno.", null, true);
    
    let eliminated;
    if (gameState.mode === 'local') {
        const t = gameState.local.turn;
        eliminated = t === 1 ? gameState.local.p1.eliminated : gameState.local.p2.eliminated;
    } else {
        const role = gameState.online.role === 'host' ? 'player1' : 'player2';
        eliminated = new Set(gameState.online.data[role].eliminated || []);
    }
    
    const candidates = gameState.pokemonList.filter(pk => !eliminated.has(pk.id));
    UI.renderGrid(UI.elements.guessGrid, candidates, (poke) => Game.makeGuess(poke));
    UI.elements.guessModal.classList.remove('hidden');
});

document.getElementById('btn-end-turn')?.addEventListener('click', () => {
    if (!checkTurn()) return;
    Game.handleEndTurn();
});

// Cerrar modales
['btn-close-guess', 'guessModalOverlay'].forEach(id => document.getElementById(id)?.addEventListener('click', () => UI.elements.guessModal.classList.add('hidden')));
['btn-close-filter', 'filterModalOverlay'].forEach(id => document.getElementById(id)?.addEventListener('click', () => UI.elements.filterModal.classList.add('hidden')));
['uiModalOverlay', 'uiModalCancel'].forEach(id => document.getElementById(id)?.addEventListener('click', UI.closeModal));

document.getElementById('askTypesBtn')?.addEventListener('click', () => {
    const types = Array.from(gameState.selectedFilters);
    UI.elements.filterModal.classList.add('hidden');
    const txt = types.map(t => typeTranslations[t]).join(' o ');
    const question = types.length === 1 ? `¿Es de tipo ${txt}?` : `¿Es de tipo ${txt}?`;
    
    if (gameState.mode === 'local') askWithYesNo(question, types, true);
    else Game.sendQuestion(types, true);
});

document.getElementById('askGenerationBtn')?.addEventListener('click', () => {
    const gens = Array.from(gameState.selectedGenerationFilters);
    UI.elements.filterModal.classList.add('hidden');
    const txt = gens.map(g => GENERATION_NAMES[g]).join(', ');
    const question = gens.length === 1 ? `¿Pertenece a ${txt}?` : `¿Pertenece a una de estas generaciones: ${txt}?`;
    
    if (gameState.mode === 'local') askWithYesNoGenerations(question, gens);
    else Game.sendQuestion(gens, false, true);
});

document.getElementById('btn-filter-single')?.addEventListener('click', () => {
    if (gameState.mode === 'local') askWithYesNo("¿Tiene UN solo tipo?", ['single'], false);
    else { UI.elements.filterModal.classList.add('hidden'); Game.sendQuestion(['single'], false); }
});

document.getElementById('btn-filter-dual')?.addEventListener('click', () => {
    if (gameState.mode === 'local') askWithYesNo("¿Tiene DOS tipos?", ['dual'], false);
    else { UI.elements.filterModal.classList.add('hidden'); Game.sendQuestion(['dual'], false); }
});

function askWithYesNo(text, criteria, isType) {
    UI.elements.filterModal.classList.add('hidden');
    UI.showQuestionModal(criteria, isType, (response) => {
        Game.applyFilter(criteria, isType, response);
        Game.handleEndTurn(); 
    });
}

function askWithYesNoGenerations(text, criteria) {
    UI.elements.filterModal.classList.add('hidden');
    UI.showQuestionModal(criteria, false, (response) => {
        Game.applyGenerationFilter(criteria, response);
        Game.handleEndTurn();
    }, true);
}

document.getElementById('btn-rematch')?.addEventListener('click', () => Game.resetGame());
document.getElementById('btn-back-lobby')?.addEventListener('click', Game.resetGame);