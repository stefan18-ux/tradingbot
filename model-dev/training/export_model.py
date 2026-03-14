"""One-time script: convert the RLlib policy_state.pkl into a plain NumPy .npz file.

Run this once (in the environment that has Ray/numpy installed) and commit
the resulting .npz.  After that, the backend can load the weights with a
single ``np.load()`` call — no Ray, no stubs, no tricks.

Usage
-----
    python export_model.py best_qqq_model

This reads ``best_qqq_model/policies/default_policy/policy_state.pkl``
and writes ``best_qqq_model/model_weights.npz``.
"""

import importlib.abc
import importlib.machinery
import pickle
import sys
import types
from pathlib import Path

import numpy as np
from cyclopts import App

app = App()


# --- temporary stubs so we can unpickle without Ray installed -------------
class _Stub:
    def __init__(self, *a, **kw): pass
    def __call__(self, *a, **kw): return _Stub()
    def __getattr__(self, n): return _Stub()
    def __bool__(self): return False

class _StubModule(types.ModuleType):
    def __getattr__(self, n): return _Stub()

class _StubFinder(importlib.abc.MetaPathFinder, importlib.abc.Loader):
    _P = ("ray", "tree", "gymnasium", "torch", "gym")
    def find_spec(self, f, p, t=None):
        if any(f == x or f.startswith(x + ".") for x in self._P):
            return importlib.machinery.ModuleSpec(f, self, is_package=True)
    def create_module(self, s):
        m = _StubModule(s.name); m.__path__ = []; m.__package__ = s.name; m.__spec__ = s; return m
    def exec_module(self, m): pass
# --------------------------------------------------------------------------


@app.default
def main(checkpoint_dir: str = "best_qqq_model"):
    pkl_path = Path(checkpoint_dir) / "policies" / "default_policy" / "policy_state.pkl"
    out_path = Path(checkpoint_dir) / "model_weights.npz"

    finder = _StubFinder()
    sys.meta_path.insert(0, finder)
    try:
        with open(pkl_path, "rb") as f:
            state = pickle.load(f)
    finally:
        sys.meta_path.remove(finder)

    weights = state["weights"]

    # Keep only the layers needed for action prediction
    keys_to_save = {
        "W1":       "flatten.0._hidden_layers.0._model.0.weight",
        "b1":       "flatten.0._hidden_layers.0._model.0.bias",
        "W2":       "flatten.0._hidden_layers.1._model.0.weight",
        "b2":       "flatten.0._hidden_layers.1._model.0.bias",
        "W_logits": "logits_layer._model.0.weight",
        "b_logits": "logits_layer._model.0.bias",
    }

    arrays = {}
    for nice_name, pkl_key in keys_to_save.items():
        arr = weights[pkl_key]
        arrays[nice_name] = arr
        print(f"  {nice_name:10s}  ←  {pkl_key:55s}  shape={arr.shape}")

    np.savez(out_path, **arrays)
    print(f"\nSaved to {out_path}  ({out_path.stat().st_size:,} bytes)")


if __name__ == "__main__":
    app()
