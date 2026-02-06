import { auth, signInAnonymously, onAuthStateChanged } from './firebase.js';
import { gameState } from './state.js';
import { Game } from './game.js';
import { UI, typeTranslations } from './ui.js';

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
        console.error("Error de inicialización:", e);
    }
};

// --- Helper de Seguridad ---
const checkTurn = () => {
    if (gameState.mode === 'local') return true;
    if (gameState.online.data && gameState.online.data.turn === auth.currentUser.uid) return true;
    
    UI.showModal("Espera", "No es tu turno.", null, true);
    return false;
};

// --- Listeners ---
document.getElementById('btn-header-reset')?.addEventListener('click', () => UI.showModal('¿Volver al Lobby?', 'Se perderá el progreso actual.', () => Game.resetGame()));
document.getElementById('resetGameBtn')?.addEventListener('click', () => UI.showModal('¿Salir?', 'Volverás a la selección de sala.', () => Game.resetGame()));
document.getElementById('themeToggleBtn')?.addEventListener('click', UI.updateTheme);
document.getElementById('btn-mode-local')?.addEventListener('click', () => Game.selectMode('local'));
document.getElementById('btn-mode-online')?.addEventListener('click', () => Game.selectMode('online'));
document.getElementById('btn-create-room')?.addEventListener('click', () => Game.createOnlineRoom());
document.getElementById('btn-join-room')?.addEventListener('click', () => {
    const input = document.getElementById('joinCodeInput');
    if(input.value.trim()) Game.joinGame(input.value.trim()); 
});
document.getElementById('btn-lobby-back')?.addEventListener('click', Game.resetGame);

document.getElementById('region-buttons-container')?.addEventListener('click', (e) => {
    const btn = e.target.closest('.region-btn');
    if(btn) {
        const ranges = {
            kanto: [1, 151], johto: [152, 251], hoenn: [252, 386], sinnoh: [387, 493],
            unova: [494, 649], kalos: [650, 721], alola: [722, 809], galar: [810, 905], paldea: [906, 1025]
        };
        const region = btn.dataset.region;
        const range = ranges[region];
        const name = btn.textContent;
        if(range) {
            if (gameState.mode === 'local') Game.startLocalGame(range[0], range[1]);
            else Game.setOnlineRegion(range[0], range[1], name);
        }
    }
});

document.getElementById('btn-copy-code')?.addEventListener('click', () => {
    const url = `${window.location.origin}${window.location.pathname}#game=${gameState.online.gameId}`;
    navigator.clipboard.writeText(url); 
    UI.showModal("Copiado", "Enlace copiado.", null, true);
});

document.getElementById('btn-local-next-turn')?.addEventListener('click', () => {
    UI.elements.interstitialScreen.classList.add('hidden');
    Game.renderLocalBoard();
});

// --- ACCIONES CON VERIFICACIÓN DE TURNO ---

document.getElementById('btn-open-filter')?.addEventListener('click', () => {
    if (!checkTurn()) return;
    
    gameState.selectedFilters.clear();
    const grid = UI.elements.filterTypeGrid;
    if(!grid) return;
    grid.innerHTML = '';
    
    Object.keys(typeTranslations).forEach(t => {
        const btn = document.createElement('button');
        btn.className = `p-2 rounded-xl font-bold uppercase text-[10px] shadow-sm transition h-10 t-${t} bg-type-filled opacity-80 hover:opacity-100`;
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
    
    UI.updateFilterButton(0);
    UI.elements.filterModal.classList.remove('hidden');
});

document.getElementById('btn-visibility')?.addEventListener('click', () => Game.toggleVisibility());

document.getElementById('btn-open-guess')?.addEventListener('click', () => {
    if (!checkTurn()) return;
    if (gameState.hasGuessedThisTurn) return UI.showModal("Espera", "Solo 1 intento por turno.", null, true);
    
    let eliminated;
    if (gameState.mode === 'local') {
        eliminated = gameState.local.turn === 1 ? gameState.local.p1.eliminated : gameState.local.p2.eliminated;
    } else {
        const myRole = gameState.online.role === 'host' ? 'player1' : 'player2';
        eliminated = new Set(gameState.online.data[myRole].eliminated || []);
    }
    const candidates = gameState.pokemonList.filter(pk => !eliminated.has(pk.id));
    UI.renderGrid(UI.elements.guessGrid, candidates, (poke) => Game.makeGuess(poke));
    UI.elements.guessModal.classList.remove('hidden');
});

document.getElementById('btn-end-turn')?.addEventListener('click', () => {
    if (!checkTurn()) return;
    Game.handleEndTurn();
});

// Modales cierre
['btn-close-guess', 'guessModalOverlay'].forEach(id => document.getElementById(id)?.addEventListener('click', () => UI.elements.guessModal.classList.add('hidden')));
['btn-close-filter', 'filterModalOverlay'].forEach(id => document.getElementById(id)?.addEventListener('click', () => UI.elements.filterModal.classList.add('hidden')));
['uiModalOverlay', 'uiModalCancel'].forEach(id => document.getElementById(id)?.addEventListener('click', UI.closeModal));

document.getElementById('askTypesBtn')?.addEventListener('click', () => {
    const types = Array.from(gameState.selectedFilters);
    UI.elements.filterModal.classList.add('hidden');
    const txt = types.map(t => typeTranslations[t]).join(' o ');
    const question = types.length === 1 ? `¿Tiene el tipo ${txt}?` : `¿Tiene alguno de los tipos: ${txt}?`;
    
    if (gameState.mode === 'local') askWithYesNo(question, types, true);
    else Game.sendQuestion(types, true);
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
    UI.showModal("¿Qué respondió tu rival?", text, () => Game.applyFilter(criteria, isType, true));
    
    const confirmBtn = document.getElementById('uiModalConfirm');
    const cancelBtn = document.getElementById('uiModalCancel');
    if (confirmBtn && cancelBtn) {
        confirmBtn.textContent = "Dijo SÍ";
        confirmBtn.className = "btn-success flex-1 py-3"; 
        cancelBtn.textContent = "Dijo NO";
        cancelBtn.className = "btn-secondary flex-1 py-3"; 
        cancelBtn.classList.remove('hidden');
        cancelBtn.onclick = () => { UI.elements.uiModal.classList.add('hidden'); Game.applyFilter(criteria, isType, false); };
    }
}

document.getElementById('btn-rematch')?.addEventListener('click', Game.triggerRematch);
document.getElementById('btn-back-lobby')?.addEventListener('click', Game.resetGame);