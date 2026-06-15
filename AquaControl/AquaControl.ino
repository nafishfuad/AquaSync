#include <Arduino.h>
#include <WiFi.h>
#include <HTTPClient.h>         // 🔥 NEW: Add this
#include <WiFiClientSecure.h>   // 🔥 NEW: Add this
#include <Preferences.h>
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

// 🔥 NEW: Define the task handle for our FreeRTOS Network Core
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

// ==========================================
// 🔥 THE NEW CORE 0: DEDICATED NETWORK LOOP
// ==========================================
void networkTask(void * parameter) {
    bool autopsyCompleted = false;

    for(;;) {
        if (netManager != nullptr) {
            netManager->handleClient();
            netManager->syncFirebase(); // <-- This handles the 60s Heartbeat beautifully!
        }
        
        // 🔥 PHASE 3: Cloud Autopsy (Runs exactly ONCE after NTP syncs)
        if (!autopsyCompleted && WiFi.status() == WL_CONNECTED) {
            time_t nowTs = time(nullptr);
            if (nowTs > 1600000000) { 
                WiFiClientSecure client;
                client.setInsecure();
                HTTPClient http;
                
                Serial.println("[AUTOPSY] Fetching last known heartbeat from Cloud...");
                http.begin(client, FIREBASE_URL + "/devices/" + hwid + "/state/lastHeartbeatTs.json");
                int httpCode = http.GET();
                
                if (httpCode == 200) {
                    String payload = http.getString();
                    uint32_t cloudTs = payload.toInt();
                    outageTracker.performCloudAutopsy(cloudTs);
                } else {
                    Serial.println("[AUTOPSY] Cloud fetch failed, assuming clean boot.");
                }
                http.end();
                autopsyCompleted = true; // Lock it so it never runs again
            }
        }

        vTaskDelay(50 / portTICK_PERIOD_MS); 
    }
}

// ==========================================
// SINGLE SETUP FUNCTION
// ==========================================
void setup() {
    Serial.begin(115200);
    Serial.setTxTimeoutMs(0); 

    // 🔥 CRITICAL NATIVE USB FIX: Wait 5 FULL SECONDS for Windows to mount the COM port!
    delay(5000); 

    Serial.println("\n\n=================================");
    Serial.println("🌊 AquaSync RTOS Booting...");
    Serial.println("=================================");

    // 🔥 RADIO RESET FIX: Force the Wi-Fi chip to reset before we configure it
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
            Serial.println("[WIFI] 🌐 Hotspot IP: 192.168.4.1");
        }
    } else {
        Serial.println("[WIFI] 📡 No credentials found. Starting Hotspot Setup Mode.");
        WiFi.mode(WIFI_AP);
        WiFi.softAP("AquaControl_setup"); 
        Serial.println("[WIFI] 🌐 Hotspot IP: 192.168.4.1");
    }

    netManager->begin();
    Serial.println("[SYS] ✅ Network Manager initialized.");

    // ==========================================
    // 🔥 IGNITE THE RTOS SCHEDULER
    // ==========================================
    xTaskCreate(
        networkTask,      
        "NetworkTask",    
        8192,             
        NULL,             
        1,                
        &NetworkTaskHandle 
    );

    Serial.println("[SYS] ✅ FreeRTOS multi-threading activated. System fully online.");
}

// ==========================================
// THE STANDARD CORE 1: DEDICATED HARDWARE LOOP
// ==========================================
void loop() {
    hwEngine.execute(settingsMgr.get(), settingsMgr.needsHardwareEval(), true);
    hwEngine.handleLEDs(); 
    btnManager.loop();     
    settingsMgr.processLazyFlashSave();

    delay(5); // Keep hardware loop incredibly fast and responsive
}