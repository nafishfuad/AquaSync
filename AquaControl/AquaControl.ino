#include <Arduino.h>
#include <WiFi.h>
#include <Preferences.h>
#include <HTTPClient.h>         
#include <WiFiClientSecure.h>   
#include <Firebase_ESP_Client.h> 

#include "CoreConfig.h"
#include "SettingsManager.h"
#include "HardwareEngine.h"
#include "ButtonManager.h"
#include "AquaNetworkManager.h" 
#include "OutageTracker.h" 

SettingsManager settingsMgr;
HardwareEngine  hwEngine;
ButtonManager   btnManager(settingsMgr, hwEngine);
AquaNetworkManager* netManager; 
OutageTracker outageTracker(settingsMgr, hwEngine); 

String hwid;
TaskHandle_t NetworkTaskHandle;

String generateSecureHWID() {
    Preferences prefs;
    prefs.begin("aqua-ctrl", false);
    String hwid = prefs.getString("secure_hwid", "");
    if (hwid == "") {
        String mac = WiFi.macAddress();
        mac.replace(":", ""); 
        const char charset[] = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
        String salt = "";
        for (int i = 0; i < 6; i++) {
            uint32_t randomIndex = esp_random() % 62; 
            salt += charset[randomIndex];
        }
        hwid = "AQUA" + mac + salt;
        prefs.putString("secure_hwid", hwid);
        Serial.println("[SYS] Generated New Secure HWID: " + hwid);
    }
    prefs.end();
    return hwid;
}

void networkTask(void * parameter) {
    bool autopsyCompleted = false;

    for(;;) {
        if (netManager != nullptr) {
            netManager->handleClient();
            netManager->syncFirebase(); 
        }
        
        // 🔥 FIX 1: Use safe HTTP Client for Autopsy to bypass token deadlocks
        if (!autopsyCompleted && WiFi.status() == WL_CONNECTED) {
            time_t nowTs = time(nullptr);
            if (nowTs > 1600000000) { 
                WiFiClientSecure client;
                client.setInsecure();
                HTTPClient http;
                
                Serial.println("[AUTOPSY] Fetching last known heartbeat from Cloud...");
                http.begin(client, FIREBASE_URL + "/devices/" + hwid + "/telemetry/lastHeartbeatTs.json");
                int httpCode = http.GET();
                
                if (httpCode == 200) {
                    String payload = http.getString();
                    uint32_t cloudTs = payload.toInt();
                    outageTracker.performCloudAutopsy(cloudTs);
                } else {
                    Serial.println("[AUTOPSY] Cloud fetch failed or clean boot.");
                }
                http.end();
                autopsyCompleted = true; 
            }
        }

        vTaskDelay(pdMS_TO_TICKS(50)); 
    }
}

void setup() {
    Serial.begin(115200);
    Serial.setTxTimeoutMs(0); 
    delay(5000); 

    Serial.println("\n\n=================================");
    Serial.println("🌊 AquaSync RTOS Booting...");
    Serial.println("=================================");

    WiFi.disconnect(true);
    delay(500);

    uint64_t chipid = ESP.getEfuseMac(); 
    uint16_t chip = (uint16_t)(chipid >> 32);
    char hwidStr[25];
    snprintf(hwidStr, sizeof(hwidStr), "AQUA-%04X%08X", chip, (uint32_t)chipid);
    
    hwid = String(hwidStr);
    hwid.toUpperCase();
    Serial.println("[SYS] Using Device ID: " + hwid);

    settingsMgr.begin();
    hwEngine.begin();
    netManager = new AquaNetworkManager(settingsMgr, hwEngine, hwid);

    Preferences prefs;
    prefs.begin("aqua-ctrl", false);
    String ssid = prefs.getString("ssid", "");
    String pass = prefs.getString("pass", "");
    prefs.end();

    if (ssid != "") {
        Serial.println("[WIFI] Attempting to connect to: " + ssid);
        WiFi.mode(WIFI_STA);
        WiFi.begin(ssid.c_str(), pass.c_str());

        int timeout = 0;
        while (WiFi.status() != WL_CONNECTED && timeout < 20) {
            delay(500);
            Serial.print(".");
            timeout++;
        }
        Serial.println();

        if (WiFi.status() == WL_CONNECTED) {
            Serial.println("[WIFI] ✅ Connected to Home Network. IP: " + WiFi.localIP().toString());
            Serial.println("[SYS] 🕒 Syncing NTP Time (UTC+6)...");
            configTime(6 * 3600, 0, "pool.ntp.org"); 
        } else {
            Serial.println("[WIFI] ❌ Connection failed. Starting Hotspot Setup Mode.");
            WiFi.mode(WIFI_AP);
            WiFi.softAP("AquaControl_setup"); 
        }
    } else {
        Serial.println("[WIFI] 📡 No credentials found. Starting Hotspot Setup Mode.");
        WiFi.mode(WIFI_AP);
        WiFi.softAP("AquaControl_setup"); 
    }

    netManager->begin();
    Serial.println("[SYS] ✅ Network Manager initialized.");

    xTaskCreate(
        networkTask,      
        "NetworkTask",    
        10000,            
        NULL,             
        0,                 
        &NetworkTaskHandle 
    );

    Serial.println("[SYS] ✅ FreeRTOS multi-threading activated. System fully online.");
}

void loop() {
    hwEngine.execute(settingsMgr.get(), settingsMgr.needsHardwareEval(), true);
    hwEngine.handleLEDs(); 
    btnManager.loop();     
    settingsMgr.processLazyFlashSave();
    vTaskDelay(pdMS_TO_TICKS(10)); 
}