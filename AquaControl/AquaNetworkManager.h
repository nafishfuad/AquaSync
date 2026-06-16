#ifndef AQUA_NETWORK_MANAGER_H
#define AQUA_NETWORK_MANAGER_H

#include <WebServer.h>
#include <WiFiClientSecure.h>   
#include <HTTPClient.h>
#include <HTTPUpdate.h>         
#include <Firebase_ESP_Client.h>
#include <addons/TokenHelper.h>
#include <addons/RTDBHelper.h>
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
    
    FirebaseData _fbdo;
    FirebaseData _streamFbdo;
    FirebaseAuth _auth;
    FirebaseConfig _config;

    TankSettings _shadow; 
    bool _shadowInit = false;
    bool _firebaseReady = false;
    unsigned long _lastHeartbeat = 0;

    void addCorsHeaders() {
        _server.sendHeader("Access-Control-Allow-Origin", "*");
        _server.sendHeader("Access-Control-Allow-Methods", "POST, GET, OPTIONS, PATCH, DELETE, PUT");
        _server.sendHeader("Access-Control-Allow-Headers", "Content-Type");
    }

    void handlePreflight() {
        addCorsHeaders();
        _server.send(204, "text/plain", "");
    }
    
    String generateTelemetryJson() {
        JsonDocument doc;
        TankSettings& s = _settingsMgr.get();

        doc["v"] = CURRENT_SCHEMA_VERSION;
        doc["localIP"] = WiFi.localIP().toString();
        doc["fw_version"] = FW_VERSION;
        doc["alive"] = true;
        doc["lastHeartbeatTs"] = time(nullptr);
        doc["isLightOn"] = s.isLightOn;
        doc["isCO2On"] = s.isCO2On;
        doc["isFanOn"] = s.isFanOn;
        doc["currentBrightness"] = s.currentBrightness;

        int liveMins = 0;
        for(int i=0; i<24; i++) {
            liveMins += s.activeMinutesToday[i];
            doc["hourlyData/" + String(i)] = s.activeMinutesToday[i];
            doc["awakeData/" + String(i)] = s.awakeMinutesToday[i];
        }
        
        doc["liveActiveMins"] = liveMins;
        doc["totalLoadSheddingToday"] = s.totalLoadSheddingToday;
        doc["lightLoadSheddingToday"] = s.lightLoadSheddingToday;

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
        String out; serializeJson(doc, out);
        _server.send(200, "application/json", out);
    }

    void handleControl() {
        addCorsHeaders();
        if (!_server.hasArg("plain")) { _server.send(400, "application/json", "{\"error\":\"Missing payload\"}"); return; }

        String rawPayload = _server.arg("plain");
        JsonDocument doc;
        if (deserializeJson(doc, rawPayload)) { _server.send(400, "application/json", "{\"error\":\"Malformed JSON\"}"); return; }

        if (_settingsMgr.updateFromJson(doc.as<JsonObject>())) {
            applyOverrides(doc);
            _server.send(200, "application/json", "{\"status\":\"success\"}"); 
        } else {
            _server.send(400, "application/json", "{\"status\":\"rejected_version\"}");
        }
    }

    void handleHandshake() {
        addCorsHeaders();
        JsonDocument doc;
        doc["hw_id"] = _hwid; 
        doc["session_token"] = "AQUA_SECURE_123"; 
        doc["model"] = DEVICE_MODEL; 
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

    void applyOverrides(JsonDocument& doc) {
        if (doc.containsKey("isAutoMode") && doc["isAutoMode"].as<bool>() == true) _hwEngine.forceResumeAuto();
        if (doc.containsKey("isLightOn")) {
            bool turnedOn = doc["isLightOn"].as<bool>();
            _hwEngine.applyManualOverride("LIGHT", turnedOn);
            if (turnedOn && _settingsMgr.get().currentBrightness == 0) _settingsMgr.get().currentBrightness = _settingsMgr.get().maxBrightness;
        }
        if (doc.containsKey("currentBrightness")) _hwEngine.applyManualOverride("LIGHT", true);
        if (doc.containsKey("isCO2On")) _hwEngine.applyManualOverride("CO2", doc["isCO2On"].as<bool>());
        if (doc.containsKey("isFanOn")) _hwEngine.applyManualOverride("FAN", doc["isFanOn"].as<bool>());
        
        _hwEngine.execute(_settingsMgr.get(), true, false);
    }

    void executeSystemCommand(String cmd, JsonDocument& doc) {
        if (cmd == "factory_reset") {
            Preferences p; p.begin("aqua-ctrl", false); p.clear(); p.end();
            p.begin("aqua-tracker", false); p.clear(); p.end();
            WiFi.disconnect(true, true); delay(500); ESP.restart();
        }
        if (cmd == "reboot") { delay(1000); ESP.restart(); }

        if (cmd == "download_ota") {
            String targetModel = doc["device_model"].as<String>();
            String version = doc["version"].as<String>(); 
            
            Firebase.RTDB.deleteNode(&_fbdo, "/devices/" + _hwid + "/config/device_model");
            Firebase.RTDB.deleteNode(&_fbdo, "/devices/" + _hwid + "/config/version");
            
            if (targetModel == DEVICE_MODEL) {
                String fullDownloadUrl = "https://raw.githubusercontent.com/nafishfuad/AquaSync/main/firmware/" + targetModel + "_" + version + ".bin";
                WiFiClientSecure otaClient; otaClient.setInsecure();
                httpUpdate.rebootOnUpdate(false); 
                if (httpUpdate.update(otaClient, fullDownloadUrl) == HTTP_UPDATE_OK) {
                    WiFiClientSecure client; client.setInsecure(); HTTPClient http;
                    http.begin(client, FIREBASE_URL + "/devices/" + _hwid + "/telemetry.json");
                    http.addHeader("Content-Type", "application/json");
                    http.PATCH("{\"ota_staged\": true}");
                    http.end();
                }
            }
        }
    }

    void handleStreamEvent() {
        String path = _streamFbdo.dataPath();
        String type = _streamFbdo.dataType();

        if (type == "json") {
            JsonDocument doc;
            deserializeJson(doc, _streamFbdo.jsonString());

            if (doc.containsKey("command")) {
                String cmd = doc["command"].as<String>();
                Firebase.RTDB.deleteNode(&_fbdo, "/devices/" + _hwid + "/config/command");
                executeSystemCommand(cmd, doc);
                return;
            }

            if (_settingsMgr.updateFromJson(doc.as<JsonObject>())) applyOverrides(doc);
            
        } else {
            String key = path.substring(1); 
            if (key == "command" && type == "string") {
                String cmd = _streamFbdo.stringData();
                Firebase.RTDB.deleteNode(&_fbdo, "/devices/" + _hwid + "/config/command");
                JsonDocument emptyDoc;
                executeSystemCommand(cmd, emptyDoc);
                return;
            }

            JsonDocument doc;
            if (type == "boolean") doc[key] = _streamFbdo.boolData();
            else if (type == "int") doc[key] = _streamFbdo.intData();
            else if (type == "float") doc[key] = _streamFbdo.floatData();
            else if (type == "string") doc[key] = _streamFbdo.stringData();
            
            if (_settingsMgr.updateFromJson(doc.as<JsonObject>())) applyOverrides(doc);
        }
    }

public:
    AquaNetworkManager(SettingsManager& sm, HardwareEngine& hw, String hwid) : _server(80), _settingsMgr(sm), _hwEngine(hw), _hwid(hwid) {}

    void begin() {
        _server.onNotFound([this]() { handlePreflight(); });
        _server.on("/info", HTTP_GET, [this]() { handleInfo(); });
        _server.on("/api/handshake", HTTP_GET, [this]() { handleHandshake(); });
        _server.on("/api/handshake", HTTP_OPTIONS, [this]() { handlePreflight(); });
        _server.on("/wifi", HTTP_POST, [this]() { handleWifiProvisioning(); });
        _server.on("/wifi", HTTP_OPTIONS, [this]() { handlePreflight(); });
        _server.on("/api/control", HTTP_POST, [this]() { handleControl(); });
        _server.on("/api/control", HTTP_OPTIONS, [this]() { handlePreflight(); }); 
        _server.begin();

        // 🔥 THE FIX: ONLY start Firebase if we are actually connected to the Internet!
        if (WiFi.status() == WL_CONNECTED) {
            _config.database_url = FIREBASE_URL;
            Firebase.reconnectWiFi(true);
            Firebase.begin(&_config, &_auth);

            if (Firebase.RTDB.beginStream(&_streamFbdo, "/devices/" + _hwid + "/config")) {
                Serial.println("[FIREBASE] 📡 Real-Time Stream connected to /config");
            }
            _firebaseReady = true;
        } else {
            Serial.println("[FIREBASE] ⚠️ Offline Mode (Hotspot). Cloud stream disabled to preserve CPU.");
        }
    }

    void handleClient() { _server.handleClient(); }

    void syncFirebase() {
        // 🔥 THE FIX: Immediately abort Firebase operations if we drop offline
        if (WiFi.status() != WL_CONNECTED || !_firebaseReady || !Firebase.ready()) return;

        if (Firebase.RTDB.readStream(&_streamFbdo)) {
            if (_streamFbdo.streamAvailable()) handleStreamEvent();
        }

        unsigned long now = millis();
        TankSettings& s = _settingsMgr.get();
        bool needsHeartbeat = (now - _lastHeartbeat > 60000);
        bool isAutonomousChange = _shadowInit && (
            s.isLightOn != _shadow.isLightOn || s.isCO2On != _shadow.isCO2On ||
            s.isFanOn != _shadow.isFanOn || s.currentBrightness != _shadow.currentBrightness
        );

        if (_hwEngine.snapshot.pending || !_shadowInit || isAutonomousChange || needsHeartbeat) {
            WiFiClientSecure client; client.setInsecure(); HTTPClient http;

            if (_hwEngine.snapshot.pending) {
                JsonDocument doc;
                int totalAct = 0, totalAwk = 0;
                for(int i=0; i<24; i++) {
                    doc["hourlyData/" + String(i)] = _hwEngine.snapshot.activeMinutes[i];
                    doc["awakeData/" + String(i)] = _hwEngine.snapshot.awakeMinutes[i];
                    totalAct += _hwEngine.snapshot.activeMinutes[i];
                    totalAwk += _hwEngine.snapshot.awakeMinutes[i];
                }
                doc["totalActiveMins"] = totalAct; doc["totalAwakeMins"] = totalAwk;
                doc["totalLoadShedding"] = _hwEngine.snapshot.totalLS; doc["lightLoadShedding"] = _hwEngine.snapshot.lightLS;

                String out; serializeJson(doc, out);
                char dateStr[16]; sprintf(dateStr, "%04d-%02d-%02d", _hwEngine.snapshot.year, _hwEngine.snapshot.month, _hwEngine.snapshot.day);

                http.begin(client, FIREBASE_URL + "/devices/" + _hwid + "/analytics/" + String(dateStr) + ".json");
                http.addHeader("Content-Type", "application/json");
                if (http.PATCH(out) > 0) _hwEngine.snapshot.pending = false; 
                http.end();
            }
            
            if (!_shadowInit || isAutonomousChange || needsHeartbeat) {
                String telemetryJson = generateTelemetryJson();
                if (telemetryJson != "") {
                    http.begin(client, FIREBASE_URL + "/devices/" + _hwid + "/telemetry.json");
                    http.addHeader("Content-Type", "application/json");
                    if (http.PATCH(telemetryJson) > 0) {
                        _shadow = s;
                        _shadowInit = true;
                        _lastHeartbeat = now;
                    }
                    http.end();
                }
            }
        }
    }
};
#endif