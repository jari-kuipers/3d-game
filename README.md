# WASM 3D Multiplayer Game

A browser-based 3D First Person Shooter built with Three.js and Socket.io.

## 🚀 Quick Start

1.  **Install Dependencies**:
    ```bash
    npm install
    ```

2.  **Start the Game Server**:
    ```bash
    node server.js
    ```

3.  **Start the Client**:
    ```bash
    npm run dev
    ```
    Open [http://localhost:5173](http://localhost:5173)

## 🎮 Features
-   **Multiplayer**: Real-time movement and chat.
-   **Terrain**: Procedurally generated hills using Perlin noise.
-   **Combat**: Shooting mechanics and health system.
-   **Mobile Support**: Virtual joysticks for touch devices.

## 🛠 Project Structure
-   `server.js`: The authoritative game server. Handles map generation and state.
-   `src/main.js`: The client game loop, rendering, and input logic.
-   `refactor_stash/`: Contains a work-in-progress TypeScript Monorepo refactor (stashed).

## 📝 Recent Updates (Dec 15)
-   Added **Procedural Forests** (Server-authoritative placement).
-   Implemented **In-Game Chat** (`Enter` to chat).
-   Fixed **Projectile Range** for larger maps.
