# HBB Vault: Hillery-Bužek-Berthiaume Quantum Secret Sharing (QSS) Demo

An offline, local interactive demonstration of the **Hillery-Bužek-Berthiaume (HBB 1999)** tripartite quantum secret sharing protocol engineered for college expos, academic presentations, and quantum computing demonstrations.

The UI is built using the Titanium Steel workflow design from Stitch (`projects/7710770674257561711`), featuring a dark palette, real-time Qiskit quantum circuit simulations, Vernam one-time pad encryption, and intercept-resend eavesdropping detection.

---

## Key Features

- **Real Quantum Simulation**: Powered by Qiskit Aer (`AerSimulator`). No hardcoded or faked data.
- **Pure Offline Architecture**: 100% self-contained. No external CDNs, no remote fonts, no external APIs.
- **Zero Database / Zero Persistence**: All state is held in Python memory; a reset clears everything.
- **Cryptographic Randomness**: Bases are selected using Python's standard `secrets` module (`secrets.choice`), never predictable pseudorandom generators or fixed simulator seeds.
- **Strict State Machine**: Step-by-step guided flow with action buttons, visible outputs, animated down-arrow transitions, and progress navigation rail.
- **Active Eavesdropping (Eve) Detection**: Intercept-resend attack on Bob's qubit via mid-circuit measurement and reset. The measured QBER (~25%) breaches the 5% sifting threshold, immediately aborting the protocol and discarding the keys.
- **Vernam One-Time Pad**: Message bits XOR'd with Alice's sifted quantum key. Plaintext is purged from server memory upon encryption.
- **Collaborative Share Synthesis**: Bob alone or Charlie alone obtains 50% entropy noise (unrecoverable garbage); together ($B \oplus C = A$) they decrypt the original plaintext bit-for-bit.

---

## Palette & Design System

- **Background**: `#000000`
- **Surfaces**: `#111215`, `#16181D`, `#1C1C1C`, `#1D2027`
- **Borders**: `#2A2E39`, `#343A46`, `#3D3D3D`, `#4B5563`, `#64748B`
- **Secondary Text**: `#7D7D7D`, `#8B95A5`, `#94A3B8`
- **Primary Text**: `#B0B0B0`, `#C5CAD4`, `#E2E8F0`, `#FFFFFF`
- **Purple Accents**: `#21213B`, `#363659`, `#505077`, `#6868A6`
- **Success Green**: `#5FBF8F`
- **Eve / Attack Red**: `#E06C75`, `#D9534F`

---

## Protocol Rules & Mathematical Foundations

1. **GHZ State Preparation**:
   $$\vert \text{GHZ} \rangle = \frac{1}{\sqrt{2}} (\vert 000 \rangle + \vert 111 \rangle)$$
   Constructed via Hadamard on qubit 0 followed by CNOT(0, 1) and CNOT(0, 2).

2. **Basis Rotations**:
   - $X$-basis: Apply $H$ gate prior to standard computational ($Z$) measurement.
   - $Y$-basis: Apply $S^\dagger$ gate followed by $H$ gate.
   
3. **Sifting Rule (Accepted Eigenstates)**:
   Only measurement combinations where the operators commute with $\vert \text{GHZ} \rangle$ are kept:
   - $X \otimes X \otimes X$ (Eigenvalue $+1 \implies A \oplus B \oplus C = 0$)
   - $X \otimes Y \otimes Y$ (Eigenvalue $-1 \implies A \oplus B \oplus C = 1$)
   - $Y \otimes X \otimes Y$ (Eigenvalue $-1 \implies A \oplus B \oplus C = 1$)
   - $Y \otimes Y \otimes X$ (Eigenvalue $-1 \implies A \oplus B \oplus C = 1$)
   All other 4 combinations ($XXY$, $XYX$, $YXX$, $YYY$) are discarded.

4. **Secret Key Sharing**:
   - Alice's key bit: $A$
   - Bob's share bit: $B$
   - Charlie's share bit: $C' = C \oplus \text{flip}$, where $\text{flip} = 0$ for $XXX$ and $1$ for the others.
   - For every kept round: $B \oplus C' = A$.

5. **Eve's Intercept-Resend Attack**:
   - Eve intercepts Bob's qubit, measures in a random $X/Y$ basis using mid-circuit measurement, resets the qubit, and re-prepares the measured state ($|+ \rangle$, $|- \rangle$, $|+i \rangle$, or $|-i \rangle$).
   - This collapses the tripartite entanglement, introducing an expected 25% QBER.

