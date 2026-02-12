import { db, doc, updateDoc, onSnapshot, getDoc, collection, addDoc, setDoc } from './firebase.js';
import { gameState, resetGameState } from './state.js';
import { UI, typeTranslations } from './ui.js';

export const REGION_RANGES = {
    kanto: [1, 151], johto: [152, 251], hoenn: [252, 386], sinnoh: [387, 493],
    unova: [494, 649], kalos: [650, 721], alola: [722, 809], galar: [810, 905], paldea: [906, 1025]
};

export const Game = {
    unsub: null,

    resetGame: () => {
        if (Game.unsub) Game.unsub();
        
        if (window.location.hash) {
            history.pushState("", document.title, window.location.pathname + window.location.search);
        }

        resetGameState();
        UI.resetViews();
        UI.showLoading(false);
        
        if (UI.elements.selectionGrid) UI.elements.selectionGrid.innerHTML = '';
        if (UI.elements.mainGrid) UI.elements.mainGrid.innerHTML = '';
        if (UI.elements.guessGrid) UI.elements.guessGrid.innerHTML = '';

        document.querySelectorAll('.region-btn').forEach(btn => {
            btn.classList.add('opacity-50', 'bg-slate-100', 'dark:bg-slate-800');
            btn.classList.remove('ring-2', 'ring-blue-500', 'bg-blue-50', 'dark:bg-blue-900/40', 'opacity-100');
        });
        document.querySelectorAll('#setup-type-grid button').forEach(btn => {
            btn.classList.add('opacity-50');
            btn.classList.remove('ring-2', 'ring-white', 'scale-105', 'opacity-100');
        });
    },

    selectMode: (mode) => {
        gameState.mode = mode;
        UI.elements.modeScreen.classList.add('hidden');
        if (mode === 'local') {
            Game.initSetupUI();
        } else {
            UI.elements.lobbyScreen.classList.remove('hidden');
        }
    },

    initSetupUI: () => {
        UI.elements.setupScreen.classList.remove('hidden');
        const container = document.getElementById('setup-type-grid');
        if (container && container.children.length === 0) {
            Object.keys(typeTranslations).forEach(type => {
                const btn = document.createElement('button');
                btn.className = `p-2 rounded-lg font-bold text-[10px] uppercase shadow-sm border-2 border-transparent transition-all opacity-50 t-${type} bg-type-filled text-white`;
                btn.textContent = typeTranslations[type];
                btn.dataset.type = type;
                btn.onclick = () => Game.toggleTypeSetup(type, btn);
                container.appendChild(btn);
            });
        }
        Game.updateStartButton();
    },

    toggleRegion: (region, btnElement) => {
        if (gameState.config.selectedRegions.has(region)) {
            gameState.config.selectedRegions.delete(region);
            btnElement.classList.add('opacity-50', 'bg-slate-100', 'dark:bg-slate-800');
            btnElement.classList.remove('ring-2', 'ring-blue-500', 'bg-blue-50', 'dark:bg-blue-900/40', 'opacity-100');
        } else {
            gameState.config.selectedRegions.add(region);
            btnElement.classList.remove('opacity-50', 'bg-slate-100', 'dark:bg-slate-800');
            btnElement.classList.add('ring-2', 'ring-blue-500', 'bg-blue-50', 'dark:bg-blue-900/40', 'opacity-100');
        }
        Game.updateStartButton();
    },

    toggleTypeSetup: (type, btnElement) => {
        if (gameState.config.selectedTypes.has(type)) {
            gameState.config.selectedTypes.delete(type);
            btnElement.classList.add('opacity-50');
            btnElement.classList.remove('ring-2', 'ring-white', 'scale-105', 'opacity-100');
        } else {
            gameState.config.selectedTypes.add(type);
            btnElement.classList.remove('opacity-50');
            btnElement.classList.add('ring-2', 'ring-white', 'scale-105', 'opacity-100');
        }
        Game.updateStartButton();
    },

    toggleAllTypes: () => {
        const allTypes = Object.keys(typeTranslations);
        const container = document.getElementById('setup-type-grid');
        const buttons = container.querySelectorAll('button');
        if (gameState.config.selectedTypes.size === allTypes.length) {
            gameState.config.selectedTypes.clear();
            buttons.forEach(btn => {
                btn.classList.add('opacity-50');
                btn.classList.remove('ring-2', 'ring-white', 'scale-105', 'opacity-100');
            });
        } else {
            allTypes.forEach(t => gameState.config.selectedTypes.add(t));
            buttons.forEach(btn => {
                btn.classList.remove('opacity-50');
                btn.classList.add('ring-2', 'ring-white', 'scale-105', 'opacity-100');
            });
        }
        Game.updateStartButton();
    },

    filterPokemonDB: () => {
        const regions = Array.from(gameState.config.selectedRegions);
        const types = Array.from(gameState.config.selectedTypes);
        
        let filtered = gameState.fullPokemonDB.filter(p => {
            return regions.some(rKey => {
                const range = REGION_RANGES[rKey];
                return p.id >= range[0] && p.id <= range[1];
            });
        });

        if (types.length > 0) {
            filtered = filtered.filter(p => p.types.some(t => types.includes(t.toLowerCase())));
        }

        gameState.pokemonList = filtered;
        return filtered.length;
    },

    updateStartButton: () => {
        const count = Game.filterPokemonDB();
        const btn = document.getElementById('btn-start-game');
        const countDisplay = document.getElementById('count-display');
        if (btn && countDisplay) {
            countDisplay.textContent = count;
            if (gameState.config.selectedRegions.size > 0 && count > 0) {
                btn.disabled = false;
                btn.classList.remove('opacity-50', 'cursor-not-allowed');
            } else {
                btn.disabled = true;
                btn.classList.add('opacity-50', 'cursor-not-allowed');
            }
        }
    },

    startGameConfirmed: async () => {
        if (gameState.mode === 'local') {
            Game.startSelectionPhase();
        } else {
            if (!gameState.online.gameId) return;
            await updateDoc(doc(db, 'games', gameState.online.gameId), {
                config: {
                    regions: Array.from(gameState.config.selectedRegions),
                    types: Array.from(gameState.config.selectedTypes)
                },
                phase: 'selection'
            });
        }
    },

    startSelectionPhase: () => {
        UI.elements.setupScreen.classList.add('hidden');
        UI.elements.selectionScreen.classList.remove('hidden');
        
        gameState.local.p1.pokemon = null;
        gameState.local.p2.pokemon = null;

        UI.renderGrid(UI.elements.selectionGrid, gameState.pokemonList, (poke) => {
            
            if (gameState.mode === 'local') {
                const isP1Turn = !gameState.local.p1.pokemon;
                const playerLabel = isP1Turn ? "Jugador 1" : "Jugador 2";

                UI.showModal(`Selección ${playerLabel}`, `¿Eliges a ${poke.name}?`, () => {
                    if (isP1Turn) {
                        gameState.local.p1.pokemon = poke;
                        UI.elements.selectionGrid.parentElement.scrollTop = 0;
                        UI.showModal("¡Guardado!", "Ahora elige el Jugador 2. (No mires si eres J1)", () => {}, true);
                    } else {
                        gameState.local.p2.pokemon = poke;
                        Game.initBattlePhase();
                    }
                });

            } else {
                const myRole = gameState.online.role === 'host' ? 'player1' : 'player2';
                UI.showModal("Confirmar", `¿Eliges a ${poke.name}?`, async () => {
                    const update = {};
                    update[`${myRole}.pokemon`] = poke;
                    
                    const opponentRole = myRole === 'player1' ? 'player2' : 'player1';
                    if (gameState.online.data && gameState.online.data[opponentRole] && gameState.online.data[opponentRole].pokemon) {
                        update.phase = 'battle';
                        update.turn = gameState.online.data.host;
                    }
                    await updateDoc(doc(db, 'games', gameState.online.gameId), update);
                });
            }
        });
    },

    initBattlePhase: () => {
        UI.elements.selectionScreen.classList.add('hidden');
        UI.elements.gameBoardScreen.classList.remove('hidden');
        if (gameState.mode === 'local') Game.renderLocalBoard();
    },

    renderLocalBoard: () => {
        const turn = gameState.local.turn; 
        const playerData = turn === 1 ? gameState.local.p1 : gameState.local.p2;
        
        UI.updateHUD(playerData.pokemon, true); 
        
        UI.renderGrid(UI.elements.mainGrid, gameState.pokemonList, (poke) => {
            if (playerData.eliminated.has(poke.id)) playerData.eliminated.delete(poke.id);
            else playerData.eliminated.add(poke.id);
            Game.renderLocalBoard(); 
        }, playerData.eliminated);
    },

    createOnlineRoom: async () => {
        UI.showLoading(true);
        try {
            const roomId = Math.floor(100000 + Math.random() * 900000).toString();
            await setDoc(doc(db, 'games', roomId), {
                host: gameState.online.myId, 
                guest: null, 
                phase: 'lobby', 
                turn: null, 
                config: null,
                player1: { pokemon: null, eliminated: [] }, 
                player2: { pokemon: null, eliminated: [] }, 
                lastAction: null 
            });
            gameState.online.gameId = roomId;
            gameState.online.role = 'host';
            Game.subscribeToGame(roomId);
        } catch (e) { 
            console.error(e); 
            UI.showLoading(false); 
            alert("Error creando sala"); 
        }
    },

    joinGame: async (gameId) => {
        UI.showLoading(true);
        const gameRef = doc(db, 'games', gameId);
        const snap = await getDoc(gameRef);
        if (snap.exists()) {
            const data = snap.data();
            if (!data.guest) {
                await updateDoc(gameRef, { guest: gameState.online.myId });
                gameState.online.gameId = gameId;
                gameState.online.role = 'guest';
                Game.subscribeToGame(gameId);
            } else if (data.guest === gameState.online.myId || data.host === gameState.online.myId) {
                gameState.online.gameId = gameId;
                gameState.online.role = data.host === gameState.online.myId ? 'host' : 'guest';
                Game.subscribeToGame(gameId);
            } else { UI.showLoading(false); alert("Sala llena"); }
        } else { UI.showLoading(false); alert("No encontrada"); }
    },

    subscribeToGame: (gameId) => {
        Game.unsub = onSnapshot(doc(db, 'games', gameId), (docSnap) => {
            UI.showLoading(false);
            const data = docSnap.data();
            gameState.online.data = data; 
            
            if (data.phase === 'lobby') {
                UI.elements.lobbyScreen.classList.add('hidden');
                UI.elements.waitingScreen.classList.remove('hidden');
                UI.elements.waitingCode.textContent = gameId;
                if (data.host && data.guest) {
                    if (gameState.online.role === 'host') {
                        UI.elements.waitingScreen.classList.add('hidden');
                        if (UI.elements.setupScreen.classList.contains('hidden')) Game.initSetupUI();
                    } else {
                        UI.elements.waitingCode.textContent = "Host configurando partida...";
                    }
                }
            }
            
            if (data.phase === 'selection') {
                UI.elements.onlineWaitScreen.classList.add('hidden');
                UI.elements.waitingScreen.classList.add('hidden');
                UI.elements.setupScreen.classList.add('hidden');
                
                if (data.config) {
                    gameState.config.selectedRegions = new Set(data.config.regions);
                    gameState.config.selectedTypes = new Set(data.config.types);
                    Game.filterPokemonDB(); 
                }

                const myRole = gameState.online.role === 'host' ? 'player1' : 'player2';
                
                if (data[myRole].pokemon) {
                    UI.elements.selectionScreen.classList.add('hidden');
                    UI.elements.loadingScreen.classList.remove('hidden'); 
                } else {
                    UI.elements.selectionScreen.classList.remove('hidden');
                    if (UI.elements.selectionGrid.children.length === 0) {
                        Game.startSelectionPhase();
                    }
                }
            }

            if (data.phase === 'battle') {
                UI.elements.selectionScreen.classList.add('hidden');
                UI.elements.loadingScreen.classList.add('hidden');
                UI.elements.gameBoardScreen.classList.remove('hidden');
                
                const myRole = gameState.online.role === 'host' ? 'player1' : 'player2';
                UI.updateHUD(data[myRole].pokemon, data.turn === gameState.online.myId);
                
                UI.renderGrid(UI.elements.mainGrid, gameState.pokemonList, async (poke) => {
                    const current = data[myRole].eliminated || [];
                    const next = current.includes(poke.id) ? current.filter(id=>id!==poke.id) : [...current, poke.id];
                    updateDoc(doc(db, 'games', gameId), { [`${myRole}.eliminated`]: next });
                }, new Set(data[myRole].eliminated));

                if (data.turn === gameState.online.myId) {
                    UI.elements.onlineWaitScreen.classList.add('hidden');
                    gameState.hasGuessedThisTurn = false;
                } else {
                    UI.elements.onlineWaitScreen.classList.remove('hidden');
                }
                Game.handleOnlineActions(data);
            }

            if (data.phase === 'finished') {
                UI.elements.onlineWaitScreen.classList.add('hidden');
                const iWon = data.winner === gameState.online.myId;
                const oppRole = gameState.online.role === 'host' ? 'player2' : 'player1';
                UI.showWinner(iWon, data[oppRole].pokemon);
            }
        });
    },

    makeGuess: async (poke) => {
        if (gameState.mode === 'local') {
            const turn = gameState.local.turn;
            const oppSecret = turn === 1 ? gameState.local.p2.pokemon : gameState.local.p1.pokemon;
            UI.elements.guessModal.classList.add('hidden');
            if (poke.id === oppSecret.id) {
                UI.showWinner(true, oppSecret);
            } else {
                UI.showModal("¡Incorrecto!", `No es ${poke.name}. Pierdes tu turno.`, () => {
                    gameState.local.turn = turn === 1 ? 2 : 1;
                    UI.elements.interstitialScreen.classList.remove('hidden');
                }, true);
            }
        } else {
            const oppRole = gameState.online.role === 'host' ? 'player2' : 'player1';
            UI.elements.guessModal.classList.add('hidden');
            if (poke.id === gameState.online.data[oppRole].pokemon.id) {
                updateDoc(doc(db, 'games', gameState.online.gameId), { phase: 'finished', winner: gameState.online.myId });
            } else {
                UI.showModal("¡Fallaste!", `No es ${poke.name}. Pierdes tu turno.`, () => Game.handleEndTurn(), true);
            }
        }
    },

    // --- MANEJO DE TURNO Y ACCIONES ---
    
    handleEndTurn: async (extraUpdates = {}) => {
        if (gameState.mode === 'online') {
            // Calcular siguiente turno con seguridad
            const currentTurn = gameState.online.data.turn;
            const hostId = gameState.online.data.host;
            const guestId = gameState.online.data.guest;
            
            // Si el turno actual es del host, pasa al guest, y viceversa
            const nextTurn = currentTurn === hostId ? guestId : hostId;
            
            try {
                console.log("Cambiando turno a:", nextTurn, "Actualizaciones extra:", extraUpdates);
                await updateDoc(doc(db, 'games', gameState.online.gameId), { 
                    turn: nextTurn, 
                    lastAction: null,
                    ...extraUpdates 
                });
            } catch (error) {
                console.error("Error al cambiar turno:", error);
                alert("Error de conexión al cambiar turno.");
            }
        } else {
            gameState.local.turn = gameState.local.turn === 1 ? 2 : 1;
            UI.elements.interstitialScreen.classList.remove('hidden');
        }
    },
    
    toggleVisibility: () => {
        gameState.hideEliminated = !gameState.hideEliminated;
        UI.updateVisibilityBtn();
        if (gameState.mode === 'local') {
            Game.renderLocalBoard();
        } else {
            const role = gameState.online.role === 'host' ? 'player1' : 'player2';
            
            const clickHandler = async (poke) => {
                const current = gameState.online.data[role].eliminated || [];
                const next = current.includes(poke.id) 
                    ? current.filter(id => id !== poke.id) 
                    : [...current, poke.id];
                await updateDoc(doc(db, 'games', gameState.online.gameId), { [`${role}.eliminated`]: next });
            };

            UI.renderGrid(
                UI.elements.mainGrid, 
                gameState.pokemonList, 
                clickHandler,
                new Set(gameState.online.data[role].eliminated)
            );
        }
    },
    
    sendQuestion: async (criteria, isType, isGeneration = false) => {
        updateDoc(doc(db, 'games', gameState.online.gameId), { lastAction: { type: 'question', sender: gameState.online.myId, criteria, isType, isGeneration, status: 'pending' } });
    },
    
    handleOnlineActions: (data) => {
        const action = data.lastAction;
        if (!action) return;
        
        // 1. Recibir Pregunta
        if (action.sender !== gameState.online.myId && action.status === 'pending') {
            if (!document.getElementById('uiModal').classList.contains('hidden')) return;
            UI.showQuestionModal(action.criteria, action.isType, (res) => Game.sendResponse(res), action.isGeneration);
        }
        
        // 2. Recibir Respuesta y Aplicar
        if (action.sender === gameState.online.myId && action.status === 'answered') {
            if (!document.getElementById('uiModal').classList.contains('hidden')) return;
            
            UI.showModal("Respuesta", `Dijo: ${action.response ? "SÍ" : "NO"}`, async () => {
                let updates;
                if (action.isGeneration) {
                    updates = Game.applyGenerationFilter(action.criteria, action.response, true);
                } else {
                    updates = Game.applyFilter(action.criteria, action.isType, action.response, true);
                }
                Game.handleEndTurn(updates);
            }, true);
        }
    },
    
    sendResponse: async (res) => {
        const act = gameState.online.data.lastAction;
        updateDoc(doc(db, 'games', gameState.online.gameId), { lastAction: { ...act, status: 'answered', response: res } });
    },
    
    applyFilter: (criteria, isType, keep, getUpdateObj = false) => {
        const toEliminate = [];
        gameState.pokemonList.forEach(p => {
            let matches = false;
            if (isType) matches = criteria.some(t => p.types.map(pt=>pt.toLowerCase()).includes(t.toLowerCase()));
            else {
                if (criteria[0] === 'single') matches = p.types.length === 1;
                if (criteria[0] === 'dual') matches = p.types.length === 2;
            }
            if (keep) { if (!matches) toEliminate.push(p.id); } else { if (matches) toEliminate.push(p.id); }
        });

        if (gameState.mode === 'local') {
            const pData = gameState.local.turn === 1 ? gameState.local.p1 : gameState.local.p2;
            toEliminate.forEach(id => pData.eliminated.add(id));
            Game.renderLocalBoard();
        } else {
            const role = gameState.online.role === 'host' ? 'player1' : 'player2';
            const next = Array.from(new Set([...(gameState.online.data[role].eliminated || []), ...toEliminate]));
            
            if (getUpdateObj) return { [`${role}.eliminated`]: next };
            
            updateDoc(doc(db, 'games', gameState.online.gameId), { [`${role}.eliminated`]: next });
        }
    },

    applyGenerationFilter: (generations, keep, getUpdateObj = false) => {
        const toEliminate = [];
        gameState.pokemonList.forEach(p => {
            const pokemonGeneration = Object.keys(REGION_RANGES).find(gen => {
                const [start, end] = REGION_RANGES[gen];
                return p.id >= start && p.id <= end;
            });

            let matches = generations.includes(pokemonGeneration);
            
            if (keep) {
                if (!matches) toEliminate.push(p.id);
            } else {
                if (matches) toEliminate.push(p.id);
            }
        });

        if (gameState.mode === 'local') {
            const pData = gameState.local.turn === 1 ? gameState.local.p1 : gameState.local.p2;
            toEliminate.forEach(id => pData.eliminated.add(id));
            Game.renderLocalBoard();
        } else {
            const role = gameState.online.role === 'host' ? 'player1' : 'player2';
            const next = Array.from(new Set([...(gameState.online.data[role].eliminated || []), ...toEliminate]));

            if (getUpdateObj) return { [`${role}.eliminated`]: next };

            updateDoc(doc(db, 'games', gameState.online.gameId), { [`${role}.eliminated`]: next });
        }
    }
};