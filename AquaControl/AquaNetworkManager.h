#ifndef AQUA_NETWORK_MANAGER_H
#define AQUA_NETWORK_MANAGER_H

#include <WebServer.h>
#include <HTTPClient.h>
#include <WiFiClientSecure.h>
#include <HTTPUpdate.h> 
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
    
    TankSettings _shadow; 
    bool _shadowInit = false;
    WiFiClientSecure _client;

    // 🔥 OPTIMIZATION A: Initialize to a negative offset so the command fetch fires INSTANTLY on boot!
    unsigned long _lastFirebasePull = -15000; 
    unsigned long _lastHeartbeat = 0;
    unsigned long _lastAnalyticsPush = 0;
    unsigned long _lastCommandReceivedTime = 0;
    
    bool _hasFetchedInitialConfig = false;
    int _lastPushedDayOfYear = -1;

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
    
    String generateDeltaStateJson() {
        JsonDocument doc;
        TankSettings& s = _settingsMgr.get();
        int changes = 0;

        if (!_shadowInit) {
            doc["v"] = CURRENT_SCHEMA_VERSION;
            doc["localIP"] = WiFi.localIP().toString();
            doc["fw_version"] = FW_VERSION;
            doc["ota_staged"] = false;
            changes++;
        }

        if (!_shadowInit || s.isAutoMode != _shadow.isAutoMode) { doc["isAutoMode"] = s.isAutoMode; _shadow.isAutoMode = s.isAutoMode; changes++; }
        if (!_shadowInit || s.isLightOn != _shadow.isLightOn) { doc["isLightOn"] = s.isLightOn; _shadow.isLightOn = s.isLightOn; changes++; }
        if (!_shadowInit || s.isCO2On != _shadow.isCO2On) { doc["isCO2On"] = s.isCO2On; _shadow.isCO2On = s.isCO2On; changes++; }
        if (!_shadowInit || s.isFanOn != _shadow.isFanOn) { doc["isFanOn"] = s.isFanOn; _shadow.isFanOn = s.isFanOn; changes++; }
        if (!_shadowInit || s.isFanEnabled != _shadow.isFanEnabled) { doc["isFanEnabled"] = s.isFanEnabled; _shadow.isFanEnabled = s.isFanEnabled; changes++; }
        if (!_shadowInit || s.currentBrightness != _shadow.currentBrightness) { doc["currentBrightness"] = s.currentBrightness; _shadow.currentBrightness = s.currentBrightness; changes++; }
        if (!_shadowInit || s.photoperiod != _shadow.photoperiod) { doc["photoperiod"] = s.photoperiod; _shadow.photoperiod = s.photoperiod; changes++; }
        if (!_shadowInit || s.maxBrightness != _shadow.maxBrightness) { doc["maxBrightness"] = s.maxBrightness; _shadow.maxBrightness = s.maxBrightness; changes++; }
        if (!_shadowInit || s.isDimmerEnabled != _shadow.isDimmerEnabled) { doc["isDimmerEnabled"] = s.isDimmerEnabled; _shadow.isDimmerEnabled = s.isDimmerEnabled; changes++; }
        if (!_shadowInit || s.sunriseMins != _shadow.sunriseMins) { doc["sunriseMins"] = s.sunriseMins; _shadow.sunriseMins = s.sunriseMins; changes++; }
        if (!_shadowInit || s.sunsetMins != _shadow.sunsetMins) { doc["sunsetMins"] = s.sunsetMins; _shadow.sunsetMins = s.sunsetMins; changes++; }
        if (!_shadowInit || s.isCO2ScheduleSeparate != _shadow.isCO2ScheduleSeparate) { doc["isCO2ScheduleSeparate"] = s.isCO2ScheduleSeparate; _shadow.isCO2ScheduleSeparate = s.isCO2ScheduleSeparate; changes++; }
        if (!_shadowInit || s.recoveryMins != _shadow.recoveryMins) { doc["recoveryMins"] = s.recoveryMins; _shadow.recoveryMins = s.recoveryMins; changes++; }
        if (!_shadowInit || s.fanSpeed != _shadow.fanSpeed) { doc["fanSpeed"] = s.fanSpeed; _shadow.fanSpeed = s.fanSpeed; changes++; }
        if (!_shadowInit || s.totalLoadSheddingToday != _shadow.totalLoadSheddingToday) { doc["totalLoadSheddingToday"] = s.totalLoadSheddingToday; _shadow.totalLoadSheddingToday = s.totalLoadSheddingToday; changes++; }
        if (!_shadowInit || s.lightLoadSheddingToday != _shadow.lightLoadSheddingToday) { doc["lightLoadSheddingToday"] = s.lightLoadSheddingToday; _shadow.lightLoadSheddingToday = s.lightLoadSheddingToday; changes++; }
        if (!_shadowInit || String(s.outageEventsToday) != String(_shadow.outageEventsToday)) { doc["outagesToday"] = s.outageEventsToday; strlcpy(_shadow.outageEventsToday, s.outageEventsToday, sizeof(_shadow.outageEventsToday)); changes++; }

        if (!_shadowInit || s.colorW != _shadow.colorW) { doc["colorW"] = s.colorW; _shadow.colorW = s.colorW; changes++; }
        if (!_shadowInit || s.colorR != _shadow.colorR) { doc["colorR"] = s.colorR; _shadow.colorR = s.colorR; changes++; }
        if (!_shadowInit || s.colorG != _shadow.colorG) { doc["colorG"] = s.colorG; _shadow.colorG = s.colorG; changes++; }
        if (!_shadowInit || s.colorB != _shadow.colorB) { doc["colorB"] = s.colorB; _shadow.colorB = s.colorB; changes++; }

        if (!_shadowInit || String(s.deviceName) != String(_shadow.deviceName)) { doc["deviceName"] = s.deviceName; strlcpy(_shadow.deviceName, s.deviceName, sizeof(_shadow.deviceName)); changes++; }
        if (!_shadowInit || String(s.startTime) != String(_shadow.startTime)) { doc["startTime"] = s.startTime; strlcpy(_shadow.startTime, s.startTime, sizeof(_shadow.startTime)); changes++; }
        if (!_shadowInit || String(s.co2OnTime) != String(_shadow.co2OnTime)) { doc["co2OnTime"] = s.co2OnTime; strlcpy(_shadow.co2OnTime, s.co2OnTime, sizeof(_shadow.co2OnTime)); changes++; }
        if (!_shadowInit || String(s.co2OffTime) != String(_shadow.co2OffTime)) { doc["co2OffTime"] = s.co2OffTime; strlcpy(_shadow.co2OffTime, s.co2OffTime, sizeof(_shadow.co2OffTime)); changes++; }
        if (!_shadowInit || String(s.fanOnTime) != String(_shadow.fanOnTime)) { doc["fanOnTime"] = s.fanOnTime; strlcpy(_shadow.fanOnTime, s.fanOnTime, sizeof(_shadow.fanOnTime)); changes++; }
        if (!_shadowInit || String(s.fanOffTime) != String(_shadow.fanOffTime)) { doc["fanOffTime"] = s.fanOffTime; strlcpy(_shadow.fanOffTime, s.fanOffTime, sizeof(_shadow.fanOffTime)); changes++; }

        for(int i=0; i<24; i++) {
            if (!_shadowInit || s.activeMinutesToday[i] != _shadow.activeMinutesToday[i]) {
                doc["hourlyData/" + String(i)] = s.activeMinutesToday[i];
                _shadow.activeMinutesToday[i] = s.activeMinutesToday[i];
                changes++;
            }
            if (!_shadowInit || s.awakeMinutesToday[i] != _shadow.awakeMinutesToday[i]) {
                doc["awakeData/" + String(i)] = s.awakeMinutesToday[i];
                _shadow.awakeMinutesToday[i] = s.awakeMinutesToday[i];
                changes++;
            }
        }
        for(int i=0; i<30; i++) {
            if (!_shadowInit || s.activeMinutesHistory[i] != _shadow.activeMinutesHistory[i]) {
                doc["dailyData/" + String(i)] = s.activeMinutesHistory[i];
                _shadow.activeMinutesHistory[i] = s.activeMinutesHistory[i];
                changes++;
            }
            if (!_shadowInit || s.awakeMinutesHistory[i] != _shadow.awakeMinutesHistory[i]) {
                doc["dailyAwakeData/" + String(i)] = s.awakeMinutesHistory[i];
                _shadow.awakeMinutesHistory[i] = s.awakeMinutesHistory[i];
                changes++;
            }
            if (!_shadowInit || s.lightLostHistory[i] != _shadow.lightLostHistory[i]) {
                doc["dailyLostLightData/" + String(i)] = s.lightLostHistory[i];
                _shadow.lightLostHistory[i] = s.lightLostHistory[i];
                changes++;
            }
        }

        if (changes == 0 && _shadowInit) return ""; 

        _shadowInit = true;
        String out;
        serializeJson(doc, out);
        return out;
    }

    String generateHeartbeatJson() {
        JsonDocument doc;
        TankSettings& s = _settingsMgr.get(); 
        
        doc["lastHeartbeatTs"] = time(nullptr);
        doc["alive"] = true;

        int liveMins = 0;
        for(int i=0; i<24; i++) liveMins += s.activeMinutesToday[i];
        doc["liveActiveMins"] = liveMins;

        String out;
        serializeJson(doc, out);
        return out;
    }

    void handleInfo() {
        addCorsHeaders();
        JsonDocument doc;
        JsonObject capabilities = doc["capabilities"].to<JsonObject>();
        capabilities["hasLight"] = true; capabilities["hasCO2"] = true; 
        capabilities["hasFan"] = true; capabilities["hasColorSpectrum"] = true; 
        doc["hw_id"] = _hwid; doc["model"] = DEVICE_MODEL;
        doc["fw_version"] = FW_VERSION; doc["schema_version"] = CURRENT_SCHEMA_VERSION;
        TankSettings& s = _settingsMgr.get();
        doc["deviceName"] = s.deviceName; doc["isAutoMode"] = s.isAutoMode;
        doc["currentBrightness"] = s.currentBrightness; doc["isLightOn"] = s.isLightOn;
        doc["isCO2On"] = s.isCO2On; doc["isFanOn"] = s.isFanOn; doc["isFanEnabled"] = s.isFanEnabled;
        
        // FULL STATE SYNCHRONIZATION
        doc["startTime"] = s.startTime; doc["photoperiod"] = s.photoperiod;
        doc["maxBrightness"] = s.maxBrightness; doc["isDimmerEnabled"] = s.isDimmerEnabled;
        doc["sunriseMins"] = s.sunriseMins; doc["sunsetMins"] = s.sunsetMins;
        doc["recoveryMins"] = s.recoveryMins; doc["isCO2ScheduleSeparate"] = s.isCO2ScheduleSeparate;
        doc["co2OnTime"] = s.co2OnTime; doc["co2OffTime"] = s.co2OffTime;
        doc["fanOnTime"] = s.fanOnTime; doc["fanOffTime"] = s.fanOffTime;
        doc["fanSpeed"] = s.fanSpeed;
        doc["colorW"] = s.colorW; doc["colorR"] = s.colorR; doc["colorG"] = s.colorG; doc["colorB"] = s.colorB;

        String out; serializeJson(doc, out);
        _server.send(200, "application/json", out);
    }

    void handleControl() {
        addCorsHeaders();
        if (!_server.hasArg("plain")) { _server.send(400, "application/json", "{\"error\":\"Missing payload\"}"); return; }

        String rawPayload = _server.arg("plain");
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
            if (cmd == "reboot") {
                delay(1000);
                ESP.restart();
            }
            return;
        }

        if (_settingsMgr.updateFromJson(doc.as<JsonObject>())) {
            _hwEngine.execute(_settingsMgr.get(), true, false);
            _lastCommandReceivedTime = millis();
            _lastFirebasePull = millis(); // 🔥 LOCAL API PRIORITY: Suspend Firebase polling for 15s to keep local Wi-Fi hyper-fast
            _server.send(200, "application/json", "{\"status\":\"success\"}"); 
        } else {
            _server.send(400, "application/json", "{\"status\":\"rejected_version\"}");
        }
    }

    void handleHandshake() {
        addCorsHeaders();
        JsonDocument doc;
        doc["hw_id"] = _hwid;
        String out; serializeJson(doc, out);
        _server.send(200, "application/json", out);
    }

    void handleWifiProvisioning() {
        addCorsHeaders();
        if (_server.method() == HTTP_OPTIONS) { _server.send(204, "text/plain", ""); return; }
        if (!_server.hasArg("plain")) return;
        JsonDocument doc; if (deserializeJson(doc, _server.arg("plain"))) return;

        String ssid = doc["ssid"].as<String>();
        String pass = doc["pass"].as<String>();
        if (ssid.length() == 0 || ssid.length() > 32 || pass.length() > 64) {
            _server.send(400, "application/json", "{\"error\":\"Invalid credentials\"}");
            return;
        }

        Preferences prefs;
        prefs.begin("aqua-ctrl", false);
        prefs.putString("ssid", ssid);
        prefs.putString("pass", pass);
        if (doc.containsKey("deviceName")) prefs.putString("devName", doc["deviceName"].as<String>());
        prefs.end();

        _server.send(200, "application/json", "{\"status\":\"rebooting\"}");
        delay(500); WiFi.disconnect(true, true); delay(500); ESP.restart();
    }

