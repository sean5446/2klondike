import React, { useState, useCallback, useEffect } from 'react';
import './App.css';
import CardComponent from './components/Card';
import { initializeGame, moveCard } from './gameLogic';
import { GameState, Card } from './types';
import Confetti from 'react-confetti';



// Main App component
function App(): React.ReactElement {
  const [game, setGame] = useState<GameState>(initializeGame());
  const [isWon, setIsWon] = useState(false);

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
    setGame(prev => moveCard(prev, fromType, fromIndex, toType, toIndex, cardId));
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
  }, []);

  const handleDeckClick = useCallback(() => {
    setGame((prevGame) => {
      if (prevGame.deck.length === 0) {
        // Recycle waste back to deck
        return {
          ...prevGame,
          deck: prevGame.waste.map((card) => ({ ...card, faceUp: false })).reverse(),
          waste: [],
        };
      }

      // Draw card from deck
      const newCard = { ...prevGame.deck[0], faceUp: true };
      return {
        ...prevGame,
        deck: prevGame.deck.slice(1),
        waste: [newCard, ...prevGame.waste],
        selectedCard: null,
        selectedFrom: null,
      };
    });
  }, []);

  const handleNewGame = useCallback(() => {
    setGame(initializeGame());
  }, []);

  return (
    <div className="app">
      {isWon && <Confetti />}
      <header className="app-header">
        <h1>Double Klondike</h1>
        <button onClick={handleNewGame} className="btn-new-game">
          New Game
        </button>
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
                onClick={() => {}} 
                draggable={!!game.waste[0]} 
                onDragStart={(e) => game.waste[0] && handleDragStart(e, game.waste[0], 'waste', 0)} 
              />
            </div>
          </div>

          {/* Foundations */}
          <div className="foundations">
            {Array.from({length: 8}, (_, index) => (
              <div key={index} className="foundation" onDrop={(e) => handleDrop(e, 'foundation', index)} onDragOver={handleDragOver}>
                <CardComponent
                  card={game.foundations[index][game.foundations[index].length - 1] || null}
                  onClick={() => {}}
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
                      onClick={() => {}} 
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
