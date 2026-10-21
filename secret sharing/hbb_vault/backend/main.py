"""FastAPI application entry point for the HBB Vault quantum secret sharing demo.

Binds to 127.0.0.1 only.
Runs completely offline with local in-memory state.
"""

import os
from typing import Any, Dict, Optional
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from hbb_vault.backend.protocol import HBBSession

app = FastAPI(title="HBB Vault - Quantum Secret Sharing")

# CORS restricted to localhost/127.0.0.1
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://127.0.0.1:8000", "http://localhost:8000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global in-memory session (reset clears it)
session = HBBSession()


# Request Models
class EncodeRequest(BaseModel):
    text: str


class RunRequest(BaseModel):
    n_rounds: Optional[int] = None
    eve_on: Optional[bool] = None
    # For single practice round
    manual_mode: Optional[bool] = False
    alice_basis: Optional[str] = "X"
    bob_basis: Optional[str] = "X"
    charlie_basis: Optional[str] = "X"


class DecryptRequest(BaseModel):
    mode: str  # 'bob', 'charlie', or 'both'


@app.post("/api/encode")
def api_encode(req: EncodeRequest):
    try:
        return session.encode_message(req.text)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/api/run")
def api_run(req: RunRequest):
    try:
        if req.manual_mode:
            # Single practice round
            return session.measure_practice_round(
                a_basis=req.alice_basis or "X",
                b_basis=req.bob_basis or "X",
                c_basis=req.charlie_basis or "X",
                eve_on=req.eve_on,
            )
        else:
            # Full batch execution
            return session.run_full_batch(
                n_rounds=req.n_rounds,
                eve_on=req.eve_on,
            )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/api/check")
def api_check():
    try:
        return session.run_security_check()
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/api/encrypt")
def api_encrypt():
    try:
        return session.encrypt()
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/api/combine")
def api_combine():
    try:
        return session.combine_shares()
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/api/decrypt")
def api_decrypt(req: DecryptRequest):
    try:
        return session.decrypt(req.mode)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/api/reset")
def api_reset():
    session.reset()
    return {"status": "reset", "message": "In-memory session state cleared completely."}


@app.get("/api/state")
def api_state():
    return {
        "eve_on": session.eve_on,
        "security_checked": session.security_checked,
        "attack_detected": session.attack_detected,
        "measured_qber": session.measured_qber,
        "qber_percent": round(session.measured_qber * 100, 2),
        "sampled_rounds": session.sampled_rounds,
        "matched_count": session.sample_size - session.errors_in_sample,
        "mismatched_count": session.errors_in_sample,
        "key_used": session.key_used,
        "total_rounds": len(session.all_rounds),
        "kept_rounds": len(session.kept_rounds),
        "has_ciphertext": bool(session.ciphertext),
        "history_count": len(session.history_runs),
        "last_eve_off_run": session.last_eve_off_run,
        "last_eve_on_run": session.last_eve_on_run,
    }


# Static files mount
frontend_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "frontend")
if os.path.exists(frontend_dir):
    app.mount("/static", StaticFiles(directory=frontend_dir), name="static")

    @app.get("/")
    def serve_index():
        return FileResponse(os.path.join(frontend_dir, "index.html"))
