import React, { useState, useCallback, useEffect, useRef } from 'react';
import './App.css';
import CardComponent from './components/Card';
import StockWaste from './components/StockWaste';
import Foundations from './components/Foundations';
import Tableau from './components/Tableau';
import {
  cloneGameState,
  findCardById,
  findFoundationMoveIndex,
  hasWon,
  initializeGame,
  moveCard,
  playDeckTurn,
} from './gameLogic';
import { GameState, Card } from './types';
import Confetti from 'react-confetti';
import pkg from '../package.json';

interface Stats {
  gamesPlayed: number;
  gamesWon: number;
  totalTurns: number;
}

interface PointerDragState {
  cardId: string;
  fromType: string;
  fromIndex: number;
  pointerId: number;
  pointerType: string;
  clientX: number;
  clientY: number;
  startClientX: number;
  startClientY: number;
  offsetX: number;
  offsetY: number;
  didMove: boolean;
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
  } catch {
    // ignore
  }
  return { gamesPlayed: 0, gamesWon: 0, totalTurns: 0 };
}

function saveStats(stats: Stats): void {
  localStorage.setItem(STATS_KEY, JSON.stringify(stats));
}

// Main App component
function App(): React.ReactElement {
  const [game, setGame] = useState<GameState>(() => initializeGame());
  const [history, setHistory] = useState<GameState[]>([]);
  const [isWon, setIsWon] = useState(false);
  const [pointerDrag, setPointerDrag] = useState<PointerDragState | null>(null);

  const [copied, setCopied] = useState<boolean>(false);
  const [stats, setStats] = useState<Stats>(loadStats);
  const [statsOpen, setStatsOpen] = useState(false);
  const wonRecorded = useRef(false);
  const pointerDragRef = useRef<PointerDragState | null>(null);
  const turnsThisGame = history.length;
  const draggedCard = pointerDrag ? findCardById(game, pointerDrag.cardId) : null;

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

  const commitMove = useCallback((fromType: string, fromIndex: number, toType: string, toIndex: number, cardId: string): boolean => {
    // Dropping back onto the same source is a no-op and should not consume a turn.
    if (fromType === toType && fromIndex === toIndex) {
      return false;
    }

    const newGame = moveCard(game, fromType, fromIndex, toType, toIndex, cardId);
    if (newGame !== game) {
      setHistory(prev => [...prev, cloneGameState(game)]);
      setGame(newGame);
      return true;
    }
    return false;
  }, [game]);

  const clearPointerDrag = useCallback(() => {
    pointerDragRef.current = null;
    setPointerDrag(null);
  }, []);

  const applyPointerDrop = useCallback((toType: string, toIndex: number) => {
    const drag = pointerDragRef.current;
    if (!drag) return;

    commitMove(drag.fromType, drag.fromIndex, toType, toIndex, drag.cardId);
    clearPointerDrag();
  }, [clearPointerDrag, commitMove]);

  const handlePointerStart = useCallback((e: React.PointerEvent<HTMLDivElement>, card: Card, fromType: string, fromIndex: number) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    e.preventDefault();

    // Apply pointer capture for touch to keep drag tracking stable.
    if (e.pointerType === 'touch' && 'setPointerCapture' in e.currentTarget) {
      e.currentTarget.setPointerCapture(e.pointerId);
    }

    const cardBounds = e.currentTarget.getBoundingClientRect();

    const nextPointerDrag = {
      cardId: card.id,
      fromType,
      fromIndex,
      pointerId: e.pointerId,
      pointerType: e.pointerType,
      clientX: e.clientX,
      clientY: e.clientY,
      startClientX: e.clientX,
      startClientY: e.clientY,
      offsetX: e.clientX - cardBounds.left,
      offsetY: e.clientY - cardBounds.top,
      didMove: false,
    };

    pointerDragRef.current = nextPointerDrag;
    setPointerDrag(nextPointerDrag);
  }, []);

  const updatePointerDragPosition = useCallback((pointerId: number, clientX: number, clientY: number) => {
    const drag = pointerDragRef.current;
    if (!drag || pointerId !== drag.pointerId) return;

    const nextPointerDrag = {
      ...drag,
      clientX,
      clientY,
      didMove: drag.didMove || Math.hypot(clientX - drag.startClientX, clientY - drag.startClientY) > 8,
    };

    pointerDragRef.current = nextPointerDrag;
    setPointerDrag(nextPointerDrag);
  }, []);

  const completePointerDrop = useCallback((pointerId: number, clientX: number, clientY: number, target: EventTarget | null) => {
    const drag = pointerDragRef.current;
    if (!drag || pointerId !== drag.pointerId) return;

    const targetElement = target as HTMLElement | null;
    const pointTarget = document.elementFromPoint(clientX, clientY)?.closest<HTMLElement>('[data-drop-type]');
    const eventTarget = targetElement?.closest<HTMLElement>('[data-drop-type]');
    // For touch, prioritize elementFromPoint; for mouse/pointer, prioritize event target
    const dropTarget = drag.pointerType === 'touch'
      ? pointTarget ?? eventTarget
      : eventTarget ?? pointTarget;

    const didMoveOnRelease = drag.didMove || Math.hypot(clientX - drag.startClientX, clientY - drag.startClientY) > 8;

    if (dropTarget) {
      const toType = dropTarget.dataset.dropType;
      const toIndexRaw = dropTarget.dataset.dropIndex;
      const toIndex = toIndexRaw ? Number.parseInt(toIndexRaw, 10) : Number.NaN;
      if (toType && !Number.isNaN(toIndex)) {
          if (drag.pointerType === 'touch' && !didMoveOnRelease) {
          const directMove = commitMove(drag.fromType, drag.fromIndex, toType, toIndex, drag.cardId);
          if (directMove) {
            clearPointerDrag();
            return;
          }
          clearPointerDrag();
          return;
        }

        applyPointerDrop(toType, toIndex);
        return;
      }
    }

    clearPointerDrag();
}, [applyPointerDrop, clearPointerDrag, commitMove]);

  const handleGlobalPointerMove = useCallback((e: React.PointerEvent) => {
    if (!pointerDragRef.current) return;
    e.preventDefault();
    updatePointerDragPosition(e.pointerId, e.clientX, e.clientY);
  }, [updatePointerDragPosition]);

  const handleGlobalPointerUp = useCallback((e: React.PointerEvent) => {
    if (!pointerDragRef.current) return;
    e.preventDefault();
    completePointerDrop(e.pointerId, e.clientX, e.clientY, e.target);
  }, [completePointerDrop]);

  useEffect(() => {
    const handleWindowPointerMove = (e: PointerEvent) => {
      updatePointerDragPosition(e.pointerId, e.clientX, e.clientY);
    };

    const handleWindowPointerUp = (e: PointerEvent) => {
      completePointerDrop(e.pointerId, e.clientX, e.clientY, e.target);
    };

    window.addEventListener('pointermove', handleWindowPointerMove);
    window.addEventListener('pointerup', handleWindowPointerUp);
    window.addEventListener('pointercancel', handleWindowPointerUp);

    return () => {
      window.removeEventListener('pointermove', handleWindowPointerMove);
      window.removeEventListener('pointerup', handleWindowPointerUp);
      window.removeEventListener('pointercancel', handleWindowPointerUp);
    };
  }, [completePointerDrop, updatePointerDragPosition]);

  const handleDeckClick = useCallback(() => {
    const nextGame = playDeckTurn(game);

    setHistory(prev => [...prev, cloneGameState(game)]);
    setGame(nextGame);
    clearPointerDrag();
  }, [clearPointerDrag, game]);

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
    clearPointerDrag();
    applySeedToUrl(newGame.seed);
  }, [applySeedToUrl, clearPointerDrag, history.length, isWon]);

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
      clearPointerDrag();
    }
  }, [clearPointerDrag, history]);

  const handleDoubleClick = useCallback((card: Card, fromType: string, fromIndex: number | string) => {
    const foundationIndex = findFoundationMoveIndex(game, card);
    if (foundationIndex !== -1) {
      const fromIndexNumber = typeof fromIndex === 'number' ? fromIndex : Number.parseInt(String(fromIndex), 10);
      if (Number.isNaN(fromIndexNumber)) return;
      commitMove(fromType, fromIndexNumber, 'foundation', foundationIndex, card.id);
    }
  }, [commitMove, game.foundations]);



  return (
    <div className={`app ${pointerDrag ? 'is-pointer-dragging' : ''}`} onPointerMoveCapture={handleGlobalPointerMove} onPointerUpCapture={handleGlobalPointerUp} onPointerCancelCapture={handleGlobalPointerUp}>
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
        <div className="board-layout">
        {/* Top area: Stock and Waste */}
        <div className="top-area">
          <StockWaste
            deck={game.deck}
            waste={game.waste}
            pointerDragCardId={pointerDrag?.cardId || null}
            onDeckClick={handleDeckClick}
            onWasteDoubleClick={(card) => handleDoubleClick(card, 'waste', 0)}
            onWastePointerDown={(e, card) => handlePointerStart(e, card, 'waste', 0)}
          />

          <Foundations
            foundations={game.foundations}
            pointerDragCardId={pointerDrag?.cardId || null}
            onFoundationDoubleClick={(card, index) => handleDoubleClick(card, 'foundation', index)}
            onFoundationPointerDrop={(index) => applyPointerDrop('foundation', index)}
          />
        </div>

        <Tableau
          tableau={game.tableau}
          pointerDragCardId={pointerDrag?.cardId || null}
          onTableauDoubleClick={(card, index) => handleDoubleClick(card, 'tableau', index)}
          onTableauPointerStart={(e, card, index) => handlePointerStart(e, card, 'tableau', index)}
          onTableauPointerDrop={(index) => applyPointerDrop('tableau', index)}
        />
        </div>
      </div>

      {pointerDrag && draggedCard && (
        <div
          className="drag-preview"
          style={{
            left: pointerDrag.clientX - pointerDrag.offsetX,
            top: pointerDrag.clientY - pointerDrag.offsetY,
          }}
        >
          <CardComponent
            card={draggedCard}
            onClick={() => { }}
            draggable={true}
          />
        </div>
      )}
    </div>
  );
}

export default App;
