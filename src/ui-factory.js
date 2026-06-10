// src/ui-factory.js

// --- Analytics Layer Imports ---
import { renderOverview } from './components/analytics/Overview.js';
import { renderCharts } from './components/analytics/Charts.js';

// --- Hardware Control Layer Imports ---
import { renderModeBanner } from './components/hardware/ModeBanner.js';
import { renderOverrideGrid } from './components/hardware/OverrideGrid.js';
import { renderLiveDimmer } from './components/hardware/Dimmer.js';
import { renderSchedulesStack } from './components/hardware/ScheduleCard.js';

// --- Color Spectrum Layer Imports ---
import { renderColorSpectrum } from './components/hardware/ColorMixer.js';

// --- System Layer Imports ---
import { renderConnection } from './components/system/Connection.js';
import { renderFirmware } from './components/system/Firmware.js';
import { renderMaintenance } from './components/system/Maintenance.js';
import { renderCompanionApp } from './components/system/Companion.js';

/**
 * Page 1: Renders the Analytics & Graph Dashboard
 */
export function buildInsightsPanel(device) {
    const overviewSlot = document.getElementById("slot-today-overview");
    const chartsSlot = document.getElementById("slot-analytics-charts");

    if (!overviewSlot || !chartsSlot) return;

    overviewSlot.innerHTML = "";
    chartsSlot.innerHTML = "";

    // Render the overview grid (Light/CO2 statuses, photoperiod values)
    renderOverview(overviewSlot, device);

    // Render the historical trends (Today's Hourly Activity line, 7-Day & 30-Day charts)
    renderCharts(chartsSlot, device.analyticsData);
}

/**
 * Page 2: Renders the Primary Schedule & Override Panel
 */
export function buildControlPanel(device, commandHook) {
    const bannerSlot = document.getElementById("slot-control-mode-banner");
    const gridSlot = document.getElementById("slot-hardware-override-grid");
    const dimmerSlot = document.getElementById("slot-live-dimmer-wrapper");
    const scheduleSlot = document.getElementById("slot-schedules-stack");

    if (!bannerSlot || !gridSlot || !dimmerSlot || !scheduleSlot) return;

    bannerSlot.innerHTML = "";
    gridSlot.innerHTML = "";
    dimmerSlot.innerHTML = "";
    scheduleSlot.innerHTML = "";

    const metrics = device.metrics;
    const cap = device.capabilities;

    // 1. Render Auto/Manual Global Switch Banner
    renderModeBanner(bannerSlot, metrics.isAutoMode, (newAutoMode) => {
        commandHook({ isAutoMode: newAutoMode });
    });

    // 2. Render Manual Override Quick Action Box Grid
    renderOverrideGrid(gridSlot, device, commandHook);

    // 3. Render Live Brightness Dimmer (Only responsive if in Manual Mode)
    if (cap.hasLight) {
        renderLiveDimmer(dimmerSlot, device, (newBrightness) => {
            commandHook({ currentBrightness: newBrightness });
        });
    }

    // 4. Render Layout Schedules (Primary Light, Dimming Ramps, CO2 limits, Fan windows)
    renderSchedulesStack(scheduleSlot, device, commandHook);
}

/**
 * Page 3: Renders the WRGB Color Mix Matrix (Polymorphic Guarded)
 */
export function buildColorPanel(device, commandHook) {
    const previewSlot = document.getElementById("slot-color-preview");
    const presetsSlot = document.getElementById("slot-color-presets");
    const manualMixSlot = document.getElementById("slot-color-manual-mix");

    if (!previewSlot || !presetsSlot || !manualMixSlot) return;

    previewSlot.innerHTML = "";
    presetsSlot.innerHTML = "";
    manualMixSlot.innerHTML = "";

    const colorTabButton = document.getElementById("nav-page-color");

    // Capabilities Enforcement: If hardware says no color mix support, hide the tab entirely
    if (!device.capabilities.hasColorSpectrum) {
        if (colorTabButton) colorTabButton.classList.add("hidden");
        return;
    }
    if (colorTabButton) colorTabButton.classList.remove("hidden");

    // Render the complete color configuration interface
    renderColorSpectrum(previewSlot, presetsSlot, manualMixSlot, device.metrics.colorSpectrum, (newSpectrum) => {
        commandHook({ colorSpectrum: newSpectrum });
    });
}

/**
 * Page 4: Renders System Utilities, Wi-Fi Configuration, and OTA Panels
 */
export function buildSystemPanel(device, apiReference, commandHook) {
    const systemSlot = document.getElementById("slot-network-manager-cards");
    if (!systemSlot) return;

    systemSlot.innerHTML = "";

    // 1. Connection Status Card
    renderConnection(systemSlot, device.network, () => {
        if (confirm("Reset Wi-Fi stack? The controller will drop back to local hotspot configuration.")) {
            apiReference.sendCommand(device, { command: "forget_wifi" });
        }
    });

    // 2. Firmware Management Card
    renderFirmware(systemSlot, device.firmware, (otaPayload) => {
        apiReference.sendCommand(device, otaPayload);
    });

    // 3. Low-Level System Actions Card (Reboot/Reset)
    renderMaintenance(systemSlot, (systemPayload) => {
        apiReference.sendCommand(device, systemPayload);
    });
}

export function buildSystemPanel(device, apiReference, commandHook) {
    const systemSlot = document.getElementById("slot-network-manager-cards");
    if (!systemSlot) return;

    systemSlot.innerHTML = "";

    // 1. Connection Status
    renderConnection(systemSlot, device.network, () => {
        if (confirm("Reset Wi-Fi stack? The controller will drop back to local hotspot configuration.")) {
            apiReference.sendCommand(device, { command: "forget_wifi" });
        }
    });

    // 2. Companion App Promo
    renderCompanionApp(systemSlot);

    // 3. Firmware Management
    renderFirmware(systemSlot, device.firmware, (otaPayload) => {
        apiReference.sendCommand(device, otaPayload);
    });

    // 4. Low-Level System Actions
    renderMaintenance(systemSlot, (systemPayload) => {
        apiReference.sendCommand(device, systemPayload);
    });
}