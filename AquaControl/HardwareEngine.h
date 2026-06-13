#ifndef HARDWARE_ENGINE_H
#define HARDWARE_ENGINE_H

#include "CoreConfig.h"
#include <time.h>
#include <Preferences.h>

class HardwareEngine {
private:
    Preferences _prefs;
    bool _hasBooted = false;
    bool _masterPowerState = false;
    
    float _currentActualPWM = 0.0;
    float _targetPWM = 0.0;

    unsigned long _lastLogTime = 0; 
    unsigned long _lastEvalTime = 0; 
    unsigned long _lastMuscleTick = 0;
    unsigned long _lastBreadcrumbTick = 0;
    unsigned long _lastAnalyticsSaveTick = 0;

    int _recoveryEndMins = 0;
    int _recoveryStartMins = 0;
    bool _isRecovering = false;

    // --- Button Manual Overrides ---
    bool _overrideLight = false;
    bool _overrideCO2 = false;
    bool _overrideFan = false;

    bool _lastAutoLight = false;
    bool _lastAutoCO2 = false;
    bool _lastAutoFan = false;

    // --- LED Blinker ---
    unsigned long _ledTimer = 0;
    int _ledBlinksRemaining = 0;
    bool _ledIsOn = false;
    unsigned int _blinkInterval = 150; 

    void saveAnalyticsVault(TankSettings& settings) {
        _prefs.putBytes("actMins", settings.activeMinutesToday, sizeof(settings.activeMinutesToday));
        _prefs.putBytes("awkMins", settings.awakeMinutesToday, sizeof(settings.awakeMinutesToday));
        
        // 🔥 CRITICAL FIX: Ensure 30-day History Arrays are written to Flash
        _prefs.putBytes("actHist", settings.activeMinutesHistory, sizeof(settings.activeMinutesHistory));
        _prefs.putBytes("awkHist", settings.awakeMinutesHistory, sizeof(settings.awakeMinutesHistory));
        
        _prefs.putInt("totLS", settings.totalLoadSheddingToday);
        _prefs.putInt("lgtLS", settings.lightLoadSheddingToday);
        _prefs.putInt("lastDay", settings.lastTrackedDay);
        Serial.println("[SYS] 💾 Analytics securely backed up to Flash Vault.");
    }

    int parseTime(const char* timeStr) {
        String t = String(timeStr);
        int sep = t.indexOf(':');
        if (sep == -1) return 0;
        return (t.substring(0, sep).toInt() * 60) + t.substring(sep + 1).toInt();
    }

    void evaluateAutoSchedule(TankSettings& settings) {
        if (!settings.isAutoMode) return;

        time_t now = time(nullptr);
        struct tm* timeinfo = localtime(&now);
        if (timeinfo->tm_year < 120) return; 

        int currentSecs = timeinfo->tm_hour * 3600 + timeinfo->tm_min * 60 + timeinfo->tm_sec;
        int startSecs = parseTime(settings.startTime) * 60;
        int endSecs = startSecs + (settings.photoperiod * 3600);
        int evalSecs = currentSecs;
        if (evalSecs < startSecs && endSecs > 86400) evalSecs += 86400;

        float targetBright = 0;
        bool targetLight = false;
        bool targetCO2 = false;
        bool targetFan = false;

        if (evalSecs >= startSecs && evalSecs < endSecs) {
            targetLight = true;
            float maxB = settings.isDimmerEnabled ? settings.maxBrightness : 100.0;

            if (_isRecovering) {
                int currentMins = currentSecs / 60;
                if (currentMins >= _recoveryEndMins) {
                    _isRecovering = false; 
                    targetBright = maxB;
                } else {
                    targetBright = map(currentMins, _recoveryStartMins, _recoveryEndMins, 0, maxB);
                }
            } else {
                targetBright = maxB;
                if (settings.isDimmerEnabled) {
                    int sunriseSecs = settings.sunriseMins * 60;
                    int sunsetSecs = settings.sunsetMins * 60;
                    if (evalSecs < startSecs + sunriseSecs) {
                        targetBright = ((float)(evalSecs - startSecs) / sunriseSecs) * maxB;
                    } else if (evalSecs > endSecs - sunsetSecs) {
                        targetBright = ((float)(endSecs - evalSecs) / sunsetSecs) * maxB;
                    }
                }
            }
        } else {
            _isRecovering = false; 
        }

        if (settings.isCO2ScheduleSeparate) {
            int co2Start = parseTime(settings.co2OnTime) * 60;
            int co2End = parseTime(settings.co2OffTime) * 60;
            targetCO2 = (co2Start < co2End) ? (currentSecs >= co2Start && currentSecs < co2End) : (currentSecs >= co2Start || currentSecs < co2End);
        } else { targetCO2 = targetLight; }

        if (settings.isFanEnabled) {
            int fanStart = parseTime(settings.fanOnTime) * 60;
            int fanEnd = parseTime(settings.fanOffTime) * 60;
            targetFan = (fanStart < fanEnd) ? (currentSecs >= fanStart && currentSecs < fanEnd) : (currentSecs >= fanStart || currentSecs < fanEnd);
        }

        if (targetLight != _lastAutoLight) { _overrideLight = false; _lastAutoLight = targetLight; }
        if (targetCO2 != _lastAutoCO2) { _overrideCO2 = false; _lastAutoCO2 = targetCO2; }
        if (targetFan != _lastAutoFan) { _overrideFan = false; _lastAutoFan = targetFan; }

        if (!_overrideLight) {
            settings.isLightOn = targetLight;
            settings.currentBrightness = (int)targetBright;
        }
        if (!_overrideCO2) settings.isCO2On = targetCO2;
        if (!_overrideFan) settings.isFanOn = targetFan; 
    }

public:
    bool _isMaintenanceMode = false;

