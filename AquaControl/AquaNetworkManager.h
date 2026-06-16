#ifndef AQUA_NETWORK_MANAGER_H
#define AQUA_NETWORK_MANAGER_H

#include <WebServer.h>
#include <WiFiClientSecure.h>   
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
            _server.send(200, "application/json", "{\"status\":\"success\"}"); 
        } else {
            _server.send(400, "application/json", "{\"status\":\"rejected_version\"}");
        }
    }

    // 🔥 THE FIX: Restored the Missing Pairing Wizard APIs
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

    void handleStreamEvent() {
        if (_streamFbdo.dataTypeEnum() == firebase_rtdb_data_type_json) {
            JsonDocument doc;
            deserializeJson(doc, _streamFbdo.jsonString());

            if (doc.containsKey("command")) {
                String cmd = doc["command"].as<String>();
                Firebase.RTDB.deleteNode(&_fbdo, "/devices/" + _hwid + "/config/command");

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
                        WiFiClientSecure otaClient;
                        otaClient.setInsecure();
                        httpUpdate.rebootOnUpdate(false); 
                        if (httpUpdate.update(otaClient, fullDownloadUrl) == HTTP_UPDATE_OK) {
                            Firebase.RTDB.setBool(&_fbdo, "/devices/" + _hwid + "/telemetry/ota_staged", true);
                        }
                    }
                }
                return;
            }

            if (doc.containsKey("ota_staged") && doc["ota_staged"].as<bool>() == false) {
                Firebase.RTDB.deleteNode(&_fbdo, "/devices/" + _hwid + "/config/ota_staged");
                Firebase.RTDB.setBool(&_fbdo, "/devices/" + _hwid + "/telemetry/ota_staged", false);
                return;
            }

            if (_settingsMgr.updateFromJson(doc.as<JsonObject>())) {
                if (doc.containsKey("isAutoMode") && doc["isAutoMode"].as<bool>() == true) _hwEngine.forceResumeAuto();
                if (doc.containsKey("isLightOn")) {
                    bool turnedOn = doc["isLightOn"].as<bool>();
                    _hwEngine.applyManualOverride("LIGHT", turnedOn);
                    if (turnedOn && _settingsMgr.get().currentBrightness == 0) _settingsMgr.get().currentBrightness = _settingsMgr.get().maxBrightness;
                }
                if (doc.containsKey("currentBrightness")) _hwEngine.applyManualOverride("LIGHT", true);
                if (doc.containsKey("isCO2On")) _hwEngine.applyManualOverride("CO2", doc["isCO2On"].as<bool>());
                if (doc.containsKey("isFanOn")) _hwEngine.applyManualOverride("FAN", doc["isFanOn"].as<bool>());
            }
        }
    }

public:
    AquaNetworkManager(SettingsManager& sm, HardwareEngine& hw, String hwid) : _server(80), _settingsMgr(sm), _hwEngine(hw), _hwid(hwid) {}

    void begin() {
        _server.onNotFound([this]() { handlePreflight(); });
        _server.on("/info", HTTP_GET, [this]() { handleInfo(); });
        
        // 🔥 THE FIX: Restored the Hotspot Wizard APIs Routes
        _server.on("/api/handshake", HTTP_GET, [this]() { handleHandshake(); });
        _server.on("/api/handshake", HTTP_OPTIONS, [this]() { handlePreflight(); });
        _server.on("/wifi", HTTP_POST, [this]() { handleWifiProvisioning(); });
        _server.on("/wifi", HTTP_OPTIONS, [this]() { handlePreflight(); });

        _server.on("/api/control", HTTP_POST, [this]() { handleControl(); });
        _server.on("/api/control", HTTP_OPTIONS, [this]() { handlePreflight(); }); 
        _server.begin();

        _config.database_url = FIREBASE_URL;
        _config.signer.test_mode = true; 
        Firebase.reconnectWiFi(true);
        Firebase.begin(&_config, &_auth);

        if (Firebase.RTDB.beginStream(&_streamFbdo, "/devices/" + _hwid + "/config")) {
            Serial.println("[FIREBASE] 📡 Real-Time Stream connected to /config");
        }
        _firebaseReady = true;
    }

    void handleClient() { _server.handleClient(); }

    void syncFirebase() {
        if (!_firebaseReady || !Firebase.ready()) return;

        if (Firebase.RTDB.readStream(&_streamFbdo)) {
            if (_streamFbdo.streamAvailable()) {
                handleStreamEvent();
            }
        }

        unsigned long now = millis();
        TankSettings& s = _settingsMgr.get();
        
        if (_hwEngine.snapshot.pending) {
            JsonDocument doc;
            int totalAct = 0, totalAwk = 0;
            for(int i=0; i<24; i++) {
                doc["hourlyData/" + String(i)] = _hwEngine.snapshot.activeMinutes[i];
                doc["awakeData/" + String(i)] = _hwEngine.snapshot.awakeMinutes[i];
                totalAct += _hwEngine.snapshot.activeMinutes[i];
                totalAwk += _hwEngine.snapshot.awakeMinutes[i];
            }
            doc["totalActiveMins"] = totalAct;
            doc["totalAwakeMins"] = totalAwk;
            doc["totalLoadShedding"] = _hwEngine.snapshot.totalLS;
            doc["lightLoadShedding"] = _hwEngine.snapshot.lightLS;

            char dateStr[16];
            sprintf(dateStr, "%04d-%02d-%02d", _hwEngine.snapshot.year, _hwEngine.snapshot.month, _hwEngine.snapshot.day);

            String out; serializeJson(doc, out);
            FirebaseJson fbSnapshot;
            fbSnapshot.setJsonData(out);

            if (Firebase.RTDB.updateNodeSilent(&_fbdo, "/devices/" + _hwid + "/analytics/" + String(dateStr), &fbSnapshot)) {
                Serial.println("[FIREBASE] 📈 Successfully pushed Midnight Snapshot to Analytics Vault!");
                _hwEngine.snapshot.pending = false; 
            }
        }
        
        bool needsHeartbeat = (now - _lastHeartbeat > 60000);
        
        bool isAutonomousChange = _shadowInit && (
            s.isLightOn != _shadow.isLightOn ||
            s.isCO2On != _shadow.isCO2On ||
            s.isFanOn != _shadow.isFanOn ||
            s.currentBrightness != _shadow.currentBrightness
        );

        if (!_shadowInit || isAutonomousChange || needsHeartbeat) {
            String telemetryJson = generateTelemetryJson();
            if (telemetryJson != "") {
                FirebaseJson fbTelemetry;
                fbTelemetry.setJsonData(telemetryJson);
                
                if (Firebase.RTDB.updateNodeSilent(&_fbdo, "/devices/" + _hwid + "/telemetry", &fbTelemetry)) {
                    _shadow = s;
                    _shadowInit = true;
                    _lastHeartbeat = now;
                }
            }
        }
    }
};
#endif