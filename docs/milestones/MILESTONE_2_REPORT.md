# Milestone 2: Blockchain Integration & Cell Logic
**Date:** 2024-05-20
**Status:** 🚧 In Progress

## Objectives
- [x] Initialize Lumos SDK with Aggron4 (Testnet) presets.
- [ ] Implement `encodeHashData` for cell serialization.
- [ ] Build `submitHash` transaction skeleton.
- [ ] verify transaction signing with local private key.

## Technical Challenges
- **Cell Model:** Adapting the abstract cell model to store simple SHA-256 hashes requires strict capacity management (CKByte/Shannons).
- **Indexer Latency:** Ensuring the indexer is synced before querying live cells.