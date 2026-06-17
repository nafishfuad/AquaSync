#ifndef CORE_CONFIG_H
#define CORE_CONFIG_H

#include <Arduino.h>

const String FW_VERSION = "v1.5.0"; 
const int CURRENT_SCHEMA_VERSION = 5;
const String DEVICE_MODEL = "AS-Base";
const String FIREBASE_URL = "https://aqua-fish-controller-default-rtdb.asia-southeast1.firebasedatabase.app";

const int PIN_RELAY = 2;  
const int PIN_FAN   = 3;
const int PIN_LIGHT = 5;  
const int PIN_LED   = 8;  
const int PIN_BTN   = 9;  
const int PIN_CO2   = 10;

struct TankSettings {
    char deviceName[32]; 
    bool isAutoMode;
    bool isLightOn;
    bool isCO2On;
    bool isFanOn;
    bool isFanEnabled;
    int currentBrightness;
    char startTime[6];
    int photoperiod;
    int maxBrightness;
    bool isDimmerEnabled;
    int sunriseMins;
    int sunsetMins;
    bool isCO2ScheduleSeparate;
    char co2OnTime[6];
    char co2OffTime[6];
    int recoveryMins;
    char fanOnTime[6];
    char fanOffTime[6];
    int fanSpeed;
    int colorW;
    int colorR;
    int colorG;
    int colorB;
    
    uint16_t activeMinutesToday[24]; 
    uint16_t awakeMinutesToday[24]; 
    int totalLoadSheddingToday;     
    int lightLoadSheddingToday;     
    int lastTrackedDay;      

    // 🔥 NEW: Volatile metrics specifically for the UI Alert
    int lastOutageTotalMins;
    int lastOutageLightMins;
};

// 🔥 FIX 1: The safe vault for midnight data transfer
struct DailySnapshot {
    bool pending = false;
    uint16_t year = 0;
    uint8_t month = 0;
    uint8_t day = 0;
    uint16_t activeMinutes[24];
    uint16_t awakeMinutes[24];
    int totalLS = 0;
    int lightLS = 0;
};

#endif