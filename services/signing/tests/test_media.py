import math
import pytest

from media import chunk_index, words_in_window


def test_seek_at_end_and_arbitrary_future_position():
    assert chunk_index(0, 19) == 0
    assert chunk_index(8, 19) == 1
    assert chunk_index(19, 19) == 2
    assert chunk_index(700, 19) == 2
    for value in [float("nan"), float("inf"), -1]:
        with pytest.raises(ValueError):
            chunk_index(value, 19)


def test_asr_context_overlap_does_not_repeat_or_drop_boundary_words():
    words = [(7.5, 8.3, "a"), (7.9, 8.4, "workshop"), (8.5, 9, "tomorrow")]
    first = words_in_window(words, 0, 8)
    second = words_in_window(words, 8, 16)
    assert first == "a"
    assert second == "workshop tomorrow"
    assert first + " " + second == "a workshop tomorrow"
