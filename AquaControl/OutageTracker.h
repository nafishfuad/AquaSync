#ifndef OUTAGE_TRACKER_H
#define OUTAGE_TRACKER_H

#include <Arduino.h>
#include <Preferences.h>
#include <time.h>
#include "SettingsManager.h"

class OutageTracker {
private:
    SettingsManager& _settings;
    unsigned long _lastSaveMillis = 0;
    bool _bootCheckDone = false;

    void saveHeartbeat(time_t currentTs) {
        Preferences p;
        p.begin("aqua-tracker", false);
        p.putUInt("last_alive", (uint32_t)currentTs);
        p.end();
    }

    void performAutopsy(time_t currentTs) {
        Preferences p;
        p.begin("aqua-tracker", true); // Open in Read-Only mode
        uint32_t lastAliveTs = p.getUInt("last_alive", 0);
        p.end();

        if (lastAliveTs == 0) {
            Serial.println("[AUTOPSY] Clean boot (No previous heartbeat found).");
            return;
        }

        uint32_t gapSeconds = currentTs - lastAliveTs;

        // If the gap is > 3 minutes (180s) and < 48 hours (to prevent insane bugs if offline for months)
        if (gapSeconds > 180 && gapSeconds < 172800) { 
            int gapMinutes = gapSeconds / 60;
            Serial.printf("[AUTOPSY] 🚨 POWER OUTAGE DETECTED! Offline for %d minutes.\n", gapMinutes);

            TankSettings& s = _settings.get();
            s.totalLoadSheddingToday += gapMinutes;

            // --- THE OVERLAP MATH ---
            // Calculate exactly how many of those lost minutes happened during the photoperiod
            int startHour = String(s.startTime).substring(0, 2).toInt();
            int startMin = String(s.startTime).substring(3, 5).toInt();
            int startMinsFromMidnight = (startHour * 60) + startMin;
            int endMinsFromMidnight = startMinsFromMidnight + (s.photoperiod * 60);

            int overlapMins = 0;
            time_t stepTs = lastAliveTs;
            
            // Step through the outage minute-by-minute
            while (stepTs < currentTs) {
                struct tm* stepTm = localtime(&stepTs);
                int currentStepMins = (stepTm->tm_hour * 60) + stepTm->tm_min;

                bool isExpectedLightOn = false;
                if (endMinsFromMidnight > 1440) {
                    // Schedule crosses midnight (e.g., 20:00 to 02:00)
                    int endWrapped = endMinsFromMidnight - 1440;
                    if (currentStepMins >= startMinsFromMidnight || currentStepMins < endWrapped) {
                        isExpectedLightOn = true;
                    }
                } else {
                    // Normal daytime schedule
                    if (currentStepMins >= startMinsFromMidnight && currentStepMins < endMinsFromMidnight) {
                        isExpectedLightOn = true;
                    }
                }

                if (isExpectedLightOn) {
                    overlapMins++;
                }
                stepTs += 60; // Advance time by 60 seconds
            }

            if (overlapMins > 0) {
                s.lightLoadSheddingToday += overlapMins;
                Serial.printf("[AUTOPSY] 💡 %d minutes of the outage affected the lighting schedule.\n", overlapMins);
            }

            // Flag the settings so the NetworkManager pushes this new data to Firebase immediately
            _settings.triggerLazySave();

        } else if (gapSeconds <= 180) {
            Serial.println("[AUTOPSY] Normal system reboot detected. (Gap < 3 mins)");
        }
    }

public:
    OutageTracker(SettingsManager& s) : _settings(s) {}

    void loop() {
        time_t nowTs = time(nullptr);
        
        // Wait until the ESP32 has actually synced its time with an NTP server via Wi-Fi
        // (1600000000 is roughly the year 2020. If time is less than this, NTP hasn't synced yet)
        if (nowTs < 1600000000) return; 

        // 1. Run the Autopsy exactly once after booting and getting the correct time
        if (!_bootCheckDone) {
            performAutopsy(nowTs);
            _bootCheckDone = true;
            _lastSaveMillis = millis();
            saveHeartbeat(nowTs);
        }

        // 2. Save a heartbeat every 60 seconds while running normally
        if (millis() - _lastSaveMillis > 60000) {
            saveHeartbeat(nowTs);
            _lastSaveMillis = millis();
        }
    }
};
#endif