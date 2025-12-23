from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import chess
import chess.pgn
import chess.engine
import io

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"], 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class FenRequest(BaseModel):
    fen: str

def get_engine():
    # PATH CHECK: Ensure this matches your laptop's path
    return chess.engine.SimpleEngine.popen_uci(
        r"C:\Users\hp\OneDrive\Desktop\Chess\chess-coach\stockfish.exe"
    )

def get_eval(engine, board):
    info = engine.analyse(board, chess.engine.Limit(depth=12))
    score = info["score"].white()
    
    # Extract Best Move
    best_move = info["pv"][0].uci() if "pv" in info else None

    # Handle Mate scores (convert to big numbers)
    if score.is_mate():
        cp = 10000 if score.mate() > 0 else -10000
    else:
        cp = score.score() or 0
        
    return cp, best_move

def classify_move(cp_diff):
    if cp_diff <= 50:
        return "Best", "text-green-400"  # Green
    elif cp_diff <= 150:
        return "Inaccuracy", "text-yellow-400" # Yellow
    elif cp_diff <= 300:
        return "Mistake", "text-orange-400" # Orange
    else:
        return "Blunder", "text-red-500 font-bold" # Red

@app.post("/analyze-pgn")
async def analyze_pgn(file: UploadFile = File(...)):
    pgn_text = (await file.read()).decode("utf-8")
    game = chess.pgn.read_game(io.StringIO(pgn_text))
    
    board = game.board()
    engine = get_engine()
    
    moves_data = []
    
    # 1. Analyze Initial Position
    prev_eval, prev_best_move = get_eval(engine, board)

    for move in game.mainline_moves():
        # Identify who is moving (White or Black)
        is_white = board.turn
        
        # 2. Make the move
        san = board.san(move)
        board.push(move)
        
        # 3. Analyze New Position
        curr_eval, curr_best_move = get_eval(engine, board)
        
        # 4. Calculate Loss (Did the player make the situation worse?)
        if is_white:
            # White wants Eval to go UP. Loss = Prev - Curr
            diff = prev_eval - curr_eval
        else:
            # Black wants Eval to go DOWN. Loss = Curr - Prev
            diff = curr_eval - prev_eval
            
        # Don't punish winning mate sequences
        if diff < 0: diff = 0 

        label, color_class = classify_move(diff)

        moves_data.append({
            "san": san,
            "eval_cp": curr_eval,
            "best_move": prev_best_move, # The move they SHOULD have played
            "classification": label,
            "color": color_class
        })
        
        # Update prev for next turn
        prev_eval = curr_eval
        prev_best_move = curr_best_move

    engine.quit()
    return {"moves": moves_data}

@app.post("/analyze-fen")
def analyze_fen(request: FenRequest):
    engine = get_engine()
    board = chess.Board(request.fen)
    cp, best_move = get_eval(engine, board)
    engine.quit()
    return {"eval_cp": cp, "best_move": best_move}
