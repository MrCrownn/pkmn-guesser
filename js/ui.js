import { gameState } from './state.js';

const DOM = {
    modeScreen: document.getElementById('modeScreen'),
    lobbyScreen: document.getElementById('lobbyScreen'),
    waitingScreen: document.getElementById('waitingScreen'),
    setupScreen: document.getElementById('setupScreen'),
    loadingScreen: document.getElementById('loadingScreen'),
    selectionScreen: document.getElementById('selectionScreen'),
    gameBoardScreen: document.getElementById('gameBoardScreen'),
    interstitialScreen: document.getElementById('interstitialScreen'),
    onlineWaitScreen: document.getElementById('onlineWaitScreen'),
    guessModal: document.getElementById('guessModal'),
    winnerModal: document.getElementById('winnerModal'),
    filterModal: document.getElementById('filterModal'),
    uiModal: document.getElementById('uiModal'),
    
    // Elementos internos
    btnOnline: document.getElementById('btnOnline'),
    connectionStatus: document.getElementById('connectionStatus'),
    waitingCode: document.getElementById('waitingCode'),
    joinCodeInput: document.getElementById('joinCodeInput'),
    roomCodeDisplay: document.getElementById('roomCodeDisplay'),
    turnStatus: document.getElementById('turnStatus'),
    selectionGrid: document.getElementById('selectionGrid'),
    mainGrid: document.getElementById('mainGrid'),
    guessGrid: document.getElementById('guessGrid'),
    filterTypeGrid: document.getElementById('filterTypeGrid'),
    hudSecretImg: document.getElementById('hudSecretImg'),
    hudSecretName: document.getElementById('hudSecretName'),
    winnerTitle: document.getElementById('winnerTitle'),
    winnerSubtitle: document.getElementById('winnerSubtitle'),
    winnerRevealImg: document.getElementById('winnerRevealImg'),
    winnerRevealName: document.getElementById('winnerRevealName'),
    uiModalTitle: document.getElementById('uiModalTitle'),
    uiModalText: document.getElementById('uiModalText'),
    uiModalConfirm: document.getElementById('uiModalConfirm'),
    uiModalCancel: document.getElementById('uiModalCancel'),
    guessBtn: document.getElementById('guessBtn'),
    askTypesBtn: document.getElementById('askTypesBtn'),
    visibilityBtn: document.getElementById('visibilityBtn'),
    themeIcon: document.getElementById('themeIcon'),
    
    // Overlays para cerrar modales
    guessModalOverlay: document.getElementById('guessModalOverlay'),
    filterModalOverlay: document.getElementById('filterModalOverlay'),
    uiModalOverlay: document.getElementById('uiModalOverlay')
};