public:
    AquaNetworkManager(SettingsManager& sm, HardwareEngine& hw, String hwid) : _server(80), _settingsMgr(sm), _hwEngine(hw), _hwid(hwid) {}

    void begin() {
        _client.setInsecure(); // 🔥 Prevent heap fragmentation by allocating SSL buffers on a persistent member

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

        HTTPClient http;

        if (!_hasFetchedInitialConfig) {
            bool offlineChangesExist = _settingsMgr.needsFirebaseSync();
            WiFi.setTxPower(WIFI_POWER_19_5dBm); // 🔥 BOOST POWER for Firebase
            http.begin(_client, FIREBASE_URL + "/devices/" + _hwid + "/state.json");
            
            if (http.GET() == 200) {
                if (!offlineChangesExist) {
                    JsonDocument doc;
                    deserializeJson(doc, http.getString());
                    _settingsMgr.updateFromJson(doc.as<JsonObject>());
                    _settingsMgr.clearFirebaseSync(); 
                }
            }
            http.end();
            WiFi.setTxPower(WIFI_POWER_8_5dBm); // 🔥 DROP POWER to stay cool
            _hasFetchedInitialConfig = true;
            _shadowInit = false; 
        }

        if (now - _lastFirebasePull > 15000) {
            _lastFirebasePull = now;
            String cmdUrl = FIREBASE_URL + "/devices/" + _hwid + "/commands.json";
            WiFi.setTxPower(WIFI_POWER_19_5dBm); // 🔥 BOOST POWER for Firebase
            http.begin(_client, cmdUrl);
            
            int httpCode = http.GET();
            if (httpCode == 200) {
                String cmdPayload = http.getString();
                http.end(); 
                
                if (cmdPayload != "null" && cmdPayload != "") {
                    JsonDocument cmdDoc;
                    DeserializationError error = deserializeJson(cmdDoc, cmdPayload);
                    bool shouldDeleteCommand = true;
                    
                    if (!error) {
                        if (cmdDoc.containsKey("ota_staged") && cmdDoc["ota_staged"].as<bool>() == false) {
                            http.begin(_client, FIREBASE_URL + "/devices/" + _hwid + "/state.json");
                            http.addHeader("Content-Type", "application/json");
                            int pCode = http.PATCH("{\"ota_staged\": false}");
                            if (pCode > 0) http.getString();
                            http.end();
                        }
                        if (cmdDoc.containsKey("command")) {
                            String cmd = cmdDoc["command"].as<String>();

                            if (cmd == "download_ota") {
                                String targetModel = cmdDoc["device_model"].as<String>();
                                String version = cmdDoc["version"].as<String>();

                                if (targetModel.isEmpty() || version.isEmpty()) { shouldDeleteCommand = false; return; }

                                if (targetModel == DEVICE_MODEL) {
                                    String fullDownloadUrl = "https://raw.githubusercontent.com/nafishfuad/AquaSync/main/firmware/" + targetModel + "_" + version + ".bin";
                                    httpUpdate.rebootOnUpdate(false); 
                                    if (httpUpdate.update(_client, fullDownloadUrl) == HTTP_UPDATE_OK) {
                                        http.begin(_client, FIREBASE_URL + "/devices/" + _hwid + "/state.json");
                                        http.addHeader("Content-Type", "application/json");
                                        int pCode = http.PATCH("{\"ota_staged\": true}");
                                        if (pCode > 0) http.getString();
                                        http.end();
                                    } else {
                                        shouldDeleteCommand = false;
                                    }
                                }
                            }

                            if (shouldDeleteCommand) {
                                http.begin(_client, cmdUrl);
                                int delCode = http.sendRequest("DELETE");
                                if (delCode > 0) http.getString();
                                http.end();
                            }

                            if (cmd == "factory_reset" || cmd == "forget_wifi") {
                                Preferences p;
                                p.begin("aqua-ctrl", false); p.clear(); p.end();
                                p.begin("aqua-tracker", false); p.clear(); p.end();
                                WiFi.disconnect(true, true);
                                delay(500);
                                ESP.restart();
                            }
                            
                            if (cmd == "reboot") {
                                delay(1000);
                                ESP.restart();
                            }

                            return;
                        }

                        if (_settingsMgr.updateFromJson(cmdDoc.as<JsonObject>())) {
                            _lastCommandReceivedTime = millis();
                            _settingsMgr.triggerLazySave(); // 🔥 FORCE HARDWARE TO APPLY INSTANTLY
                        }
                    }

                    if (shouldDeleteCommand) {
                        http.begin(_client, cmdUrl);
                        int delCode = http.sendRequest("DELETE");
                        if (delCode > 0) http.getString();
                        http.end();
                    }
                }
            } else {
                http.end();
            }
            WiFi.setTxPower(WIFI_POWER_8_5dBm); // 🔥 DROP POWER to stay cool
        }

        if (now - _lastHeartbeat > 60000) {
            _lastHeartbeat = now;
            WiFi.setTxPower(WIFI_POWER_19_5dBm); // 🔥 BOOST POWER for Firebase
            http.begin(_client, FIREBASE_URL + "/devices/" + _hwid + "/state.json");
            http.addHeader("Content-Type", "application/json");
            int hbCode = http.PATCH(generateHeartbeatJson());
            if (hbCode > 0) http.getString();
            http.end();
            WiFi.setTxPower(WIFI_POWER_8_5dBm); // 🔥 DROP POWER to stay cool
        }

        bool isDebouncedPush = (_settingsMgr.needsFirebaseSync() && (now - _lastCommandReceivedTime > 5000)); 
        bool isHourlyPush = (now - _lastAnalyticsPush > 3600000);

        TankSettings& s = _settingsMgr.get();

        bool isAutonomousChange = _shadowInit && (
            s.isLightOn != _shadow.isLightOn ||
            s.isCO2On != _shadow.isCO2On ||
            s.isFanOn != _shadow.isFanOn ||
            s.currentBrightness != _shadow.currentBrightness
        );

        bool isRolloverPush = false;
        time_t nowTime = time(nullptr);
        struct tm* timeinfo = localtime(&nowTime);
        if (timeinfo->tm_year >= 120) {
            int currentDayOfYear = timeinfo->tm_yday;
            if (_lastPushedDayOfYear != -1 && currentDayOfYear != _lastPushedDayOfYear) {
                isRolloverPush = true; 
            }
            _lastPushedDayOfYear = currentDayOfYear;
        }

        if (!_shadowInit || isDebouncedPush || isHourlyPush || isAutonomousChange || isRolloverPush) {
            TankSettings backupShadow = _shadow; 
            String deltaJson = generateDeltaStateJson();

            if (deltaJson != "") {
                WiFi.setTxPower(WIFI_POWER_19_5dBm); // 🔥 BOOST POWER for Firebase
                http.begin(_client, FIREBASE_URL + "/devices/" + _hwid + "/state.json");
                http.addHeader("Content-Type", "application/json");
                int response = http.PATCH(deltaJson);
                http.end();
                WiFi.setTxPower(WIFI_POWER_8_5dBm); // 🔥 DROP POWER to stay cool

                if (response >= 200 && response < 300) {
                    if (isDebouncedPush) _settingsMgr.clearFirebaseSync(); 
                    if (isHourlyPush) _lastAnalyticsPush = now;
                } else {
                    _shadow = backupShadow; 
                }
            } else {
                if (isDebouncedPush) _settingsMgr.clearFirebaseSync();
                if (isHourlyPush) _lastAnalyticsPush = now;
            }
        }
    }
};
#endif