6. **Security Check (20% Random Sample)**:
   - 20% of the sifted rounds are randomly sampled using `secrets`.
   - The parity $A \oplus B \oplus C$ is verified publicly.
   - If error rate $> 5\%$, an **ATTACK** is flagged, all keys are discarded, and encryption is locked.
   - If error rate $\le 5\%$, the sampled rounds are removed from the key, leaving clean private shares.

7. **Vernam OTP Encryption & Decryption**:
   - Plaintext $P$ (up to 8 ASCII chars) encoded into 8-bit binary per char.
   - Ciphertext $C = P \oplus A[:n]$.
   - Plaintext is cleared from server memory.
   - Bob alone: $C \oplus B$ (garbage).
   - Charlie alone: $C \oplus C'$ (garbage).
   - Collaborative: $C \oplus (B \oplus C') = C \oplus A = P$ (original plaintext bit-for-bit).

---

## Directory Structure

```
secret sharing/
├── hbb_vault/
│   ├── backend/
│   │   ├── __init__.py
│   │   ├── main.py          # FastAPI app & REST routes (binds to 127.0.0.1)
│   │   ├── quantum.py       # ONLY file importing Qiskit & AerSimulator
│   │   ├── protocol.py      # HBB sifting, state management & security check
│   │   └── crypto.py        # Classical ASCII/binary Vernam OTP functions
│   ├── frontend/
│   │   ├── index.html       # Titanium steel workflow markup
│   │   ├── style.css        # Complete offline stylesheet
│   │   └── app.js           # Strict state machine controller & animations
│   └── tests/
│       ├── __init__.py
│       └── test_protocol.py # Automated protocol verification suite
├── README.md
├── run.bat                  # One-click launcher for Windows
└── run.sh                   # One-click launcher for Unix/macOS
```

---

## Installation & Setup

Ensure Python 3.10+ is installed on your system.

```bash
pip install fastapi uvicorn qiskit qiskit-aer pytest
```

---

## Running the Application

### Option A: Windows
Double-click `run.bat` or run:
```cmd
run.bat
```

### Option B: Linux / macOS
Make the script executable and run:
```bash
chmod +x run.sh
./run.sh
```

### Option C: Manual Command
```bash
python -m uvicorn hbb_vault.backend.main:app --host 127.0.0.1 --port 8000
```
Open your browser to: **http://127.0.0.1:8000**

---

## Running the Automated Test Suite

Run pytest with standard verbosity:
```bash
python -m pytest hbb_vault/tests/test_protocol.py -v -s
```

All 5 core protocol verification tests must pass:
1. `test_eve_off_exact_zero_error_and_share_equality`: 0.0% QBER and $B \oplus C = A$ for 20 consecutive runs.
2. `test_eve_on_error_rate_between_20_and_30_percent`: Intercept-resend attack yields QBER between 20% and 30% over 2000 kept rounds.
3. `test_encrypt_and_decrypt_reconstruction`: Both decrypts accurately; Bob alone or Charlie alone fails.
4. `test_key_never_reused_and_repeated_encrypt_refused`: Reusing key without a fresh HBB run raises an error.
5. `test_no_fixed_seed_and_no_random_module`: Verifies via regex that `random.` is never imported or used.

---

## REST API Reference

| Endpoint | Method | Payload | Description |
|---|---|---|---|
| `/api/encode` | POST | `{"text": "CAT123"}` | Encodes text to 8-bit binary representation |
| `/api/run` | POST | `{"manual_mode": bool, "eve_on": bool, ...}` | Runs single coin collapse or full quantum batch |
| `/api/check` | POST | `{}` | Samples 20% of kept rounds, computes real QBER |
| `/api/encrypt` | POST | `{}` | Vernam OTP encryption with key $A$, purges server plaintext |
| `/api/combine` | POST | `{}` | Synthesizes shares $B \oplus C = A$ |
| `/api/decrypt` | POST | `{"mode": "bob"\|"charlie"\|"both"}` | Decrypts ciphertext with requested share(s) |
| `/api/reset` | POST | `{}` | Clears all in-memory protocol state |
| `/api/state` | GET | `{}` | Retrieves telemetry and current session state |
