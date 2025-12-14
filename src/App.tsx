import React, { useState, useCallback, useEffect } from 'react';
import './App.css';
import CardComponent from './components/Card';
import { initializeGame, moveCard, canMoveToFoundation } from './gameLogic';
import { GameState, Card } from './types';
import Confetti from 'react-confetti';



// Main App component
function App(): React.ReactElement {
  const [game, setGame] = useState<GameState>(initializeGame());
  const [history, setHistory] = useState<GameState[]>([]);
  const [isWon, setIsWon] = useState(false);
  const [customSeed, setCustomSeed] = useState<string>('');

  useEffect(() => {
    const won = game.deck.length === 0 && game.tableau.every(pile => pile.length === 0);
    setIsWon(won);
  }, [game]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'w' && e.ctrlKey && e.altKey) {
        setIsWon(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleDragStart = useCallback((e: React.DragEvent, card: Card, fromType: string, fromIndex: number | string) => {
    e.dataTransfer.setData('text/plain', `${card.id}|${fromType}|${fromIndex}`);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent, toType: string, toIndex: number | string) => {
    e.preventDefault();
    const data = e.dataTransfer.getData('text/plain');
    const [cardId, fromType, fromIndexStr] = data.split('|');
    const fromIndex = parseInt(fromIndexStr);
    const newGame = moveCard(game, fromType, fromIndex, toType, toIndex, cardId);
    if (newGame !== game) { // Only push to history if the move actually changed the state
      setHistory(prev => [...prev, game]);
      setGame(newGame);
    }
  }, [game]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
  }, []);

  const handleDeckClick = useCallback(() => {
    setGame((prevGame) => {
      const newGame = prevGame.deck.length === 0
        ? {
          ...prevGame,
          deck: prevGame.waste.map((card) => ({ ...card, faceUp: false })).reverse(),
          waste: [],
        }
        : {
          ...prevGame,
          deck: prevGame.deck.slice(1),
          waste: [{ ...prevGame.deck[0], faceUp: true }, ...prevGame.waste],
          selectedCard: null,
          selectedFrom: null,
        };
      setHistory(prev => [...prev, prevGame]);
      return newGame;
    });
  }, []);

  const handleNewGame = useCallback(() => {
    const seed = customSeed.trim() ? parseInt(customSeed, 10) : undefined;
    const newGame = initializeGame(seed);
    setGame(newGame);
    setHistory([]);
    setCustomSeed(''); // Clear after use
  }, [customSeed]);

  const handleUndo = useCallback(() => {
    if (history.length > 0) {
      const previousGame = history[history.length - 1];
      setGame(previousGame);
      setHistory(prev => prev.slice(0, -1));
    }
  }, [history]);

  const handleDoubleClick = useCallback((card: Card, fromType: string, fromIndex: number | string) => {
    // Find a foundation where the card can be placed
    const foundationIndex = game.foundations.findIndex(foundation => canMoveToFoundation(card, foundation));
    if (foundationIndex !== -1) {
      const newGame = moveCard(game, fromType, fromIndex, 'foundation', foundationIndex, card.id);
      if (newGame !== game) {
        setHistory(prev => [...prev, game]);
        setGame(newGame);
      }
    }
  }, [game]);

  return (
    <div className="app">
      {isWon && <Confetti />}
      <header className="app-header">
        <h1>Double Klondike</h1>
        <div className="header-right">
          <div className="header-buttons">
            <button onClick={handleUndo} className="btn-undo" disabled={history.length === 0}>
              Undo
            </button>
            <button onClick={handleNewGame} className="btn-new-game">
              New Game
            </button>
          </div>
          <div className="seed-info">
            <span>Seed: {game.seed}</span>
            <input
              type="number"
              placeholder="Enter seed"
              value={customSeed}
              onChange={(e) => setCustomSeed(e.target.value)}
            />
          </div>
        </div>
      </header>

      <div className="game-board">
        {/* Top area: Stock and Waste */}
        <div className="top-area">
          <div className="stock-waste">
            <div className="stock">
              <CardComponent card={null} onClick={handleDeckClick} faceDown={game.deck.length > 0} />
              <div className="stock-count">{game.deck.length}</div>
            </div>
            <div className="waste">
              <CardComponent
                card={game.waste[0] || null}
                onClick={() => { }}
                onDoubleClick={() => game.waste[0] && handleDoubleClick(game.waste[0], 'waste', 0)}
                draggable={!!game.waste[0]}
                onDragStart={(e) => game.waste[0] && handleDragStart(e, game.waste[0], 'waste', 0)}
              />
            </div>
          </div>

          {/* Foundations */}
          <div className="foundations">
            {Array.from({ length: 8 }, (_, index) => (
              <div key={index} className="foundation" onDrop={(e) => handleDrop(e, 'foundation', index)} onDragOver={handleDragOver}>
                <CardComponent
                  card={game.foundations[index][game.foundations[index].length - 1] || null}
                  onClick={() => { }}
                  onDoubleClick={() => {
                    const topCard = game.foundations[index][game.foundations[index].length - 1];
                    if (topCard) handleDoubleClick(topCard, 'foundation', index);
                  }}
                />
              </div>
            ))}
          </div>
        </div>

        {/* Tableau */}
        <div className="tableau">
          {game.tableau.map((pile, index) => (
            <div key={index} className="tableau-pile" onDrop={(e) => handleDrop(e, 'tableau', index)} onDragOver={handleDragOver}>
              {pile.length === 0 ? (
                <div className="tableau-empty-slot" onDrop={(e) => handleDrop(e, 'tableau', index)} onDragOver={handleDragOver} />
              ) : (
                pile.map((card, cardIndex) => (
                  <div
                    key={card.id}
                    className="tableau-card"
                    style={{ transform: `translateY(${cardIndex * 30}px)` }}
                  >
                    <CardComponent
                      card={card}
                      onClick={() => { }}
                      onDoubleClick={() => card.faceUp && handleDoubleClick(card, 'tableau', index)}
                      faceDown={!card.faceUp}
                      draggable={card.faceUp}
                      onDragStart={(e) => card.faceUp && handleDragStart(e, card, 'tableau', index)}
                    />
                  </div>
                ))
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default App;
