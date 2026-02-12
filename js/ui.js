import { gameState } from './state.js';

export const typeTranslations = {
    normal: "Normal", fire: "Fuego", water: "Agua", grass: "Planta",
    electric: "Eléctrico", ice: "Hielo", fighting: "Lucha", poison: "Veneno",
    ground: "Tierra", flying: "Volador", psychic: "Psíquico", bug: "Bicho",
    rock: "Roca", ghost: "Fantasma", dragon: "Dragón", steel: "Acero", fairy: "Hada",dark: "siniestro"
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
    get hudSecretTypes() { return document.getElementById('hudSecretTypes'); },
    get winnerTitle() { return document.getElementById('winnerTitle'); },
    get winnerSubtitle() { return document.getElementById('winnerSubtitle'); },
    get winnerRevealImg() { return document.getElementById('winnerRevealImg'); },
    get winnerRevealName() { return document.getElementById('winnerRevealName'); },
    
    // UI Modal Elementos
    get uiModalTitle() { return document.getElementById('uiModalTitle'); },
    get uiModalText() { return document.getElementById('uiModalText'); },
    get uiModalConfirm() { return document.getElementById('uiModalConfirm'); },
    get uiModalCancel() { return document.getElementById('uiModalCancel'); },
    
    // Botones
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
            if(DOM.connectionStatus) {
                DOM.connectionStatus.textContent = "● Conectado";
                DOM.connectionStatus.className = "mb-4 text-xs font-bold text-green-500";
            }
        } else {
            if(DOM.connectionStatus) {
                DOM.connectionStatus.textContent = "Offline";
                DOM.connectionStatus.className = "mb-4 text-xs font-bold text-red-500";
            }
        }
    },

    // --- MODAL PERSONALIZADO (NO CONFIRM NATIVO) ---
    showModal: (title, text, onConfirm, isAlert = false) => {
        if(DOM.uiModalTitle) DOM.uiModalTitle.textContent = title;
        if(DOM.uiModalText) DOM.uiModalText.textContent = text;
        DOM.uiModal.classList.remove('hidden');
        
        // Clonamos para limpiar eventos previos
        const oldConfirm = document.getElementById('uiModalConfirm');
        const oldCancel = document.getElementById('uiModalCancel');
        const newConfirm = oldConfirm.cloneNode(true);
        const newCancel = oldCancel.cloneNode(true);
        oldConfirm.parentNode.replaceChild(newConfirm, oldConfirm);
        oldCancel.parentNode.replaceChild(newCancel, oldCancel);

        const btnConfirm = document.getElementById('uiModalConfirm');
        const btnCancel = document.getElementById('uiModalCancel');

        btnCancel.classList.remove('hidden');

        if (isAlert) {
            btnCancel.classList.add('hidden');
            btnConfirm.textContent = "Aceptar";
            btnConfirm.className = "bg-blue-500 text-white w-full py-3 rounded-xl font-bold";
            
            btnConfirm.onclick = () => {
                 DOM.uiModal.classList.add('hidden');
                 if(onConfirm) onConfirm();
            };
        } else {
            btnConfirm.textContent = "Confirmar";
            btnCancel.textContent = "Cancelar";
            
            btnConfirm.className = "bg-blue-500 text-white py-3 rounded-xl font-bold flex-1";
            btnCancel.className = "bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-white py-3 rounded-xl font-bold flex-1";

            btnConfirm.onclick = () => {
                 DOM.uiModal.classList.add('hidden');
                 if(onConfirm) onConfirm();
            };
            
            btnCancel.onclick = () => {
                DOM.uiModal.classList.add('hidden');
            };
        }
    },

    showQuestionModal: (criteria, isType, onResponse, isGeneration = false) => {
        let questionText = "";
        if (isGeneration) {
            const genName = criteria[0].charAt(0).toUpperCase() + criteria[0].slice(1);
            questionText = `¿El Pokémon es de la generación ${genName}?`;
        } else if (isType) {
            const translatedTypes = criteria.map(t => typeTranslations[t] || t);
            if (translatedTypes.length === 1) {
                questionText = `¿Tiene el tipo ${translatedTypes[0]}?`;
            } else {
                questionText = `¿Tiene alguno de los tipos: ${translatedTypes.join(' o ')}?`;
            }
        } else {
            if (criteria[0] === 'single') questionText = "¿Tiene UN solo tipo?";
            else if (criteria[0] === 'dual') questionText = "¿Tiene DOS tipos?";
        }

        DOM.uiModalTitle.textContent = "¡El rival pregunta!";
        DOM.uiModalText.textContent = questionText;
        DOM.uiModal.classList.remove('hidden');
        
        // Clonar botones para limpiar eventos
        const oldConfirm = document.getElementById('uiModalConfirm');
        const oldCancel = document.getElementById('uiModalCancel');
        const newConfirm = oldConfirm.cloneNode(true);
        const newCancel = oldCancel.cloneNode(true);
        oldConfirm.parentNode.replaceChild(newConfirm, oldConfirm);
        oldCancel.parentNode.replaceChild(newCancel, oldCancel);

        const btnConfirm = document.getElementById('uiModalConfirm');
        const btnCancel = document.getElementById('uiModalCancel');

        btnConfirm.textContent = "SÍ";
        btnConfirm.className = "bg-green-500 hover:bg-green-600 text-white font-bold py-3 rounded-xl flex-1"; 
        btnConfirm.onclick = () => {
             DOM.uiModal.classList.add('hidden');
             onResponse(true);
        };

        btnCancel.textContent = "NO";
        btnCancel.className = "bg-red-500 hover:bg-red-600 text-white font-bold py-3 rounded-xl flex-1"; 
        btnCancel.classList.remove('hidden');
        btnCancel.onclick = () => {
            DOM.uiModal.classList.add('hidden');
            onResponse(false);
        };
    },

    closeModal: () => DOM.uiModal.classList.add('hidden'),

    // --- RENDERIZADO VISUAL CORRECTO ---
    renderGrid: (container, list, onClick, eliminatedSet = new Set()) => {
        if (!container || !Array.isArray(list)) return;
        container.innerHTML = '';
        
        const fragment = document.createDocumentFragment();
        const isGuessModal = container.id === 'guessGrid';

        list.forEach(poke => {
            const isEliminated = eliminatedSet.has(poke.id);
            if (gameState.hideEliminated && isEliminated) return;

            const div = document.createElement('div');
            
            // Usamos tu clase 'card' para mantener la estética original en el tablero principal
            // Y un estilo más simple pero consistente para el modal de arriesgar
            if (isGuessModal) {
                div.className = `relative rounded-xl p-2 border border-slate-200 dark:border-slate-700 flex flex-col items-center justify-between transition-all select-none
                    ${isEliminated ? 'opacity-25 grayscale bg-slate-100 dark:bg-slate-900' : 'bg-white dark:bg-slate-800 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700'}`;
            } else {
                div.className = `card relative rounded-xl p-1 shadow-sm ${isEliminated ? 'eliminated' : 'cursor-pointer hover:scale-105'}`;
                // Agregamos la clase de tipo principal para bordes o efectos si tu CSS lo usa
                div.classList.add(`t-${poke.types[0].toLowerCase()}`); 
                div.classList.add('card-border'); // Borde inferior de color
            }

            // --- AQUÍ ESTÁ EL FIX DE LOS CÍRCULOS ---
            // Usamos las clases de Tailwind (t-fire, t-water) + bg-type-filled para que el CSS pinte el color
            const typesHtml = poke.types.map(t => 
                `<span class="w-3 h-3 rounded-full t-${t.toLowerCase()} bg-type-filled border border-slate-100 dark:border-slate-700 shadow-sm" title="${typeTranslations[t] || t}"></span>`
            ).join('');

            if (isGuessModal) {
                 div.innerHTML = `
                    <img src="${poke.image}" class="w-16 h-16 object-contain mb-1 pointer-events-none" loading="lazy">
                    <div class="text-[10px] font-bold truncate w-full text-center text-slate-700 dark:text-slate-200 pointer-events-none">${poke.name}</div>
                    <div class="flex justify-center gap-1 mt-1 pointer-events-none">${typesHtml}</div>
                `;
            } else {
                // Diseño original del tablero
                div.innerHTML = `
                    <img src="${poke.image}" class="w-full aspect-square object-contain bg-slate-50 dark:bg-slate-900 rounded-lg mb-1" loading="lazy">
                    <div class="text-center text-[10px] sm:text-xs font-bold truncate px-1 text-slate-700 dark:text-slate-200">${poke.name}</div>
                    <div class="flex justify-center gap-1 mt-1 pb-1">${typesHtml}</div>
                `;
            }
            
            div.onclick = (e) => { e.stopPropagation(); onClick(poke); };
            fragment.appendChild(div);
        });
        
        container.appendChild(fragment);
    },

    updateHUD: (secret, isMyTurn) => {
        if (!secret) return;
        DOM.hudSecretImg.src = secret.image;
        DOM.hudSecretName.textContent = secret.name;

        // Render types
        const typesContainer = document.getElementById('hudSecretTypes');
        if (typesContainer) {
            typesContainer.innerHTML = ''; // Limpiar tipos anteriores
            secret.types.forEach(type => {
                const typeSpan = document.createElement('span');
                typeSpan.className = `w-4 h-4 rounded-full t-${type.toLowerCase()} bg-type-filled border border-slate-100 dark:border-slate-700 shadow-sm`;
                typeSpan.title = typeTranslations[type.toLowerCase()] || type;
                typesContainer.appendChild(typeSpan);
            });
        }
        
        DOM.turnStatus.textContent = isMyTurn ? "TU TURNO" : "ESPERANDO";
        DOM.turnStatus.className = isMyTurn ? "font-black text-sm text-blue-500 animate-pulse" : "font-bold text-sm text-slate-400";
    },

    showWinner: (isMeWinner, oppSecret) => {
        if(DOM.winnerTitle) {
            DOM.winnerTitle.textContent = isMeWinner ? "¡GANASTE!" : "DERROTA";
            DOM.winnerTitle.className = isMeWinner ? "text-3xl font-black mb-2 text-green-500" : "text-3xl font-black mb-2 text-red-500";
        }
        
        if(DOM.winnerSubtitle) {
            DOM.winnerSubtitle.textContent = isMeWinner ? "¡Adivinaste correctamente!" : "Tu rival ganó la partida";
        }
        
        if (oppSecret) {
            if(DOM.winnerRevealImg) DOM.winnerRevealImg.src = oppSecret.image;
            if(DOM.winnerRevealName) DOM.winnerRevealName.textContent = oppSecret.name;
        }
        DOM.winnerModal.classList.remove('hidden');
    },

    updateVisibilityBtn: () => {
        if (!DOM.visibilityBtn) return;
        if (gameState.hideEliminated) {
            DOM.visibilityBtn.classList.add('bg-blue-100', 'text-blue-600', 'border-blue-300');
            DOM.visibilityBtn.classList.remove('bg-slate-100', 'dark:bg-slate-800');
        } else {
            DOM.visibilityBtn.classList.remove('bg-blue-100', 'text-blue-600', 'border-blue-300');
            DOM.visibilityBtn.classList.add('bg-slate-100', 'dark:bg-slate-800');
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
        DOM.guessModal.classList.add('hidden');
        
        DOM.modeScreen.classList.remove('hidden');
        
        if (DOM.visibilityBtn) {
            DOM.visibilityBtn.classList.remove('bg-blue-100', 'text-blue-600');
        }
        if (DOM.guessBtn) DOM.guessBtn.classList.remove('opacity-50', 'cursor-not-allowed');
    }
};