    void begin() {
        // Higher PWM for perfectly smooth LED dimming
        analogWriteResolution(PIN_LIGHT, 8);
        analogWriteFrequency(PIN_LIGHT, 5000); 
        analogWriteResolution(PIN_FAN, 8);
        analogWriteFrequency(PIN_FAN, 5000);
        
        pinMode(PIN_CO2, OUTPUT);
        pinMode(PIN_RELAY, OUTPUT);
        pinMode(PIN_LED, OUTPUT);
        pinMode(PIN_BTN, INPUT_PULLUP);
        
        digitalWrite(PIN_RELAY, LOW);
        digitalWrite(PIN_CO2, HIGH); 
        analogWrite(PIN_LIGHT, 255); 
        analogWrite(PIN_FAN, 255);   
        digitalWrite(PIN_LED, HIGH); 

        _prefs.begin("aqua-tracker", false);
    }

    void applyManualOverride(String component, bool state) {
        if (component == "LIGHT") _overrideLight = true;
        else if (component == "CO2") _overrideCO2 = true;
        else if (component == "FAN") _overrideFan = true;
    }

    void triggerLEDPattern(String type) {
        if (type == "LOCAL") { _ledBlinksRemaining = 1; _blinkInterval = 150; }
        else if (type == "CLOUD") { _ledBlinksRemaining = 2; _blinkInterval = 150; }
        else if (type == "REBOOT") { _ledBlinksRemaining = 5; _blinkInterval = 100; }
        else if (type == "RESET") { _ledBlinksRemaining = 15; _blinkInterval = 50; } 
    }

    void handleLEDs() {
        unsigned long now = millis();
        if (_ledBlinksRemaining > 0) {
            if (now - _ledTimer > _blinkInterval) {
                _ledTimer = now;
                _ledIsOn = !_ledIsOn;
                digitalWrite(PIN_LED, _ledIsOn ? LOW : HIGH); 
                if (!_ledIsOn) _ledBlinksRemaining--;
            }
        }
        else if (_isMaintenanceMode) {
            if (now - _ledTimer > 500) { 
                _ledTimer = now;
                _ledIsOn = !_ledIsOn;
                digitalWrite(PIN_LED, _ledIsOn ? LOW : HIGH);
            }
        }
        else {
            if (_ledIsOn) {
                _ledIsOn = false;
                digitalWrite(PIN_LED, HIGH); 
            }
        }
    }

