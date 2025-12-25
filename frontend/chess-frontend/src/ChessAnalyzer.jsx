import React, { useState, useEffect, useRef } from 'react';
import { Chess } from 'chess.js';
import { Chessboard } from 'react-chessboard';
import axios from 'axios';
import { ChevronLeft, ChevronRight, Upload, Activity, Trophy, Volume2, VolumeX, Target } from 'lucide-react';
import EvaluationGraph from './EvaluationGraph'; 

const ChessAnalyzer = () => {
  const [game, setGame] = useState(new Chess());
  const [analysis, setAnalysis] = useState([]);
  const [accuracy, setAccuracy] = useState(null);
  const [currentMoveIndex, setCurrentMoveIndex] = useState(-1);
  const [isLoading, setIsLoading] = useState(false);
  
  // Audio State
  const [soundEnabled, setSoundEnabled] = useState(true);
  
  // Live analysis state
  const [liveEval, setLiveEval] = useState(null);
  const [liveBestMove, setLiveBestMove] = useState(null);
  const moveListRef = useRef(null);

  // --- AUDIO ENGINE ---
  const playSound = (type) => {
    if (!soundEnabled) return;
    try {
        const audio = new Audio(`/sounds/${type}.mp3`);
        audio.volume = 0.5; 
        audio.play().catch(e => console.warn("Audio play failed:", e));
    } catch (e) {
        console.warn("Audio error:", e);
    }
  };

  // --- HELPERS ---
  const formatEval = (cp) => {
    if (cp === undefined || cp === null) return "-";
    if (cp >= 9900) return "M+"; 
    if (cp <= -9900) return "M-"; 
    const score = cp / 100;
    return score > 0 ? `+${score.toFixed(2)}` : score.toFixed(2);
  };

  const getMoveBadge = (cls) => {
    if (!cls) return null;
    switch(cls) {
        case "Brilliant": return <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-teal-500/20 text-teal-400 border border-teal-500/30 shadow-[0_0_8px_rgba(45,212,191,0.2)]">!!</span>;
        case "Best": return <span className="text-teal-400 text-sm drop-shadow-md">★</span>;
        case "Excellent": return <span className="text-green-400 text-[10px] font-bold">✓</span>;
        case "Inaccuracy": return <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-yellow-500/20 text-yellow-400 border border-yellow-500/30">?!</span>;
        case "Mistake": return <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-orange-500/20 text-orange-400 border border-orange-500/30">?</span>;
        case "Blunder": return <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-500/20 text-red-400 border border-red-500/30 shadow-[0_0_8px_rgba(248,113,113,0.3)]">??</span>;
        default: return null;
    }
  };

  const getGraphData = () => {
    if (!analysis || analysis.length === 0) return [];
    return analysis.map((move, index) => ({
      moveIndex: index,
      score: Math.max(-8, Math.min(8, (move.eval_cp || 0) / 100))
    }));
  };

  // --- HANDLERS ---
  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    setIsLoading(true);
    setLiveEval(null);
    setAnalysis([]);
    setAccuracy(null);
    playSound('move'); 
    
    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await axios.post('http://localhost:8000/analyze-pgn', formData);
      const newGame = new Chess();
      setGame(newGame);
      setAnalysis(response.data.moves || []);
      setAccuracy(response.data.accuracy);
      setCurrentMoveIndex(-1);
    } catch (err) {
      console.error(err);
      alert("Backend Error: " + (err.response?.data?.detail || "Check console"));
    } finally {
      setIsLoading(false);
    }
  };

  const goToMove = (index) => {
    if (index < -1 || index >= analysis.length) return;
    
    if (index >= 0) {
        const moveData = analysis[index];
        if (moveData.classification === "Blunder") playSound('blunder');
        else playSound('move');
    }

    const newGame = new Chess();
    for (let i = 0; i <= index; i++) newGame.move(analysis[i].san);
    setGame(newGame);
    setCurrentMoveIndex(index);
    setLiveEval(null); 
    setLiveBestMove(null);
  };

  // --- CRITICAL FIX: onDrop logic ---
  const onDrop = (sourceSquare, targetSquare) => {
    try {
      // 1. Validate move with chess.js
      const newGame = new Chess(game.fen());
      const move = newGame.move({ from: sourceSquare, to: targetSquare, promotion: 'q' });
      
      if (!move) return false; // Illegal move -> snap back
      
      // 2. Play Sound
      if (newGame.in_check()) playSound('check');
      else if (move.captured) playSound('capture');
      else playSound('move');

      // 3. Update React State immediately
      setGame(newGame);
      setLiveEval("..."); 
      
      // 4. Async Backend Call (Doesn't block UI)
      axios.post('http://localhost:8000/analyze-fen', { fen: newGame.fen() })
        .then(res => { setLiveEval(res.data.eval_cp); setLiveBestMove(res.data.best_move); })
        .catch(err => console.error("Eval failed", err));
      
      return true; // Return true to react-chessboard
    } catch (e) { 
      console.error("Move failed:", e);
      return false; 
    }
  };

  useEffect(() => {
    if (moveListRef.current) {
        const active = moveListRef.current.querySelector('[data-active="true"]');
        if(active) active.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [currentMoveIndex]);

  // --- RENDER ---
  const displayEval = liveEval !== null ? liveEval : (currentMoveIndex >= 0 ? analysis[currentMoveIndex]?.eval_cp : 0);
  const evalPercent = Math.max(5, Math.min(95, 50 + (displayEval / 10))); 
  
  let arrowToDraw = [];
  if (liveBestMove) arrowToDraw = [[liveBestMove.substring(0, 2), liveBestMove.substring(2, 4)]];
  else if (analysis[currentMoveIndex + 1]?.best_move) {
     const bm = analysis[currentMoveIndex + 1].best_move;
     if(bm) arrowToDraw = [[bm.substring(0, 2), bm.substring(2, 4)]];
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 p-4 md:p-8 font-sans selection:bg-emerald-500/30">
      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-slate-900 p-4 rounded-xl shadow-2xl border border-slate-800 flex gap-4 relative">
             
            {/* Eval Bar */}
            <div className="w-6 bg-slate-800 rounded relative overflow-hidden border border-slate-700 shadow-inner">
               <div className="absolute inset-0 bg-gradient-to-b from-slate-800 to-slate-900 opacity-50"></div>
               <div className="absolute bottom-0 w-full bg-gradient-to-t from-slate-200 to-white transition-all duration-500 ease-out shadow-[0_0_15px_rgba(255,255,255,0.3)]" style={{ height: `${evalPercent}%` }} />
            </div>

            {/* Chessboard Container */}
            <div className="flex-grow aspect-square max-w-[650px] shadow-2xl rounded-lg overflow-hidden border border-slate-700 z-10">
              <Chessboard 
                id="ChessboardID"
                position={game.fen()} 
                onPieceDrop={onDrop}
                arePiecesDraggable={true} 
                customArrows={arrowToDraw} 
                customDarkSquareStyle={{ backgroundColor: '#334155' }} 
                customLightSquareStyle={{ backgroundColor: '#94a3b8' }}
                animationDuration={250}
              />
            </div>
            
            {/* Loading Indicator (Small, Top Right, NOT blocking board) */}
            {isLoading && (
                 <div className="absolute top-4 right-4 bg-slate-900/90 px-3 py-1 rounded-full border border-emerald-500/50 flex items-center gap-2 z-20 shadow-lg">
                    <div className="w-4 h-4 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
                    <span className="text-xs text-emerald-400 font-bold">Analyzing...</span>
                 </div>
             )}
          </div>
          
          <EvaluationGraph data={getGraphData()} onMoveClick={goToMove} currentIndex={currentMoveIndex} />
          
          <div className="bg-slate-900 p-4 rounded-xl flex justify-between items-center border border-slate-800 shadow-lg">
            <button onClick={() => document.getElementById('up').click()} className="bg-emerald-600 hover:bg-emerald-500 text-white px-5 py-2.5 rounded-lg font-bold flex gap-2 transition-all shadow-[0_4px_14px_0_rgba(16,185,129,0.39)] active:scale-95"><Upload size={18}/> Analyze PGN</button>
            <input type="file" id="up" hidden onChange={handleFileUpload} />
            
            <div className="flex gap-4 items-center">
                <button onClick={() => setSoundEnabled(!soundEnabled)} className="p-2 text-slate-400 hover:text-emerald-400 transition-colors">
                    {soundEnabled ? <Volume2 size={20}/> : <VolumeX size={20}/>}
                </button>
                <div className="flex gap-1 bg-slate-800 p-1 rounded-lg border border-slate-700">
                    <button onClick={() => goToMove(currentMoveIndex - 1)} className="p-2.5 hover:bg-slate-700 rounded text-slate-300"><ChevronLeft/></button>
                    <button onClick={() => goToMove(currentMoveIndex + 1)} className="p-2.5 hover:bg-slate-700 rounded text-slate-300"><ChevronRight/></button>
                </div>
            </div>
          </div>
        </div>

        <div className="bg-slate-900 rounded-xl flex flex-col h-[600px] border border-slate-800 shadow-xl overflow-hidden">
          <div className="p-5 border-b border-slate-800 bg-slate-900/50 backdrop-blur">
            <h2 className="text-lg font-bold flex items-center gap-2 text-emerald-400 mb-4"><Activity className="w-5"/> Game Report</h2>
            {accuracy ? (
                <div className="grid grid-cols-2 gap-4 text-center">
                    <div className="bg-slate-800/80 p-3 rounded-lg border border-slate-700">
                        <div className="text-[10px] text-slate-400 uppercase font-bold mb-1">White Accuracy</div>
                        <div className="text-2xl font-black text-white">{accuracy.white}%</div>
                    </div>
                    <div className="bg-slate-800/80 p-3 rounded-lg border border-slate-700">
                        <div className="text-[10px] text-slate-400 uppercase font-bold mb-1">Black Accuracy</div>
                        <div className="text-2xl font-black text-white">{accuracy.black}%</div>
                    </div>
                </div>
            ) : <div className="text-center text-slate-500 text-sm italic py-4 bg-slate-800/30 rounded border border-slate-800/50">Upload a PGN to unlock full game insights.</div>}
          </div>

          <div className="flex-grow overflow-y-auto custom-scrollbar bg-slate-950 p-2" ref={moveListRef}>
             {analysis.map((move, i) => {
               if (i % 2 !== 0) return null;
               const w = move;
               const b = analysis[i+1];
               const wActive = currentMoveIndex === i;
               const bActive = currentMoveIndex === i+1;
               return (
                 <div key={i} className="flex gap-1 mb-1 text-sm group">
                   <div className="w-8 text-slate-500 text-right pr-2 py-1.5 font-mono opacity-50">{Math.floor(i/2)+1}.</div>
                   <button onClick={() => goToMove(i)} data-active={wActive} className={`flex-1 text-left px-3 py-1.5 rounded-md flex justify-between items-center transition-all ${wActive ? 'bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-500/50' : 'text-slate-300 hover:bg-slate-800'}`}>
                     <span className="font-bold flex gap-1">{w.san} {getMoveBadge(w.classification)}</span>
                     <span className="opacity-40 font-mono text-[10px]">{formatEval(w.eval_cp)}</span>
                   </button>
                   {b && <button onClick={() => goToMove(i+1)} data-active={bActive} className={`flex-1 text-left px-3 py-1.5 rounded-md flex justify-between items-center transition-all ${bActive ? 'bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-500/50' : 'text-slate-300 hover:bg-slate-800'}`}>
                     <span className="font-bold flex gap-1">{b.san} {getMoveBadge(b.classification)}</span>
                     <span className="opacity-40 font-mono text-[10px]">{formatEval(b.eval_cp)}</span>
                   </button>}
                 </div>
               )
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChessAnalyzer;