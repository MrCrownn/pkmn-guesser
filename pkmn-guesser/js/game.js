import { gameState, resetGameState } from './state.js';
import { UI } from './ui.js';
import { db, appId, doc, updateDoc, collection, setDoc, getDoc, onSnapshot, auth } from './firebase.js';
import { loadPokemonData } from './api.js';

let unsubscribeGame = null;

export const Game = {
    
    initGame: async (start, end, regionName) => {
        UI.showLoading(true);
        document.getElementById('setupScreen').classList.add('hidden');
        
        loadPokemonData({start, end}, (list) => {
            gameState.pokemonList = list;
            
            if (gameState.mode === 'local') {
                UI.showLoading(false);
                Game.startLocalSelection(1);
            } else {
                // Online creation
                const code = Math.floor(100000 + Math.random() * 900000).toString();
                gameState.online.gameId = code;
                const gameDoc = {
                    createdAt: new Date(),
                    hostId: auth.currentUser.uid,
                    region: { start, end, name: regionName },
                    status: 'waiting',
                    turn: auth.currentUser.uid,
                    winner: null,
                    player1: { id: auth.currentUser.uid, secret: null, eliminated: [] },
                    player2: { id: null, secret: null, eliminated: [] }
                };
                
                setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'games', code), gameDoc).then(() => {
                    UI.showLoading(false);
                    UI.elements.waitingCode.textContent = code;
                    UI.elements.roomCodeDisplay.textContent = `CODE: ${code}`;
                    UI.elements.roomCodeDisplay.classList.remove('hidden');
                    UI.elements.waitingScreen.classList.remove('hidden');
                    Game.subscribeToGame(code);
                });
            }
        }, (err) => {
            UI.showLoading(false);
            document.getElementById('setupScreen').classList.remove('hidden');
            UI.showModal("Error", "Error al cargar datos de Pokémon", null, true);
        });
    },

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
            
            const data = snap.data();
            if (data.status !== 'waiting' && data.player2.id !== auth.currentUser.uid) {
                UI.showLoading(false);
                UI.elements.lobbyScreen.classList.remove('hidden');
                return UI.showModal("Error", "La sala está llena", null, true);
            }
            
            gameState.online.gameId = code;
            gameState.online.role = 'guest';
            
            if (!data.player2.id) {
                await updateDoc(gameRef, { 'player2.id': auth.currentUser.uid, status: 'selecting' });
            }
            
            loadPokemonData(data.region, (list) => {
                gameState.pokemonList = list;
                Game.subscribeToGame(code);
            }, (err) => { throw err; });
            
        } catch (err) {
            UI.showLoading(false);
            UI.elements.lobbyScreen.classList.remove('hidden');
            UI.showModal("Error", "Error al unirse", null, true);
        }
    },

    subscribeToGame: (code) => {
        unsubscribeGame = onSnapshot(doc(db, 'artifacts', appId, 'public', 'data', 'games', code), (docSnap) => {
            if (!docSnap.exists()) return;
            const data = docSnap.data();
            gameState.online.data = data;
            
            const myRole = gameState.online.role === 'host' ? 'player1' : 'player2';
            const iHaveSelected = !!data[myRole].secret;

            if (data.status === 'selecting') {
                UI.elements.waitingScreen.classList.add('hidden');
                UI.elements.winnerModal.classList.add('hidden');
                UI.elements.gameBoardScreen.classList.add('hidden');
                
                // Reset local state for rematch
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
            }
            
            if ((data.status === 'selecting' || data.status === 'waiting') && data.player1.secret && data.player2.secret && data.status !== 'playing') {
                if (gameState.online.role === 'host') updateDoc(docSnap.ref, { status: 'playing' });
            }
            
            if (data.status === 'playing') {
                UI.showLoading(false);
                UI.elements.selectionScreen.classList.add('hidden');
                UI.elements.gameBoardScreen.classList.remove('hidden');
                
                const isMyTurn = data.turn === auth.currentUser.uid;
                const myData = data[myRole];
                
                UI.updateHUD(myData.secret, isMyTurn);

                // Check for turn change to reset guess state
                if (gameState.online.currentTurnOwner !== data.turn) {
                    gameState.online.currentTurnOwner = data.turn;
                    if (isMyTurn) {
                        gameState.hasGuessedThisTurn = false;
                        UI.elements.guessBtn.classList.remove('opacity-50', 'cursor-not-allowed');
                    }
                }

                if (isMyTurn) UI.elements.onlineWaitScreen.classList.add('hidden');
                else UI.elements.onlineWaitScreen.classList.remove('hidden');
                
                const elimSet = new Set(myData.eliminated || []);
                UI.renderGrid(UI.elements.mainGrid, gameState.pokemonList, (poke) => {
                    if (!isMyTurn) return;
                    let newElim = [...(myData.eliminated || [])];
                    if (newElim.includes(poke.id)) newElim = newElim.filter(id => id !== poke.id);
                    else newElim.push(poke.id);
                    
                    updateDoc(docSnap.ref, { [`${myRole}.eliminated`]: newElim });
                }, elimSet);
            }
            
            if (data.winner) {
                const isMeWinner = data.winner === auth.currentUser.uid;
                const oppRole = gameState.online.role === 'host' ? 'player2' : 'player1';
                const oppSecret = data[oppRole].secret;
                UI.showWinner(isMeWinner, oppSecret);
            }
        });
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
                    await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'games', gameState.online.gameId), { [field]: poke });
                } catch(e) {
                    UI.showModal("Error", "Error al guardar selección", null, true);
                    UI.showLoading(false);
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
            Game.renderLocalBoard(); // Re-render logic inside game file
        }, data.eliminated);
    },

    handleEndTurn: async () => {
        if (gameState.mode === 'local') {
            const current = gameState.local.turn;
            Game.startLocalTurn(current === 1 ? 2 : 1);
        } else {
            const data = gameState.online.data;
            const nextTurnId = data.turn === data.player1.id ? data.player2.id : data.player1.id;
            await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'games', gameState.online.gameId), { turn: nextTurnId });
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
                     // Local display winner logic reused from UI
                     UI.elements.winnerTitle.textContent = `¡JUGADOR ${gameState.local.turn} GANA!`;
                     UI.elements.winnerTitle.className = gameState.local.turn === 1 ? "text-3xl font-black text-blue-500" : "text-3xl font-black text-red-500";
                     UI.elements.winnerSubtitle.textContent = "Adivinó el secreto";
                     UI.elements.winnerRevealImg.src = targetSecret.image;
                     UI.elements.winnerRevealName.textContent = targetSecret.name;
                     UI.elements.winnerModal.classList.remove('hidden');
                 }
                 else await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'games', gameState.online.gameId), { winner: auth.currentUser.uid });
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
                        await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'games', gameState.online.gameId), { [`${myRole}.eliminated`]: newElim });
                    }
                }

                gameState.hasGuessedThisTurn = true;
                UI.elements.guessBtn.classList.add('opacity-50', 'cursor-not-allowed');
                
                UI.showModal("¡Incorrecto!", `Elegiste a ${poke.name}, pero no es. Se ha eliminado del tablero. Tu turno termina.`, () => {
                    Game.handleEndTurn();
                }, true);
            }
        });
    },

    applyFilter: async (criteriaArray, isType, responseYes) => {
        let toEliminate = [];
        
        gameState.pokemonList.forEach(p => {
            let match = false;
            if (isType) {
                match = criteriaArray.some(type => p.types.includes(type));
            } else {
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
            await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'games', gameState.online.gameId), { [`${myRole}.eliminated`]: newElim });
        }

        Game.handleEndTurn(); 
    },

    triggerRematch: async () => {
        if (gameState.mode === 'local') {
            resetGameState();
            UI.resetViews();
            Game.selectMode('local');
            return;
        }
        
        const gameRef = doc(db, 'artifacts', appId, 'public', 'data', 'games', gameState.online.gameId);
        try {
            await updateDoc(gameRef, {
                status: 'selecting',
                winner: null,
                turn: gameState.online.data.hostId,
                'player1.secret': null,
                'player1.eliminated': [],
                'player2.secret': null,
                'player2.eliminated': []
            });
            UI.elements.winnerModal.classList.add('hidden');
        } catch (e) {
            console.error(e);
            UI.showModal("Error", "No se pudo reiniciar la partida.", null, true);
        }
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
        // Clear url params
        history.pushState("", document.title, window.location.pathname + window.location.search);
    }
};