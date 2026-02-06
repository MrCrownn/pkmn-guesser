import { gameState, resetGameState } from './state.js';
import { UI } from './ui.js';
import { db, appId, doc, updateDoc, collection, setDoc, getDoc, onSnapshot, auth } from './firebase.js';
import { loadPokemonData } from './api.js';

let unsubscribeGame = null;

// Tiempo en milisegundos para que expire la sala (1 hora)
const SESSION_TIMEOUT = 60 * 60 * 1000; 

export const Game = {
    
    // --- MODO LOCAL ---
    startLocalGame: (start, end) => {
        UI.showLoading(true);
        UI.elements.setupScreen.classList.add('hidden');
        
        loadPokemonData({start, end}, (list) => {
            gameState.pokemonList = list;
            UI.showLoading(false);
            Game.startLocalSelection(1);
        }, (err) => {
            UI.showLoading(false);
            UI.elements.setupScreen.classList.remove('hidden');
            UI.showModal("Error", "Error al cargar datos de Pokémon", null, true);
        });
    },

    // --- MODO ONLINE: 1. Crear Sala ---
    createOnlineRoom: async () => {
        if (!auth.currentUser) return UI.showModal("Error", "No conectado", null, true);
        
        UI.showLoading(true);
        const code = Math.floor(100000 + Math.random() * 900000).toString();
        gameState.online.gameId = code;
        gameState.online.role = 'host';

        const gameDoc = {
            createdAt: new Date(),
            lastActivity: Date.now(), // Marca de tiempo inicial
            hostId: auth.currentUser.uid,
            region: null,
            status: 'waiting_for_guest',
            turn: auth.currentUser.uid,
            winner: null,
            player1: { id: auth.currentUser.uid, secret: null, eliminated: [] },
            player2: { id: null, secret: null, eliminated: [] }
        };
        
        try {
            await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'games', code), gameDoc);
            UI.showLoading(false);
            UI.elements.lobbyScreen.classList.add('hidden');
            
            UI.elements.waitingCode.textContent = code;
            UI.elements.roomCodeDisplay.textContent = `CODE: ${code}`;
            UI.elements.roomCodeDisplay.classList.remove('hidden');
            UI.elements.waitingScreen.classList.remove('hidden');
            
            Game.subscribeToGame(code);
        } catch (e) {
            UI.showLoading(false);
            UI.showModal("Error", "No se pudo crear la sala", null, true);
        }
    },

    // --- MODO ONLINE: 2. Unirse a Sala (Con lógica de expiración) ---
    joinGame: async (code) => {
        UI.elements.lobbyScreen.classList.add('hidden');
        UI.showLoading(true);
        
        try {
            const gameRef = doc(db, 'artifacts', appId, 'public', 'data', 'games', code);
            const snap = await getDoc(gameRef);
            
            if (!snap.exists()) {
                UI.showLoading(false);
                UI.elements.lobbyScreen.classList.remove('hidden');
                return UI.showModal("Error", "Sala no encontrada", null, true);
            }
            
            let data = snap.data();
            const now = Date.now();
            const lastActivity = data.lastActivity || 0; // Si no existe, es muy vieja (0)

            // Lógica de Expiración / Reciclaje
            if ((now - lastActivity) > SESSION_TIMEOUT) {
                // La sala ha caducado. La reciclamos y nos convertimos en HOST.
                
                const recycledDoc = {
                    createdAt: new Date(), // Nueva fecha
                    lastActivity: now,
                    hostId: auth.currentUser.uid, // Tomamos posesión
                    region: null,
                    status: 'waiting_for_guest',
                    turn: auth.currentUser.uid,
                    winner: null,
                    player1: { id: auth.currentUser.uid, secret: null, eliminated: [] },
                    player2: { id: null, secret: null, eliminated: [] }
                };

                await setDoc(gameRef, recycledDoc); // Sobrescribir
                
                gameState.online.gameId = code;
                gameState.online.role = 'host'; // Ahora somos HOST de la sala vieja
                
                // Mostrar pantalla de espera (como si la hubiéramos creado)
                UI.showLoading(false);
                UI.elements.waitingCode.textContent = code;
                UI.elements.roomCodeDisplay.textContent = `CODE: ${code}`;
                UI.elements.roomCodeDisplay.classList.remove('hidden');
                UI.elements.waitingScreen.classList.remove('hidden');
                
                Game.subscribeToGame(code);
                return;
            }

            // Flujo Normal (Sala activa)
            if (data.player2.id && data.player2.id !== auth.currentUser.uid) {
                UI.showLoading(false);
                UI.elements.lobbyScreen.classList.remove('hidden');
                return UI.showModal("Error", "La sala está llena", null, true);
            }
            
            gameState.online.gameId = code;
            gameState.online.role = 'guest';
            
            if (!data.player2.id) {
                await updateDoc(gameRef, { 
                    'player2.id': auth.currentUser.uid, 
                    status: 'selecting_region',
                    lastActivity: Date.now() // Actualizar actividad
                });
            } else {
                 // Si me estoy reconectando como player 2, actualizo actividad también
                 await updateDoc(gameRef, { lastActivity: Date.now() });
            }
            
            // Si ya hay región definida (reconexion o juego en curso), cargamos datos
            if (data.region) {
                 loadPokemonData(data.region, (list) => {
                    gameState.pokemonList = list;
                    Game.subscribeToGame(code);
                }, (err) => { throw err; });
            } else {
                // Si aún no hay región, solo nos suscribimos y esperamos
                Game.subscribeToGame(code);
            }
            
        } catch (err) {
            console.error(err);
            UI.showLoading(false);
            UI.elements.lobbyScreen.classList.remove('hidden');
            UI.showModal("Error", "Error al unirse", null, true);
        }
    },

    // --- MODO ONLINE: 3. Elegir Región ---
    setOnlineRegion: async (start, end, regionName) => {
        UI.showLoading(true);
        try {
            await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'games', gameState.online.gameId), {
                region: { start, end, name: regionName },
                status: 'selecting_pokemon',
                lastActivity: Date.now() // Mantener sesión viva
            });
        } catch (e) {
            UI.showLoading(false);
            UI.showModal("Error", "No se pudo establecer la región", null, true);
        }
    },

    // --- ESCUCHA DE CAMBIOS ---
    subscribeToGame: (code) => {
        unsubscribeGame = onSnapshot(doc(db, 'artifacts', appId, 'public', 'data', 'games', code), async (docSnap) => {
            if (!docSnap.exists()) return;
            const data = docSnap.data();
            gameState.online.data = data;
            
            const myRole = gameState.online.role === 'host' ? 'player1' : 'player2';
            
            // Protección: Si la sala se reseteó y yo no soy el nuevo host, me saca o reinicia
            if (data.hostId !== auth.currentUser.uid && data.player2.id !== auth.currentUser.uid && data.status !== 'waiting_for_guest') {
                 // Caso borde: alguien recicló la sala mientras yo estaba dentro
                 // Podríamos manejarlo, pero por ahora dejemos que el flujo siga o recargue si hay inconsistencia.
            }

            // 1. ESPERANDO INVITADO
            if (data.status === 'waiting_for_guest') {
                UI.showLoading(false);
                UI.elements.waitingScreen.classList.remove('hidden');
                // Si soy invitado y veo esto, es que la sala se reinició. Debería unirme de nuevo o esperar.
                if (gameState.online.role === 'guest') {
                     // Auto-join si estoy conectado como guest y la sala espera guest?
                     // Mejor no hacer nada automático complejo para evitar bucles.
                }
                return;
            }

            // 2. SELECCIONANDO REGIÓN
            if (data.status === 'selecting_region') {
                UI.showLoading(false);
                UI.elements.waitingScreen.classList.add('hidden');
                UI.elements.winnerModal.classList.add('hidden');
                UI.elements.gameBoardScreen.classList.add('hidden');
                UI.elements.setupScreen.classList.remove('hidden');
                return;
            }

            // 3. SELECCIONANDO PERSONAJE
            if (data.status === 'selecting_pokemon') {
                UI.elements.setupScreen.classList.add('hidden');
                
                const currentRegionId = `${data.region.start}-${data.region.end}`;
                if (!gameState.pokemonList.length || gameState.loadedRegionId !== currentRegionId) {
                    UI.showLoading(true);
                    loadPokemonData(data.region, (list) => {
                        gameState.pokemonList = list;
                        gameState.loadedRegionId = currentRegionId;
                        UI.showLoading(false);
                        checkSelectionState(data, myRole);
                    }, () => UI.showModal("Error", "Fallo al cargar datos", null, true));
                } else {
                    checkSelectionState(data, myRole);
                }
            }
            
            // 4. JUGANDO
            if (data.status === 'playing') {
                handlePlayingState(data, myRole);
            }
            
            // 5. GANADOR
            if (data.winner) {
                const isMeWinner = data.winner === auth.currentUser.uid;
                const oppRole = gameState.online.role === 'host' ? 'player2' : 'player1';
                const oppSecret = data[oppRole].secret;
                UI.showWinner(isMeWinner, oppSecret);
            }
        });
    },

    // --- ACCIONES DE JUEGO (Todas actualizan lastActivity) ---
    
    triggerRematch: async () => {
        if (gameState.mode === 'local') {
            resetGameState();
            UI.resetViews();
            UI.elements.setupScreen.classList.remove('hidden');
            return;
        }
        
        const gameRef = doc(db, 'artifacts', appId, 'public', 'data', 'games', gameState.online.gameId);
        try {
            await updateDoc(gameRef, {
                status: 'selecting_region',
                region: null,
                winner: null,
                turn: gameState.online.data.hostId,
                'player1.secret': null,
                'player1.eliminated': [],
                'player2.secret': null,
                'player2.eliminated': [],
                lastActivity: Date.now() // Update activity
            });
            UI.elements.winnerModal.classList.add('hidden');
        } catch (e) {
            UI.showModal("Error", "No se pudo reiniciar.", null, true);
        }
    },

    startLocalSelection: (player) => {
        UI.elements.selectionScreen.classList.remove('hidden');
        const title = UI.elements.selectionScreen.querySelector('h2');
        title.textContent = `Jugador ${player}: Elige Personaje`;
        
        UI.renderGrid(UI.elements.selectionGrid, gameState.pokemonList, (poke) => {
            UI.showModal(`¿Elegir a ${poke.name}?`, "Será tu personaje secreto.", () => {
                if (player === 1) {
                    gameState.local.p1.secret = poke;
                    UI.elements.selectionScreen.scrollTo(0,0);
                    Game.startLocalSelection(2);
                } else {
                    gameState.local.p2.secret = poke;
                    UI.elements.selectionScreen.classList.add('hidden');
                    Game.startLocalTurn(1);
                }
            });
        });
    },

    startOnlineSelection: () => {
        UI.elements.selectionScreen.classList.remove('hidden');
        UI.renderGrid(UI.elements.selectionGrid, gameState.pokemonList, (poke) => {
            UI.showModal(`¿Elegir a ${poke.name}?`, "Será tu personaje secreto.", async () => {
                UI.elements.selectionScreen.classList.add('hidden');
                UI.showLoading(true);
                const field = gameState.online.role === 'host' ? 'player1.secret' : 'player2.secret';
                try {
                    await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'games', gameState.online.gameId), { 
                        [field]: poke,
                        lastActivity: Date.now() 
                    });
                } catch(e) {
                    UI.showModal("Error", "Error al guardar.", null, true);
                    UI.elements.selectionScreen.classList.remove('hidden');
                }
            });
        });
    },

    startLocalTurn: (player) => {
        gameState.local.turn = player;
        gameState.hasGuessedThisTurn = false;
        UI.elements.guessBtn.classList.remove('opacity-50', 'cursor-not-allowed');
        UI.elements.gameBoardScreen.classList.add('hidden');
        UI.elements.interstitialScreen.classList.remove('hidden');
        UI.elements.interstitialScreen.querySelector('h2').textContent = `Turno Jugador ${player}`;
    },

    renderLocalBoard: () => {
        UI.elements.gameBoardScreen.classList.remove('hidden');
        const p = gameState.local.turn;
        const data = p === 1 ? gameState.local.p1 : gameState.local.p2;
        UI.updateHUD(data.secret, true);
        UI.renderGrid(UI.elements.mainGrid, gameState.pokemonList, (poke) => {
            if (data.eliminated.has(poke.id)) data.eliminated.delete(poke.id);
            else data.eliminated.add(poke.id);
            Game.renderLocalBoard();
        }, data.eliminated);
    },
    
    renderOnlineBoard: () => {
        if (!gameState.online.data) return;
        const myRole = gameState.online.role === 'host' ? 'player1' : 'player2';
        const myData = gameState.online.data[myRole];
        const elimSet = new Set(myData.eliminated || []);
        const isMyTurn = gameState.online.data.turn === auth.currentUser.uid;

        UI.renderGrid(UI.elements.mainGrid, gameState.pokemonList, (poke) => {
            if (!isMyTurn) return;
            let newElim = [...(myData.eliminated || [])];
            if (newElim.includes(poke.id)) newElim = newElim.filter(id => id !== poke.id);
            else newElim.push(poke.id);
            updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'games', gameState.online.gameId), { 
                [`${myRole}.eliminated`]: newElim,
                lastActivity: Date.now()
            });
        }, elimSet);
    },

    handleEndTurn: async () => {
        if (gameState.mode === 'local') {
            const current = gameState.local.turn;
            Game.startLocalTurn(current === 1 ? 2 : 1);
        } else {
            const data = gameState.online.data;
            const nextTurnId = data.turn === data.player1.id ? data.player2.id : data.player1.id;
            await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'games', gameState.online.gameId), { 
                turn: nextTurnId,
                lastActivity: Date.now()
            });
        }
    },

    makeGuess: async (poke) => {
        UI.showModal(`¿Es ${poke.name}?`, "Si fallas, pasará tu turno automáticamente.", async () => {
            UI.elements.guessModal.classList.add('hidden');
            let isCorrect = false;
            let targetSecret = null;

            if (gameState.mode === 'local') {
                const current = gameState.local.turn;
                targetSecret = current === 1 ? gameState.local.p2.secret : gameState.local.p1.secret;
                isCorrect = (poke.id === targetSecret.id);
            } else {
                 const data = gameState.online.data;
                 const oppRole = gameState.online.role === 'host' ? 'player2' : 'player1';
                 targetSecret = data[oppRole].secret;
                 isCorrect = (poke.id === targetSecret.id);
            }

            if (isCorrect) {
                 if (gameState.mode === 'local') {
                     UI.elements.winnerTitle.textContent = `¡JUGADOR ${gameState.local.turn} GANA!`;
                     UI.elements.winnerTitle.className = gameState.local.turn === 1 ? "text-3xl font-black text-blue-500" : "text-3xl font-black text-red-500";
                     UI.elements.winnerSubtitle.textContent = "Adivinó el secreto";
                     UI.elements.winnerRevealImg.src = targetSecret.image;
                     UI.elements.winnerRevealName.textContent = targetSecret.name;
                     UI.elements.winnerModal.classList.remove('hidden');
                 }
                 else await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'games', gameState.online.gameId), { 
                     winner: auth.currentUser.uid,
                     lastActivity: Date.now()
                 });
            } else {
                if (gameState.mode === 'local') {
                    const p = gameState.local.turn;
                    const data = p === 1 ? gameState.local.p1 : gameState.local.p2;
                    data.eliminated.add(poke.id);
                    Game.renderLocalBoard();
                } else {
                    const myRole = gameState.online.role === 'host' ? 'player1' : 'player2';
                    const currentElim = gameState.online.data[myRole].eliminated || [];
                    if (!currentElim.includes(poke.id)) {
                        const newElim = [...currentElim, poke.id];
                        await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'games', gameState.online.gameId), { 
                            [`${myRole}.eliminated`]: newElim,
                            lastActivity: Date.now()
                        });
                    }
                }
                gameState.hasGuessedThisTurn = true;
                UI.elements.guessBtn.classList.add('opacity-50', 'cursor-not-allowed');
                UI.showModal("¡Incorrecto!", `Elegiste a ${poke.name}, pero no es. Tu turno termina.`, () => Game.handleEndTurn(), true);
            }
        });
    },

    applyFilter: async (criteriaArray, isType, responseYes) => {
        let toEliminate = [];
        gameState.pokemonList.forEach(p => {
            let match = false;
            if (isType) match = criteriaArray.some(type => p.types.includes(type));
            else {
                if (criteriaArray[0] === 'single') match = p.types.length === 1;
                else if (criteriaArray[0] === 'dual') match = p.types.length === 2;
            }
            if (responseYes && !match) toEliminate.push(p.id);
            if (!responseYes && match) toEliminate.push(p.id);
        });

        if (gameState.mode === 'local') {
            const p = gameState.local.turn;
            const data = p === 1 ? gameState.local.p1 : gameState.local.p2;
            toEliminate.forEach(id => data.eliminated.add(id));
            Game.renderLocalBoard();
        } else {
            const myRole = gameState.online.role === 'host' ? 'player1' : 'player2';
            const currentElim = gameState.online.data[myRole].eliminated || [];
            const newElim = [...new Set([...currentElim, ...toEliminate])];
            await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'games', gameState.online.gameId), { 
                [`${myRole}.eliminated`]: newElim,
                lastActivity: Date.now()
            });
        }
        Game.handleEndTurn(); 
    },
    
    toggleVisibility: () => {
        gameState.hideEliminated = !gameState.hideEliminated;
        UI.updateVisibilityBtn();
        if (gameState.mode === 'local') Game.renderLocalBoard();
        else Game.renderOnlineBoard();
    },
    
    selectMode: (mode) => {
        if (mode === 'online' && !auth.currentUser) return UI.showModal("Error", "Esperando conexión...", null, true);
        gameState.mode = mode;
        UI.elements.modeScreen.classList.add('hidden');
        if (mode === 'local') UI.elements.setupScreen.classList.remove('hidden');
        else UI.elements.lobbyScreen.classList.remove('hidden');
    },

    resetGame: () => {
        if (unsubscribeGame) { unsubscribeGame(); unsubscribeGame = null; }
        resetGameState();
        UI.resetViews();
        history.pushState("", document.title, window.location.pathname + window.location.search);
    }
};