    void execute(TankSettings& settings, bool forceEval = false, bool debugLog = false) {
        unsigned long nowMillis = millis();
        time_t nowTime = time(nullptr);
        struct tm* timeinfo = localtime(&nowTime);
        bool timeValid = (timeinfo->tm_year >= 120);

        if (timeValid && !_hasBooted) {
            _hasBooted = true;
            _prefs.getBytes("actMins", settings.activeMinutesToday, sizeof(settings.activeMinutesToday));
            _prefs.getBytes("awkMins", settings.awakeMinutesToday, sizeof(settings.awakeMinutesToday));
            
            // 🔥 CRITICAL FIX: Load History on Boot
            _prefs.getBytes("actHist", settings.activeMinutesHistory, sizeof(settings.activeMinutesHistory));
            _prefs.getBytes("awkHist", settings.awakeMinutesHistory, sizeof(settings.awakeMinutesHistory));
            
            settings.totalLoadSheddingToday = _prefs.getInt("totLS", 0);
            settings.lightLoadSheddingToday = _prefs.getInt("lgtLS", 0);
            settings.lastTrackedDay = _prefs.getInt("lastDay", 0);
            
            long lastBreadcrumb = _prefs.getLong("last_time", 0);
            if (lastBreadcrumb > 0 && nowTime > lastBreadcrumb && (nowTime - lastBreadcrumb) >= 60) {
                int outageMins = max(1, (int)(nowTime - lastBreadcrumb) / 60);
                settings.totalLoadSheddingToday += outageMins;
                int curr = timeinfo->tm_hour * 60 + timeinfo->tm_min;
                int start = parseTime(settings.startTime);
                int end = start + (settings.photoperiod * 60);
                if (curr >= start && (curr - outageMins) < end) {
                    settings.lightLoadSheddingToday += min(outageMins, (end - (curr - outageMins)));
                    _isRecovering = true;
                    _recoveryStartMins = curr;
                    _recoveryEndMins = curr + settings.recoveryMins;
                }
                saveAnalyticsVault(settings);
            }
            _lastBreadcrumbTick = nowMillis; 
            _lastAnalyticsSaveTick = nowMillis;
        }

        if (forceEval || (nowMillis - _lastEvalTime > 5000)) {
            if (settings.isAutoMode) evaluateAutoSchedule(settings);
            else _isRecovering = false; 
            _lastEvalTime = nowMillis;
            _targetPWM = settings.isLightOn ? settings.currentBrightness : 0.0;
        }

        float dt = (nowMillis - _lastMuscleTick) / 1000.0;
        _lastMuscleTick = nowMillis;
        
        if (dt > 0) {
            float fadeSpeed = dt * 2.0; 
            if (fadeSpeed > 1.0) fadeSpeed = 1.0; 
            _currentActualPWM += (_targetPWM - _currentActualPWM) * fadeSpeed;
            if (_currentActualPWM < 0.0) _currentActualPWM = 0.0;
            if (_currentActualPWM > 100.0) _currentActualPWM = 100.0;
        }
        
        analogWrite(PIN_LIGHT, settings.isLightOn ? map((int)_currentActualPWM, 0, 100, 255, 0) : 255);
        digitalWrite(PIN_RELAY, (settings.isLightOn || settings.isCO2On || (settings.isFanEnabled && settings.isFanOn)) ? HIGH : LOW);
        digitalWrite(PIN_CO2, settings.isCO2On ? LOW : HIGH);
        analogWrite(PIN_FAN, (settings.isFanEnabled && settings.isFanOn) ? map(settings.fanSpeed, 0, 100, 255, 0) : 255);

        if (timeValid && (nowMillis - _lastBreadcrumbTick >= 60000)) {
            _lastBreadcrumbTick = nowMillis;
            _prefs.putLong("last_time", (long)nowTime);
            if (settings.lastTrackedDay != 0 && settings.lastTrackedDay != timeinfo->tm_mday) {
                
                // 🔥 CRITICAL FIX: Shift BOTH history arrays down by 1 Day
                for (int i = 29; i > 0; i--) {
                    settings.activeMinutesHistory[i] = settings.activeMinutesHistory[i-1];
                    settings.awakeMinutesHistory[i] = settings.awakeMinutesHistory[i-1];
                }
                
                uint16_t yTotal = 0;
                uint16_t yAwake = 0;
                for(int i=0; i<24; i++) { 
                    yTotal += settings.activeMinutesToday[i]; 
                    yAwake += settings.awakeMinutesToday[i];
                    settings.activeMinutesToday[i] = 0; 
                    settings.awakeMinutesToday[i] = 0; 
                }
                
                settings.activeMinutesHistory[0] = yTotal;
                settings.awakeMinutesHistory[0] = yAwake;
                settings.totalLoadSheddingToday = 0; 
                settings.lightLoadSheddingToday = 0;
                settings.lastTrackedDay = timeinfo->tm_mday;
                saveAnalyticsVault(settings);
            } else if (settings.lastTrackedDay == 0) {
                settings.lastTrackedDay = timeinfo->tm_mday;
            }
            
            settings.awakeMinutesToday[timeinfo->tm_hour] += 1;
            if (settings.isLightOn) settings.activeMinutesToday[timeinfo->tm_hour] += 1;
        }

        // 1 HOUR NVS SAVE
        if (timeValid && (nowMillis - _lastAnalyticsSaveTick >= 3600000)) {
            _lastAnalyticsSaveTick = nowMillis;
            saveAnalyticsVault(settings);
        }
    }
};
#endif