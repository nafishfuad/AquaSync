#ifndef AQUA_NETWORK_MANAGER_H
#define AQUA_NETWORK_MANAGER_H

#include <WebServer.h>
#include <HTTPClient.h>
#include <WiFiClientSecure.h>
#include <HTTPUpdate.h> // 🔥 Added for Universal OTA Rescue
#include <Preferences.h>
#include "CoreConfig.h"
#include "SettingsManager.h"
#include "HardwareEngine.h"

class AquaNetworkManager {
private:
    WebServer _server;
    SettingsManager& _settingsMgr;
    HardwareEngine& _hwEngine; 
    String _hwid;
    
    // --- Master Plan Timers ---
    unsigned long _lastFirebasePull = 0;
    unsigned long _lastHeartbeat = 0;
    unsigned long _lastAnalyticsPush = 0;
    unsigned long _lastCommandReceivedTime = 0;
    
    // --- State Flags ---
    bool _needsCloudPush = false;
    bool _hasFetchedInitialConfig = false; // Phase 4 Boot Sync

    String getLogTime() {
        time_t now = time(nullptr);
        struct tm* timeinfo = localtime(&now);
        if (timeinfo->tm_year < 120) return String(millis() / 1000) + "s";
        char buf[10];
        sprintf(buf, "%02d:%02d:%02d", timeinfo->tm_hour, timeinfo->tm_min, timeinfo->tm_sec);
        return String(buf);
    }

    void addCorsHeaders() {
        _server.sendHeader("Access-Control-Allow-Origin", "*");
        _server.sendHeader("Access-Control-Allow-Methods", "POST, GET, OPTIONS, PATCH, DELETE");
        _server.sendHeader("Access-Control-Allow-Headers", "Content-Type");
    }

    void handlePreflight() {
        addCorsHeaders();
        _server.send(204, "text/plain", "");
    }
    
    // ---------------------------------------------------------
    // TIER 1: QUICK STATE (Small JSON)
    // ---------------------------------------------------------
    String generateQuickStateJson(bool includeIP = false) {
        JsonDocument doc;
        TankSettings& s = _settingsMgr.get();
        doc["v"] = CURRENT_SCHEMA_VERSION;
        doc["deviceName"] = s.deviceName;
        doc["isAutoMode"] = s.isAutoMode;
        doc["isLightOn"] = s.isLightOn;
        doc["isCO2On"] = s.isCO2On;
        doc["isFanOn"] = s.isFanOn;
        doc["isFanEnabled"] = s.isFanEnabled;
        doc["currentBrightness"] = s.currentBrightness;
        if (includeIP) doc["localIP"] = WiFi.localIP().toString();

        doc["startTime"] = s.startTime;
        doc["photoperiod"] = s.photoperiod;
        doc["maxBrightness"] = s.maxBrightness;
        doc["isDimmerEnabled"] = s.isDimmerEnabled;
        doc["sunriseMins"] = s.sunriseMins;
        doc["sunsetMins"] = s.sunsetMins;
        doc["isCO2ScheduleSeparate"] = s.isCO2ScheduleSeparate;
        doc["co2OnTime"] = s.co2OnTime;
        doc["co2OffTime"] = s.co2OffTime;
        doc["recoveryMins"] = s.recoveryMins;
        doc["fanOnTime"] = s.fanOnTime;
        doc["fanOffTime"] = s.fanOffTime;
        doc["fanSpeed"] = s.fanSpeed;
        
        String out;
        serializeJson(doc, out);
        return out;
    }

    // ---------------------------------------------------------
    // TIER 2: ANALYTICS (Batched Arrays)
    // ---------------------------------------------------------
    String generateAnalyticsJson() {
        JsonDocument doc;
        TankSettings& s = _settingsMgr.get();
        doc["totalLoadSheddingToday"] = s.totalLoadSheddingToday;
        doc["lightLoadSheddingToday"] = s.lightLoadSheddingToday;

        JsonArray hourly = doc.createNestedArray("hourlyData");
        for(int i=0; i<24; i++) hourly.add(s.activeMinutesToday[i]);

        JsonArray awakeHourly = doc.createNestedArray("awakeData");
        for(int i=0; i<24; i++) awakeHourly.add(s.awakeMinutesToday[i]);

        JsonArray daily = doc.createNestedArray("dailyData");
        for(int i=0; i<30; i++) daily.add(s.activeMinutesHistory[i]);

        String out;
        serializeJson(doc, out);
        return out;
    }

    // ---------------------------------------------------------
    // TIER 3: HEARTBEAT (Tiny Payload)
    // ---------------------------------------------------------
    String generateHeartbeatJson() {
        JsonDocument doc;
        doc["lastHeartbeatTs"] = time(nullptr);
        doc["alive"] = true;
        String out;
        serializeJson(doc, out);
        return out;
    }

