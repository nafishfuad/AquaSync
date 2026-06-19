# AquaSync Ecosystem Context (Hardened v1.5.0 Baseline)

## Architecture Overview
This is a highly stable, Firebase-driven hybrid IoT ecosystem consisting of a Web App and an ESP32-C3 microcontroller.

## Frontend Rules (Web App)
- **Tech Stack:** Pure Vanilla JavaScript, HTML, Tailwind CSS (via CDN), and Chart.js.
- **No Bundlers:** Do NOT use Webpack, Vite, Node.js, or React.
- **State Management:** All data flows through `state.js`.
- **Authentication:** Uses the real Firebase JS SDK. UIDs are explicitly generated and locked to the user's email to ensure cross-browser persistence.
- **Networking:** Strictly relies on Firebase REST API and the Firebase JS SDK for syncing. **DO NOT** use WebSockets (`ws://`), `localSocket`, or Port 81 connections. 

## Backend Rules (ESP32-C3 Hardware)
- **Tech Stack:** C++ / Arduino Framework.
- **Execution Model:** Single-core blocking `loop()`. **DO NOT** use FreeRTOS `xTaskCreate` or multi-threading for network tasks, as heavy SSL encryption will cause thread starvation on weak Wi-Fi. 
- **Networking (`AquaNetworkManager.h`):** Uses standard Firebase HTTP polling and pushing. **DO NOT** include `<WebSocketsServer.h>` or attempt to open a local port 81.
- **Memory Limits:** The ESP32-C3 has strict RAM limits. Do NOT introduce heavy String allocations in the main loop. Use `debug_helpers.h` hooks in the main `loop()` to monitor Heap, Temp, and RSSI safely.