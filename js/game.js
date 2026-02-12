import { db, doc, updateDoc, onSnapshot, getDoc, collection, addDoc, setDoc, runTransaction } from './firebase.js';
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
    galar: 'galar',
    paldea: 'paldea'
};

import { loadAllPokemon } from './api.js';

export const Game = {
    unsub: null,
    isLoadingPokemon: false,

    loadPokemon: () => {
        return new Promise(async (resolve) => {
            if (Game.isLoadingPokemon) {
                // Si ya hay una carga en curso, simplemente espera a que termine.
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
    
            const pokedexNames = regions.map(r => REGION_RANGES[r]);
            
            const onComplete = (pokemonList) => {
                // Filtramos por si acaso hay duplicados de la API
                const uniquePokemon = Array.from(new Map(pokemonList.map(p => [p.id, p])).values());
                gameState.fullPokemonDB = uniquePokemon;
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
        if (Game.unsub) {
            Game.unsub();
            Game.unsub = null; // Asegurarse de limpiar la suscripción
        }

        if (gameState.mode === 'online' && gameState.online.gameId) {
            Game.resetOnlineGame();
        } else {
            // Comportamiento para modo local o para resetear si no hay juego online
            if (window.location.hash) {
                history.pushState("", document.title, window.location.pathname + window.location.search);
            }

            resetGameState(); // Resetea el estado base
            
            // Oculta las vistas de final de partida y tablero
            UI.elements.winnerModal.classList.add('hidden');
            UI.elements.gameBoardScreen.classList.add('hidden');
            
            // En lugar de llamar a UI.resetViews(), preparamos la UI para una nueva configuración
            Game.initSetupUI(); 

            // Limpieza de UI específica
            if (UI.elements.selectionGrid) UI.elements.selectionGrid.innerHTML = '';
            if (UI.elements.mainGrid) UI.elements.mainGrid.innerHTML = '';
            if (UI.elements.guessGrid) UI.elements.guessGrid.innerHTML = '';

            // Reiniciar botones de selección de región y tipo
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
            // Actualiza la partida a fase de lobby, limpiando las selecciones
            await updateDoc(doc(db, 'games', gameState.online.gameId), {
                phase: 'lobby',
                turn: null,
                "player1.pokemon": null,
                "player1.eliminated": [],
                "player2.pokemon": null,
                "player2.eliminated": [],
                lastAction: null,
                config: null // Permite al host re-configurar la partida
            });

            // El onSnapshot existente debería detectar este cambio y actualizar la UI.
            // Ocultamos manualmente los modales de la partida anterior.
            UI.elements.winnerModal.classList.add('hidden');
            UI.elements.gameBoardScreen.classList.add('hidden');
            
            // No es necesario llamar a subscribeToGame de nuevo si la suscripción sigue activa.
            // onSnapshot se encarga de re-renderizar la vista correcta (setup para host, espera para guest).
            
        } catch (error) {
            console.error("Error al reiniciar la partida online:", error);
            // Si falla el reinicio online, hacemos un reseteo completo como fallback
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
            const regionPokedexNames = regions.map(r => REGION_RANGES[r]);
            filtered = gameState.fullPokemonDB.filter(p => {
                // Un Pokémon puede estar en varias pokedexes, chequeamos si alguna de ellas está en las seleccionadas
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
        const countDisplay = document.getElementById('count-display');

        if (btn) {
            const regionCount = gameState.config.selectedRegions.size;
            if (regionCount > 0) {
                btn.disabled = false;
                btn.classList.remove('opacity-50', 'cursor-not-allowed');

                // Solo muestra el conteo si la base de datos de Pokémon ya ha sido cargada
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
        Game.updateStartButton(); // To update the count
        
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
                        await runTransaction(db, async (transaction) => {
                            const gameDoc = await transaction.get(gameRef);
                            if (!gameDoc.exists()) {
                                throw "El documento del juego no existe.";
                            }

                            const gameData = gameDoc.data();
                            const update = {};
                            update[`${myRole}.pokemon`] = poke;

                            const opponentRole = myRole === 'player1' ? 'player2' : 'player1';
                            if (gameData[opponentRole] && gameData[opponentRole].pokemon) {
                                update.phase = 'battle';
                                update.turn = gameData.host; // El turno inicial siempre es del host
                            }
                            
                            transaction.update(gameRef, update);
                        });
                    } catch (e) {
                        console.error("Transaction failed: ", e);
                        alert("Hubo un error al seleccionar tu Pokémon. Inténtalo de nuevo.");
                    }
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
        if (Game.unsub) Game.unsub(); // Cancela suscripción anterior para evitar duplicados
    
        Game.unsub = onSnapshot(doc(db, 'games', gameId), (docSnap) => {
            UI.showLoading(false);
            if (!docSnap.exists()) {
                console.error("El documento del juego ya no existe.");
                UI.resetViews();
                alert("La sala ha sido cerrada.");
                return;
            }
    
            const data = docSnap.data();
            gameState.online.data = data;
    
            // Ocultar todas las pantallas de juego activas para empezar de cero en cada cambio de fase
            UI.elements.selectionScreen.classList.add('hidden');
            UI.elements.gameBoardScreen.classList.add('hidden');
            UI.elements.winnerModal.classList.add('hidden');
            UI.elements.onlineWaitScreen.classList.add('hidden');
            UI.elements.loadingScreen.classList.add('hidden');
            
            if (data.phase === 'lobby') {
                UI.elements.lobbyScreen.classList.add('hidden'); // Oculta lobby inicial si estuviera visible
                UI.elements.waitingScreen.classList.remove('hidden');
                UI.elements.waitingCode.textContent = gameId;
    
                if (data.host && data.guest) {
                    if (gameState.online.role === 'host') {
                        UI.elements.waitingScreen.classList.add('hidden');
                        Game.initSetupUI(); // El host configura la partida
                    } else {
                        UI.elements.waitingCode.textContent = "El host está configurando la partida...";
                    }
                } else {
                    // Aún esperando a un jugador
                    UI.elements.waitingCode.textContent = `Código: ${gameId} - Esperando rival...`;
                }
            }
            
            if (data.phase === 'selection') {
                UI.elements.waitingScreen.classList.add('hidden');
                UI.elements.setupScreen.classList.add('hidden');
                
                if (data.config) {
                    gameState.config.selectedRegions = new Set(data.config.regions);
                    gameState.config.selectedTypes = new Set(data.config.types);
                    Game.filterPokemonDB(); 
                }

                const myRole = gameState.online.role === 'host' ? 'player1' : 'player2';
                
                if (data[myRole] && data[myRole].pokemon) {
                    UI.elements.selectionScreen.classList.add('hidden');
                    UI.elements.loadingScreen.classList.remove('hidden'); 
                    UI.elements.loadingScreen.textContent = "Pokémon seleccionado. Esperando al rival...";
                } else {
                    // Asegurarse de que la grilla de selección está vacía antes de renderizar
                    if (UI.elements.selectionGrid.children.length === 0) {
                        Game.startSelectionPhase();
                    }
                    UI.elements.selectionScreen.classList.remove('hidden');
                }
            }

            if (data.phase === 'battle') {
                UI.elements.gameBoardScreen.classList.remove('hidden');
                
                const myRole = gameState.online.role === 'host' ? 'player1' : 'player2';
                const myData = data[myRole];
                
                if (!myData || !myData.pokemon) {
                    console.error("Faltan datos del jugador en la fase de batalla.");
                    return;
                }

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
                }
                Game.handleOnlineActions(data);
            }

            if (data.phase === 'finished') {
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
            // Evita mostrar múltiples modales si ya hay uno activo.
            if (!document.getElementById('uiModal').classList.contains('hidden')) return;
            
            UI.showQuestionModal(
                action.criteria, 
                action.isType, 
                (res) => Game.sendResponse(res), 
                action.isGeneration // Pasar el flag aquí
            );
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
        const regionPokedexNames = generations.map(g => REGION_RANGES[g]);

        gameState.pokemonList.forEach(p => {
            // Un Pokémon puede estar en varias pokedexes, chequeamos si alguna de ellas está en las seleccionadas
            const matches = p.pokedexes && p.pokedexes.some(pokedex => regionPokedexNames.includes(pokedex.name));
            
            if (keep) { // Si la respuesta es SÍ, se deben MANTENER los que coinciden
                if (!matches) {
                    toEliminate.push(p.id); // Eliminar los que NO coinciden
                }
            } else { // Si la respuesta es NO, se deben ELIMINAR los que coinciden
                if (matches) {
                    toEliminate.push(p.id); // Eliminar los que SÍ coinciden
                }
            }
        });

        if (gameState.mode === 'local') {
            const pData = gameState.local.turn === 1 ? gameState.local.p1 : gameState.local.p2;
            toEliminate.forEach(id => pData.eliminated.add(id));
            Game.renderLocalBoard();
        } else {
            const role = gameState.online.role === 'host' ? 'player1' : 'player2';
            const currentEliminated = gameState.online.data[role].eliminated || [];
            const next = Array.from(new Set([...currentEliminated, ...toEliminate]));

            if (getUpdateObj) {
                return { [`${role}.eliminated`]: next };
            }

            updateDoc(doc(db, 'games', gameState.online.gameId), { [`${role}.eliminated`]: next });
        }
    }
};