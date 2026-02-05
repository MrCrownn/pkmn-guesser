import { auth, signInAnonymously, onAuthStateChanged } from './firebase.js';
import { gameState } from './state.js';
import { Game } from './game.js';
import { UI, typeTranslations } from './ui.js';

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
// Event Listeners (attach safely)
function onId(id, event, handler) {
    const el = document.getElementById(id);
    if (el) el.addEventListener(event, handler);
}

onId('btn-header-reset', 'click', () => UI.showModal('¿Volver al Lobby?', 'Se perderá el progreso actual.', () => Game.resetGame()));
onId('resetGameBtn', 'click', () => UI.showModal('¿Salir?', 'Volverás a la selección de sala.', () => Game.resetGame()));
onId('themeToggleBtn', 'click', UI.updateTheme);

onId('btn-mode-local', 'click', () => Game.selectMode('local'));
onId('btn-mode-online', 'click', () => Game.selectMode('online'));

onId('btn-create-room', 'click', () => {
    if (!auth.currentUser) return UI.showModal("Error", "No estás conectado.", null, true);
    gameState.online.role = 'host';
    if (UI.elements.lobbyScreen) UI.elements.lobbyScreen.classList.add('hidden');
    if (UI.elements.setupScreen) UI.elements.setupScreen.classList.remove('hidden');
});

onId('btn-join-room', 'click', () => Game.joinGame(null));
onId('btn-lobby-back', 'click', Game.resetGame);

const regionContainer = document.getElementById('region-buttons-container');
if (regionContainer) regionContainer.addEventListener('click', (e) => {
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

onId('btn-copy-code', 'click', () => {
    const url = `${window.location.origin}${window.location.pathname}#game=${gameState.online.gameId}`;
    navigator.clipboard.writeText(url);
    UI.showModal("Copiado", "Enlace copiado al portapapeles", null, true);
});

onId('btn-local-next-turn', 'click', () => { if (UI.elements.interstitialScreen) UI.elements.interstitialScreen.classList.add('hidden'); Game.renderLocalBoard(); });

onId('btn-open-filter', 'click', () => {
    gameState.selectedFilters.clear();
    const types = Object.keys(typeTranslations);
    if (UI.elements.filterTypeGrid) UI.elements.filterTypeGrid.innerHTML = '';
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
                if (gameState.selectedFilters.size >= 2) {
                    UI.showModal("Límite Alcanzado", "Solo puedes seleccionar hasta 2 tipos.", null, true);
                    return;
                }
                gameState.selectedFilters.add(t);
                btn.classList.add('filter-selected');
                btn.classList.remove('opacity-80');
            }
            UI.updateFilterButton(gameState.selectedFilters.size);
        };
        if (UI.elements.filterTypeGrid) UI.elements.filterTypeGrid.appendChild(btn);
    });
    UI.updateFilterButton(0);
    if (UI.elements.filterModal) UI.elements.filterModal.classList.remove('hidden');
});

onId('btn-visibility', 'click', () => { if (Game.toggleVisibility) Game.toggleVisibility(); });

onId('btn-open-guess', 'click', () => {
    if (gameState.hasGuessedThisTurn) return UI.showModal("Espera", "Solo puedes arriesgar 1 vez por turno.", null, true);
    let eliminated = new Set();
    if (gameState.mode === 'local') {
        const p = gameState.local.turn;
        eliminated = p === 1 ? gameState.local.p1.eliminated : gameState.local.p2.eliminated;
    } else {
        const myRole = gameState.online.role === 'host' ? 'player1' : 'player2';
        eliminated = new Set(gameState.online.data[myRole].eliminated || []);
    }
    const candidates = gameState.pokemonList.filter(pk => !eliminated.has(pk.id));
    UI.renderGrid(UI.elements.guessGrid, candidates, (poke) => Game.makeGuess(poke));
    if (UI.elements.guessModal) UI.elements.guessModal.classList.remove('hidden');
});

onId('btn-end-turn', 'click', Game.handleEndTurn);

// Modals
const btnCloseGuess = document.getElementById('btn-close-guess');
if (btnCloseGuess) btnCloseGuess.addEventListener('click', () => UI.elements.guessModal.classList.add('hidden'));

