#ifndef HARDWARE_ENGINE_H
#define HARDWARE_ENGINE_H

#include "CoreConfig.h"
#include <time.h>
#include <Preferences.h>

class HardwareEngine {
private:
    Preferences _prefs;
    bool _hasBooted = false;
    bool _hasTimeBooted = false; 
    bool _masterPowerState = false;
    
    float _currentActualPWM = 0.0;
    float _targetPWM = 0.0;

    int _lastLightPWM = -1;
    int _lastRelayState = -1;
    int _lastCO2State = -1;
    int _lastFanPWM = -1;

    unsigned long _lastLogTime = 0; 
    unsigned long _lastEvalTime = 0; 
    unsigned long _lastMuscleTick = 0;
    unsigned long _lastBreadcrumbTick = 0;
    unsigned long _lastAnalyticsSaveTick = 0;

    int _recoveryEndMins = 0;
    int _recoveryStartMins = 0;
    bool _isRecovering = false;

    bool _overrideLight = false;
    bool _overrideCO2 = false;
    bool _overrideFan = false;

    bool _lastAutoLight = false;
    bool _lastAutoCO2 = false;
    bool _lastAutoFan = false;
    bool _lastAutoModeState = true;

    unsigned long _ledTimer = 0;
    int _ledBlinksRemaining = 0;
    bool _ledIsOn = false;
    unsigned int _blinkInterval = 150; 

    void saveAnalyticsVault(TankSettings& settings) {
        _prefs.putBytes("actMins", settings.activeMinutesToday, sizeof(settings.activeMinutesToday));
        _prefs.putBytes("awkMins", settings.awakeMinutesToday, sizeof(settings.awakeMinutesToday));
        _prefs.putInt("totLS", settings.totalLoadSheddingToday);
        _prefs.putInt("lgtLS", settings.lightLoadSheddingToday);
        _prefs.putInt("lastDay", settings.lastTrackedDay);
    }

    int parseTime(const char* timeStr) {
        String t = String(timeStr);
        int sep = t.indexOf(':');
        if (sep == -1) return 0;
        return (t.substring(0, sep).toInt() * 60) + t.substring(sep + 1).toInt();
    }

    void evaluateAutoSchedule(TankSettings& settings) {
        if (!settings.isAutoMode) {
            _lastAutoModeState = false; 
            return;
        }

        if (!_lastAutoModeState) {
            _overrideLight = false;
            _overrideCO2 = false;
            _overrideFan = false;
            _lastAutoModeState = true;
        }

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
                if (_recoveryEndMins <= _recoveryStartMins || currentMins >= _recoveryEndMins) {
                    _isRecovering = false; 
                    targetBright = maxB;
                } else {
                    targetBright = map(currentMins, _recoveryStartMins, _recoveryEndMins, 0, maxB);
                }
            } else {
                targetBright = maxB;
                if (settings.isDimmerEnabled) {
                    int sunriseSecs = max(1, settings.sunriseMins * 60);
                    int sunsetSecs  = max(1, settings.sunsetMins * 60);
                    
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
    DailySnapshot snapshot; // 🔥 FIX 1: Make snapshot available to the Network Manager

    void forceResumeAuto() {
        _overrideLight = false;
        _overrideCO2 = false;
        _overrideFan = false;
        _lastAutoModeState = false; 
    }

    void startRecoveryRamp(int currentMins, int durationMins) {
        _isRecovering = true;
        _recoveryStartMins = currentMins;
        _recoveryEndMins = currentMins + durationMins;
    }

    void begin() {
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

        if (!_hasBooted) {
            _hasBooted = true;
            _prefs.getBytes("actMins", settings.activeMinutesToday, sizeof(settings.activeMinutesToday));
            _prefs.getBytes("awkMins", settings.awakeMinutesToday, sizeof(settings.awakeMinutesToday));
            settings.totalLoadSheddingToday = _prefs.getInt("totLS", 0);
            settings.lightLoadSheddingToday = _prefs.getInt("lgtLS", 0);
            settings.lastTrackedDay = _prefs.getInt("lastDay", 0);
        }

        if (timeValid && !_hasTimeBooted) {
            _hasTimeBooted = true;
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
        
        int currentLightPWM = settings.isLightOn ? map((int)_currentActualPWM, 0, 100, 255, 0) : 255;
        if (currentLightPWM != _lastLightPWM) {
            analogWrite(PIN_LIGHT, currentLightPWM);
            _lastLightPWM = currentLightPWM;
        }

        int currentRelay = (settings.isLightOn || settings.isCO2On || (settings.isFanEnabled && settings.isFanOn)) ? HIGH : LOW;
        if (currentRelay != _lastRelayState) {
            digitalWrite(PIN_RELAY, currentRelay);
            _lastRelayState = currentRelay;
        }

        int currentCO2 = settings.isCO2On ? LOW : HIGH;
        if (currentCO2 != _lastCO2State) {
            digitalWrite(PIN_CO2, currentCO2);
            _lastCO2State = currentCO2;
        }

        int currentFanPWM = (settings.isFanEnabled && settings.isFanOn) ? map(settings.fanSpeed, 0, 100, 255, 0) : 255;
        if (currentFanPWM != _lastFanPWM) {
            analogWrite(PIN_FAN, currentFanPWM);
            _lastFanPWM = currentFanPWM;
        }

        if (timeValid && (nowMillis - _lastBreadcrumbTick >= 60000)) {
            _lastBreadcrumbTick = nowMillis;
            
            // 🔥 NEW: Read internal silicon temperature and print to Serial
            float coreTemp = temperatureRead();
            Serial.printf("[HW] 🌡️ ESP32 Core Temperature: %.1f°C\n", coreTemp);

            int currentDayOfYear = timeinfo->tm_yday; 
            
            if (settings.lastTrackedDay != 0 && settings.lastTrackedDay != currentDayOfYear) {
                
                time_t yesterday = nowTime - 86400; 
                struct tm* ytm = localtime(&yesterday);
                
                snapshot.year = ytm->tm_year + 1900;
                snapshot.month = ytm->tm_mon + 1;
                snapshot.day = ytm->tm_mday;
                snapshot.totalLS = settings.totalLoadSheddingToday;
                snapshot.lightLS = settings.lightLoadSheddingToday;
                
                for(int i = 0; i < 24; i++) { 
                    snapshot.activeMinutes[i] = settings.activeMinutesToday[i];
                    snapshot.awakeMinutes[i] = settings.awakeMinutesToday[i];
                    
                    settings.activeMinutesToday[i] = 0; 
                    settings.awakeMinutesToday[i] = 0; 
                }
                
                snapshot.pending = true; 

                settings.totalLoadSheddingToday = 0; 
                settings.lightLoadSheddingToday = 0;
                
                settings.lastOutageTotalMins = 0;
                settings.lastOutageLightMins = 0;

                settings.lastTrackedDay = currentDayOfYear;
                saveAnalyticsVault(settings);
                
            } else if (settings.lastTrackedDay == 0) {
                settings.lastTrackedDay = currentDayOfYear;
            }
            
            settings.awakeMinutesToday[timeinfo->tm_hour] += 1;
            if (settings.isLightOn) settings.activeMinutesToday[timeinfo->tm_hour] += 1;
        }

        if (timeValid && (nowMillis - _lastAnalyticsSaveTick >= 3600000)) {
            _lastAnalyticsSaveTick = nowMillis;
            saveAnalyticsVault(settings);
        }
    }
};
#endif