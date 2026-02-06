import { auth, signInAnonymously, onAuthStateChanged } from './firebase.js';
import { gameState } from './state.js';
import { Game } from './game.js';
import { UI, typeTranslations } from './ui.js';

// --- INICIALIZACIÓN ---
window.onload = async () => {
    UI.initTheme();
    try {
        await signInAnonymously(auth);
        onAuthStateChanged(auth, (u) => {
            if (u) {
                gameState.online.myId = u.uid;
                UI.setConnectionStatus(true);
                
                // Verificar si hay invitación en la URL (Hash)
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
        console.error("Error de inicialización:", e);
    }
};

// --- LISTENERS DE NAVEGACIÓN Y MENÚS ---

document.getElementById('btn-header-reset')?.addEventListener('click', () => {
    UI.showModal('¿Volver al Lobby?', 'Se perderá el progreso actual.', () => Game.resetGame());
});

document.getElementById('resetGameBtn')?.addEventListener('click', () => {
    UI.showModal('¿Salir?', 'Volverás a la selección de sala.', () => Game.resetGame());
});

document.getElementById('themeToggleBtn')?.addEventListener('click', UI.updateTheme);

// Selección de Modo
document.getElementById('btn-mode-local')?.addEventListener('click', () => Game.selectMode('local'));
document.getElementById('btn-mode-online')?.addEventListener('click', () => Game.selectMode('online'));

// Lobby Online
document.getElementById('btn-create-room')?.addEventListener('click', () => {
    Game.createOnlineRoom();
});

document.getElementById('btn-join-room')?.addEventListener('click', () => {
    const input = document.getElementById('joinCodeInput');
    const code = input ? input.value.trim() : null;
    if(code) Game.joinGame(code); 
});

document.getElementById('btn-lobby-back')?.addEventListener('click', Game.resetGame);

// Selección de Región (Funciona diferente para Local vs Online)
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
            if (gameState.mode === 'local') {
                // En local, cargamos y empezamos inmediatamente
                Game.startLocalGame(range[0], range[1]);
            } else {
                // En online, solo actualizamos la configuración de la sala
                Game.setOnlineRegion(range[0], range[1], name);
            }
        }
    }
});

// Sala de Espera
document.getElementById('btn-copy-code')?.addEventListener('click', () => {
    const url = `${window.location.origin}${window.location.pathname}#game=${gameState.online.gameId}`;
    navigator.clipboard.writeText(url); 
    UI.showModal("Copiado", "Enlace copiado al portapapeles", null, true);
});

// Intersticial (Paso de turno manual en Local)
document.getElementById('btn-local-next-turn')?.addEventListener('click', () => {
    UI.elements.interstitialScreen.classList.add('hidden');
    Game.renderLocalBoard();
});

// --- ACCIONES DEL TABLERO DE JUEGO ---

// 1. Abrir Modal de Filtros
document.getElementById('btn-open-filter')?.addEventListener('click', () => {
    gameState.selectedFilters.clear();
    const grid = UI.elements.filterTypeGrid;
    if(!grid) return;
    
    grid.innerHTML = '';
    const types = Object.keys(typeTranslations); 
    
    types.forEach(t => {
        const btn = document.createElement('button');
        // Estilos para los botones de tipo
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
        grid.appendChild(btn);
    });
    
    UI.updateFilterButton(0);
    UI.elements.filterModal.classList.remove('hidden');
});

// 2. Botón "Ojo" (Visibilidad)
document.getElementById('btn-visibility')?.addEventListener('click', () => {
    Game.toggleVisibility();
});

