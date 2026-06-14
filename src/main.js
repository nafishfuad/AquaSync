// src/main.js

import { DeviceStore, IdentityStore } from './state.js';
import { API } from './api.js';
import { buildInsightsPanel, buildControlPanel, buildSystemPanel, buildColorPanel } from './ui-factory.js';
import { renderEmptyState, renderPairingWizard } from './components/system/PairingWizard.js';
import { initTopNav } from './components/system/TopNav.js';
import { debounce } from './utils.js'; 
import { showOutageModal } from './components/system/OutageModal.js'; 

const AquaSync = {
    syncLoopStarted: false,

    async init() {
        console.log("🌊 AquaSync Ecosystem Initializing...");
        
        // 🔥 THE FIX: Wait for state.js to finish checking Auth & loading Cloud/Local data
        window.addEventListener("aquasync_data_ready", () => {
            this.setupUI();
        });

        // Start the Identity/Auth listener (this will eventually fire the event above)
        IdentityStore.init(); 
    },

    setupUI() {
        if (Object.keys(DeviceStore.devices).length === 0) {
            // Hide the app pages
            ['page-insights', 'page-control', 'page-color', 'page-network'].forEach(id => {
                const el = document.getElementById(id);
                if (el) el.classList.add('hidden');
            });

            // Hide the bottom tab bar
            document.querySelectorAll("nav").forEach(nav => {
                if (nav.id !== "slot-top-nav") nav.classList.add("hidden");
            });

            // Force the Top Nav to be visible AND elevate it above the splash overlay!
            const topNav = document.getElementById("slot-top-nav");
            if (topNav) {
                topNav.classList.remove("hidden");
                topNav.style.display = "block"; 
                topNav.style.zIndex = "400";
            }
            
            initTopNav(); 
            renderEmptyState();
            return; 
        }

        // If we have devices, make sure bottom nav is visible
        document.querySelectorAll("nav").forEach(nav => {
            nav.classList.remove("hidden");
        });

        initTopNav();
        
        const lastOpenTab = localStorage.getItem('aquasync_active_tab') || 'page-control';
        this.switchTab(lastOpenTab); 
        
        this.renderActiveUI();

        // Prevent attaching multiple event listeners if Cloud Sync updates frequently
        if (!this.syncLoopStarted) {
            this.syncLoopStarted = true;
            this.runSyncLoop();

            document.addEventListener("visibilitychange", () => {
                if (document.visibilityState === 'visible') {
                    this.runSyncLoop();
                }
            });
        }
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
        
        const topPing = document.getElementById("ui-top-ping");
        const topDot = document.getElementById("ui-top-dot");
        
        if (topPing && topDot) {
            topPing.className = "absolute inline-flex h-full w-full rounded-full opacity-75";
            topDot.className = "relative inline-flex rounded-full h-2.5 w-2.5 transition-colors duration-300";
            
            if (status === "local") {
                topPing.classList.add("bg-blue-400", "animate-ping");
                topDot.classList.add("bg-blue-500");
            } else if (status === "cloud") {
                topPing.classList.add("bg-purple-400", "animate-ping");
                topDot.classList.add("bg-purple-500");
            } else { 
                topPing.classList.add("hidden"); 
                topDot.classList.add("bg-gray-500"); 
            }
        }
        
        const overviewPing = document.getElementById("ui-overview-ping");
        const overviewDot = document.getElementById("ui-overview-dot");
        
        if (overviewPing && overviewDot) {
            overviewPing.className = "absolute inline-flex h-full w-full rounded-full opacity-75";
            overviewDot.className = "relative inline-flex rounded-full h-2.5 w-2.5 transition-colors duration-300";
            
            if (status === "offline") {
                overviewPing.classList.add("hidden"); 
                overviewDot.classList.add("bg-red-500"); 
            } else { 
                overviewPing.classList.add("bg-blue-400", "animate-ping");
                overviewDot.classList.add("bg-blue-500");
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
                if (!spin.classList.contains('hidden') === false) { 
                    this.updateSyncStatus('idle');
                }
            }, 5000);
        } else {
            dot.classList.remove('hidden');
        }
    },

    async runSyncLoop() {
        const device = DeviceStore.getActiveDevice();
        if (!device) return;

        if (device.firmware.latest === "Checking..." || device.firmware.latest === "Unknown") {
            try {
                const fullManifestReq = await fetch("https://raw.githubusercontent.com/nafishfuad/AquaSync/main/firmware.json?t=" + Date.now());
                if (fullManifestReq.ok) {
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
    },

    renderActiveUI() {
        const device = DeviceStore.getActiveDevice();
        if (!device) return;

        const debouncedNetworkSend = debounce(async (targetDevice, payload) => {
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
        }, 5000);

        const commandHook = async (payload, fastUI = false) => {
            if ((payload.hasOwnProperty("isLightOn") || payload.hasOwnProperty("currentBrightness")) && !device.metrics.isCO2ScheduleSeparate) {
                payload.isCO2On = payload.hasOwnProperty("isLightOn") ? payload.isLightOn : (payload.currentBrightness > 0);
            }

            DeviceStore.updateDeviceState(device.hwid, payload);
            AquaSync.renderActiveUI(); 
            AquaSync.updateSyncStatus('syncing');

            if (!fastUI) {
                const res = await API.sendCommand(device, payload);
                if (res && res.success) {
                    AquaSync.updateSyncStatus('success'); 
                    if (res.returnedState) {
                        DeviceStore.updateDeviceState(device.hwid, res.returnedState);
                        AquaSync.renderActiveUI(); 
                    }
                } else {
                    AquaSync.updateSyncStatus('idle');
                }
            } else {
                debouncedNetworkSend(device, payload);
            }
        };

        buildControlPanel(device, commandHook);
        buildInsightsPanel(device);
        buildColorPanel(device, commandHook);
        buildSystemPanel(device, API, commandHook);

        this.setConnectionStatus(this.currentStatus || 'offline');
    }
};

// ==========================================
// GLOBALS FOR UI HTML ELEMENTS
// ==========================================
window.AquaSync = AquaSync;
window.showOutageModal = showOutageModal; 

window.handleAddNewDeviceForm = async function(hwid, model, name) {
    const result = await DeviceStore.claimDevice(hwid, model, name);
    if (!result.success) {
        alert(result.message); // Show the "Already Claimed" warning
    } else {
        // Force the app to re-evaluate the UI to show the new tank!
        AquaSync.setupUI();
    }
};

// Helper functions to open the modals from your TopNav buttons
window.openAuthModal = () => {
    const el = document.getElementById('modal-auth');
    if(el) el.classList.remove('hidden');
};
window.openAddDeviceModal = () => {
    const el = document.getElementById('modal-add-device');
    if(el) el.classList.remove('hidden');
};

// ==========================================
// ACCOUNT & NETWORK PAGE LOGIC
// ==========================================
window.addEventListener("aquasync_auth_changed", (e) => {
    const guestView = document.getElementById('network-guest-view');
    const authView = document.getElementById('network-auth-view');
    const emailDisplay = document.getElementById('ui-user-email');

    if (!guestView || !authView) return;

    if (e.detail.isGuest) {
        // Show Guest UI
        guestView.classList.remove('hidden');
        authView.classList.add('hidden');
    } else {
        // Show Logged-In UI
        guestView.classList.add('hidden');
        authView.classList.remove('hidden');
        if (emailDisplay) emailDisplay.innerText = e.detail.email;
    }
});

// Attach the Logout functionality
document.addEventListener("DOMContentLoaded", () => {
    const btnLogout = document.getElementById('btn-logout');
    if (btnLogout) {
        btnLogout.addEventListener('click', () => {
            if(confirm("Are you sure you want to sign out? Your tanks will remain connected to the cloud, but you won't be able to control them until you log back in.")) {
                IdentityStore.logout();
                // Clear local memory so the next user doesn't see the previous user's tanks
                DeviceStore.devices = {};
                DeviceStore.activeDeviceId = null;
                DeviceStore.save();
                window.location.reload(); // Hard reset the UI state
            }
        });
    }
});
// ==========================================
// UI EVENT LISTENERS & INITIALIZATION
// ==========================================
document.addEventListener("DOMContentLoaded", () => {
    
    // --- 1. LOGIN & SIGNUP LOGIC ---
    const btnLogin = document.getElementById('btn-login');
    const btnSignup = document.getElementById('btn-signup');
    const authError = document.getElementById('auth-error');

    const handleAuth = async (isLogin) => {
        const email = document.getElementById('auth-email').value.trim();
        const pass = document.getElementById('auth-password').value.trim();
        
        if (!email || pass.length < 6) {
            authError.innerText = "Valid email and 6+ char password required.";
            authError.classList.remove('hidden');
            return;
        }

        // Show loading state on buttons
        const originalText = isLogin ? btnLogin.innerText : btnSignup.innerText;
        if (isLogin) btnLogin.innerText = "Loading...";
        else btnSignup.innerText = "Loading...";
        
        authError.classList.add('hidden');

        // Call our Firebase IdentityStore
        const result = isLogin ? await IdentityStore.login(email, pass) : await IdentityStore.signup(email, pass);

        if (result.success) {
            document.getElementById('modal-auth').classList.add('hidden');
            document.getElementById('auth-email').value = "";
            document.getElementById('auth-password').value = "";
        } else {
            authError.innerText = result.message;
            authError.classList.remove('hidden');
        }

        // Restore button text
        if (isLogin) btnLogin.innerText = originalText;
        else btnSignup.innerText = originalText;
    };

    if (btnLogin) btnLogin.addEventListener('click', () => handleAuth(true));
    if (btnSignup) btnSignup.addEventListener('click', () => handleAuth(false));


    // --- 2. SMART DEVICE PROVISIONING LOGIC ---
    const btnScanLocal = document.getElementById('btn-scan-local');
    const formProvision = document.getElementById('form-provision-device');
    const scanError = document.getElementById('scan-error');

    if (btnScanLocal) {
        btnScanLocal.addEventListener('click', async () => {
            btnScanLocal.innerHTML = `Scanning...`;
            btnScanLocal.disabled = true;
            scanError.classList.add('hidden');

            try {
                // Ping the ESP32's local setup hotspot API using a timeout controller
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 4000); // 4 second timeout
                
                const response = await fetch("http://192.168.4.1/api/handshake", { 
                    signal: controller.signal 
                });
                clearTimeout(timeoutId);

                if (response.ok) {
                    const data = await response.json();
                    if (data.hw_id) {
                        // Success! We found the ESP32 and grabbed its ID invisibly.
                        document.getElementById('prov-hwid').value = data.hw_id;
                        document.getElementById('display-found-hwid').innerText = `ID: ${data.hw_id}`;
                        
                        // Switch UI to Step 2
                        document.getElementById('setup-step-1').classList.add('hidden');
                        document.getElementById('setup-step-2').classList.remove('hidden');
                    }
                } else {
                    throw new Error("Invalid response from device.");
                }
            } catch (err) {
                console.warn(err);
                scanError.innerText = "Tank not found. Ensure you are connected to the 'AquaControl_setup' Wi-Fi network.";
                scanError.classList.remove('hidden');
            } finally {
                btnScanLocal.innerHTML = `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg> Scan for Tank`;
                btnScanLocal.disabled = false;
            }
        });
    }

    if (formProvision) {
        formProvision.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const btnSubmit = document.getElementById('btn-submit-provision');
            btnSubmit.innerText = "Configuring Hardware...";
            btnSubmit.disabled = true;

            const hwid = document.getElementById('prov-hwid').value;
            const name = document.getElementById('prov-name').value;
            const ssid = document.getElementById('prov-ssid').value;
            const pass = document.getElementById('prov-pass').value;

            try {
                // 1. Send Wi-Fi credentials to the physical ESP32
                const wifiPayload = {
                    ssid: ssid,
                    pass: pass,
                    deviceName: name
                };

                // We don't await the fetch response because the ESP32 immediately reboots 
                // upon receiving this, dropping the network and causing a browser error.
                fetch("http://192.168.4.1/wifi", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(wifiPayload)
                }).catch(() => { /* Ignore network drop */ });

                btnSubmit.innerText = "Registering with Cloud...";

                // 2. Claim the device in our Firebase account immediately!
                await window.handleAddNewDeviceForm(hwid, "AS-Standard", name);

                // 3. Close the modal and reset it
                document.getElementById('modal-add-device').classList.add('hidden');
                document.getElementById('setup-step-2').classList.add('hidden');
                document.getElementById('setup-step-1').classList.remove('hidden');
                formProvision.reset();
                
                alert("Setup Complete! Connect your phone back to your Home Wi-Fi to see your tank.");

            } catch (err) {
                alert("Error claiming device: " + err.message);
            } finally {
                btnSubmit.innerText = "Connect to Cloud";
                btnSubmit.disabled = false;
            }
        });
    }

    // --- 3. START THE APP ---
    AquaSync.init();
});