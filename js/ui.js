import { gameState } from './state.js';

export const typeTranslations = {
    normal: "Normal", fire: "Fuego", water: "Agua", grass: "Planta",
    electric: "Eléctrico", ice: "Hielo", fighting: "Lucha", poison: "Veneno",
    ground: "Tierra", flying: "Volador", psychic: "Psíquico", bug: "Bicho",
    rock: "Roca", ghost: "Fantasma", dragon: "Dragón", steel: "Acero", fairy: "Hada"
};

const DOM = {
    // Pantallas
    get modeScreen() { return document.getElementById('modeScreen'); },
    get lobbyScreen() { return document.getElementById('lobbyScreen'); },
    get waitingScreen() { return document.getElementById('waitingScreen'); },
    get setupScreen() { return document.getElementById('setupScreen'); },
    get loadingScreen() { return document.getElementById('loadingScreen'); },
    get selectionScreen() { return document.getElementById('selectionScreen'); },
    get gameBoardScreen() { return document.getElementById('gameBoardScreen'); },
    get interstitialScreen() { return document.getElementById('interstitialScreen'); },
    get onlineWaitScreen() { return document.getElementById('onlineWaitScreen'); },
    
    // Modales
    get guessModal() { return document.getElementById('guessModal'); },
    get winnerModal() { return document.getElementById('winnerModal'); },
    get filterModal() { return document.getElementById('filterModal'); },
    get uiModal() { return document.getElementById('uiModal'); },
    
    // Elementos internos
    get btnOnline() { return document.getElementById('btn-mode-online'); },
    get connectionStatus() { return document.getElementById('connectionStatus'); },
    get waitingCode() { return document.getElementById('waitingCode'); },
    get joinCodeInput() { return document.getElementById('joinCodeInput'); },
    get roomCodeDisplay() { return document.getElementById('roomCodeDisplay'); },
    get turnStatus() { return document.getElementById('turnStatus'); },
    
    // Grids
    get selectionGrid() { return document.getElementById('selectionGrid'); },
    get mainGrid() { return document.getElementById('mainGrid'); },
    get guessGrid() { return document.getElementById('guessGrid'); },
    get filterTypeGrid() { return document.getElementById('filterTypeGrid'); },
    
    // HUD y Textos
    get hudSecretImg() { return document.getElementById('hudSecretImg'); },
    get hudSecretName() { return document.getElementById('hudSecretName'); },
    get winnerTitle() { return document.getElementById('winnerTitle'); },
    get winnerSubtitle() { return document.getElementById('winnerSubtitle'); },
    get winnerRevealImg() { return document.getElementById('winnerRevealImg'); },
    get winnerRevealName() { return document.getElementById('winnerRevealName'); },
    
    // UI Modal Elementos (Botones directos)
    get uiModalTitle() { return document.getElementById('uiModalTitle'); },
    get uiModalText() { return document.getElementById('uiModalText'); },
    get uiModalConfirm() { return document.getElementById('uiModalConfirm'); },
    get uiModalCancel() { return document.getElementById('uiModalCancel'); },
    
    // Botones de acción
    get guessBtn() { return document.getElementById('btn-open-guess'); },
    get askTypesBtn() { return document.getElementById('askTypesBtn'); },
    get visibilityBtn() { return document.getElementById('btn-visibility'); },
    get themeIcon() { return document.getElementById('themeIcon'); },
    
    // Overlays
    get guessModalOverlay() { return document.getElementById('guessModalOverlay'); },
    get filterModalOverlay() { return document.getElementById('filterModalOverlay'); },
    get uiModalOverlay() { return document.getElementById('uiModalOverlay'); }
};