    void handleInfo() {
        addCorsHeaders();
        JsonDocument doc;
        JsonObject capabilities = doc.createNestedObject("capabilities");
        capabilities["hasLight"] = true; capabilities["hasCO2"] = true;
        capabilities["hasFan"] = true; capabilities["hasColorSpectrum"] = true; 
        doc["hw_id"] = _hwid; doc["model"] = DEVICE_MODEL;
        doc["fw_version"] = FW_VERSION; doc["schema_version"] = CURRENT_SCHEMA_VERSION;
        TankSettings& s = _settingsMgr.get();
        doc["deviceName"] = s.deviceName; doc["isAutoMode"] = s.isAutoMode;
        doc["currentBrightness"] = s.currentBrightness; doc["isLightOn"] = s.isLightOn;
        doc["isCO2On"] = s.isCO2On; doc["isFanOn"] = s.isFanOn; doc["isFanEnabled"] = s.isFanEnabled;
        String out; serializeJson(doc, out);
        _server.send(200, "application/json", out);
    }

    void handleControl() {
        addCorsHeaders();
        if (!_server.hasArg("plain")) { _server.send(400, "application/json", "{\"error\":\"Missing payload\"}"); return; }

        String rawPayload = _server.arg("plain");
        Serial.printf("\n[%s] 🌐 [LOCAL WIFI] Received Payload:\n%s\n", getLogTime().c_str(), rawPayload.c_str());

        JsonDocument doc;
        if (deserializeJson(doc, rawPayload)) { _server.send(400, "application/json", "{\"error\":\"Malformed JSON\"}"); return; }

        if (doc.containsKey("command")) {
            String cmd = doc["command"].as<String>();
            _server.send(200, "application/json", "{\"status\":\"executing\"}");
            delay(500);
            
            if (cmd == "factory_reset" || cmd == "forget_wifi") {
                Preferences p;
                p.begin("aqua-ctrl", false); p.clear(); p.end();
                p.begin("aqua-tracker", false); p.clear(); p.end();
                WiFi.disconnect(true, true);
                delay(500);
                ESP.restart();
            }
            return;
        }

        if (_settingsMgr.updateFromJson(doc.as<JsonObject>())) {
            _hwEngine.execute(_settingsMgr.get(), true, false);
            _lastCommandReceivedTime = millis();
            _needsCloudPush = true;
            _server.send(200, "application/json", generateQuickStateJson(false)); 
        } else {
            _server.send(400, "application/json", "{\"status\":\"rejected_version\"}");
        }
    }

    void handleHandshake() {
        addCorsHeaders();
        JsonDocument doc;
        doc["hw_id"] = _hwid; doc["session_token"] = "AQUA_SECURE_123"; 
        String out; serializeJson(doc, out);
        _server.send(200, "application/json", out);
    }

    void handleWifiProvisioning() {
        addCorsHeaders();
        if (_server.method() == HTTP_OPTIONS) { _server.send(204, "text/plain", ""); return; }
        if (!_server.hasArg("plain")) return;
        JsonDocument doc; if (deserializeJson(doc, _server.arg("plain"))) return;

        Preferences prefs;
        prefs.begin("aqua-ctrl", false);
        prefs.putString("ssid", doc["ssid"].as<String>());
        prefs.putString("pass", doc["pass"].as<String>());
        if (doc.containsKey("deviceName")) prefs.putString("devName", doc["deviceName"].as<String>());
        prefs.end();

        _server.send(200, "application/json", "{\"status\":\"rebooting\"}");
        delay(500); WiFi.disconnect(true, true); delay(500); ESP.restart();
    }

public:
    AquaNetworkManager(SettingsManager& sm, HardwareEngine& hw, String hwid) : _server(80), _settingsMgr(sm), _hwEngine(hw), _hwid(hwid) {}

    void begin() {
        _server.onNotFound([this]() { handlePreflight(); });
        _server.on("/info", HTTP_GET, [this]() { handleInfo(); });
        _server.on("/api/control", HTTP_POST, [this]() { handleControl(); });
        _server.on("/api/control", HTTP_OPTIONS, [this]() { handlePreflight(); }); 
        _server.on("/api/handshake", HTTP_GET, [this]() { handleHandshake(); });
        _server.on("/wifi", HTTP_POST, [this]() { handleWifiProvisioning(); });
        _server.on("/wifi", HTTP_OPTIONS, [this]() { handleWifiProvisioning(); });
        _server.begin();
    }

    void handleClient() { _server.handleClient(); }

