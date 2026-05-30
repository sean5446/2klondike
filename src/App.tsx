import React, { useState, useCallback, useEffect, useRef } from 'react';
import './App.css';
import CardComponent from './components/Card';
import { initializeGame, moveCard, canMoveToFoundation, hasWon } from './gameLogic';
import { GameState, Card } from './types';
import Confetti from 'react-confetti';
import pkg from '../package.json';

interface Stats {
  gamesPlayed: number;
  gamesWon: number;
  totalTurns: number;
}

const STATS_KEY = '2klondike-stats';

function loadStats(): Stats {
  try {
    const raw = localStorage.getItem(STATS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<Stats>;
      return {
        gamesPlayed: parsed.gamesPlayed ?? 0,
        gamesWon: parsed.gamesWon ?? 0,
        totalTurns: parsed.totalTurns ?? 0,
      };
    }
  } catch { /* ignore */ }
  return { gamesPlayed: 0, gamesWon: 0, totalTurns: 0 };
}

function saveStats(stats: Stats): void {
  localStorage.setItem(STATS_KEY, JSON.stringify(stats));
}

// Create deep clone of game state for history snapshots.
function cloneGame(g: GameState): GameState {
  return structuredClone(g) as GameState;
}

// Main App component
function App(): React.ReactElement {
  const [game, setGame] = useState<GameState>(() => initializeGame());
  const [history, setHistory] = useState<GameState[]>([]);
  const [isWon, setIsWon] = useState(false);

  const [copied, setCopied] = useState<boolean>(false);
  const [stats, setStats] = useState<Stats>(loadStats);
  const [statsOpen, setStatsOpen] = useState(false);
  const wonRecorded = useRef(false);
  const turnsThisGame = history.length;

  useEffect(() => {
    setIsWon(hasWon(game));
  }, [game]);

  useEffect(() => {
    if (isWon && !wonRecorded.current) {
      wonRecorded.current = true;
      setStats(prev => {
        const next = {
          gamesPlayed: prev.gamesPlayed + 1,
          gamesWon: prev.gamesWon + 1,
          totalTurns: prev.totalTurns + turnsThisGame,
        };
        saveStats(next);
        return next;
      });
    }
  }, [isWon, turnsThisGame]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'w' && e.ctrlKey && e.altKey) {
        setIsWon(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const applySeedToUrl = useCallback((seed: number) => {
    const basePath = '/2klondike';
    const newPath = `${basePath}/?${seed}`;
    const url = `${window.location.origin}${newPath}`;
    window.history.replaceState({}, '', url);
  }, []);

  useEffect(() => {
    // Expect path like /2klondike/?123
    const search = window.location.search;
    const match = search.match(/^\?(\d+)$/);
    const paramSeed = match?.[1];
    if (!paramSeed) return;

    const parsedSeed = Number.parseInt(paramSeed, 10);
    if (Number.isNaN(parsedSeed)) return;

    const seededGame = initializeGame(parsedSeed);
    setGame(seededGame);
    setHistory([]);

    applySeedToUrl(seededGame.seed);
  }, [applySeedToUrl]);

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
      setHistory(prev => [...prev, cloneGame(game)]);
      setGame(newGame);
    }
  }, [game]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
  }, []);

  const handleDeckClick = useCallback(() => {
    const nextGame = game.deck.length === 0
      ? {
        ...game,
        deck: game.waste.map((card) => ({ ...card, faceUp: false })).reverse(),
        waste: [],
      }
      : {
        ...game,
        deck: game.deck.slice(1),
        waste: [{ ...game.deck[0], faceUp: true }, ...game.waste],
        selectedCard: null,
        selectedFrom: null,
      };

    setHistory(prev => [...prev, cloneGame(game)]);
    setGame(nextGame);
  }, [game]);

  const handleNewGame = useCallback(() => {
    if (history.length > 0 && !isWon) {
      setStats(prev => {
        const next = {
          ...prev,
          gamesPlayed: prev.gamesPlayed + 1,
          totalTurns: prev.totalTurns + history.length,
        };
        saveStats(next);
        return next;
      });
    }
    wonRecorded.current = false;
    const newGame = initializeGame();
    setGame(newGame);
    setHistory([]);
    applySeedToUrl(newGame.seed);
  }, [applySeedToUrl, history.length, isWon]);

  const handleCopyLink = useCallback(async () => {
    const basePath = '/2klondike';
    const url = `${window.location.origin}${basePath}/?${game.seed}`;
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      // Fallback for environments without clipboard API
      const textarea = document.createElement('textarea');
      textarea.value = url;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  }, [game.seed]);

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
        setHistory(prev => [...prev, cloneGame(game)]);
        setGame(newGame);
      }
    }
  }, [game]);

  return (
    <div className="app">
      {isWon && <Confetti />}
      {statsOpen && (
        <div className="modal-overlay" onClick={() => setStatsOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>Stats</h2>
            <div className="stats-grid">
              <div className="stat">
                <span className="stat-value">{stats.gamesPlayed}</span>
                <span className="stat-label">Played</span>
              </div>
              <div className="stat">
                <span className="stat-value">{stats.gamesWon}</span>
                <span className="stat-label">Won</span>
              </div>
              <div className="stat">
                <span className="stat-value">{stats.totalTurns}</span>
                <span className="stat-label">Total Turns</span>
              </div>
              <div className="stat">
                <span className="stat-value">
                  {stats.gamesPlayed === 0 ? '—' : `${Math.round((stats.gamesWon / stats.gamesPlayed) * 100)}%`}
                </span>
                <span className="stat-label">Win Rate</span>
              </div>
              <div className="stat">
                <span className="stat-value">
                  {stats.gamesPlayed === 0 ? '—' : (stats.totalTurns / stats.gamesPlayed).toFixed(1)}
                </span>
                <span className="stat-label">Turns / Game</span>
              </div>
            </div>
            <button className="modal-close" onClick={() => setStatsOpen(false)}>Close</button>
          </div>
        </div>
      )}
      <header className="app-header">
        <div className="header-row">
          <h1>Double Klondike</h1>
          <div className="header-actions">
            <button onClick={handleUndo} className="btn-undo" disabled={history.length === 0}>
              Undo
            </button>
            <button onClick={handleNewGame} className="btn-new-game">
              New Game
            </button>
            <button onClick={() => setStatsOpen(true)} className="btn-stats">
              Stats
            </button>
          </div>
        </div>
        <div className="header-row">
          <div className="header-meta">
            <a
              href="https://github.com/sean5446/2klondike/activity"
              className="version"
              target="_blank"
              rel="noopener noreferrer"
            >
              v{pkg.version}
            </a>
            <span className="meta-separator">·</span>
            <span className="turn-count">Turn: {turnsThisGame}</span>
          </div>
          <div className="seed-info">
            <a
              href={`${window.location.origin}/2klondike/?${game.seed}`}
              onClick={(e) => { e.preventDefault(); handleCopyLink(); }}
              className="game-id-link"
              title="Click to copy shareable link"
            >
              Game ID: {game.seed} <span aria-hidden="true">⧉</span>
            </a>
            {copied && (
              <span className="copy-toast" role="status" aria-live="polite">Copied game URL!</span>
            )}
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
