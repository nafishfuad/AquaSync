#include <Arduino.h>
#include <WiFi.h>
#include <Preferences.h>
#include <nvs_flash.h>
#include "CoreConfig.h"
#include "SettingsManager.h"
#include "HardwareEngine.h"
#include "ButtonManager.h"
#include "AquaNetworkManager.h" 
#include "debug_helpers.h"

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

    // 🔥 COOLING OPTIMIZATION: Underclock CPU from 160MHz to 80MHz
    // This dramatically reduces power consumption and thermals while keeping it plenty fast
    setCpuFrequencyMhz(80); 

    // 🔥 FATAL RECOVERY OPTIMIZATION: Safely initialize NVS and format if completely corrupted
    esp_err_t err = nvs_flash_init();
    if (err == ESP_ERR_NVS_NO_FREE_PAGES || err == ESP_ERR_NVS_NEW_VERSION_FOUND) {
        Serial.println("[SYS] ⚠️ NVS Memory Corrupted! Formatting to prevent bootloop...");
        nvs_flash_erase();
        err = nvs_flash_init();
    }
    if (err != ESP_OK) Serial.println("[SYS] ❌ Failed to initialize NVS!");

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
        // 🔥 POWER OPTIMIZATION: Set baseline power to low (cool) state
        WiFi.setTxPower(WIFI_POWER_8_5dBm);
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
            String apPass = hwid.length() >= 8 ? hwid.substring(hwid.length() - 8) : "AquaSync";
            WiFi.softAP("AquaControl_setup", apPass);
            Serial.println("[WIFI] 🌐 Hotspot IP: 192.168.4.1");
        }
    } else {
        Serial.println("[WIFI] 📡 No credentials found. Starting Hotspot Setup Mode.");
        WiFi.mode(WIFI_AP);
        String apPass = hwid.length() >= 8 ? hwid.substring(hwid.length() - 8) : "AquaSync";
        WiFi.softAP("AquaControl_setup", apPass);
        Serial.println("[WIFI] 🌐 Hotspot IP: 192.168.4.1");
    }

    netManager->begin();
    Serial.println("[SYS] ✅ System fully initialized and routing API requests.");
}

void loop() {
    netManager->handleClient();
    DebugHelpers::checkSerialCommands(settingsMgr);
    
    hwEngine.execute(settingsMgr.get(), settingsMgr.needsHardwareEval(), true);
    
    // Add Button & LED Loops
    hwEngine.handleLEDs(); 
    btnManager.loop();     
    
    netManager->syncFirebase();
    settingsMgr.processLazyFlashSave();
    DebugHelpers::tickLoop();
    DebugHelpers::tickNetwork();

    delay(10); 
}