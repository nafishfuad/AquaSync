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

String homeSsid = "";
String homePass = "";

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
        hwid = "AQUA-" + mac.substring(mac.length() - 4) + salt;
        prefs.putString("secure_hwid", hwid);
    }
    prefs.end();
    return hwid;
}

void networkTask(void * parameter) {
    bool autopsyCompleted = false;
    bool timeSynced = false;
    unsigned long lastWifiRetry = 0;

    for(;;) {
        if (netManager != nullptr) {
            netManager->handleClient();
            netManager->syncFirebase(); 
        }
        
        // 🔥 THE FIX: Background Router Scanner
        if (homeSsid != "") {
            if (WiFi.status() != WL_CONNECTED) {
                // If the router is still booting, retry every 30 seconds
                if (millis() - lastWifiRetry > 30000) {
                    lastWifiRetry = millis();
                    Serial.println("[WIFI] Router not found yet. Searching in background...");
                    WiFi.disconnect();
                    WiFi.begin(homeSsid.c_str(), homePass.c_str());
                }
            } else {
                // We are finally connected!
                if (WiFi.getMode() != WIFI_STA) {
                    Serial.println("[WIFI] ✅ Connected to Router! Shutting down Hotspot.");
                    Serial.println("[WIFI] IP Address: " + WiFi.localIP().toString());
                    WiFi.softAPdisconnect(true); 
                    WiFi.mode(WIFI_STA); // Clean up AP
                }

                if (!timeSynced) {
                    Serial.println("[SYS] 🕒 Syncing NTP Time (UTC+6)...");
                    configTime(6 * 3600, 0, "pool.ntp.org"); 
                    timeSynced = true;
                }

                if (!autopsyCompleted) {
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
                        client.stop(); // 🔥 FIX: Prevents the "Closed SSL" error
                        autopsyCompleted = true; 
                    }
                }
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

    // 🔥 COOLING FIX 1: Underclock CPU. Drops heat massively!
    setCpuFrequencyMhz(80); 

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
    homeSsid = prefs.getString("ssid", "");
    homePass = prefs.getString("pass", "");
    prefs.end();

    if (homeSsid != "") {
        Serial.println("[WIFI] Saved credentials found. Attempting background connection...");
        // 🔥 THE FIX: Boot into AP+STA mode so Hotspot works immediately 
        // while the background task searches for the router.
        WiFi.mode(WIFI_AP_STA);
        WiFi.softAP("AquaControl_setup"); 
        
        // 🔥 COOLING FIX 2: Set TX Power to 15dBm (Strong enough for walls, cooler than max)
        WiFi.setTxPower(WIFI_POWER_2dBm); 
        WiFi.begin(homeSsid.c_str(), homePass.c_str());
    } else {
        Serial.println("[WIFI] 📡 No credentials found. Starting Hotspot Setup Mode.");
        WiFi.mode(WIFI_AP);
        WiFi.softAP("AquaControl_setup"); 
    }

    // NO MORE DELAYS HERE! Hardware loop is instantly available.

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