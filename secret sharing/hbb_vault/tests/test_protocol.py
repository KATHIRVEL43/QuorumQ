"""Tests for the Hillery-Buzek-Berthiaume (HBB) quantum secret sharing implementation.

Validates all protocol rules:
1. Eve OFF over 20 runs: error rate is exactly 0 and B⊕C == A for every kept round.
2. Eve ON over 2000 kept rounds: error rate between 0.20 and 0.30.
3. Encrypt then decrypt (both) returns the original. Bob alone and Charlie alone do not.
4. Key bits are never reused, and repeated encrypt without a new run is refused.
5. No fixed seeds and no `random.` module usage for basis selection.
"""

import os
import re
import pytest

from hbb_vault.backend.crypto import bits_to_text, text_to_bits, xor_bits
from hbb_vault.backend.protocol import HBBSession, VALID_BASES
from hbb_vault.backend.quantum import create_hbb_circuit, run_hbb_rounds


def test_eve_off_exact_zero_error_and_share_equality():
    """Eve OFF over 20 runs: error rate is exactly 0 and B⊕C == A for every kept round."""
    session = HBBSession()
    session.encode_message("TEST")

    for run_idx in range(20):
        res = session.run_full_batch(n_rounds=40, eve_on=False)
        assert res["kept_count"] > 0, "Should have kept rounds in run"

        # Check every kept round: actual_parity must match expected, and B ^ C == A
        for r in session.kept_rounds:
            assert r["comb"] in VALID_BASES
            expected_parity = 0 if r["comb"] == "XXX" else 1
            actual_parity = r["a_bit"] ^ r["b_bit"] ^ r["c_bit"]
            assert actual_parity == expected_parity, f"Parity mismatch in round {r['round_id']}"
            # Charlie's share bit XOR Bob's bit must equal Alice's bit
            assert (r["b_bit"] ^ r["c_share"]) == r["a_bit"], f"Share equality failed in round {r['round_id']}"

        # Run security check: error rate must be exactly 0
        check = session.run_security_check()
        assert check["errors"] == 0, f"Run {run_idx}: Expected 0 errors with Eve OFF, got {check['errors']}"
        assert check["error_rate"] == 0.0, f"Run {run_idx}: Expected 0.0 QBER with Eve OFF, got {check['error_rate']}"
        assert check["mismatched_count"] == 0
        assert check["matched_count"] == check["sample_size"]
        assert not check["attack_detected"], "Should not detect attack when Eve is OFF"


def test_api_check_match_flags_and_counts():
    """/api/check returns sampled rounds with match flags, and mismatched_count / sampled_count equals error_rate."""
    session = HBBSession()
    session.encode_message("CHECK")
    session.run_full_batch(n_rounds=100, eve_on=True)
    check = session.run_security_check()

    assert "sampled_rounds" in check
    assert "matched_count" in check
    assert "mismatched_count" in check
    assert "error_rate" in check

    sampled = check["sampled_rounds"]
    assert len(sampled) == check["sample_size"]

    mismatches = 0
    matches = 0
    for r in sampled:
        assert "round_no" in r
        assert "expected_parity" in r
        assert "actual_parity" in r
        assert "match" in r
        assert isinstance(r["match"], bool)

        if r["match"]:
            matches += 1
            assert r["expected_parity"] == r["actual_parity"]
        else:
            mismatches += 1
            assert r["expected_parity"] != r["actual_parity"]

    assert matches == check["matched_count"]
    assert mismatches == check["mismatched_count"]
    assert pytest.approx(mismatches / len(sampled)) == check["error_rate"]


def test_eve_on_error_rate_between_20_and_30_percent():
    """Eve ON over 2000 kept rounds: error rate between 0.20 and 0.30."""
    session = HBBSession()
    session.encode_message("EVE")

    # Accumulate 2000 kept rounds with Eve ON
    kept_target = 2000
    accumulated_kept = []

    while len(accumulated_kept) < kept_target:
        # Generate batch of 400 rounds
        session.run_full_batch(n_rounds=400, eve_on=True)
        accumulated_kept.extend(session.kept_rounds)

    sampled_kept = accumulated_kept[:kept_target]
    errors = 0
    for r in sampled_kept:
        expected = 0 if r["comb"] == "XXX" else 1
        actual = r["a_bit"] ^ r["b_bit"] ^ r["c_bit"]
        if actual != expected:
            errors += 1

    error_rate = errors / len(sampled_kept)
    print(f"\n[Test Eve ON] Kept: {len(sampled_kept)}, Errors: {errors}, QBER: {error_rate:.4f}")
    assert 0.20 <= error_rate <= 0.30, f"Eve ON QBER {error_rate:.4f} not in expected [0.20, 0.30] range"


def test_encrypt_and_decrypt_reconstruction():
    """Encrypt then decrypt (both) returns the original. Bob alone and Charlie alone do not."""
    session = HBBSession()
    msg = "EXPO2026"
    session.encode_message(msg)

    # Run Eve OFF batch
    session.run_full_batch(n_rounds=80, eve_on=False)
    check = session.run_security_check()
    assert not check["attack_detected"]

    # Encrypt
    enc = session.encrypt()
    ciphertext = enc["ciphertext"]
    assert len(ciphertext) == len(msg) * 8

    # Server erased plaintext
    assert session.message_text == ""
    assert session.message_bits == ""

    # Combine shares
    comb = session.combine_shares()
    assert comb["matches_alice"]

    # Bob alone
    dec_bob = session.decrypt("bob")
    assert not dec_bob["success"]
    assert dec_bob["text"] != msg, "Bob alone should not decrypt to original plaintext"

    # Charlie alone
    dec_charlie = session.decrypt("charlie")
    assert not dec_charlie["success"]
    assert dec_charlie["text"] != msg, "Charlie alone should not decrypt to original plaintext"

    # Both together
    dec_both = session.decrypt("both")
    assert dec_both["success"]
    assert dec_both["text"] == msg, f"Expected '{msg}', got '{dec_both['text']}'"


def test_key_never_reused_and_repeated_encrypt_refused():
    """Key bits are never reused, and a repeated encrypt without a new run is refused."""
    session = HBBSession()
    session.encode_message("SAFE")
    session.run_full_batch(n_rounds=80, eve_on=False)
    session.run_security_check()

    # First encrypt should succeed
    enc1 = session.encrypt()
    assert enc1["ciphertext"]

    # Second encrypt without new run MUST raise ValueError
    with pytest.raises(ValueError, match="Key bits already used"):
        session.encrypt()


def test_no_fixed_seed_and_no_random_module():
    """grep confirms there is no fixed seed and no `random.` use for bases."""
    backend_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "backend")
    files_to_check = ["quantum.py", "protocol.py", "crypto.py", "main.py"]

    for fname in files_to_check:
        fpath = os.path.join(backend_dir, fname)
        assert os.path.exists(fpath), f"File {fpath} not found"
        with open(fpath, "r", encoding="utf-8") as f:
            content = f.read()

        # Check for import random or from random import
        assert not re.search(r"^\s*import\s+random\b", content, re.MULTILINE), f"Found 'import random' in {fname}"
        assert not re.search(r"^\s*from\s+random\s+import\b", content, re.MULTILINE), f"Found 'from random' in {fname}"
        assert "random.choice" not in content, f"Found 'random.choice' in {fname}"
        assert "random.sample" not in content, f"Found 'random.sample' in {fname}"
        assert "random.seed" not in content, f"Found 'random.seed' in {fname}"
        assert "seed_simulator" not in content, f"Found fixed simulator seed in {fname}"
