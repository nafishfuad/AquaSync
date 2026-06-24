// =============================================================
//  AquaSync Test — Stress Test Debug Helpers
//  File: AquaControl/debug_helpers.h
//
//  HOW TO USE:
//  1. #include "debug_helpers.h" at the TOP of AquaControl.ino
//     (after all other includes, before setup())
//  2. In loop(), call:      DebugHelpers::tickLoop();
//  3. In loop(), call:      DebugHelpers::tickNetwork();
//     (Test branch is single-core, so both go in loop())
//  4. After handleClient(), call:
//     DebugHelpers::checkSerialCommands(settingsMgr);
//  5. Re-upload, open Serial Monitor at 115200 baud.
//  6. Once testing is done, remove the #include — zero impact
//     on production firmware.
// =============================================================

#ifndef DEBUG_HELPERS_H
#define DEBUG_HELPERS_H

#include <Arduino.h>
#include <WiFi.h>

namespace DebugHelpers {

    // -------------------------------------------------------
    // [PHASE 3-B] Heap Monitor
    // Prints heap stats every 60 s so you can watch for leaks.
    // -------------------------------------------------------
    static unsigned long _lastHeapPrint = 0;
    void printHeap() {
        unsigned long now = millis();
        if (now - _lastHeapPrint >= 60000) {
            _lastHeapPrint = now;
            Serial.printf(
                "[MEM] Free: %6u B | Min Ever: %6u B | Largest Block: %6u B\n",
                ESP.getFreeHeap(),
                ESP.getMinFreeHeap(),
                ESP.getMaxAllocHeap()
            );
        }
    }

    // -------------------------------------------------------
    // [PHASE 3-A] Core Temperature
    // -------------------------------------------------------
    static unsigned long _lastTempPrint = 0;
    void printCoreTemp() {
        unsigned long now = millis();
        if (now - _lastTempPrint >= 30000) {  // every 30 s during testing
            _lastTempPrint = now;
            float t = temperatureRead();
            const char* status = (t < 55) ? "OK" : (t < 70) ? "WARM" : "HOT!";
            Serial.printf("[TEMP] Core: %.1f C  [%s]\n", t, status);
        }
    }

    // -------------------------------------------------------
    // [PHASE 1-A] Wi-Fi Signal Strength (RSSI)
    // -------------------------------------------------------
    static unsigned long _lastRSSIPrint = 0;
    void printRSSI() {
        unsigned long now = millis();
        if (now - _lastRSSIPrint >= 15000) {
            _lastRSSIPrint = now;
            if (WiFi.status() == WL_CONNECTED) {
                int rssi = WiFi.RSSI();
                const char* quality = (rssi > -60) ? "Excellent" :
                                      (rssi > -70) ? "Good" :
                                      (rssi > -80) ? "Fair" : "Poor!";
                Serial.printf("[WIFI] RSSI: %d dBm  [%s]\n", rssi, quality);
            }
        }
    }

    // -------------------------------------------------------
    // Serial Command Handler
    // Type commands into Serial Monitor to query on demand:
    //   HEAP  — print heap stats
    //   TEMP  — print core temperature
    //   RSSI  — print Wi-Fi signal strength
    //   TASKS — (FreeRTOS only) print task list
    // -------------------------------------------------------
    void checkSerialCommands(SettingsManager& settingsMgr) {
        if (Serial.available()) {
            String cmd = Serial.readStringUntil('\n');
            cmd.trim();

            if (cmd == "HEAP") {
                Serial.printf("[CMD] Heap: %u B | Min: %u B\n",
                    ESP.getFreeHeap(), ESP.getMinFreeHeap());
            }
            else if (cmd == "TEMP") {
                Serial.printf("[CMD] Core Temp: %.1f C\n", temperatureRead());
            }
            else if (cmd == "RSSI") {
                Serial.printf("[CMD] RSSI: %d dBm\n", WiFi.RSSI());
            }
            else if (cmd != "") {
                Serial.printf("[CMD] Unknown command: '%s'\n", cmd.c_str());
                Serial.println("[CMD] Available: HEAP | TEMP | RSSI");
            }
        }
    }

    // -------------------------------------------------------
    // Aggregate tick functions
    // -------------------------------------------------------
    void tickLoop() {
        printCoreTemp();
        printHeap();
    }

    void tickNetwork() {
        printRSSI();
    }

} // namespace DebugHelpers

#endif // DEBUG_HELPERS_H
