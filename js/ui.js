
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
    
    // UI Modal Elementos
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
            DOM.connectionStatus.textContent = "● Conectado";
            DOM.connectionStatus.style.color = "green";
        } else {
            DOM.connectionStatus.textContent = "Offline";
            DOM.connectionStatus.style.color = "red";
        }
    },

   
    showModal: (title, text, onConfirm, isAlert = false) => {
        DOM.uiModalTitle.textContent = title;
        DOM.uiModalText.textContent = text;
        DOM.uiModal.classList.remove('hidden');
        
        // Clonación para limpiar eventos
        const oldConfirm = DOM.uiModalConfirm;
        const oldCancel = DOM.uiModalCancel;
        const newConfirm = oldConfirm.cloneNode(true);
        const newCancel = oldCancel.cloneNode(true);
        oldConfirm.parentNode.replaceChild(newConfirm, oldConfirm);
        oldCancel.parentNode.replaceChild(newCancel, oldCancel);
        
        // Resetear textos y visibilidad
        newConfirm.textContent = isAlert ? "OK" : "Confirmar";
        newCancel.textContent = "Cancelar";
        
        // --- APLICAR CLASES CSS MANUALMENTE PARA ASEGURAR ESTILO ---
        // Botón Confirmar (Azul)
        newConfirm.className = "btn-primary flex-1"; // Usa la clase de styles.css
        
        // Botón Cancelar (Gris)
        newCancel.className = "btn-secondary flex-1"; // Usa la clase de styles.css

        if (isAlert) {
            newCancel.classList.add('hidden'); // Ocultar cancelar en alertas
            newConfirm.onclick = () => {
                 DOM.uiModal.classList.add('hidden');
                 if(onConfirm) onConfirm();
            };
        } else {
            newCancel.classList.remove('hidden');
            newConfirm.onclick = () => {
                 DOM.uiModal.classList.add('hidden');
                 if(onConfirm) onConfirm();
            };
            newCancel.onclick = () => DOM.uiModal.classList.add('hidden');
        }
    },

    closeModal: () => DOM.uiModal.classList.add('hidden'),

    renderGrid: (container, list, onClick, eliminatedSet = new Set()) => {
        if (!container) return;
        container.innerHTML = '';
        list.forEach(poke => {
            const isEliminated = eliminatedSet.has(poke.id);
            if (gameState.hideEliminated && isEliminated) return;

            const div = document.createElement('div');
            // Aplicar clases de CSS puro
            div.className = `card ${isEliminated ? 'eliminated' : ''}`;
            
            // Añadir clase de color de tipo (ej: t-fire)
            // IMPORTANTE: Aseguramos que el CSS tenga estos colores definidos
            const typeClass = `t-${poke.types[0]}`;
            div.classList.add(typeClass);
            div.classList.add('card-border'); // Borde inferior de color

            // Crear bolitas de tipos
            const typesHtml = poke.types.map(t => 
                `<span class="type-badge t-${t}" title="${typeTranslations[t] || t}"></span>`
            ).join('');

            div.innerHTML = `
                <img src="${poke.image}" loading="lazy">
                <div style="font-weight:bold; font-size:0.75rem; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; padding:0 4px;">${poke.name}</div>
                <div style="display:flex; justify-content:center; gap:4px; margin-top:4px;">${typesHtml}</div>
            `;
            
            div.onclick = (e) => { e.stopPropagation(); onClick(poke); };
            container.appendChild(div);
        });
    },

    updateHUD: (secret, isMyTurn) => {
        DOM.hudSecretImg.src = secret.image;
        DOM.hudSecretName.textContent = secret.name;
        DOM.turnStatus.textContent = isMyTurn ? "TU TURNO" : "ESPERANDO";
        // Estilos directos para asegurar visibilidad
        DOM.turnStatus.style.color = isMyTurn ? "var(--poke-blue)" : "gray";
        DOM.turnStatus.style.fontWeight = "900";
    },

    showWinner: (isMeWinner, oppSecret) => {
        DOM.winnerTitle.textContent = isMeWinner ? "¡GANASTE!" : "DERROTA";
        DOM.winnerTitle.style.color = isMeWinner ? "green" : "red";
        DOM.winnerSubtitle.textContent = isMeWinner ? "¡Adivinaste correctamente!" : "Tu rival ganó la partida";
        DOM.winnerRevealImg.src = oppSecret.image;
        DOM.winnerRevealName.textContent = oppSecret.name;
        DOM.winnerModal.classList.remove('hidden');
    },

    updateVisibilityBtn: () => {
        if (!DOM.visibilityBtn) return;
        // Cambiar estilo visual si está activo
        if (gameState.hideEliminated) {
            DOM.visibilityBtn.style.backgroundColor = "#dbeafe"; // blue-100
            DOM.visibilityBtn.style.color = "#2563eb"; // blue-600
        } else {
            DOM.visibilityBtn.style.backgroundColor = ""; // reset
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
        
        // Resetear estilos manuales
        if(DOM.visibilityBtn) {
             DOM.visibilityBtn.style.backgroundColor = ""; 
             DOM.visibilityBtn.style.color = "";
        }
        if (DOM.guessBtn) DOM.guessBtn.classList.remove('opacity-50', 'cursor-not-allowed');
    }
};