const guessModalOverlay = document.getElementById('guessModalOverlay');
if (guessModalOverlay) guessModalOverlay.addEventListener('click', () => UI.elements.guessModal.classList.add('hidden'));

const btnCloseFilter = document.getElementById('btn-close-filter');
if (btnCloseFilter) btnCloseFilter.addEventListener('click', () => UI.elements.filterModal.classList.add('hidden'));

const filterModalOverlay = document.getElementById('filterModalOverlay');
if (filterModalOverlay) filterModalOverlay.addEventListener('click', () => UI.elements.filterModal.classList.add('hidden'));

const uiModalOverlay = document.getElementById('uiModalOverlay');
if (uiModalOverlay) uiModalOverlay.addEventListener('click', UI.closeModal);

const uiModalCancelBtn = document.getElementById('uiModalCancel');
if (uiModalCancelBtn) uiModalCancelBtn.addEventListener('click', UI.closeModal);

// Lógica de Filtros (SÍ/NO) corregida sin setTimeout
onId('askTypesBtn', 'click', () => {
    const types = Array.from(gameState.selectedFilters);
    UI.elements.filterModal.classList.add('hidden');
    
    const translatedTypes = types.map(t => typeTranslations[t] || t);
    let questionText = translatedTypes.length === 1 ? `¿Es tipo ${translatedTypes[0]}?` : `¿Es tipo ${translatedTypes.join(' o ')}?`;

    // 1. Abrimos el modal base con la acción afirmativa
    UI.showModal("¿Qué respondió tu rival?", questionText, () => {
        Game.applyFilter(types, true, true);
    });
    
    // 2. Modificamos los botones INMEDIATAMENTE (sin setTimeout) para convertirlos en SÍ/NO
    const cancelBtn = document.getElementById('uiModalCancel');
    const confirmBtn = document.getElementById('uiModalConfirm');

    if (cancelBtn && confirmBtn) {
        cancelBtn.textContent = "Dijo NO";
        // Aseguramos estilo visible y consistente
        cancelBtn.className = "flex-1 py-3 rounded-xl font-bold text-slate-500 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all";
        cancelBtn.classList.remove('hidden');
        
        // Sobrescribimos el comportamiento de cancelar para que sea "Dijo NO"
        cancelBtn.onclick = () => {
            UI.elements.uiModal.classList.add('hidden');
            Game.applyFilter(types, true, false);
        };

        confirmBtn.textContent = "Dijo SÍ";
        confirmBtn.className = "flex-1 py-3 rounded-xl font-bold text-white bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-500/30 transition-all";
    }
});

onId('btn-filter-single', 'click', () => triggerFilterStruct('single', "¿Tiene UN solo tipo?"));
onId('btn-filter-dual', 'click', () => triggerFilterStruct('dual', "¿Tiene DOS tipos?"));

function triggerFilterStruct(type, text) {
    UI.elements.filterModal.classList.add('hidden');
    
    UI.showModal("¿Qué respondió tu rival?", text, () => {
        Game.applyFilter([type], false, true);
    });

    // Modificación inmediata síncrona
    const cancelBtn = document.getElementById('uiModalCancel');
    const confirmBtn = document.getElementById('uiModalConfirm');

    if (cancelBtn && confirmBtn) {
        cancelBtn.textContent = "Dijo NO";
        cancelBtn.className = "flex-1 py-3 rounded-xl font-bold text-slate-500 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all";
        cancelBtn.classList.remove('hidden');
        
        cancelBtn.onclick = () => {
            UI.elements.uiModal.classList.add('hidden');
            Game.applyFilter([type], false, false);
        };

        confirmBtn.textContent = "Dijo SÍ";
        confirmBtn.className = "flex-1 py-3 rounded-xl font-bold text-white bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-500/30 transition-all";
    }
}

// Winner Modal
onId('btn-rematch', 'click', Game.triggerRematch);
onId('btn-back-lobby', 'click', Game.resetGame);

// Ensure initial visible view in case other scripts fail
if (UI && UI.resetViews) UI.resetViews();