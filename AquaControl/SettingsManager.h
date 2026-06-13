#ifndef SETTINGS_MANAGER_H
#define SETTINGS_MANAGER_H

#include <Preferences.h>
#include <ArduinoJson.h>
#include "CoreConfig.h"

class SettingsManager {
private:
    Preferences _prefs;
    TankSettings _settings;
    
    unsigned long _lastChangeMillis = 0;
    unsigned long _lastTimestamp = 0; 
    bool _needsFlashSave = false;
    bool _needsFirebaseSync = false;
    bool _forceHardwareEval = false;

public:
    void begin() {
        _needsFlashSave = false;
        _needsFirebaseSync = false;
        
        // 🔥 FATAL CRASH FIX: This must be 'false' to safely format a brand new ESP32 memory chip
        _prefs.begin("aqua-ctrl", false);
        
        String dName = _prefs.getString("devName", "AquaSync Controller");
        strncpy(_settings.deviceName, dName.c_str(), sizeof(_settings.deviceName));
        _settings.deviceName[sizeof(_settings.deviceName) - 1] = '\0'; 

        _settings.isAutoMode = _prefs.getBool("autoMode", true);
        _settings.isLightOn = _prefs.getBool("lightOn", false);
        _settings.isCO2On = _prefs.getBool("co2On", false);
        _settings.isFanOn = _prefs.getBool("fanOn", false);
        _settings.isFanEnabled = _prefs.getBool("fanEn", false);
        _settings.currentBrightness = _prefs.getInt("brightness", 0);
        
        String start = _prefs.getString("startTime", "17:00");
        strncpy(_settings.startTime, start.c_str(), sizeof(_settings.startTime));
        
        _settings.photoperiod = _prefs.getInt("photo", 6);
        _settings.maxBrightness = _prefs.getInt("maxBright", 80);
        
        _settings.isDimmerEnabled = _prefs.getBool("dimmerEn", true);
        _settings.sunriseMins = _prefs.getInt("sunrise", 20);
        _settings.sunsetMins = _prefs.getInt("sunset", 20);
        _settings.recoveryMins = _prefs.getInt("recovery", 5);
        _settings.isCO2ScheduleSeparate = _prefs.getBool("co2Sep", false);
        
        String co2On = _prefs.getString("co2OnT", "16:50");
        strncpy(_settings.co2OnTime, co2On.c_str(), sizeof(_settings.co2OnTime));
        String co2Off = _prefs.getString("co2OffT", "22:40");
        strncpy(_settings.co2OffTime, co2Off.c_str(), sizeof(_settings.co2OffTime));
        
        String fanOn = _prefs.getString("fanOnT", "10:00");
        strncpy(_settings.fanOnTime, fanOn.c_str(), sizeof(_settings.fanOnTime));
        String fanOff = _prefs.getString("fanOffT", "18:00");
        strncpy(_settings.fanOffTime, fanOff.c_str(), sizeof(_settings.fanOffTime));
        _settings.fanSpeed = _prefs.getInt("fanSpeed", 80);

        _settings.colorW = _prefs.getInt("colW", 87);
        _settings.colorR = _prefs.getInt("colR", 100);
        _settings.colorG = _prefs.getInt("colG", 100);
        _settings.colorB = _prefs.getInt("colB", 100);
    }

    TankSettings& get() { return _settings; }
    
    bool needsFirebaseSync() const { return _needsFirebaseSync; }
    void clearFirebaseSync() { _needsFirebaseSync = false; }
    
    bool needsHardwareEval() { 
        if (_forceHardwareEval) {
            _forceHardwareEval = false;
            return true;
        }
        return false;
    }

    void triggerLazySave() {
        _lastChangeMillis = millis();
        _needsFlashSave = true;
        _needsFirebaseSync = true;
        _forceHardwareEval = true; 
    }

