# MoveRealm Python Shadow Agent

This dependency-light Python agent evaluates frozen MoveRealm candidates with an explicit
`observe → evaluate → recover → verify` loop. It calls the repository's production TypeScript hard
gates as its authoritative tool, then optionally invokes a small local Ollama vision model for an
advisory quality score. A model score can never make a failed candidate eligible.

The default model is [`qwen3-vl:4b-instruct-q4_K_M`](https://ollama.com/library/qwen3-vl:4b-instruct-q4_K_M):
a 3.3 GB, Apache-2.0 vision model. The agent requires Python 3.10 or newer,
does not download it automatically and retains neither image bytes nor raw model responses.

```bash
ollama serve
ollama pull qwen3-vl:4b-instruct-q4_K_M

npm run agent:python -- \
  --candidate artifacts/evaluation/candidates/uncertain-room-original.json \
  --fallback-candidate artifacts/evaluation/candidates/uncertain-room.json \
  --judge ollama \
  --strict-judge \
  --out artifacts/evaluation/python-agent-4b.json
```

Use `--judge none` for a model-free hard-gate run. CodeBuddy remains MoveRealm's only runtime
Movement Director; this Python agent is an offline evaluator and recovery demonstrator, not a
second gameplay authority.

The frozen real-model evidence at
`artifacts/evaluation/python-agent-qwen3-vl-4b.json` is intentionally revealing: the 4B model gave
the unsafe original a higher advisory score, but the agent rejected it and selected the lower-scored
validated fallback. This demonstrates that advisory model taste cannot override the product's safety
contracts.
