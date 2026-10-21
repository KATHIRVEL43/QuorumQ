"""Hillery-Buzek-Berthiaume (HBB) Quantum Secret Sharing Protocol Engine.

Plain Python only. No Qiskit import.
Uses Python's standard `secrets` module for all cryptographic choices.
NEVER imports `random`.
"""

import secrets
from typing import Any, Dict, List, Optional, Tuple

from hbb_vault.backend.crypto import (
    bits_to_hex,
    bits_to_text,
    format_bit_groups,
    text_to_bits,
    xor_bits,
)
from hbb_vault.backend.quantum import run_hbb_rounds, simulate_single_round

VALID_BASES = {"XXX", "XYY", "YXY", "YYX"}


class HBBSession:
    """Manages an in-memory session for the HBB protocol."""

    def __init__(self):
        self.history_runs: List[Dict[str, Any]] = []
        self.last_eve_off_run: Optional[Dict[str, Any]] = None
        self.last_eve_on_run: Optional[Dict[str, Any]] = None
        self.reset()

    def reset(self) -> None:
        """Reset all in-memory protocol state."""
        self.message_text: str = ""
        self.message_bits: str = ""
        self.message_breakdown: List[Dict[str, Any]] = []
        self.message_bit_len: int = 0

        self.eve_on: bool = False
        self.practice_round: Optional[Dict[str, Any]] = None

        self.all_rounds: List[Dict[str, Any]] = []
        self.kept_rounds: List[Dict[str, Any]] = []

        self.sample_indices: List[int] = []
        self.sampled_rounds: List[Dict[str, Any]] = []
        self.security_checked: bool = False
        self.attack_detected: bool = False
        self.measured_qber: float = 0.0
        self.errors_in_sample: int = 0
        self.sample_size: int = 0

        self.key_A: str = ""
        self.key_B: str = ""
        self.key_C: str = ""
        self.key_used: bool = False

        self.ciphertext: str = ""
        self.ciphertext_hex: str = ""

    def encode_message(self, text: str) -> Dict[str, Any]:
        """Convert plaintext message into 8-bit binary representation."""
        if not text:
            raise ValueError("Message cannot be empty.")
        if len(text) > 8:
            raise ValueError("Message must be at most 8 ASCII characters.")

        # If previous key was used or new message entered, reset crypto state
        self.key_used = False
        self.ciphertext = ""
        self.ciphertext_hex = ""

        bits, breakdown = text_to_bits(text)
        self.message_text = text
        self.message_bits = bits
        self.message_breakdown = breakdown
        self.message_bit_len = len(bits)

        return {
            "text": text,
            "bits": bits,
            "bit_len": len(bits),
            "char_count": len(text),
            "breakdown": breakdown,
        }

    def measure_practice_round(
        self,
        a_basis: str,
        b_basis: str,
        c_basis: str,
        eve_on: Optional[bool] = None,
    ) -> Dict[str, Any]:
        """Run a single practice round with specified bases."""
        if a_basis not in ("X", "Y") or b_basis not in ("X", "Y") or c_basis not in ("X", "Y"):
            raise ValueError("Bases must be 'X' or 'Y'.")

        if eve_on is not None:
            self.eve_on = eve_on

        comb = f"{a_basis}{b_basis}{c_basis}"
        valid = comb in VALID_BASES
        expected_parity = 0 if comb == "XXX" else (1 if valid else None)

        a_bit, b_bit, c_bit, eve_basis = simulate_single_round(
            a_basis, b_basis, c_basis, eve_on=self.eve_on
        )

        flip = 0 if comb == "XXX" else 1
        c_share = c_bit ^ flip if valid else c_bit
        actual_parity = a_bit ^ b_bit ^ c_bit
        rule_held = (actual_parity == expected_parity) if valid else False

        result = {
            "round_id": len(self.all_rounds) + 1,
            "bases": {"alice": a_basis, "bob": b_basis, "charlie": c_basis},
            "comb": comb,
            "valid": valid,
            "bits": {"alice": a_bit, "bob": b_bit, "charlie": c_bit},
            "c_share": c_share,
            "expected_parity": expected_parity,
            "actual_parity": actual_parity,
            "rule_held": rule_held,
            "eve_on": self.eve_on,
            "eve_basis": eve_basis,
        }
        self.practice_round = result
        return result

    def run_full_batch(
        self,
        n_rounds: Optional[int] = None,
        eve_on: Optional[bool] = None,
    ) -> Dict[str, Any]:
        """Run the full batch of HBB rounds using AerSimulator.

        Default n_rounds: 4 * (message bits) + 40 (or 150 if no message yet).
        Automatically generates extra rounds if needed so remaining key >= message bits.
        """
        if eve_on is not None:
            self.eve_on = eve_on

        target_message_len = self.message_bit_len if self.message_bit_len > 0 else 48
        calculated_rounds = 4 * target_message_len + 40
        rounds_to_run = n_rounds if (n_rounds is not None and n_rounds > 0) else calculated_rounds

        self.all_rounds = []
        self.kept_rounds = []
        self.security_checked = False
        self.attack_detected = False
        self.measured_qber = 0.0
        self.sample_indices = []
        self.sampled_rounds = []
        self.key_A = ""
        self.key_B = ""
        self.key_C = ""
        self.key_used = False
        self.ciphertext = ""
        self.ciphertext_hex = ""

        total_generated = 0

        while True:
            batch_bases = []
            for _ in range(rounds_to_run):
                a_b = secrets.choice(["X", "Y"])
                b_b = secrets.choice(["X", "Y"])
                c_b = secrets.choice(["X", "Y"])
                batch_bases.append((a_b, b_b, c_b))

            raw_results = run_hbb_rounds(batch_bases, eve_on=self.eve_on)

            for i, (a_b, b_b, c_b) in enumerate(batch_bases):
                total_generated += 1
                comb = f"{a_b}{b_b}{c_b}"
                valid = comb in VALID_BASES
                a_bit, b_bit, c_bit, eve_b = raw_results[i]

                expected_parity = 0 if comb == "XXX" else (1 if valid else None)
                actual_parity = a_bit ^ b_bit ^ c_bit
                rule_held = (actual_parity == expected_parity) if valid else False

                flip = 0 if comb == "XXX" else 1
                c_share = c_bit ^ flip if valid else c_bit

                round_data = {
                    "round_id": total_generated,
                    "comb": comb,
                    "bases": {"alice": a_b, "bob": b_b, "charlie": c_b},
                    "valid": valid,
                    "a_bit": a_bit,
                    "b_bit": b_bit,
                    "c_bit": c_bit,
                    "c_share": c_share,
                    "expected_parity": expected_parity,
                    "actual_parity": actual_parity,
                    "rule_held": rule_held,
                    "eve_basis": eve_b,
                }
                self.all_rounds.append(round_data)
                if valid:
                    self.kept_rounds.append(round_data)

            # Check if after 20% security sample, the remaining key would be >= target_message_len
            est_sample = max(1, round(0.20 * len(self.kept_rounds)))
            est_remaining = len(self.kept_rounds) - est_sample
            if est_remaining >= target_message_len:
                break
            if n_rounds is not None and self.message_bit_len == 0:
                # Only exit if no message is set and fixed n_rounds was requested
                break

            # Need more rounds to cover message length
            needed_rounds = max(20, (target_message_len - est_remaining) * 3)
            rounds_to_run = needed_rounds

        raw_A = "".join(str(r["a_bit"]) for r in self.kept_rounds)
        raw_B = "".join(str(r["b_bit"]) for r in self.kept_rounds)
        raw_C = "".join(str(r["c_share"]) for r in self.kept_rounds)

        return {
            "total_rounds": len(self.all_rounds),
            "kept_count": len(self.kept_rounds),
            "discarded_count": len(self.all_rounds) - len(self.kept_rounds),
            "eve_on": self.eve_on,
            "raw_key_A": raw_A,
            "raw_key_B": raw_B,
            "raw_key_C": raw_C,
            "rounds_sample": self.all_rounds[-20:] if len(self.all_rounds) > 20 else self.all_rounds,
        }

    def run_security_check(self) -> Dict[str, Any]:
        """Perform security check on 20% random sample of kept rounds.

        If error rate > 5%, flags attack and discards everything.
        Otherwise removes sampled rounds from key to form safe key.
        """
        if not self.kept_rounds:
            raise ValueError("No kept rounds available. Please run batch first.")

        n_kept = len(self.kept_rounds)
        sample_size = max(1, round(0.20 * n_kept))

        # Pick random distinct indices from kept_rounds using secrets
        all_indices = list(range(n_kept))
        # Cryptographically secure random sample using secrets
        sampled_indices_set = set()
        while len(sampled_indices_set) < sample_size:
            idx = secrets.choice(all_indices)
            sampled_indices_set.add(idx)

        self.sample_indices = sorted(list(sampled_indices_set))

        errors = 0
        self.sampled_rounds = []
        for idx in self.sample_indices:
            r = self.kept_rounds[idx]
            # Parity rule check:
            # expected: A ^ B ^ C == 0 for XXX, 1 for others
            expected = 0 if r["comb"] == "XXX" else 1
            actual = r["a_bit"] ^ r["b_bit"] ^ r["c_bit"]
            is_match = (actual == expected)
            if not is_match:
                errors += 1

            self.sampled_rounds.append({
                "round_no": r["round_id"],
                "comb": r["comb"],
                "a_bit": r["a_bit"],
                "b_bit": r["b_bit"],
                "c_bit": r["c_bit"],
                "expected_parity": expected,
                "actual_parity": actual,
                "match": is_match,
            })

        matched_count = sample_size - errors
        mismatched_count = errors
        qber = errors / sample_size if sample_size > 0 else 0.0
        if not self.eve_on and errors == 0:
            qber = 0.0
            qber_pct = 0.0
        else:
            qber_pct = round(qber * 100, 2)

        self.measured_qber = qber
        self.errors_in_sample = errors
        self.sample_size = sample_size
        self.security_checked = True

        if qber > 0.05:
            # ATTACK DETECTED
            self.attack_detected = True
            self.key_A = ""
            self.key_B = ""
            self.key_C = ""
        else:
            # SECURE
            self.attack_detected = False
            # Remove sampled rounds from the key
            remaining_rounds = [
                self.kept_rounds[i] for i in range(n_kept) if i not in sampled_indices_set
            ]
            self.key_A = "".join(str(r["a_bit"]) for r in remaining_rounds)
            self.key_B = "".join(str(r["b_bit"]) for r in remaining_rounds)
            self.key_C = "".join(str(r["c_share"]) for r in remaining_rounds)

        # Record companion donut run stats
        run_record = {
            "error_rate": qber,
            "qber_percent": qber_pct,
            "sample_size": sample_size,
            "matched_count": matched_count,
            "mismatched_count": mismatched_count,
            "attack_detected": self.attack_detected,
        }
        if self.eve_on:
            self.last_eve_on_run = run_record
        else:
            self.last_eve_off_run = run_record

        # Log in historical runs for the expo
        self.history_runs.append({
            "id": len(self.history_runs) + 1,
            "eve_on": self.eve_on,
            "qber": qber_pct,
            "attack": self.attack_detected,
            "sample_size": sample_size,
            "errors": errors,
            "matched_count": matched_count,
            "mismatched_count": mismatched_count,
        })

        return {
            "sampled_rounds": self.sampled_rounds,
            "matched_count": matched_count,
            "mismatched_count": mismatched_count,
            "error_rate": qber,
            "qber": qber,
            "qber_percent": qber_pct,
            "sample_size": sample_size,
            "errors": errors,
            "attack_detected": self.attack_detected,
            "last_eve_off_run": self.last_eve_off_run,
            "last_eve_on_run": self.last_eve_on_run,
            "remaining_key_len": len(self.key_A),
            "history": self.history_runs,
        }

    def encrypt(self) -> Dict[str, Any]:
        """Encrypt message with Alice's key A.

        Enforces:
        - Must have valid non-attack key.
        - Key bits are marked as USED and cannot be reused.
        - Plaintext is cleared from the server after encryption.
        """
        if self.attack_detected:
            raise ValueError("Attack detected. Key was discarded and encryption is locked.")
        if not self.security_checked:
            raise ValueError("Security check must be performed before encryption.")
        if self.key_used:
            raise ValueError("Key bits already used! A second encryption requires a fresh HBB run.")
        if not self.message_bits:
            raise ValueError("No message to encrypt. Please input message in Step 01.")

        needed_len = len(self.message_bits)
        if len(self.key_A) < needed_len:
            raise ValueError(
                f"Remaining key length ({len(self.key_A)}) is shorter than message ({needed_len} bits)."
            )

        # Slice key to message length
        a_slice = self.key_A[:needed_len]
        b_slice = self.key_B[:needed_len]
        c_slice = self.key_C[:needed_len]

        # Vernam One-Time Pad
        ciphertext_bits = xor_bits(self.message_bits, a_slice)
        ciphertext_hex = bits_to_hex(ciphertext_bits)

        self.ciphertext = ciphertext_bits
        self.ciphertext_hex = ciphertext_hex
        self.key_used = True

        # Truncate stored keys to the slice used so Combine and Decrypt match
        self.key_A = a_slice
        self.key_B = b_slice
        self.key_C = c_slice

        # Erase plaintext from server memory (Hard Constraint Rule 11)
        original_len = needed_len
        self.message_bits = ""
        self.message_text = ""

        return {
            "ciphertext": ciphertext_bits,
            "ciphertext_hex": ciphertext_hex,
            "key_A": a_slice,
            "key_len": original_len,
        }

    def combine_shares(self) -> Dict[str, Any]:
        """Combine Bob's share B and Charlie's share C."""
        if not self.key_B or not self.key_C:
            raise ValueError("Shares B and C are not available.")

        combined_bits = xor_bits(self.key_B, self.key_C)
        matches_alice = combined_bits == self.key_A

        return {
            "share_B": self.key_B,
            "share_C": self.key_C,
            "combined": combined_bits,
            "matches_alice": matches_alice,
        }

    def decrypt(self, mode: str) -> Dict[str, Any]:
        """Decrypt ciphertext using requested mode: 'bob', 'charlie', or 'both'."""
        if not self.ciphertext:
            raise ValueError("No ciphertext available. Please encrypt first.")

        if mode == "bob":
            bits = xor_bits(self.ciphertext, self.key_B)
            text = bits_to_text(bits)
            return {
                "mode": "bob",
                "success": False,
                "bits": bits,
                "text": text,
                "description": "Bob alone decrypting (unshared entropy: results in garbage).",
            }
        elif mode == "charlie":
            bits = xor_bits(self.ciphertext, self.key_C)
            text = bits_to_text(bits)
            return {
                "mode": "charlie",
                "success": False,
                "bits": bits,
                "text": text,
                "description": "Charlie alone decrypting (unshared entropy: results in garbage).",
            }
        elif mode == "both":
            combined_key = xor_bits(self.key_B, self.key_C)
            bits = xor_bits(self.ciphertext, combined_key)
            text = bits_to_text(bits)
            return {
                "mode": "both",
                "success": True,
                "bits": bits,
                "text": text,
                "description": "Bob and Charlie combine shares: exact plaintext recovered.",
            }
        else:
            raise ValueError("Mode must be 'bob', 'charlie', or 'both'.")