export const UI = {
    elements: DOM,
    
    showLoading: (show) => {
        if(show) DOM.loadingScreen.classList.remove('hidden');
        else DOM.loadingScreen.classList.add('hidden');
    },

    setConnectionStatus: (connected) => {
        if (connected) {
            DOM.btnOnline.classList.remove('opacity-50', 'cursor-not-allowed');
            DOM.connectionStatus.textContent = "● Conectado";
            DOM.connectionStatus.className = "text-xs font-bold text-green-500";
        } else {
            DOM.connectionStatus.textContent = "Offline";
            DOM.connectionStatus.className = "text-xs font-bold text-red-500";
        }
    },

    showModal: (title, text, onConfirm, isAlert = false) => {
        DOM.uiModalTitle.textContent = title;
        DOM.uiModalText.textContent = text;
        DOM.uiModal.classList.remove('hidden');
        
        // Clonar para limpiar eventos
        const newConfirm = DOM.uiModalConfirm.cloneNode(true);
        const newCancel = DOM.uiModalCancel.cloneNode(true);
        DOM.uiModalConfirm.parentNode.replaceChild(newConfirm, DOM.uiModalConfirm);
        DOM.uiModalCancel.parentNode.replaceChild(newCancel, DOM.uiModalCancel);
        
        // Actualizar referencias en DOM cache
        DOM.uiModalConfirm = newConfirm;
        DOM.uiModalCancel = newCancel;

        if (isAlert) {
            newCancel.classList.add('hidden');
            newConfirm.textContent = "OK";
            newConfirm.onclick = () => {
                 DOM.uiModal.classList.add('hidden');
                 if(onConfirm) onConfirm();
            };
        } else {
            newCancel.classList.remove('hidden');
            newConfirm.textContent = "Confirmar";
            newConfirm.onclick = () => {
                 DOM.uiModal.classList.add('hidden');
                 if(onConfirm) onConfirm();
            };
            newCancel.onclick = () => DOM.uiModal.classList.add('hidden');
        }
    },

    closeModal: () => DOM.uiModal.classList.add('hidden'),

    renderGrid: (container, list, onClick, eliminatedSet = new Set()) => {
        container.innerHTML = '';
        list.forEach(poke => {
            const isEliminated = eliminatedSet.has(poke.id);
            if (gameState.hideEliminated && isEliminated) return;

            const div = document.createElement('div');
            div.className = `card relative bg-white dark:bg-slate-800 rounded-xl p-1 shadow-sm border border-slate-100 dark:border-slate-700 ${isEliminated ? 'eliminated' : 'cursor-pointer hover:scale-105'}`;
            div.classList.add(`t-${poke.types[0]}`, 'card-border');
            
            const typesHtml = poke.types.map(t => 
                `<span class="inline-block w-4 h-4 rounded-full t-${t} type-badge border border-slate-100 dark:border-slate-700 shadow-sm" title="${t}"></span>`
            ).join('');

            div.innerHTML = `
                <img src="${poke.image}" class="w-full aspect-square object-contain bg-slate-50 dark:bg-slate-900 rounded-lg mb-1" loading="lazy">
                <div class="text-center text-[10px] sm:text-xs font-bold truncate px-1 text-slate-700 dark:text-slate-200">${poke.name}</div>
                <div class="flex justify-center gap-1 mt-1 pb-1">${typesHtml}</div>
            `;
            
            div.onclick = (e) => { e.stopPropagation(); onClick(poke); };
            container.appendChild(div);
        });
    },

    updateHUD: (secret, isMyTurn) => {
        DOM.hudSecretImg.src = secret.image;
        DOM.hudSecretName.textContent = secret.name;
        DOM.turnStatus.textContent = isMyTurn ? "TU TURNO" : "ESPERANDO";
        DOM.turnStatus.className = isMyTurn ? "font-black text-sm text-poke-blue dark:text-blue-400 animate-pulse" : "font-bold text-sm text-slate-400 dark:text-slate-500";
    },

    showWinner: (isMeWinner, oppSecret) => {
        DOM.winnerTitle.textContent = isMeWinner ? "¡GANASTE!" : "DERROTA";
        DOM.winnerTitle.className = isMeWinner ? "text-4xl font-black mb-2 text-green-500" : "text-4xl font-black mb-2 text-red-500";
        DOM.winnerSubtitle.textContent = isMeWinner ? "¡Adivinaste correctamente!" : "Tu rival ganó la partida";
        DOM.winnerRevealImg.src = oppSecret.image;
        DOM.winnerRevealName.textContent = oppSecret.name;
        DOM.winnerModal.classList.remove('hidden');
    },

    updateVisibilityBtn: () => {
        if (gameState.hideEliminated) {
            DOM.visibilityBtn.classList.add('bg-blue-100', 'text-blue-600', 'dark:bg-blue-900/50', 'dark:text-blue-300');
        } else {
            DOM.visibilityBtn.classList.remove('bg-blue-100', 'text-blue-600', 'dark:bg-blue-900/50', 'dark:text-blue-300');
        }
    },

    updateFilterButton: (count) => {
        if (count > 0) {
            DOM.askTypesBtn.disabled = false;
            DOM.askTypesBtn.classList.remove('bg-slate-300', 'cursor-not-allowed', 'dark:bg-slate-700');
            DOM.askTypesBtn.classList.add('bg-blue-600', 'hover:bg-blue-700', 'shadow-lg');
            DOM.askTypesBtn.textContent = `Preguntar por ${count} Tipo${count > 1 ? 's' : ''}`;
        } else {
            DOM.askTypesBtn.disabled = true;
            DOM.askTypesBtn.classList.add('bg-slate-300', 'cursor-not-allowed', 'dark:bg-slate-700');
            DOM.askTypesBtn.classList.remove('bg-blue-600', 'hover:bg-blue-700', 'shadow-lg');
            DOM.askTypesBtn.textContent = "Selecciona tipos primero";
        }
    },

    updateTheme: () => {
        if (document.documentElement.classList.contains('dark')) {
            document.documentElement.classList.remove('dark');
            localStorage.setItem('theme', 'light');
        } else {
            document.documentElement.classList.add('dark');
            localStorage.setItem('theme', 'dark');
        }
        UI.updateThemeIcon();
    },

    updateThemeIcon: () => {
        const isDark = document.documentElement.classList.contains('dark');
        DOM.themeIcon.textContent = isDark ? '☀️' : '🌙';
    },

    initTheme: () => {
        if (localStorage.theme === 'dark' || (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }
        UI.updateThemeIcon();
    },

    resetViews: () => {
        DOM.winnerModal.classList.add('hidden');
        DOM.gameBoardScreen.classList.add('hidden');
        DOM.setupScreen.classList.add('hidden');
        DOM.lobbyScreen.classList.add('hidden');
        DOM.selectionScreen.classList.add('hidden');
        DOM.waitingScreen.classList.add('hidden');
        DOM.interstitialScreen.classList.add('hidden');
        DOM.filterModal.classList.add('hidden');
        DOM.roomCodeDisplay.classList.add('hidden');
        
        DOM.modeScreen.classList.remove('hidden');
        DOM.visibilityBtn.classList.remove('bg-blue-100', 'text-blue-600', 'dark:bg-blue-900/50', 'dark:text-blue-300');
        DOM.guessBtn.classList.remove('opacity-50', 'cursor-not-allowed');
    }
};