from fastapi.middleware.cors import CORSMiddleware
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from main import analyze_pgn_file
import tempfile
import os


app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)



class AnalyzeRequest(BaseModel):
    pgn: str


@app.post("/analyze")
def analyze(req: AnalyzeRequest):
    try:
        # Write PGN text to a temporary file
        with tempfile.NamedTemporaryFile(
            delete=False,
            suffix=".pgn",
            mode="w",
            encoding="utf-8"
        ) as f:
            f.write(req.pgn)
            temp_path = f.name

        # Run your existing engine
        result = analyze_pgn_file(temp_path)

        # Cleanup temp file
        os.remove(temp_path)

        return result

    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
