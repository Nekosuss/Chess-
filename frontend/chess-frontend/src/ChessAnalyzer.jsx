import React, { useState, useEffect, useRef } from 'react';
import { Chess } from 'chess.js';
import { Chessboard } from 'react-chessboard';
import axios from 'axios';
import { ChevronLeft, ChevronRight, Upload, FileText } from 'lucide-react';

const ChessAnalyzer = () => {
  const [game, setGame] = useState(new Chess());
  const [analysis, setAnalysis] = useState([]);
  const [currentMoveIndex, setCurrentMoveIndex] = useState(-1);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  
  // New state for live analysis (Drag & Drop)
  const [liveEval, setLiveEval] = useState(null);
  const [liveBestMove, setLiveBestMove] = useState(null);

  const moveListRef = useRef(null);

  // Convert raw Centipawns to standard Eval (e.g. 150 -> +1.50)
  const formatEval = (cp) => {
    if (cp === undefined || cp === null) return "-";
    if (cp === 10000) return "MATE (White)";
    if (cp === -10000) return "MATE (Black)";
    const score = cp / 100;
    return score > 0 ? `+${score.toFixed(2)}` : score.toFixed(2);
  };

  // Helper to get symbol for classification
  const getMoveSymbol = (cls) => {
    if (cls === "Blunder") return "??";
    if (cls === "Mistake") return "?";
    if (cls === "Inaccuracy") return "?!";
    return "";
  };

  // Handle File Upload
  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    setIsLoading(true);
    setError(null);
    setLiveEval(null); 
    
    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await axios.post('http://localhost:8000/analyze-pgn', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      const newGame = new Chess();
      setGame(newGame);
      setAnalysis(response.data.moves);
      setCurrentMoveIndex(-1);
    } catch (err) {
      console.error(err);
      setError("Failed to analyze. Is backend running on port 8000?");
    } finally {
      setIsLoading(false);
    }
  };

  // Navigation Logic
  const goToMove = (index) => {
    if (index < -1 || index >= analysis.length) return;

    const newGame = new Chess();
    for (let i = 0; i <= index; i++) {
      newGame.move(analysis[i].san);
    }
    setGame(newGame);
    setCurrentMoveIndex(index);
    setLiveEval(null); 
    setLiveBestMove(null);
  };

  // Handle Drag & Drop (Making a move)
  const onDrop = (sourceSquare, targetSquare) => {
    try {
      const newGame = new Chess(game.fen());
      const move = newGame.move({
        from: sourceSquare,
        to: targetSquare,
        promotion: 'q',
      });

      if (move === null) return false; 

      setGame(newGame);
      setLiveEval("..."); 
      
      axios.post('http://localhost:8000/analyze-fen', { fen: newGame.fen() })
        .then(res => {
          setLiveEval(res.data.eval_cp);
          setLiveBestMove(res.data.best_move);
        });

      return true;
    } catch (e) {
      return false;
    }
  };

  // Handle Keyboard Arrow Keys
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (analysis.length === 0) return;

      if (e.key === "ArrowRight") {
        goToMove(currentMoveIndex + 1);
      } else if (e.key === "ArrowLeft") {
        goToMove(currentMoveIndex - 1);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [currentMoveIndex, analysis]);

  // Scroll to active move
  useEffect(() => {
    if (moveListRef.current) {
        const active = moveListRef.current.querySelector('.bg-blue-600');
        if(active) {
            active.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }
  }, [currentMoveIndex]);

  // Determine Eval and Arrows
  const displayEval = liveEval !== null ? liveEval : (currentMoveIndex >= 0 ? analysis[currentMoveIndex]?.eval_cp : 0);
  const evalPercent = Math.max(0, Math.min(100, 50 + (displayEval / 10))); 

  let arrowToDraw = [];
  if (liveBestMove) {
     arrowToDraw = [[liveBestMove.substring(0, 2), liveBestMove.substring(2, 4)]];
  } else if (analysis[currentMoveIndex + 1]?.best_move) { // Look ahead to next move for historical analysis
     // Note: In the new backend logic, 'best_move' is stored in the entry corresponding to the move that *just happened*.
     // But for arrows, we actually want to know: "In the CURRENT position, what is best?"
     // The backend stores "best_move" alongside the move that was played.
     // So if we are at move 5, we look at analysis[5] to see what we SHOULD have done instead of move 6.
     // Actually, let's keep it simple: Use the best_move from the *next* array item if it exists.
     const nextData = analysis[currentMoveIndex + 1];
     if (nextData && nextData.best_move) {
         arrowToDraw = [[nextData.best_move.substring(0, 2), nextData.best_move.substring(2, 4)]];
     }
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8 font-sans">
      <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* LEFT COLUMN: Board */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-gray-800 p-4 rounded-xl shadow-2xl flex gap-4">
            
            {/* Eval Bar */}
            <div className="w-8 bg-gray-700 rounded-md relative overflow-hidden border border-gray-600">
              <div 
                className="absolute bottom-0 w-full bg-white transition-all duration-500 ease-in-out"
                style={{ height: `${evalPercent}%` }}
              ></div>
            </div>

            {/* Chessboard */}
            <div className="flex-grow max-w-[600px] aspect-square">
              <Chessboard 
                position={game.fen()} 
                boardWidth={560}
                onPieceDrop={onDrop}
                arePiecesDraggable={true}
                animationDuration={200}
                snapToCursor={true}
                customDarkSquareStyle={{ backgroundColor: '#779556' }}
                customLightSquareStyle={{ backgroundColor: '#ebecd0' }}
                customArrows={arrowToDraw}
                customArrowColor="rgba(0, 255, 0, 0.5)" 
              />
            </div>
          </div>

          {/* Controls */}
          <div className="flex justify-between items-center bg-gray-800 p-4 rounded-xl">
            <button 
                onClick={() => document.getElementById('pgn-upload').click()}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg font-medium transition"
            >
                <Upload size={20} /> Upload PGN
            </button>
            <input type="file" id="pgn-upload" accept=".pgn" onChange={handleFileUpload} className="hidden" />

            <div className="flex gap-2">
                <button onClick={() => goToMove(currentMoveIndex - 1)} disabled={currentMoveIndex < 0} className="p-2 bg-gray-700 hover:bg-gray-600 rounded-lg disabled:opacity-50">
                    <ChevronLeft size={24} />
                </button>
                <button onClick={() => goToMove(currentMoveIndex + 1)} disabled={currentMoveIndex >= analysis.length - 1} className="p-2 bg-gray-700 hover:bg-gray-600 rounded-lg disabled:opacity-50">
                    <ChevronRight size={24} />
                </button>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Analysis */}
        <div className="bg-gray-800 rounded-xl p-6 shadow-xl flex flex-col h-[700px]">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            <FileText className="text-blue-400"/> Analysis Report
          </h2>

          {isLoading ? (
            <div className="flex-grow flex items-center justify-center text-blue-400 animate-pulse">Analyzing positions...</div>
          ) : analysis.length === 0 && !liveEval ? (
            <div className="text-gray-500 text-center mt-10">Upload a PGN file or move pieces to start.</div>
          ) : (
            <>
              <div className="bg-gray-700 p-4 rounded-lg mb-4">
                <div className="text-gray-400 text-sm">{liveEval !== null ? "Live Evaluation" : "Evaluation"}</div>
                <div className={`text-3xl font-bold ${displayEval > 0 ? 'text-green-400' : displayEval < 0 ? 'text-red-400' : 'text-white'}`}>
                    {displayEval === "..." ? "..." : formatEval(displayEval)}
                </div>
              </div>

              <div className="flex-grow overflow-y-auto pr-2 space-y-1" ref={moveListRef}>
                {analysis.map((move, index) => {
                   const isWhite = index % 2 === 0;
                   const moveNum = Math.floor(index / 2) + 1;
                   
                   return isWhite ? (
                     <div key={index} className="flex items-center gap-2 mt-2">
                       <span className="text-gray-500 w-6 text-sm">{moveNum}.</span>
                       
                       {/* WHITE MOVE */}
                       <button onClick={() => goToMove(index)} className={`flex-1 text-left px-3 py-2 rounded ${currentMoveIndex === index && liveEval === null ? 'bg-blue-600 text-white' : 'bg-gray-700 hover:bg-gray-600'}`}>
                         <span className={`font-bold ${analysis[index].color || 'text-white'}`}>
                            {analysis[index].san} {getMoveSymbol(analysis[index].classification)}
                         </span>
                         <span className="float-right text-xs opacity-70">{formatEval(analysis[index].eval_cp)}</span>
                       </button>

                       {/* BLACK MOVE */}
                       {analysis[index + 1] && (
                         <button onClick={() => goToMove(index + 1)} className={`flex-1 text-left px-3 py-2 rounded ${currentMoveIndex === index + 1 && liveEval === null ? 'bg-blue-600 text-white' : 'bg-gray-700 hover:bg-gray-600'}`}>
                           <span className={`font-bold ${analysis[index + 1].color || 'text-white'}`}>
                             {analysis[index + 1].san} {getMoveSymbol(analysis[index + 1].classification)}
                           </span>
                           <span className="float-right text-xs opacity-70">{formatEval(analysis[index + 1].eval_cp)}</span>
                         </button>
                       )}
                     </div>
                   ) : null;
                })}
              </div>
            </>
          )}
          {error && <div className="mt-4 text-red-400 text-center text-sm">{error}</div>}
        </div>
      </div>
    </div>
  );
};

export default ChessAnalyzer;