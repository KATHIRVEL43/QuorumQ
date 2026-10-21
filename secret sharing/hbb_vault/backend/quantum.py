"""Quantum circuit generation and AerSimulator execution for HBB protocol.

This is the ONLY file that imports Qiskit.
It uses Python's `secrets` module for cryptographic randomness and NEVER imports `random`.
No fixed simulator seeds are used.
"""

import secrets
from typing import Dict, List, Optional, Tuple
from qiskit import ClassicalRegister, QuantumCircuit
from qiskit_aer import AerSimulator

VALID_BASES = {"XXX", "XYY", "YXY", "YYX"}


def create_hbb_circuit(
    a_basis: str,
    b_basis: str,
    c_basis: str,
    eve_on: bool = False,
    eve_basis: Optional[str] = None,
) -> Tuple[QuantumCircuit, Optional[str]]:
    """Create a 3-qubit circuit implementing one round of the HBB protocol.

    Qubits:
      0: Alice (dealer)
      1: Bob (shareholder 1)
      2: Charlie (shareholder 2)

    Protocol:
      1. GHZ state preparation: H(0), CX(0, 1), CX(0, 2)
      2. If Eve is active:
         - Eve intercepts Bob's qubit (qubit 1).
         - Eve picks a basis (X or Y) using secrets.
         - Eve measures Bob's qubit in that basis into an Eve classical bit.
         - Eve resets Bob's qubit.
         - Eve re-prepares Bob's qubit in the measured state:
           |0> or |1> depending on outcome, then H if X basis, or H then S if Y basis.
      3. Parties rotate to their chosen measurement basis:
         - Basis X: H
         - Basis Y: Sdg then H
      4. Measure all 3 qubits into classical register.
    """
    qc = QuantumCircuit(3)

    # 1. GHZ state creation
    qc.h(0)
    qc.cx(0, 1)
    qc.cx(0, 2)

    # 2. Eve intercept-resend attack on Bob's qubit
    actual_eve_basis: Optional[str] = None
    if eve_on:
        actual_eve_basis = eve_basis if eve_basis in ("X", "Y") else secrets.choice(["X", "Y"])
        cr_eve = ClassicalRegister(1, "eve")
        qc.add_register(cr_eve)

        # Rotate qubit 1 to Eve's chosen basis
        if actual_eve_basis == "X":
            qc.h(1)
        else:  # Y
            qc.sdg(1)
            qc.h(1)

        # Eve measures qubit 1
        qc.measure(1, cr_eve[0])

        # Reset qubit 1
        qc.reset(1)

        # If Eve measured 1, flip from |0> to |1>
        with qc.if_test((cr_eve[0], 1)):
            qc.x(1)

        # Re-prepare into the eigenstate in Eve's basis
        if actual_eve_basis == "X":
            # |0> -> |+>, |1> -> |->
            qc.h(1)
        else:  # Y
            # |0> -> |+i>, |1> -> |-i>
            qc.h(1)
            qc.s(1)

    # 3. Measurement basis rotations for Alice, Bob, Charlie
    # Alice (qubit 0)
    if a_basis == "X":
        qc.h(0)
    elif a_basis == "Y":
        qc.sdg(0)
        qc.h(0)

    # Bob (qubit 1)
    if b_basis == "X":
        qc.h(1)
    elif b_basis == "Y":
        qc.sdg(1)
        qc.h(1)

    # Charlie (qubit 2)
    if c_basis == "X":
        qc.h(2)
    elif c_basis == "Y":
        qc.sdg(2)
        qc.h(2)

    # 4. Measure Alice, Bob, and Charlie into a 3-bit register
    cr_meas = ClassicalRegister(3, "meas")
    qc.add_register(cr_meas)
    qc.measure(0, cr_meas[0])  # Alice -> bit 0
    qc.measure(1, cr_meas[1])  # Bob -> bit 1
    qc.measure(2, cr_meas[2])  # Charlie -> bit 2

    return qc, actual_eve_basis


def run_batch_circuits(circuits: List[QuantumCircuit]) -> List[Tuple[int, int, int]]:
    """Run a batch of circuits on AerSimulator in a single call.

    Returns a list of (alice_bit, bob_bit, charlie_bit) tuples.
    Correctly accounts for Qiskit's little-endian bit ordering.
    """
    if not circuits:
        return []

    # Use a fresh AerSimulator without fixed seed
    sim = AerSimulator()
    job = sim.run(circuits, shots=1, memory=True)
    results = job.result()

    outcomes: List[Tuple[int, int, int]] = []
    for i in range(len(circuits)):
        # memory string is space-separated registers.
        # cr_meas is added last, so it is the first register in the bitstring.
        mem_str = results.get_memory(i)[0]
        meas_bits = mem_str.split(" ")[0]  # 3 characters: cr_meas[2], cr_meas[1], cr_meas[0]

        # Little-endian bit ordering:
        # cr_meas[0] (Alice) is at index 2 (meas_bits[-1])
        # cr_meas[1] (Bob) is at index 1 (meas_bits[-2])
        # cr_meas[2] (Charlie) is at index 0 (meas_bits[-3])
        alice_bit = int(meas_bits[2])
        bob_bit = int(meas_bits[1])
        charlie_bit = int(meas_bits[0])
        outcomes.append((alice_bit, bob_bit, charlie_bit))

    return outcomes


def run_hbb_rounds(
    bases_list: List[Tuple[str, str, str]],
    eve_on: bool = False,
) -> List[Tuple[int, int, int, Optional[str]]]:
    """Build and execute a batch of HBB circuits in one AerSimulator call.

    Takes a list of (alice_basis, bob_basis, charlie_basis).
    Returns list of (alice_bit, bob_bit, charlie_bit, eve_basis) tuples.
    """
    if not bases_list:
        return []

    circuits = []
    eve_bases = []
    for a_b, b_b, c_b in bases_list:
        qc, eve_b = create_hbb_circuit(a_b, b_b, c_b, eve_on=eve_on)
        circuits.append(qc)
        eve_bases.append(eve_b)

    raw_outcomes = run_batch_circuits(circuits)
    results = []
    for (a_bit, b_bit, c_bit), eve_b in zip(raw_outcomes, eve_bases):
        results.append((a_bit, b_bit, c_bit, eve_b))
    return results


def simulate_single_round(
    a_basis: str,
    b_basis: str,
    c_basis: str,
    eve_on: bool = False,
    eve_basis: Optional[str] = None,
) -> Tuple[int, int, int, Optional[str]]:
    """Simulate a single round of HBB.

    Returns (alice_bit, bob_bit, charlie_bit, eve_basis).
    """
    circuit, actual_eve_basis = create_hbb_circuit(
        a_basis=a_basis,
        b_basis=b_basis,
        c_basis=c_basis,
        eve_on=eve_on,
        eve_basis=eve_basis,
    )
    outcomes = run_batch_circuits([circuit])
    alice_bit, bob_bit, charlie_bit = outcomes[0]
    return alice_bit, bob_bit, charlie_bit, actual_eve_basis

