# ESCAPE 1942 — Changelog

## v2.0.0 — Full 3D Migration & WWII Educational Upgrade
- Migrated 2D Canvas maze to real-time Three.js WebGL2 first-person 3D warehouse complex using `InstancedMesh` and nearest-neighbor procedural PBR textures.
- Upgraded grid from 45×45 to deterministic 64×64 maze (seed `1942`) with >=2-cell-wide corridors, 3-cell main avenues, rooms, 4 distinct regions, and 3 independently navigable escape routes (Main Gate, Storage Passage, Service Exit).
- Replaced 2D monsters with 7 composite 3D patrol guards (`patrol`, `alert`, `chase`, `return`) and added `Shift` / touch Dodge mechanic with collision awareness and protection window.
- Replaced legacy school subjects with verified World War II & Japanese occupation of Indonesia question bank (Multiple Choice & True/False) with historical explanations and source references.
- Added versioned `localStorage` autosave (`version: 2`), settings persistence, local leaderboard, procedural Web Audio soundtrack/SFX, hand-drawn minimap, and Historical Journal.
