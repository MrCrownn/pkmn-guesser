// --- CORRECCIÓN IMPORT: Agregado arrayUnion que faltaba ---
import { db, doc, updateDoc, onSnapshot, getDoc, collection, addDoc, setDoc, runTransaction, arrayUnion } from './firebase.js';
import { gameState, resetGameState } from './state.js';
import { UI, typeTranslations } from './ui.js';

export const REGION_RANGES = {
    kanto: 'kanto',
    johto: 'original-johto',
    hoenn: 'hoenn',
    sinnoh: 'original-sinnoh',
    unova: 'original-unova',
    kalos: 'kalos-central',
    alola: 'updated-alola',
    galar: ['galar', 'isle-of-armor', 'crown-tundra', 'hisui'],
    paldea: 'paldea'
};

const GENERATION_NAMES = {
    kanto: 'Gen 1', johto: 'Gen 2', hoenn: 'Gen 3', sinnoh: 'Gen 4',
    unova: 'Gen 5', kalos: 'Gen 6', alola: 'Gen 7', galar: 'Gen 8', paldea: 'Gen 9'
};

import { loadAllPokemon } from './api.js';

export const Game = {
    unsub: null,
    isLoadingPokemon: false,
    loadedRegions: null,

    loadPokemon: () => {
        return new Promise(async (resolve) => {
            if (Game.isLoadingPokemon) {
                const checkLoading = setInterval(() => {
                    if (!Game.isLoadingPokemon) {
                        clearInterval(checkLoading);
                        resolve();
                    }
                }, 100);
                return;
            }
    
            const regions = Array.from(gameState.config.selectedRegions);
            if (regions.length === 0) {
                gameState.fullPokemonDB = [];
                resolve();
                return;
            }
    
            Game.isLoadingPokemon = true;
    
            const pokedexNames = regions.map(r => REGION_RANGES[r]).flat();
            
            const onComplete = (pokemonList) => {
                const uniquePokemon = Array.from(new Map(pokemonList.map(p => [p.id, p])).values());
                uniquePokemon.sort((a, b) => a.id - b.id);
                
                gameState.fullPokemonDB = uniquePokemon;
                Game.loadedRegions = new Set(regions);
                Game.isLoadingPokemon = false;
                resolve(); 
            };
            
            const onProgress = (pokedexName, current, total) => {
                const loadingText = document.querySelector("#loadingScreen p");
                if (loadingText) {
                    loadingText.textContent = `Cargando ${pokedexName}... (${current}/${total})`;
                }
            };
    
            await loadAllPokemon(pokedexNames, onProgress, onComplete);
        });
    },

    resetGame: () => {
        if (gameState.mode === 'online' && gameState.online.gameId) {
            Game.resetOnlineGame();
        } else {
            if (Game.unsub) {
                Game.unsub();
                Game.unsub = null;
            }

            if (window.location.hash || window.location.search) {
                try {
                    window.history.replaceState({}, document.title, window.location.pathname);
                } catch (e) {
                    console.log("No se pudo limpiar URL", e);
                }
            }

            resetGameState();
            Game.loadedRegions = null;
            
            UI.elements.winnerModal.classList.add('hidden');
            UI.elements.gameBoardScreen.classList.add('hidden');
            UI.elements.historyModal.classList.add('hidden');
            
            const emoteBar = document.getElementById('emote-bar');
            if(emoteBar) emoteBar.classList.add('hidden');
            
            Game.initSetupUI(); 

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
        }
    },

    resetOnlineGame: async () => {
        if (!gameState.online.gameId) return;

        UI.showLoading(true);
        try {
            await updateDoc(doc(db, 'games', gameState.online.gameId), {
                phase: 'lobby',
                turn: null,
                "player1.pokemon": null,
                "player1.eliminated": [],
                "player2.pokemon": null,
                "player2.eliminated": [],
                lastAction: null,
                lastEmote: null,
                history: [],
                config: null
            });

            UI.elements.winnerModal.classList.add('hidden');
            UI.elements.gameBoardScreen.classList.add('hidden');
            
        } catch (error) {
            console.error("Error al reiniciar la partida online:", error);
            UI.resetViews(); 
        } finally {
            UI.showLoading(false);
        }
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

        let filtered = gameState.fullPokemonDB;

        if (regions.length > 0) {
            const regionPokedexNames = regions.map(r => REGION_RANGES[r]).flat();
            filtered = filtered.filter(p => {
                return p.pokedexes && p.pokedexes.some(pokedex => regionPokedexNames.includes(pokedex.name));
            });
        }
        
        if (types.length > 0) {
            filtered = filtered.filter(p => p.types.some(t => types.includes(t.toLowerCase())));
        }

        gameState.pokemonList = filtered;
        return filtered.length;
    },
    
    updateStartButton: () => {
        const btn = document.getElementById('btn-start-game');
        if (btn) {
            const regionCount = gameState.config.selectedRegions.size;
            if (regionCount > 0) {
                btn.disabled = false;
                btn.classList.remove('opacity-50', 'cursor-not-allowed');
                if (gameState.fullPokemonDB.length > 0) {
                    const pokemonCount = Game.filterPokemonDB();
                    btn.innerHTML = `JUGAR (<span id="count-display">${pokemonCount}</span>)`;
                } else {
                    btn.innerHTML = `JUGAR`;
                }
            } else {
                btn.disabled = true;
                btn.classList.add('opacity-50', 'cursor-not-allowed');
                btn.innerHTML = `JUGAR`;
            }
        }
    },
    
    startGameConfirmed: async () => {
        UI.showLoading(true);
        await Game.loadPokemon();
        Game.filterPokemonDB();
        Game.updateStartButton();
        
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
        UI.showLoading(false);
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
                    const gameRef = doc(db, 'games', gameState.online.gameId);
                    try {
                        const cleanPoke = JSON.parse(JSON.stringify(poke)); 
                        await runTransaction(db, async (transaction) => {
                            const gameDoc = await transaction.get(gameRef);
                            if (!gameDoc.exists()) throw "Error";
                            const gameData = gameDoc.data();
                            const update = {};
                            update[`${myRole}.pokemon`] = cleanPoke;
                            const opponentRole = myRole === 'player1' ? 'player2' : 'player1';
                            if (gameData[opponentRole] && gameData[opponentRole].pokemon) {
                                update.phase = 'battle';
                                update.turn = gameData.host;
                            }
                            transaction.update(gameRef, update);
                        });
                    } catch (e) {
                        console.error("Transaction failed: ", e);
                        alert("Hubo un error al seleccionar.");
                    }
                });
            }
        });
    },

    initBattlePhase: () => {
        UI.elements.selectionScreen.classList.add('hidden');
        UI.elements.gameBoardScreen.classList.remove('hidden');
        
        const emoteBar = document.getElementById('emote-bar');
        if (emoteBar) {
            if (gameState.mode === 'online') emoteBar.classList.remove('hidden');
            else emoteBar.classList.add('hidden');
        }

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
                lastAction: null,
                lastEmote: null,
                history: []
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
        if (Game.unsub) Game.unsub();
    
        Game.unsub = onSnapshot(doc(db, 'games', gameId), async (docSnap) => {
            UI.showLoading(false);
            if (!docSnap.exists()) {
                UI.resetViews();
                alert("La sala ha sido cerrada.");
                return;
            }
    
            const data = docSnap.data();
            gameState.online.data = data;

            // --- CORRECCIÓN: Carga de datos fuera del if de fase ---
            if (data.config) {
                gameState.config.selectedRegions = new Set(data.config.regions);
                gameState.config.selectedTypes = new Set(data.config.types);
                
                const currentRegions = Array.from(gameState.config.selectedRegions).sort().join(',');
                const loadedRegions = Game.loadedRegions ? Array.from(Game.loadedRegions).sort().join(',') : '';

                if (gameState.fullPokemonDB.length === 0 || currentRegions !== loadedRegions) {
                    UI.showLoading(true);
                    await Game.loadPokemon();
                    UI.showLoading(false);
                }
                
                Game.filterPokemonDB();
            }
    
            // Manejo de Vistas por Fases
            UI.elements.selectionScreen.classList.add('hidden');
            UI.elements.gameBoardScreen.classList.add('hidden');
            UI.elements.winnerModal.classList.add('hidden');
            UI.elements.onlineWaitScreen.classList.add('hidden');
            UI.elements.loadingScreen.classList.add('hidden');
            UI.elements.lobbyScreen.classList.add('hidden');
            UI.elements.waitingScreen.classList.add('hidden');
            
            if (data.phase === 'lobby') {
                UI.elements.waitingScreen.classList.remove('hidden');
                UI.elements.waitingCode.textContent = gameId;
                const statusPill = document.querySelector('#waitingScreen span.font-bold');
                
                if (data.host && data.guest) {
                    if (gameState.online.role === 'host') {
                        UI.elements.waitingScreen.classList.add('hidden');
                        Game.initSetupUI();
                    } else {
                        if(statusPill) statusPill.textContent = "El host está configurando...";
                    }
                } else {
                    if(statusPill) statusPill.textContent = "Esperando rival...";
                }
            }
            
            else if (data.phase === 'selection') {
                const myRole = gameState.online.role === 'host' ? 'player1' : 'player2';
                
                if (data[myRole] && data[myRole].pokemon) {
                    UI.elements.loadingScreen.classList.remove('hidden'); 
                    UI.elements.loadingScreen.textContent = "Pokémon seleccionado. Esperando al rival...";
                } else {
                    if (gameState.pokemonList.length > 0) {
                        if (UI.elements.selectionGrid.children.length === 0) {
                            Game.startSelectionPhase();
                        }
                    }
                    UI.elements.selectionScreen.classList.remove('hidden');
                }
            }

            else if (data.phase === 'battle') {
                UI.elements.gameBoardScreen.classList.remove('hidden');
                const emoteBar = document.getElementById('emote-bar');
                if(emoteBar) emoteBar.classList.remove('hidden');

                const myRole = gameState.online.role === 'host' ? 'player1' : 'player2';
                const myData = data[myRole];
                
                if (myData && myData.pokemon) {
                    UI.updateHUD(myData.pokemon, data.turn === gameState.online.myId);
                    
                    UI.renderGrid(UI.elements.mainGrid, gameState.pokemonList, async (poke) => {
                        const current = myData.eliminated || [];
                        const next = current.includes(poke.id) 
                            ? current.filter(id => id !== poke.id) 
                            : [...current, poke.id];
                        await updateDoc(doc(db, 'games', gameId), { [`${myRole}.eliminated`]: next });
                    }, new Set(myData.eliminated));

                    if (data.turn !== gameState.online.myId) {
                        UI.elements.onlineWaitScreen.classList.remove('hidden');
                    } else {
                        UI.elements.onlineWaitScreen.classList.add('hidden');
                    }
                }
                
                Game.handleOnlineActions(data);

                // --- EMOTES ---
                if (data.lastEmote && data.lastEmote.sender !== gameState.online.myId) {
                    const lastTs = window.lastEmoteTs || 0;
                    if (data.lastEmote.timestamp > lastTs) {
                        window.lastEmoteTs = data.lastEmote.timestamp;
                        // --- CORRECCIÓN: Llamada a UI.showEmoteToast ---
                        UI.showEmoteToast(data.lastEmote.content);
                    }
                }

                // --- HISTORIAL ---
                if (data.history) {
                    gameState.history = data.history;
                    const historyModal = document.getElementById('historyModal');
                    if (historyModal && !historyModal.classList.contains('hidden')) {
                        UI.renderHistory(data.history);
                    }
                }
            }

            else if (data.phase === 'finished') {
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
                const currentPlayer = turn === 1 ? gameState.local.p1 : gameState.local.p2;
                currentPlayer.eliminated.add(poke.id);
                Game.renderLocalBoard();
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
                const myRole = gameState.online.role === 'host' ? 'player1' : 'player2';
                const currentEliminated = gameState.online.data[myRole].eliminated || [];
                const nextEliminated = [...new Set([...currentEliminated, poke.id])];
                UI.showModal("¡Fallaste!", `No es ${poke.name}. Pierdes tu turno.`, () => Game.handleEndTurn({ [`${myRole}.eliminated`]: nextEliminated }), true);
            }
        }
    },

    handleEndTurn: async (extraUpdates = {}) => {
        if (gameState.mode === 'online') {
            const currentTurn = gameState.online.data.turn;
            const hostId = gameState.online.data.host;
            const guestId = gameState.online.data.guest;
            const nextTurn = currentTurn === hostId ? guestId : hostId;
            try {
                await updateDoc(doc(db, 'games', gameState.online.gameId), { 
                    turn: nextTurn, 
                    lastAction: null,
                    ...extraUpdates 
                });
            } catch (error) { console.error("Error cambio turno:", error); }
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
            UI.renderGrid(UI.elements.mainGrid, gameState.pokemonList, clickHandler, new Set(gameState.online.data[role].eliminated));
        }
    },
    
    sendQuestion: async (criteria, isType, isGeneration = false) => {
        updateDoc(doc(db, 'games', gameState.online.gameId), { lastAction: { type: 'question', sender: gameState.online.myId, criteria, isType, isGeneration, status: 'pending' } });
    },
    
    // --- CORRECCIÓN: Llamada a UI.showEmoteToast ---
    sendEmote: async (emoji) => {
        if (!gameState.online.gameId) return;
        try {
            await updateDoc(doc(db, 'games', gameState.online.gameId), {
                lastEmote: {
                    sender: gameState.online.myId,
                    content: emoji,
                    timestamp: Date.now()
                }
            });
            UI.showEmoteToast(emoji, true);
        } catch (e) {
            console.error("Error emote:", e);
        }
    },

    handleOnlineActions: (data) => {
        const action = data.lastAction;
        if (!action) return;
        
        if (action.sender !== gameState.online.myId && action.status === 'pending') {
            if (!document.getElementById('uiModal').classList.contains('hidden')) return;
            UI.showQuestionModal(action.criteria, action.isType, (res) => Game.sendResponse(res), action.isGeneration);
        }
        
        if (action.sender === gameState.online.myId && action.status === 'answered') {
            if (!document.getElementById('uiModal').classList.contains('hidden')) return;
            UI.showModal("Respuesta", `Dijo: ${action.response ? "SÍ" : "NO"}`, async () => {
                let updates;
                if (action.isGeneration) {
                    const toEliminate = Game.applyGenerationFilter(action.criteria, action.response, true);
                    const role = gameState.online.role === 'host' ? 'player1' : 'player2';
                    const currentEliminated = gameState.online.data[role].eliminated || [];
                    const nextEliminated = Array.from(new Set([...currentEliminated, ...toEliminate]));
                    updates = { [`${role}.eliminated`]: nextEliminated };
                } else {
                    const toEliminate = Game.applyFilter(action.criteria, action.isType, action.response, true);
                    const role = gameState.online.role === 'host' ? 'player1' : 'player2';
                    const currentEliminated = gameState.online.data[role].eliminated || [];
                    const nextEliminated = Array.from(new Set([...currentEliminated, ...toEliminate]));
                    updates = { [`${role}.eliminated`]: nextEliminated };
                }
                Game.handleEndTurn(updates);
            }, true);
        }
    },
    
    sendResponse: async (res) => {
        const act = gameState.online.data.lastAction;
        const qText = Game.formatQuestionText(act.criteria, act.isType, act.isGeneration);
        
        const historyEntry = {
            question: qText,
            answer: res,
            turn: gameState.online.role === 'host' ? 'Invitado' : 'Anfitrión'
        };

        await updateDoc(doc(db, 'games', gameState.online.gameId), { 
            lastAction: { ...act, status: 'answered', response: res },
            history: arrayUnion(historyEntry) // Usar arrayUnion exportado
        });
    },
    
    // Función auxiliar para texto del historial
    formatQuestionText: (criteria, isType, isGeneration) => {
        if (isGeneration) {
            const genNames = criteria.map(g => GENERATION_NAMES[g] || g).join(', ');
            return `¿Gen: ${genNames}?`;
        } else if (isType) {
            const translatedTypes = criteria.map(t => typeTranslations[t] || t).join(', ');
            return `¿Tipo: ${translatedTypes}?`;
        } else {
            if (criteria[0] === 'single') return "¿Un solo tipo?";
            if (criteria[0] === 'dual') return "¿Doble tipo?";
            return "¿...?";
        }
    },

    addToLocalHistory: (criteria, isType, isGeneration, response) => {
        const qText = Game.formatQuestionText(criteria, isType, isGeneration);
        const playerLabel = gameState.local.turn === 1 ? "J1" : "J2";
        gameState.history.unshift({ // Agregar al principio
            question: qText,
            answer: response,
            turn: playerLabel
        });
        // Si el modal está abierto en local, actualizar
        const historyModal = document.getElementById('historyModal');
        if (historyModal && !historyModal.classList.contains('hidden')) {
            UI.renderHistory(gameState.history);
        }
    },

    applyFilter: (criteria, isType, keep, getUpdateObj = false) => {
        // En local, guardar en historial
        if (gameState.mode === 'local') {
            Game.addToLocalHistory(criteria, isType, false, keep);
        }

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
            if (getUpdateObj) {
                return toEliminate;
            }
        }
    },

    applyGenerationFilter: (generations, keep, getUpdateObj = false) => {
        // En local, guardar en historial
        if (gameState.mode === 'local') {
            Game.addToLocalHistory(generations, false, true, keep);
        }

        const toEliminate = [];
        if (!generations || !Array.isArray(generations)) return [];
        const regionPokedexNames = generations.map(g => REGION_RANGES[g]).flat().map(n => String(n).toLowerCase());

        if (regionPokedexNames.length === 0) return [];

        gameState.pokemonList.forEach(p => {
            const pokedexes = Array.isArray(p.pokedexes) ? p.pokedexes : [];
            const matches = pokedexes.some(pokedex => {
                const pName = typeof pokedex === 'string' ? pokedex : pokedex.name;
                return pName && regionPokedexNames.includes(String(pName).toLowerCase());
            });
            
            if (keep) { if (!matches) toEliminate.push(p.id); } else { if (matches) toEliminate.push(p.id); }
        });

        if (gameState.mode === 'local') {
            const pData = gameState.local.turn === 1 ? gameState.local.p1 : gameState.local.p2;
            toEliminate.forEach(id => pData.eliminated.add(id));
            Game.renderLocalBoard();
        } else {
            if (getUpdateObj) {
                return toEliminate;
            }
        }
    }
};