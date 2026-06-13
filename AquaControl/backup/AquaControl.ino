#include <Arduino.h>
#include <WiFi.h>
#include <Preferences.h>
#include "CoreConfig.h"
#include "SettingsManager.h"
#include "HardwareEngine.h"
#include "ButtonManager.h"
#include "AquaNetworkManager.h" 

SettingsManager settingsMgr;
HardwareEngine  hwEngine;
ButtonManager   btnManager(settingsMgr, hwEngine);
AquaNetworkManager* netManager; 

String hwid;

void setup() {
    Serial.begin(115200);
    // Anti-Freeze for Native USB ESP32-C3
    Serial.setTxTimeoutMs(0); 

    delay(1000); 
    Serial.println("\n\n=================================");
    Serial.println("🌊 AquaSync Brain Booting...");
    Serial.println("=================================");

    uint64_t chipid = ESP.getEfuseMac();
    hwid = "AQUA-" + String((uint32_t)(chipid >> 32), HEX);
    hwid.toUpperCase();
    Serial.println("[SYS] Generated Device ID: " + hwid);

    // Initialize subsystems (Safely formats NVS if blank)
    settingsMgr.begin();
    hwEngine.begin();
    netManager = new AquaNetworkManager(settingsMgr, hwEngine, hwid);

    // Pull Wi-Fi credentials
    Preferences prefs;
    // 🔥 SAFE: This uses 'false' just to ensure no crashes
    prefs.begin("aqua-ctrl", false);
    String ssid = prefs.getString("ssid", "");
    String pass = prefs.getString("pass", "");
    prefs.end();

    WiFi.mode(WIFI_STA);
    
    if (ssid != "") {
        Serial.println("[WIFI] Attempting to connect to: " + ssid);
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
            WiFi.softAP("AquaControl_setup", ""); 
            Serial.println("[WIFI] 🌐 Hotspot IP: 192.168.4.1");
        }
    } else {
        Serial.println("[WIFI] 📡 No credentials found. Starting Hotspot Setup Mode.");
        WiFi.mode(WIFI_AP);
        WiFi.softAP("AquaControl_setup", "");
        Serial.println("[WIFI] 🌐 Hotspot IP: 192.168.4.1");
    }

    netManager->begin();
    Serial.println("[SYS] ✅ System fully initialized and routing API requests.");
}

void loop() {
    netManager->handleClient();
    
    hwEngine.execute(settingsMgr.get(), settingsMgr.needsHardwareEval(), true);
    
    // Add Button & LED Loops
    hwEngine.handleLEDs(); 
    btnManager.loop();     
    
    netManager->syncFirebase();
    settingsMgr.processLazyFlashSave();

    delay(10); 
}