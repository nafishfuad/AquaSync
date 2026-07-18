// src/main.js

import { DeviceStore, IdentityStore } from './state.js'; 
import { API } from './api.js';
import { buildInsightsPanel, buildControlPanel, buildSystemPanel, buildColorPanel } from './ui-factory.js';
import { renderEmptyState, renderPairingWizard } from './components/system/PairingWizard.js';
import { initTopNav } from './components/system/TopNav.js';
import { debounce } from './utils.js'; 
import { showOutageModal } from './components/system/OutageModal.js'; 
import { initAuthModal } from './components/system/AuthModal.js'; 

const AquaSync = {
    _sendTimeout: null,
    _syncTimer: null,
    _syncLoopRunning: false,
    _firmwareChecked: false,

    async init() {
        console.log("🌊 AquaSync Ecosystem Initializing...");
        
        // Dynamic Debounce: Hyper-fast for Local Wi-Fi, slow for Cloud to save Firebase bandwidth
        this._debouncedSend = (targetDevice, payload) => {
            const isLocal = this.currentStatus === 'local';
            const waitTime = isLocal ? 150 : 3000;
            
            if (this._sendTimeout) clearTimeout(this._sendTimeout);
            
            this._sendTimeout = setTimeout(async () => {
                const res = await API.sendCommand(targetDevice, payload);
                if (res && res.success) {
                    AquaSync.updateSyncStatus('success'); 
                    if (res.returnedState) {
                        DeviceStore.updateDeviceState(targetDevice.hwid, res.returnedState);
                        AquaSync.renderActiveUI(); 
                    }
                } else {
                    AquaSync.updateSyncStatus('idle');
                }
            }, waitTime);
        };

        initAuthModal();

        // 🔥 THE FIX: Set up the "ears" BEFORE initializing the auth system!
        window.addEventListener("aquasync_auth_resolved", async () => {
            if (IdentityStore.currentUser) {
                // Claim any locally-known devices in Firebase for this account
                await DeviceStore.claimAllLocalDevices(IdentityStore.currentUser.uid);
                // Then fetch their devices from the cloud (includes ones added on other browsers)
                await DeviceStore.syncFromCloud(IdentityStore.currentUser.uid);
            }
            
            // Redraw UI after cloud sync attempt
            if (Object.keys(DeviceStore.devices).length === 0) {
                // No devices found locally OR in the cloud — show the pairing wizard
                ['page-insights', 'page-control', 'page-color', 'page-network'].forEach(id => {
                    const el = document.getElementById(id);
                    if (el) el.classList.add('hidden');
                });
                document.querySelectorAll("nav").forEach(nav => {
                    if (nav.id !== "slot-top-nav") nav.classList.add("hidden");
                });
                const topNav = document.getElementById("slot-top-nav");
                if (topNav) {
                    topNav.classList.remove("hidden");
                    topNav.style.display = "block";
                    topNav.style.zIndex = "400";
                }
                initTopNav();
                if (typeof renderEmptyState === 'function') renderEmptyState();
            } else {
                // Devices found — do a full UI bootstrap (tab restore + sync loop)
                document.querySelectorAll("nav").forEach(nav => nav.classList.remove("hidden"));
                initTopNav();
                const lastOpenTab = localStorage.getItem('aquasync_active_tab') || 'page-control';
                this.switchTab(lastOpenTab);
                this.renderActiveUI();
                this.runSyncLoop();
            }
        });

        window.addEventListener("aquasync_stream_update", () => {
            this.setConnectionStatus("cloud");
            this.renderActiveUI();
        });

        // Initialize local storage devices
        DeviceStore.init();
        
        // NOW initialize Auth (This will instantly trigger the listener we just created above)
        IdentityStore.init();

        // Standard local boot routine (Will be gracefully overridden if cloud sync finds devices)
        if (Object.keys(DeviceStore.devices).length === 0) {
            ['page-insights', 'page-control', 'page-color', 'page-network'].forEach(id => {
                const el = document.getElementById(id);
                if (el) el.classList.add('hidden');
            });

            document.querySelectorAll("nav").forEach(nav => {
                if (nav.id !== "slot-top-nav") nav.classList.add("hidden");
            });

            const topNav = document.getElementById("slot-top-nav");
            if (topNav) {
                topNav.classList.remove("hidden");
                topNav.style.display = "block"; 
                topNav.style.zIndex = "400";
            }
            
            initTopNav(); 
            if (typeof renderEmptyState === 'function') renderEmptyState();
            return; 
        }

        initTopNav();
        const lastOpenTab = localStorage.getItem('aquasync_active_tab') || 'page-control';
        this.switchTab(lastOpenTab); 
        
        this.renderActiveUI();
        this.runSyncLoop();

        document.addEventListener("visibilitychange", () => {
            if (document.visibilityState === 'visible') {
                if (!this._syncLoopRunning) this.runSyncLoop();
            }
        });
    },

    switchTab(targetId) {
        localStorage.setItem('aquasync_active_tab', targetId);

        const pages = ['page-insights', 'page-control', 'page-color', 'page-network'];
        pages.forEach(id => {
            const pageEl = document.getElementById(id);
            const navEl = document.getElementById(`nav-${id}`);
            if (pageEl) pageEl.classList.add('hidden');
            if (navEl) {
                navEl.classList.remove('text-aqua');
                navEl.classList.add('text-gray-500');
            }
        });

        const targetPage = document.getElementById(targetId);
        const targetNav = document.getElementById(`nav-${targetId}`);
        if (targetPage) targetPage.classList.remove('hidden');
        if (targetNav) {
            targetNav.classList.add('text-aqua');
            targetNav.classList.remove('text-gray-500');
        }
        
        if (typeof window !== 'undefined' && window.event && window.event.type === 'click') {
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    },

    setConnectionStatus(status) {
        this.currentStatus = status;
        
        const topPings = document.querySelectorAll(".ui-top-ping");
        const topDots = document.querySelectorAll(".ui-top-dot");
        
        topPings.forEach(topPing => {
            topPing.className = "ui-top-ping absolute inline-flex h-full w-full rounded-full opacity-75";
            if (status === "local") topPing.classList.add("bg-aqua", "animate-ping");
            else if (status === "cloud") topPing.classList.add("bg-purple-400", "animate-ping");
            else topPing.classList.add("hidden");
        });

        topDots.forEach(topDot => {
            topDot.className = "ui-top-dot relative inline-flex rounded-full h-2.5 w-2.5 transition-colors duration-300";
            if (status === "local") topDot.classList.add("bg-aqua");
            else if (status === "cloud") topDot.classList.add("bg-purple-500");
            else topDot.classList.add("bg-gray-500");
        });
        
        const overviewPing = document.getElementById("ui-overview-ping");
        const overviewDot = document.getElementById("ui-overview-dot");
        
        if (overviewPing && overviewDot) {
            overviewPing.className = "absolute inline-flex h-full w-full rounded-full opacity-75";
            overviewDot.className = "relative inline-flex rounded-full h-2.5 w-2.5 transition-colors duration-300";
            
            if (status === "offline") {
                overviewPing.classList.add("hidden"); 
                overviewDot.classList.add("bg-red-500"); 
            } else { 
                overviewPing.classList.add("bg-aqua", "animate-ping");
                overviewDot.classList.add("bg-aqua");
            }
        }
    },

    updateSyncStatus(state) {
        const dot = document.getElementById("ui-status-dot");
        const spin = document.getElementById("ui-status-spinner");
        const check = document.getElementById("ui-status-check");
        if (!dot || !spin || !check) return; 

        [dot, spin, check].forEach(el => el.classList.add('hidden'));

        if (state === 'syncing') {
            spin.classList.remove('hidden');
        } else if (state === 'success') {
            check.classList.remove('hidden');
            setTimeout(() => {
                if (!check.classList.contains('hidden')) { 
                    this.updateSyncStatus('idle');
                }
            }, 5000);
        } else {
            dot.classList.remove('hidden');
        }
    },

    async runSyncLoop() {
        if (this._syncLoopRunning) return;
        this._syncLoopRunning = true;
        if (this._syncTimer) clearTimeout(this._syncTimer);
        const device = DeviceStore.getActiveDevice();
        if (!device) { this._syncLoopRunning = false; return; }

        if (!this._firmwareChecked || device.firmware.latest === "Checking..." || device.firmware.latest === "Unknown") {
            this._firmwareChecked = true;
            try {
                const isLocalHost = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1" || window.location.hostname.startsWith("192.168.") || window.location.hostname.startsWith("10.") || window.location.hostname.startsWith("172.");
                let fullManifestReq = null;
                if (isLocalHost) {
                    try {
                        fullManifestReq = await fetch("/firmware.json?t=" + Date.now());
                    } catch (e) {
                        fullManifestReq = null;
                    }
                }
                if (!fullManifestReq || !fullManifestReq.ok) {
                    fullManifestReq = await fetch("https://raw.githubusercontent.com/nafishfuad/AquaSync/main/firmware.json?t=" + Date.now());
                }

                if (fullManifestReq && fullManifestReq.ok) {
                    const fullManifest = await fullManifestReq.json();
                    
                    device.firmware.latest = fullManifest[device.model]?.version || "Unknown";
                    device.firmware.downloadUrl = fullManifest[device.model]?.firmware_url || "";
                    device.companion.latest = fullManifest["CompanionApp"]?.version || "Unknown";
                    device.companion.downloadUrl = fullManifest["CompanionApp"]?.download_url || "";
                    
                    DeviceStore.save();
                    this.renderActiveUI();
                } else {
                    throw new Error("Manifest not OK");
                }
            } catch (e) {
                device.firmware.latest = "Unknown";
                device.companion.latest = "Unknown";
                DeviceStore.save();
                this.renderActiveUI();
            }
        }

        const response = await API.syncDevice(device);
        
        if (response && response.data) {
            const nowSecs = Math.floor(Date.now() / 1000);
            const lastBeat = response.data.lastHeartbeatTs || nowSecs;
            const timeSinceLastBeat = nowSecs - lastBeat;

            if (response.source === "cloud" && timeSinceLastBeat > 60) {
                this.setConnectionStatus("offline");
            } else {
                this.setConnectionStatus(response.source);
            }
            
            if (response.data.localIP && response.data.localIP !== device.localIP) {
                DeviceStore.updateNetwork(device.hwid, response.data.localIP, true);
            }
            if (response.data.capabilities) {
                DeviceStore.updateDeviceState(device.hwid, response.data, response.data.capabilities);
            } else {
                DeviceStore.updateDeviceState(device.hwid, response.data);
            }

            this.renderActiveUI();
        } else {
            this.setConnectionStatus("offline");
        }

        // Loop every 10 seconds
        this._syncLoopRunning = false;
        this._syncTimer = setTimeout(() => this.runSyncLoop(), 10000);
    },

    renderActiveUI() {
        const device = DeviceStore.getActiveDevice();
        if (!device) return;

        const commandHook = async (payload, fastUI = false) => {
            // Get fresh device in case user switched tabs/devices during debounce
            const currentDevice = DeviceStore.getActiveDevice();
            if (!currentDevice) return;

            if (!currentDevice.metrics.isAutoMode && (payload.hasOwnProperty("isLightOn") || payload.hasOwnProperty("currentBrightness")) && !currentDevice.metrics.isCO2ScheduleSeparate) {
                payload.isCO2On = payload.hasOwnProperty("isLightOn") ? payload.isLightOn : (payload.currentBrightness > 0);
            }

            DeviceStore.updateDeviceState(currentDevice.hwid, payload);
            AquaSync.renderActiveUI(); 
            AquaSync.updateSyncStatus('syncing');

            if (!fastUI) {
                const res = await API.sendCommand(currentDevice, payload);
                if (res && res.success) {
                    AquaSync.updateSyncStatus('success'); 
                    if (res.returnedState) {
                        DeviceStore.updateDeviceState(currentDevice.hwid, res.returnedState);
                        AquaSync.renderActiveUI(); 
                    }
                } else {
                    AquaSync.updateSyncStatus('idle');
                }
            } else {
                AquaSync._debouncedSend(currentDevice, payload);
            }
        };

        buildControlPanel(device, commandHook);
        buildInsightsPanel(device);
        buildColorPanel(device, commandHook);
        buildSystemPanel(device, API, commandHook);

        this.setConnectionStatus(this.currentStatus || 'offline');
    }
};

window.AquaSync = AquaSync;
window.showOutageModal = showOutageModal; 

document.addEventListener("DOMContentLoaded", () => AquaSync.init());