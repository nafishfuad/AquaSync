# AquaSync Ecosystem Context

## Architecture Overview
This is a hybrid IoT ecosystem consisting of a Web App and an ESP32-C3 microcontroller.

## Frontend Rules (Web App)
- **Tech Stack:** Pure Vanilla JavaScript, HTML, Tailwind CSS (via CDN), and Chart.js.
- **No Bundlers:** Do NOT use Webpack, Vite, Node.js, or React.
- **State Management:** All data flows through `state.js` using Client-Side Prediction (Optimistic UI). 
- **Networking:** `api.js` attempts a Zero-Latency Local WebSocket connection (ws://IP:81) first. If it fails, it falls back to Firebase REST API polling.

## Backend Rules (ESP32-C3 Hardware)
- **Tech Stack:** C++ / Arduino Framework / FreeRTOS.
- **Memory Limits:** The ESP32-C3 has strict RAM limits (~400KB). Do NOT introduce heavy String allocations in the main loop. 
- **Networking (`AquaNetworkManager.h`):** Uses a Single-Socket Polling architecture. Holds a local WebSocket Server on Port 81 for fast UI control, and pushes heavy analytics to Firebase only once every 10 minutes to save bandwidth.