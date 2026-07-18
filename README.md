# AquaSync 🌊

AquaSync is a comprehensive, hybrid IoT ecosystem designed to fully automate and monitor aquarium environments. It controls aquarium lighting, CO2 injection, and cooling fans, providing real-time metrics, automated scheduling, and a beautiful dashboard for remote management.

## 🚀 Why I Built AquaSync
When building a custom 30-inch rimless planted aquarium, I needed a reliable way to fully automate and monitor the complex environment. While commercial Wi-Fi switches exist, they lack critical features like Wi-Fi-controlled dimming for lights, integrated CO2 scheduling, and comprehensive metric tracking. 

The few commercial products that do offer these features are prohibitively expensive. AquaSync bridges this gap by providing an affordable, feature-rich, and highly optimized custom solution tailored specifically to the strict parameters of modern planted aquariums.

## 🛠️ The "Vibe Coding" & Architecture Journey
This entire project was built using "vibe coding" (AI-assisted development). I successfully architected the system, defined the logic, and directed the testing without manually typing the underlying syntax.

*   **Phase 1 (Prototyping):** I started with Gemini Web to build the initial prototype. While fantastic for rapid ideation, the complexity quickly scaled beyond what a standard web interface could handle without breaking existing features. *(Note: This phase resulted in a large amount of experimental commits as I constantly pushed to GitHub to preview the live VSCode server on my phone via my PC's IP address).*
*   **Phase 2 (Scaling & Architecture):** To properly scale the application, I transitioned to AntiGravity (an advanced agentic coding framework). This forced me to deeply understand the full-stack architecture—from the Vanilla JavaScript web frontend, to the Firebase Realtime Database, down to the ESP32 C++ firmware. 

**The Takeaway:** AI is incredible for rapid prototyping, but for long-term scalability and QA, having a deep structural understanding of the architecture is essential. By understanding how the web communicates with Firebase and how the ESP32 polls the database, I was able to surgically test, debug, and optimize the system.

## 📉 Optimization & Learnings
Reviewing and refining the AI output gave me deep, hands-on experience with:
*   **API Optimization:** The system is heavily optimized to prevent bandwidth spikes, consuming only around 27MB of bandwidth per 24 hours (including constant live telemetry syncing).
*   **Hardware-Software Bridging:** Understanding how to efficiently pass complex JSON payloads between a web app and a memory-constrained microcontroller.
*   **Browser Caching:** Leveraging service workers and local storage to make the web app load instantly.
*   **Firebase Authentication:** Managing secure user login and device ownership mapping.

## 📁 Repository Structure
*   `/frontend/` - The core Vanilla JavaScript Web Application (`Index.html`, `/src/`, `/assets/`, `sw.js`).
*   `/firmware/` - Both the C++ source code (`/firmware/AquaControl/`) for the ESP32 microcontroller and the compiled `.bin` files for Over-The-Air (OTA) updates.
*   `/mobile/` - The Android Studio project files (`/mobile/android/`) and compiled APK (`/mobile/apk/`).
*   `firmware.json` & `netlify.toml` - Root manifest and deployment configuration.

## ©️ Copyright & License
Copyright © 2026 Nafish Fuad. All rights reserved.
This project is available for personal, non-commercial use only. You may not use this software for commercial purposes, and you may not copy, distribute, or modify it without explicit permission.