// 3. Botón "Rayo" (Arriesgar)
document.getElementById('btn-open-guess')?.addEventListener('click', () => {
    if (gameState.hasGuessedThisTurn) return UI.showModal("Espera", "Solo puedes arriesgar 1 vez por turno.", null, true);
    
    // Filtrar candidatos para mostrar en el grid de arriesgar
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

// 4. Botón Fin de Turno
document.getElementById('btn-end-turn')?.addEventListener('click', Game.handleEndTurn);

// --- CIERRE DE MODALES ---
document.getElementById('btn-close-guess')?.addEventListener('click', () => UI.elements.guessModal.classList.add('hidden'));
document.getElementById('guessModalOverlay')?.addEventListener('click', () => UI.elements.guessModal.classList.add('hidden'));

document.getElementById('btn-close-filter')?.addEventListener('click', () => UI.elements.filterModal.classList.add('hidden'));
document.getElementById('filterModalOverlay')?.addEventListener('click', () => UI.elements.filterModal.classList.add('hidden'));

document.getElementById('uiModalOverlay')?.addEventListener('click', UI.closeModal);
document.getElementById('uiModalCancel')?.addEventListener('click', UI.closeModal);

// --- LÓGICA DE PREGUNTAS (LOCAL VS ONLINE) ---

// Botón "Preguntar por Selección" (Tipos)
document.getElementById('askTypesBtn')?.addEventListener('click', () => {
    const types = Array.from(gameState.selectedFilters);
    UI.elements.filterModal.classList.add('hidden');
    
    const translatedTypes = types.map(t => typeTranslations[t] || t);
    // Texto amigable: "¿Tiene el tipo Fuego?" o "¿Tiene alguno de los tipos...?"
    let questionText = translatedTypes.length === 1 ? `¿Tiene el tipo ${translatedTypes[0]}?` : `¿Tiene alguno de los tipos: ${translatedTypes.join(' o ')}?`;

    if (gameState.mode === 'local') {
        askWithYesNo(questionText, types, true);
    } else {
        Game.sendQuestion(types, true);
    }
});

// Botones de Estructura (Solo 1 Tipo / 2 Tipos)
document.getElementById('btn-filter-single')?.addEventListener('click', () => {
    if (gameState.mode === 'local') askWithYesNo("¿Tiene UN solo tipo?", ['single'], false);
    else {
        UI.elements.filterModal.classList.add('hidden');
        Game.sendQuestion(['single'], false);
    }
});

document.getElementById('btn-filter-dual')?.addEventListener('click', () => {
    if (gameState.mode === 'local') askWithYesNo("¿Tiene DOS tipos?", ['dual'], false);
    else {
        UI.elements.filterModal.classList.add('hidden');
        Game.sendQuestion(['dual'], false);
    }
});

// Función auxiliar para el modo Local (simula la respuesta)
function askWithYesNo(text, criteria, isType) {
    UI.elements.filterModal.classList.add('hidden');

    const onYes = () => Game.applyFilter(criteria, isType, true);
    const onNo = () => {
        UI.elements.uiModal.classList.add('hidden');
        Game.applyFilter(criteria, isType, false);
    };

    UI.showModal("¿Qué respondió tu rival?", text, onYes);

    // Ajuste visual manual de los botones para que parezcan SÍ/NO
    const confirmBtn = document.getElementById('uiModalConfirm');
    const cancelBtn = document.getElementById('uiModalCancel');

    if (confirmBtn && cancelBtn) {
        confirmBtn.textContent = "Dijo SÍ";
        confirmBtn.className = "flex-1 py-3 rounded-xl font-bold text-white bg-green-600 hover:bg-green-700 shadow-lg transition-all";
        
        cancelBtn.textContent = "Dijo NO";
        cancelBtn.className = "flex-1 py-3 rounded-xl font-bold text-white bg-red-500 hover:bg-red-600 shadow-lg transition-all";
        cancelBtn.classList.remove('hidden');
        
        cancelBtn.onclick = onNo;
    }
}

// Botones de Fin de Partida
document.getElementById('btn-rematch')?.addEventListener('click', Game.triggerRematch);
document.getElementById('btn-back-lobby')?.addEventListener('click', Game.resetGame);