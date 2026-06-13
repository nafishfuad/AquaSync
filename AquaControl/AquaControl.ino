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


// 🔥 PHASE 1: The Cryptographic HWID Generator
String generateSecureHWID() {
    Preferences prefs;
    prefs.begin("aqua-ctrl", false);
    
    String hwid = prefs.getString("secure_hwid", "");

    if (hwid == "") {
        String mac = WiFi.macAddress();
        mac.replace(":", ""); // Remove colons to make it Firebase-safe

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

void setup() {
    Serial.begin(115200);
    // Anti-Freeze for Native USB ESP32-C3
    Serial.setTxTimeoutMs(0); 

    delay(1000); 
    Serial.println("\n\n=================================");
    Serial.println("🌊 AquaSync Brain Booting...");
    Serial.println("=================================");

    // We must initialize WiFi first so we can read the MAC address!
    WiFi.mode(WIFI_STA);
    
    // 🔥 GENERATE THE SECURE HWID
    // Grabs the unique internal MAC address of the ESP32 chip and formats it
    uint64_t chipid = ESP.getEfuseMac(); 
    uint16_t chip = (uint16_t)(chipid >> 32);
    char hwidStr[25];
    snprintf(hwidStr, sizeof(hwidStr), "AQUA-%04X%08X", chip, (uint32_t)chipid);
    
    hwid = String(hwidStr);
    hwid.toUpperCase();
    
    Serial.println("[SYS] Using Device ID: " + hwid);

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