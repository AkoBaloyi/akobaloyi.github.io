// Chat Attack entry point.
// The implementation lives in ./chat-attack/index.js (the bootstrap) and its
// module tree under ./chat-attack/. This file is a thin re-export so the
// existing <script type="module" src=".../chat-attack.js"> tag keeps working
// after the monolith was split into modules (see design.md §Module decomposition).
import './chat-attack/index.js';
