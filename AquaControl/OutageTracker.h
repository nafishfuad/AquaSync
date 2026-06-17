#ifndef OUTAGE_TRACKER_H
#define OUTAGE_TRACKER_H

#include <Arduino.h>
#include <time.h>
#include "SettingsManager.h"
#include "HardwareEngine.h"

class OutageTracker {
private:
  SettingsManager& _settings;
  HardwareEngine& _hw;

public:
  // 🔥 FIX: Now accepts the HardwareEngine so it can control the lights
  OutageTracker(SettingsManager& s, HardwareEngine& h)
    : _settings(s), _hw(h) {}

  void performCloudAutopsy(uint32_t cloudLastAliveTs) {
    time_t nowTs = time(nullptr);

    if (cloudLastAliveTs == 0 || cloudLastAliveTs >= nowTs) {
      Serial.println("[AUTOPSY] Clean boot or no cloud history.");
      return;
    }

    uint32_t gapSeconds = nowTs - cloudLastAliveTs;

    if (gapSeconds > 180 && gapSeconds < 172800) {
      int gapMinutes = gapSeconds / 60;
      Serial.printf("[AUTOPSY] 🚨 POWER OUTAGE DETECTED! System was dead for %d minutes.\n", gapMinutes);

      TankSettings& s = _settings.get();
      s.totalLoadSheddingToday += gapMinutes;  // Keeps the cumulative history intact
      s.lastOutageTotalMins = gapMinutes;      // 🔥 Isolates the latest blackout

      int overlapMins = 0;
      uint32_t stepTs = cloudLastAliveTs;

      int startH, startM;
      sscanf(s.startTime, "%d:%d", &startH, &startM);
      int startTotalMins = (startH * 60) + startM;
      int endTotalMins = startTotalMins + (s.photoperiod * 60);

      while (stepTs < (uint32_t)nowTs) {
        time_t tempTs = stepTs;
        struct tm* t = localtime(&tempTs);
        int currentMins = t->tm_hour * 60 + t->tm_min;

        // 🔥 THE FIX: Wrap currentMins by 24h if the schedule crosses midnight
        int evalMins = currentMins;
        if (evalMins < startTotalMins && endTotalMins > 1440) {
          evalMins += 1440;
        }

        if (evalMins >= startTotalMins && evalMins < endTotalMins) {
          overlapMins++;
        }
        stepTs += 60;
      }

      if (overlapMins > 0) {
        s.lightLoadSheddingToday += overlapMins;
        s.lastOutageLightMins = overlapMins;
        Serial.printf("[AUTOPSY] 💡 %d minutes of the outage affected the lighting schedule.\n", overlapMins);

        // 🔥 FIX: If power came back ON while the light is supposed to be on, trigger the Gentle Ramp!
        struct tm* nowT = localtime(&nowTs);
        int nowMins = nowT->tm_hour * 60 + nowT->tm_min;
        if (nowMins >= startTotalMins && nowMins < endTotalMins) {
          _hw.startRecoveryRamp(nowMins, s.recoveryMins);
        }
      }

      _settings.triggerLazySave();

    } else if (gapSeconds <= 180) {
      Serial.println("[AUTOPSY] Normal system reboot detected. (Gap < 3 mins)");
    }
  }
};
#endif