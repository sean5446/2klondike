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

interface TouchSelectionState {
  cardId: string;
  fromType: string;
  fromIndex: number;
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

// Create deep clone of game state for history snapshots.
function cloneGame(g: GameState): GameState {
  return structuredClone(g) as GameState;
}

function findCardById(game: GameState, cardId: string): Card | null {
  const wasteCard = game.waste.find((card) => card.id === cardId);
  if (wasteCard) return wasteCard;

  for (const pile of game.tableau) {
    const tableauCard = pile.find((card) => card.id === cardId);
    if (tableauCard) return tableauCard;
  }

  for (const pile of game.foundations) {
    const foundationCard = pile.find((card) => card.id === cardId);
    if (foundationCard) return foundationCard;
  }

  return null;
}

// Main App component
function App(): React.ReactElement {
  const [game, setGame] = useState<GameState>(() => initializeGame());
  const [history, setHistory] = useState<GameState[]>([]);
  const [isWon, setIsWon] = useState(false);
  const [pointerDrag, setPointerDrag] = useState<PointerDragState | null>(null);
  const [touchSelection, setTouchSelection] = useState<TouchSelectionState | null>(null);

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
    const newGame = moveCard(game, fromType, fromIndex, toType, toIndex, cardId);
    if (newGame !== game) {
      setHistory(prev => [...prev, cloneGame(game)]);
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

    // Reset tap-selection when starting a drag gesture.
    setTouchSelection(null);

    if (e.currentTarget.hasPointerCapture && !e.currentTarget.hasPointerCapture(e.pointerId)) {
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
            setTouchSelection(null);
            clearPointerDrag();
            return;
          }

          // Touch tap-to-move fallback: tap card to select, then tap destination pile.
          if (touchSelection && touchSelection.cardId !== drag.cardId) {
            const moved = commitMove(touchSelection.fromType, touchSelection.fromIndex, toType, toIndex, touchSelection.cardId);
            if (moved) {
              setTouchSelection(null);
              clearPointerDrag();
              return;
            }
          }

            if (drag.fromType === 'tableau' || drag.fromType === 'waste') {
              setTouchSelection((prev) => {
                if (prev?.cardId === drag.cardId) return null;
                return { cardId: drag.cardId, fromType: drag.fromType, fromIndex: drag.fromIndex };
              });
            }
          clearPointerDrag();
          return;
        }

        applyPointerDrop(toType, toIndex);
        setTouchSelection(null);
        return;
      }
    }

    clearPointerDrag();
  }, [applyPointerDrop, clearPointerDrag, commitMove, touchSelection]);

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
    clearPointerDrag();
    setTouchSelection(null);
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
    setTouchSelection(null);
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
      setTouchSelection(null);
    }
  }, [clearPointerDrag, history]);

  const handleDoubleClick = useCallback((card: Card, fromType: string, fromIndex: number | string) => {
    // Find a foundation where the card can be placed
    const foundationIndex = game.foundations.findIndex(foundation => canMoveToFoundation(card, foundation));
    if (foundationIndex !== -1) {
      const fromIndexNumber = typeof fromIndex === 'number' ? fromIndex : Number.parseInt(String(fromIndex), 10);
      if (Number.isNaN(fromIndexNumber)) return;
      commitMove(fromType, fromIndexNumber, 'foundation', foundationIndex, card.id);
    }
  }, [commitMove, game.foundations]);

  const handleTapSelect = useCallback((card: Card, fromType: string, fromIndex: number) => {
    if (!card.faceUp) return;
    setTouchSelection((prev) => {
      if (prev?.cardId === card.id) return null;
      return { cardId: card.id, fromType, fromIndex };
    });
  }, []);

  const handleTapDrop = useCallback((toType: string, toIndex: number) => {
    if (!touchSelection) return;
    const moved = commitMove(touchSelection.fromType, touchSelection.fromIndex, toType, toIndex, touchSelection.cardId);
    // Always clear tap-selection after an attempted destination tap.
    if (!moved) {
      setTouchSelection(null);
      return;
    }
    setTouchSelection(null);
  }, [commitMove, touchSelection]);

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
          <div className="stock-waste">
            <div className="stock">
              <CardComponent card={null} onClick={handleDeckClick} faceDown={game.deck.length > 0} />
              <div className="stock-count">{game.deck.length}</div>
            </div>
            <div className="waste">
              <CardComponent
                card={game.waste[0] || null}
                onClick={() => game.waste[0] && handleTapSelect(game.waste[0], 'waste', 0)}
                onDoubleClick={() => game.waste[0] && handleDoubleClick(game.waste[0], 'waste', 0)}
                draggable={!!game.waste[0]}
                onPointerDown={(e) => game.waste[0] && handlePointerStart(e, game.waste[0], 'waste', 0)}
                isDragging={pointerDrag?.cardId === game.waste[0]?.id}
              />
            </div>
          </div>

          {/* Foundations */}
          <div className="foundations">
            {Array.from({ length: 8 }, (_, index) => (
              <div
                key={index}
                className="foundation"
                data-drop-type="foundation"
                data-drop-index={index}
                onClick={() => handleTapDrop('foundation', index)}
                onPointerUp={(e) => {
                  e.preventDefault();
                  applyPointerDrop('foundation', index);
                  handleTapDrop('foundation', index);
                }}
              >
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
            <div
              key={index}
              className="tableau-pile"
              data-drop-type="tableau"
              data-drop-index={index}
              onClick={() => handleTapDrop('tableau', index)}
              onPointerUp={(e) => {
                e.preventDefault();
                applyPointerDrop('tableau', index);
                handleTapDrop('tableau', index);
              }}
            >
              {pile.length === 0 ? (
                <div className="tableau-empty-slot" />
              ) : (
                pile.map((card, cardIndex) => (
                  <div
                    key={card.id}
                    className="tableau-card"
                    style={{ transform: `translateY(calc(${cardIndex} * var(--tableau-offset)))` }}
                  >
                    <CardComponent
                      card={card}
                      onClick={() => handleTapSelect(card, 'tableau', index)}
                      onDoubleClick={() => card.faceUp && handleDoubleClick(card, 'tableau', index)}
                      faceDown={!card.faceUp}
                      draggable={card.faceUp}
                      onPointerDown={(e) => card.faceUp && handlePointerStart(e, card, 'tableau', index)}
                      isDragging={pointerDrag?.cardId === card.id}
                      isSelected={touchSelection?.cardId === card.id}
                    />
                  </div>
                ))
              )}
            </div>
          ))}
        </div>
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
