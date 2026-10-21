"""Classical cryptography operations for HBB Vernam One-Time Pad.

Plain Python only. No Qiskit, no random module.
"""

from typing import List, Tuple


def text_to_bits(text: str) -> Tuple[str, List[dict]]:
    """Convert an ASCII string (up to 8 characters) to an 8-bit binary string.

    Returns the concatenated bit string and a breakdown list per character.
    """
    if len(text) > 8:
        raise ValueError("Message exceeds 8 ASCII characters maximum.")

    breakdown = []
    bit_chunks = []
    for ch in text:
        ascii_code = ord(ch)
        if ascii_code > 127:
            raise ValueError(f"Character '{ch}' is outside standard ASCII range (0-127).")
        bits = f"{ascii_code:08b}"
        bit_chunks.append(bits)
        breakdown.append({
            "char": ch,
            "ascii": ascii_code,
            "bits": bits,
            "hex": f"0x{ascii_code:02X}",
        })

    full_bits = "".join(bit_chunks)
    return full_bits, breakdown


def bits_to_text(bits: str) -> str:
    """Convert an 8-bit binary string to text.

    Non-printable or invalid ASCII characters are rendered as readable placeholders.
    """
    chars = []
    for i in range(0, len(bits), 8):
        chunk = bits[i : i + 8]
        if len(chunk) < 8:
            break
        val = int(chunk, 2)
        if 32 <= val <= 126:
            chars.append(chr(val))
        else:
            # Readable placeholder for non-printable characters
            chars.append("·")
    return "".join(chars)


def xor_bits(bits1: str, bits2: str) -> str:
    """XOR two bitstrings together.

    Truncates to the shorter length if unequal.
    """
    length = min(len(bits1), len(bits2))
    return "".join("1" if bits1[i] != bits2[i] else "0" for i in range(length))


def bits_to_hex(bits: str) -> str:
    """Format a bitstring into hex bytes (e.g. '0x43 0x41 0x54')."""
    hex_parts = []
    for i in range(0, len(bits), 8):
        chunk = bits[i : i + 8]
        if len(chunk) < 8:
            break
        hex_parts.append(f"0x{int(chunk, 2):02X}")
    return " ".join(hex_parts)


def format_bit_groups(bits: str, group_size: int = 8) -> str:
    """Format bitstring with spaces every group_size bits."""
    return " ".join(bits[i : i + group_size] for i in range(0, len(bits), group_size))