    bool updateFromJson(const JsonObject& doc) {
        if (doc.containsKey("ts")) {
            unsigned long incomingTs = doc["ts"];
            if (incomingTs < _lastTimestamp) return false;
            _lastTimestamp = incomingTs;
        }

        if (doc.containsKey("deviceName")) {
            strncpy(_settings.deviceName, doc["deviceName"], sizeof(_settings.deviceName));
            _settings.deviceName[sizeof(_settings.deviceName) - 1] = '\0';
        }

        if (doc.containsKey("isAutoMode")) _settings.isAutoMode = doc["isAutoMode"];
        if (doc.containsKey("isCO2ScheduleSeparate")) _settings.isCO2ScheduleSeparate = doc["isCO2ScheduleSeparate"];
        
        if (doc.containsKey("currentBrightness")) {
            _settings.currentBrightness = doc["currentBrightness"];
            _settings.isLightOn = (_settings.currentBrightness > 0);
        } else if (doc.containsKey("isLightOn")) {
            _settings.isLightOn = doc["isLightOn"];
            if (!_settings.isLightOn) _settings.currentBrightness = 0;
            else if (_settings.currentBrightness == 0) _settings.currentBrightness = 40;
        }

        if ((doc.containsKey("isLightOn") || doc.containsKey("currentBrightness")) && !_settings.isCO2ScheduleSeparate) {
            _settings.isCO2On = _settings.isLightOn; 
        }

        if (doc.containsKey("isCO2On")) _settings.isCO2On = doc["isCO2On"]; 
        if (doc.containsKey("isFanOn")) _settings.isFanOn = doc["isFanOn"];
        if (doc.containsKey("isFanEnabled")) _settings.isFanEnabled = doc["isFanEnabled"];
        if (doc.containsKey("photoperiod")) _settings.photoperiod = doc["photoperiod"];
        if (doc.containsKey("maxBrightness")) _settings.maxBrightness = doc["maxBrightness"];
        if (doc.containsKey("fanSpeed")) _settings.fanSpeed = doc["fanSpeed"];
        
        if (doc.containsKey("isDimmerEnabled")) _settings.isDimmerEnabled = doc["isDimmerEnabled"];
        if (doc.containsKey("sunriseMins")) _settings.sunriseMins = doc["sunriseMins"];
        if (doc.containsKey("sunsetMins")) _settings.sunsetMins = doc["sunsetMins"];
        if (doc.containsKey("recoveryMins")) _settings.recoveryMins = doc["recoveryMins"];
        
        if (doc.containsKey("startTime")) strncpy(_settings.startTime, doc["startTime"], sizeof(_settings.startTime));
        if (doc.containsKey("co2OnTime")) strncpy(_settings.co2OnTime, doc["co2OnTime"], sizeof(_settings.co2OnTime));
        if (doc.containsKey("co2OffTime")) strncpy(_settings.co2OffTime, doc["co2OffTime"], sizeof(_settings.co2OffTime));
        if (doc.containsKey("fanOnTime")) strncpy(_settings.fanOnTime, doc["fanOnTime"], sizeof(_settings.fanOnTime));
        if (doc.containsKey("fanOffTime")) strncpy(_settings.fanOffTime, doc["fanOffTime"], sizeof(_settings.fanOffTime));

        if (doc.containsKey("colorSpectrum")) {
            JsonObject col = doc["colorSpectrum"];
            if (col.containsKey("w")) _settings.colorW = col["w"];
            if (col.containsKey("r")) _settings.colorR = col["r"];
            if (col.containsKey("g")) _settings.colorG = col["g"];
            if (col.containsKey("b")) _settings.colorB = col["b"];
        }

        triggerLazySave(); 
        return true;
    }

    void processLazyFlashSave() {
        if (!_needsFlashSave) return;
        if (millis() - _lastChangeMillis < 60000) return; 

        _prefs.putString("devName", String(_settings.deviceName));
        _prefs.putBool("autoMode", _settings.isAutoMode);
        _prefs.putBool("lightOn", _settings.isLightOn);
        _prefs.putBool("co2On", _settings.isCO2On);
        _prefs.putBool("fanOn", _settings.isFanOn);
        _prefs.putBool("fanEn", _settings.isFanEnabled);
        _prefs.putInt("brightness", _settings.currentBrightness);
        _prefs.putString("startTime", String(_settings.startTime));
        _prefs.putInt("photo", _settings.photoperiod);
        _prefs.putInt("maxBright", _settings.maxBrightness);
        
        _prefs.putBool("dimmerEn", _settings.isDimmerEnabled);
        _prefs.putInt("sunrise", _settings.sunriseMins);
        _prefs.putInt("sunset", _settings.sunsetMins);
        _prefs.putInt("recovery", _settings.recoveryMins);
        _prefs.putBool("co2Sep", _settings.isCO2ScheduleSeparate);
        
        _prefs.putString("co2OnT", String(_settings.co2OnTime));
        _prefs.putString("co2OffT", String(_settings.co2OffTime));
        _prefs.putString("fanOnT", String(_settings.fanOnTime));
        _prefs.putString("fanOffT", String(_settings.fanOffTime));
        _prefs.putInt("fanSpeed", _settings.fanSpeed);
        _prefs.putInt("colW", _settings.colorW);
        _prefs.putInt("colR", _settings.colorR);
        _prefs.putInt("colG", _settings.colorG);
        _prefs.putInt("colB", _settings.colorB);
        
        _needsFlashSave = false;
        Serial.println("[SYS] 💾 60-Second Lazy Save Triggered. Memory committed to flash.");
    }
    
    bool isReadyForFirebaseSync() {
        if (!_needsFirebaseSync) return false;
        if (millis() - _lastChangeMillis < 3000) return false; 
        return true;
    }
};

#endif