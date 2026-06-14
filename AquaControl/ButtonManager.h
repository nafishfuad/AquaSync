#ifndef BUTTON_MANAGER_H
#define BUTTON_MANAGER_H

#include <Arduino.h>
#include "CoreConfig.h"
#include "SettingsManager.h"
#include "HardwareEngine.h"

class ButtonManager {
private:
    SettingsManager& _settings;
    HardwareEngine& _hw;

    bool _lastState = false; 
    unsigned long _pressTime = 0;
    unsigned long _releaseTime = 0;
    int _clickCount = 0;
    bool _handledHold = false; 
    
    bool _isMaintenanceMode = false;
    unsigned long _maintenanceStartTime = 0;
    
    bool _isDimmingActive = false;
    unsigned long _lastDimIncrement = 0;

    void executeNormalCommand() {
        TankSettings& s = _settings.get();
        
        if (_clickCount == 1) {
            s.isLightOn = !s.isLightOn;
            if (s.isLightOn && s.currentBrightness == 0) s.currentBrightness = s.maxBrightness;
            _hw.applyManualOverride("LIGHT", s.isLightOn);
            _hw.triggerLEDPattern("LOCAL");
            Serial.println("[BTN] 1 Click -> Light Toggled");
        } 
        else if (_clickCount == 2) {
            s.isCO2On = !s.isCO2On;
            _hw.applyManualOverride("CO2", s.isCO2On);
            _hw.triggerLEDPattern("LOCAL");
            Serial.println("[BTN] 2 Clicks -> CO2 Toggled");
        }
        else if (_clickCount == 3) {
            s.isFanOn = !s.isFanOn;
            _hw.applyManualOverride("FAN", s.isFanOn);
            _hw.triggerLEDPattern("LOCAL");
            Serial.println("[BTN] 3 Clicks -> Fan Toggled");
        }
        
        _settings.triggerLazySave(); 
    }

public:
    ButtonManager(SettingsManager& s, HardwareEngine& h) : _settings(s), _hw(h) {}

    void loop() {
        bool currentState = digitalRead(PIN_BTN) == LOW; 
        unsigned long now = millis();

        if (currentState && !_lastState) {
            _pressTime = now;
            _handledHold = false; 
            if (_isMaintenanceMode) _maintenanceStartTime = now; 
        }

        unsigned long holdDuration = now - _pressTime;
        if (currentState && holdDuration > 500) {
            
            if (!_isMaintenanceMode) {
                if (_clickCount == 1) { 
                    _isDimmingActive = true;
                    _handledHold = true;
                    
                    if (now - _lastDimIncrement > 1000) { 
                        _lastDimIncrement = now;
                        TankSettings& s = _settings.get();
                        s.isLightOn = true;
                        s.currentBrightness += 10;
                        if (s.currentBrightness > 100) s.currentBrightness = 10; 
                        _hw.applyManualOverride("LIGHT", true);
                        _hw.triggerLEDPattern("LOCAL"); 
                        Serial.printf("[BTN] Dimming... %d%%\n", s.currentBrightness);
                    }
                } 
                else if (_clickCount == 3) { 
                    _isMaintenanceMode = true;
                    _maintenanceStartTime = now;
                    _hw._isMaintenanceMode = true; 
                    _clickCount = 0; 
                    _handledHold = true;
                    Serial.println("[BTN] ⚠️ ENTERED MAINTENANCE MODE");
                }
            } 
        }

        if (!currentState && _lastState) {
            _releaseTime = now;
            
            if (_isDimmingActive) {
                _isDimmingActive = false;
                _settings.triggerLazySave(); 
                _clickCount = 0;
            } 
            else if (_isMaintenanceMode && holdDuration > 500) {
                if (holdDuration >= 8000) {
                    Serial.println("[BTN] 🧨 FACTORY RESET CONFIRMED");
                    _hw.triggerLEDPattern("RESET");
                    
                    unsigned long flashStart = millis();
                    while(millis() - flashStart < 3000) _hw.handleLEDs(); 
                    
                    Preferences p; 
                    p.begin("aqua-ctrl", false); 
                    p.clear(); 
                    // 🔥 THE DEATH RATTLE FLAG: Tell the next boot sequence to nuke the Cloud lock
                    p.putBool("nuke_cloud", true); 
                    p.end();
                    
                    p.begin("aqua-tracker", false); 
                    p.clear(); 
                    p.end();
                    
                    ESP.restart();
                } 
                else if (holdDuration >= 3000) {
                    Serial.println("[BTN] 🔄 REBOOT CONFIRMED");
                    _hw.triggerLEDPattern("REBOOT");
                    
                    unsigned long flashStart = millis();
                    while(millis() - flashStart < 1500) _hw.handleLEDs(); 
                    
                    ESP.restart();
                }
            } 
            else if (!_isMaintenanceMode && !_handledHold) {
                _clickCount++;
            }
        }

        if (!currentState && !_isMaintenanceMode && _clickCount > 0 && (now - _releaseTime > 400)) {
            executeNormalCommand();
            _clickCount = 0;
        }

        if (_isMaintenanceMode && !currentState && (now - _maintenanceStartTime > 5000)) {
            _isMaintenanceMode = false;
            _hw._isMaintenanceMode = false; 
            Serial.println("[BTN] ⚠️ EXITED MAINTENANCE MODE (Timeout)");
        }

        _lastState = currentState;
    }
};
#endif