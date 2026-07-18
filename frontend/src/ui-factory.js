// src/ui-factory.js
import { DeviceStore } from './state.js';
// --- Analytics Layer Imports ---
import { renderOverview } from './components/analytics/Overview.js';
import { renderCharts } from './components/analytics/Charts.js';

// --- Hardware Control Layer Imports ---
import { renderPrimaryControlCard } from './components/hardware/PrimaryControlCard.js';
import { renderSchedulesStack } from './components/hardware/ScheduleCard.js';

// --- Color Spectrum Layer Imports ---
import { renderColorSpectrum } from './components/hardware/ColorMixer.js';

// --- System Layer Imports ---
import { renderConnection } from './components/system/Connection.js';
import { renderMaintenance } from './components/system/Maintenance.js';
import { renderCompanionApp } from './components/system/Companion.js';
import { renderFirmware } from './components/system/Firmware.js';
import { renderAccount } from './components/system/Account.js';
import { showConfirm } from './components/system/CustomDialogs.js'; // 🔥 ADDED

/**
 * Page 1: Renders the Analytics & Graph Dashboard
 */
export function buildInsightsPanel(device) {
    const overviewSlot = document.getElementById("slot-today-overview");
    const chartsSlot = document.getElementById("slot-analytics-charts");

    if (!overviewSlot || !chartsSlot) return;

    overviewSlot.innerHTML = "";
    // Destroy existing Chart instances to prevent memory leak
    if (typeof Chart !== 'undefined') {
        const existingCanvases = chartsSlot.querySelectorAll('canvas');
        existingCanvases.forEach(canvas => {
            const chartInstance = Chart.getChart(canvas);
            if (chartInstance) chartInstance.destroy();
        });
    }
    chartsSlot.innerHTML = "";

    renderOverview(overviewSlot, device);
    renderCharts(chartsSlot, device.analyticsData);
}

/**
 * Page 2: Renders the Primary Schedule & Override Panel
 */
export function buildControlPanel(device, commandHook) {
    const primaryCardSlot = document.getElementById("slot-primary-control-card");
    const scheduleSlot = document.getElementById("slot-schedules-stack");

    if (!primaryCardSlot || !scheduleSlot) return;

    primaryCardSlot.innerHTML = "";
    scheduleSlot.innerHTML = "";

    renderPrimaryControlCard(primaryCardSlot, device, commandHook);
    renderSchedulesStack(scheduleSlot, device, commandHook);
}

/**
 * Page 3: Renders the WRGB Color Mix Matrix
 */
export function buildColorPanel(device, commandHook) {
    const previewSlot = document.getElementById("slot-color-preview");
    const presetsSlot = document.getElementById("slot-color-presets");
    const manualMixSlot = document.getElementById("slot-color-manual-mix");
    const customSlot = document.getElementById("slot-color-custom");

    if (!previewSlot || !presetsSlot || !manualMixSlot || !customSlot) return;

    previewSlot.innerHTML = "";
    presetsSlot.innerHTML = "";
    manualMixSlot.innerHTML = "";
    customSlot.innerHTML = "";

    const colorTabButton = document.getElementById("nav-page-color");

    if (!device.capabilities.hasColorSpectrum) {
        if (colorTabButton) colorTabButton.classList.add("hidden");
        return;
    }
    if (colorTabButton) colorTabButton.classList.remove("hidden");

    const currentSpectrumObj = {
        w: device.metrics.colorW || 100,
        r: device.metrics.colorR || 100,
        g: device.metrics.colorG || 100,
        b: device.metrics.colorB || 100
    };

    renderColorSpectrum(
        previewSlot, 
        presetsSlot, 
        manualMixSlot, 
        customSlot,
        currentSpectrumObj, 
        device.customColors || [],
        (newSpectrum, fastUI = false) => {
            commandHook({ 
                colorW: newSpectrum.w, 
                colorR: newSpectrum.r, 
                colorG: newSpectrum.g, 
                colorB: newSpectrum.b 
            }, fastUI);
        },
        (name, spectrum) => {
            if (!device.customColors) device.customColors = [];
            device.customColors.push({ name, ...spectrum });
            DeviceStore.save();
            buildColorPanel(device, commandHook); // re-render
        },
        (index) => {
            device.customColors.splice(index, 1);
            DeviceStore.save();
            buildColorPanel(device, commandHook); // re-render
        }
    );
}

/**
 * Page 4: Renders System Utilities, Wi-Fi Configuration, and OTA Panels
 */
export function buildSystemPanel(device, apiReference, commandHook) {
    const systemSlot = document.getElementById("slot-network-manager-cards");
    if (!systemSlot) return;

    systemSlot.innerHTML = "";

    // 🔥 NEW: Render the Account Card at the top
    renderAccount(systemSlot);

    renderConnection(systemSlot, device.network, async () => {
        if (await showConfirm("Reset Wi-Fi", "Reset Wi-Fi stack? The controller will drop back to local hotspot configuration.")) {
            apiReference.sendCommand(device, { command: "forget_wifi" });
        }
    });

    renderMaintenance(systemSlot, (systemPayload) => {
        apiReference.sendCommand(device, systemPayload);
    });

    renderCompanionApp(systemSlot, device);

    renderFirmware(systemSlot, device.firmware, (otaPayload) => {
        apiReference.sendCommand(device, otaPayload);
    });
}