function checkSelectionState(data, myRole) {
    const iHaveSelected = !!data[myRole].secret;
    gameState.hasGuessedThisTurn = false;
    UI.elements.guessBtn.classList.remove('opacity-50', 'cursor-not-allowed');

    if (!iHaveSelected) {
        if (UI.elements.selectionScreen.classList.contains('hidden')) {
            UI.showLoading(false);
            Game.startOnlineSelection();
        }
    } else {
        UI.elements.selectionScreen.classList.add('hidden');
        if (data.status !== 'playing') UI.showLoading(true);
    }
    
    if (data.player1.secret && data.player2.secret && data.status !== 'playing' && gameState.online.role === 'host') {
         updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'games', gameState.online.gameId), { 
             status: 'playing',
             lastActivity: Date.now()
         });
    }
}

function handlePlayingState(data, myRole) {
    UI.showLoading(false);
    UI.elements.selectionScreen.classList.add('hidden');
    UI.elements.gameBoardScreen.classList.remove('hidden');
    
    const isMyTurn = data.turn === auth.currentUser.uid;
    const myData = data[myRole];
    
    UI.updateHUD(myData.secret, isMyTurn);

    if (gameState.online.currentTurnOwner !== data.turn) {
        gameState.online.currentTurnOwner = data.turn;
        if (isMyTurn) {
            gameState.hasGuessedThisTurn = false;
            UI.elements.guessBtn.classList.remove('opacity-50', 'cursor-not-allowed');
        }
    }

    if (isMyTurn) UI.elements.onlineWaitScreen.classList.add('hidden');
    else UI.elements.onlineWaitScreen.classList.remove('hidden');
    
    Game.renderOnlineBoard();
}