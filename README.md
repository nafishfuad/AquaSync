# AquaSync 🌊

AquaSync is a comprehensive, hybrid IoT ecosystem designed to fully automate and monitor aquarium environments. It controls aquarium lighting, CO2 injection, and cooling fans, providing real-time metrics, automated scheduling, and a beautiful dashboard for remote management.

## 🚀 Why I Built AquaSync
I built this project to solve a genuine problem in the aquarium hobby space. While commercial Wi-Fi switches exist, they lack critical features like Wi-Fi controlled dimming for lights, integrated CO2 scheduling, and comprehensive metric tracking. The few commercial products that do offer these features are prohibitively expensive. AquaSync bridges this gap by providing an affordable, feature-rich, and highly optimized custom solution tailored specifically to the needs of modern planted aquariums.

## 🛠️ The "Vibe Coding" Journey
This entire project was built using "vibe coding" (AI-assisted development), where I successfully architected and directed the development without writing a single line of code manually. 

- **Phase 1 (Prototyping):** I started with Gemini Web to build the initial prototype. While it was fantastic for getting the project off the ground, the complexity quickly scaled beyond what a standard web interface could handle without breaking existing features. *(Note: This phase resulted in a large amount of experimental commits as I constantly pushed to GitHub to preview the live VSCode server on my phone via my PC's IP address).*
- **Phase 2 (Scaling & Architecture):** To properly scale the application, I transitioned to **AntiGravity** (an advanced agentic coding framework). This allowed me to deeply understand the architecture—from the vanilla JavaScript web frontend, to the Firebase Realtime Database, down to the ESP32 C++ firmware. 
- **The Takeaway:** Vibe coding is incredible for rapid prototyping, but for long-term scalability, having a deep structural understanding of the architecture is essential. By understanding how the web talks to Firebase and how the ESP32 polls the database, I was able to surgically optimize the system.

## 📉 Optimization & Learnings
Through this project, I gained deep hands-on experience with:
- **API Optimization:** The system is heavily optimized to prevent bandwidth spikes, consuming only around **27MB of bandwidth per 24 hours** (which includes constant live telemetry syncing).
- **Firebase Authentication:** Secure user login and device ownership mapping.
- **Browser Caching:** Leveraging service workers and local storage to make the web app load instantly.
- **Hardware-Software Bridging:** Understanding how to efficiently pass complex JSON payloads between a web app and a memory-constrained microcontroller.

## 📁 Repository Structure
- `Index.html`, `/src/`, `/assets/` - The core Vanilla JavaScript Web Application.
- `/ESP32_Firmware/AquaControl/` - The C++ source code for the ESP32 microcontroller.
- `/Android_APK/` - The compiled Android app for the ecosystem.
- `/firmware/` - Compiled `.bin` files used by the ESP32 for remote Over-The-Air (OTA) updates.

## ©️ Copyright & License
Copyright © 2026 Nafis. All rights reserved.

This project is available for **personal, non-commercial use only**. You may not use this software for commercial purposes, and you may not copy, distribute, or modify it without explicit permission.