    void syncFirebase() {
        unsigned long now = millis();
        if (WiFi.status() != WL_CONNECTED) return;

        WiFiClientSecure client;
        client.setInsecure();
        HTTPClient http;

        // 🔥 PHASE 4: BOOT SYNC (Fetch from Cloud on first connection)
        if (!_hasFetchedInitialConfig) {
            Serial.println("[SYS] 🔄 Performing Initial Boot Sync with Firebase...");
            http.begin(client, FIREBASE_URL + "/devices/" + _hwid + "/state.json");
            if (http.GET() == 200) {
                JsonDocument doc;
                deserializeJson(doc, http.getString());
                _settingsMgr.updateFromJson(doc.as<JsonObject>());
            }
            http.end();
            _hasFetchedInitialConfig = true;
            
            // Push our physical IP and reality back
            String stateUrl = FIREBASE_URL + "/devices/" + _hwid + "/state.json";
            http.begin(client, stateUrl);
            http.addHeader("Content-Type", "application/json");
            http.PATCH(generateQuickStateJson(true)); // True = Include IP
            http.end();
            return;
        }

        // 🔥 15-SECOND COMMAND POLL & OTA INTERCEPTOR
        if (now - _lastFirebasePull > 15000) {
            _lastFirebasePull = now;
            String cmdUrl = FIREBASE_URL + "/devices/" + _hwid + "/commands.json";
            http.begin(client, cmdUrl);
            
            if (http.GET() == 200) {
                String cmdPayload = http.getString();
                if (cmdPayload != "null" && cmdPayload != "") {
                    JsonDocument cmdDoc;
                    if (!deserializeJson(cmdDoc, cmdPayload)) {
                        
                        if (cmdDoc.containsKey("command")) {
                            String cmd = cmdDoc["command"].as<String>();
                            http.end(); 
                            
                            // Delete command to prevent infinite loops
                            http.begin(client, cmdUrl);
                            http.sendRequest("DELETE");
                            http.end();

                            // OTA RESCUE LOGIC
                            if (cmd == "execute_ota") {
                                String targetModel = cmdDoc["device_model"].as<String>();
                                String fwUrl = cmdDoc["firmware_url"].as<String>();
                                
                                if (targetModel == DEVICE_MODEL) {
                                    Serial.println("\n[OTA] 🚀 Initiating Firmware Download: " + fwUrl);
                                    WiFiClientSecure otaClient;
                                    otaClient.setInsecure();
                                    httpUpdate.rebootOnUpdate(false); 
                                    t_httpUpdate_return ret = httpUpdate.update(otaClient, fwUrl);
                                    
                                    if (ret == HTTP_UPDATE_OK) {
                                        Serial.println("[OTA] ✅ SUCCESS! Rebooting...");
                                        delay(1000); ESP.restart();
                                    } else {
                                        Serial.printf("[OTA] ❌ FAILED. Code: %d\n", httpUpdate.getLastError());
                                    }
                                }
                            } 
                            else if (cmd == "factory_reset" || cmd == "forget_wifi") {
                                Preferences p;
                                p.begin("aqua-ctrl", false); p.clear(); p.end();
                                p.begin("aqua-tracker", false); p.clear(); p.end();
                                WiFi.disconnect(true, true);
                                delay(500); ESP.restart();
                            }
                            return;
                        }

                        if (_settingsMgr.updateFromJson(cmdDoc.as<JsonObject>())) {
                            _lastCommandReceivedTime = millis();
                            _needsCloudPush = true;
                        }
                        http.end();
                        http.begin(client, cmdUrl);
                        http.sendRequest("DELETE"); 
                    }
                }
            }
            http.end();
        }

        // 🔥 PHASE 3: 1-MIN HEARTBEAT (Load Shedding Check)
        if (now - _lastHeartbeat > 60000) {
            _lastHeartbeat = now;
            http.begin(client, FIREBASE_URL + "/devices/" + _hwid + "/state.json");
            http.addHeader("Content-Type", "application/json");
            http.PATCH(generateHeartbeatJson());
            http.end();
        }

        // 🔥 PHASE 3: 30-MIN ANALYTICS PUSH
        if (now - _lastAnalyticsPush > 1800000) {
            _lastAnalyticsPush = now;
            http.begin(client, FIREBASE_URL + "/devices/" + _hwid + "/state.json");
            http.addHeader("Content-Type", "application/json");
            http.PATCH(generateAnalyticsJson());
            http.end();
        }

        // 🔥 PHASE 2: 5-SEC DEBOUNCED QUICK STATE (Buttons & Schedules)
        bool isButtonPush = _settingsMgr.isReadyForFirebaseSync();
        bool isDebouncedPush = (_needsCloudPush && (now - _lastCommandReceivedTime > 5000)) || isButtonPush; 
        
        if (isDebouncedPush) {
            http.begin(client, FIREBASE_URL + "/devices/" + _hwid + "/state.json");
            http.addHeader("Content-Type", "application/json");
            int response = http.PATCH(generateQuickStateJson(false));
            http.end();

            if (response > 0) {
                if (_needsCloudPush && (now - _lastCommandReceivedTime > 5000)) _needsCloudPush = false;
                if (isButtonPush) _settingsMgr.clearFirebaseSync(); 
            }
        }
    }
};
#endif