export const UI = {
    elements: DOM,
    
    showLoading: (show) => {
        if (!DOM.loadingScreen) return;
        if(show) DOM.loadingScreen.classList.remove('hidden');
        else DOM.loadingScreen.classList.add('hidden');
    },

    setConnectionStatus: (connected) => {
        if (!DOM.btnOnline) return;
        if (connected) {
            DOM.btnOnline.classList.remove('opacity-50', 'cursor-not-allowed');
            DOM.btnOnline.disabled = false;
            DOM.connectionStatus.textContent = "● Conectado";
            DOM.connectionStatus.style.color = "green";
        } else {
            DOM.connectionStatus.textContent = "Offline";
            DOM.connectionStatus.style.color = "red";
        }
    },

    // --- FUNCIÓN SHOWMODAL SIMPLIFICADA (Sin clonación) ---
    showModal: (title, text, onConfirm, isAlert = false) => {
        DOM.uiModalTitle.textContent = title;
        DOM.uiModalText.textContent = text;
        DOM.uiModal.classList.remove('hidden');
        
        const btnConfirm = DOM.uiModalConfirm;
        const btnCancel = DOM.uiModalCancel;

        // Reiniciar visibilidad
        btnCancel.classList.remove('hidden');

        if (isAlert) {
            btnCancel.classList.add('hidden');
            btnConfirm.textContent = "OK";
            btnConfirm.className = "btn-primary w-full"; // Clase sólida azul
            
            btnConfirm.onclick = () => {
                 DOM.uiModal.classList.add('hidden');
                 if(onConfirm) onConfirm();
            };
        } else {
            btnConfirm.textContent = "Confirmar";
            btnCancel.textContent = "Cancelar";
            
            btnConfirm.className = "btn-primary flex-1";
            btnCancel.className = "btn-secondary flex-1";

            btnConfirm.onclick = () => {
                 DOM.uiModal.classList.add('hidden');
                 if(onConfirm) onConfirm();
            };
            
            // Importante: onclick simple para cancelar
            btnCancel.onclick = () => {
                DOM.uiModal.classList.add('hidden');
            };
        }
    },

    // --- MODAL DE PREGUNTA AL RIVAL ---
    showQuestionModal: (criteria, isType, onResponse) => {
        let questionText = "";
        if (isType) {
            const translatedTypes = criteria.map(t => typeTranslations[t] || t);
            if (translatedTypes.length === 1) questionText = `¿Tiene el tipo ${translatedTypes[0]}?`;
            else questionText = `¿Tiene alguno de los tipos: ${translatedTypes.join(' o ')}?`;
        } else {
            if (criteria[0] === 'single') questionText = "¿Tiene UN solo tipo?";
            else if (criteria[0] === 'dual') questionText = "¿Tiene DOS tipos?";
        }

        DOM.uiModalTitle.textContent = "¡El rival pregunta!";
        DOM.uiModalText.textContent = questionText;
        DOM.uiModal.classList.remove('hidden');
        
        const btnConfirm = DOM.uiModalConfirm;
        const btnCancel = DOM.uiModalCancel;

        // Configuración para SÍ
        btnConfirm.textContent = "SÍ";
        btnConfirm.className = "btn-success flex-1 py-3"; // Verde
        btnConfirm.onclick = () => {
             DOM.uiModal.classList.add('hidden');
             onResponse(true);
        };

        // Configuración para NO
        btnCancel.textContent = "NO";
        btnCancel.className = "btn-danger flex-1 py-3"; // Rojo
        btnCancel.classList.remove('hidden');
        btnCancel.onclick = () => {
            DOM.uiModal.classList.add('hidden');
            onResponse(false);
        };
    },

    closeModal: () => DOM.uiModal.classList.add('hidden'),

    renderGrid: (container, list, onClick, eliminatedSet = new Set()) => {
        if (!container || !Array.isArray(list)) return;
        container.innerHTML = '';
        list.forEach(poke => {
            const isEliminated = eliminatedSet.has(poke.id);
            if (gameState.hideEliminated && isEliminated) return;

            const div = document.createElement('div');
            div.className = `card relative rounded-xl p-1 shadow-sm ${isEliminated ? 'eliminated' : 'cursor-pointer hover:scale-105'}`;
            
            div.classList.add(`t-${poke.types[0]}`);
            div.classList.add('border-type-bottom');

            const typesHtml = poke.types.map(t => 
                `<span class="type-badge t-${t} bg-type-filled border border-white dark:border-slate-700 shadow-sm" title="${typeTranslations[t] || t}"></span>`
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
        if (!secret) return;
        DOM.hudSecretImg.src = secret.image;
        DOM.hudSecretName.textContent = secret.name;
        
        DOM.turnStatus.textContent = isMyTurn ? "TU TURNO" : "ESPERANDO";
        DOM.turnStatus.style.color = isMyTurn ? "#3B82F6" : "#94a3b8"; 
        DOM.turnStatus.style.fontWeight = "900";
    },

    showWinner: (isMeWinner, oppSecret) => {
        DOM.winnerTitle.textContent = isMeWinner ? "¡GANASTE!" : "DERROTA";
        DOM.winnerTitle.style.color = isMeWinner ? "#22c55e" : "#ef4444";
        DOM.winnerSubtitle.textContent = isMeWinner ? "¡Adivinaste correctamente!" : "Tu rival ganó la partida";
        if (oppSecret) {
            DOM.winnerRevealImg.src = oppSecret.image;
            DOM.winnerRevealName.textContent = oppSecret.name;
        }
        DOM.winnerModal.classList.remove('hidden');
    },

    updateVisibilityBtn: () => {
        if (!DOM.visibilityBtn) return;
        if (gameState.hideEliminated) {
            DOM.visibilityBtn.style.backgroundColor = "#dbeafe";
            DOM.visibilityBtn.style.color = "#2563eb";
        } else {
            DOM.visibilityBtn.style.backgroundColor = "";
            DOM.visibilityBtn.style.color = "";
        }
    },

    updateFilterButton: (count) => {
        if (!DOM.askTypesBtn) return;
        if (count > 0) {
            DOM.askTypesBtn.disabled = false;
            DOM.askTypesBtn.classList.remove('opacity-50', 'cursor-not-allowed');
            DOM.askTypesBtn.textContent = `Preguntar por ${count} Tipo${count > 1 ? 's' : ''}`;
        } else {
            DOM.askTypesBtn.disabled = true;
            DOM.askTypesBtn.classList.add('opacity-50', 'cursor-not-allowed');
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
        if (DOM.themeIcon) DOM.themeIcon.textContent = isDark ? '☀️' : '🌙';
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
        
        if (DOM.visibilityBtn) {
            DOM.visibilityBtn.style.backgroundColor = "";
            DOM.visibilityBtn.style.color = "";
        }
        if (DOM.guessBtn) DOM.guessBtn.classList.remove('opacity-50', 'cursor-not-allowed');
    }
};