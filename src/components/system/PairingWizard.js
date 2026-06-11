// src/components/system/PairingWizard.js
import { DeviceStore } from '../../state.js';
import { API } from '../../api.js';

let heartbeatInterval = null;

export function renderPairingWizard(onComplete) {
    const slot = document.getElementById("slot-global-overlays");
    const template = document.getElementById("tpl-pairing-wizard");
    if (!template || !slot) return;

    slot.innerHTML = "";
    const clone = template.content.cloneNode(true);
    
    // 1. IMMEDIATELY APPEND TO LIVE DOM
    slot.classList.remove("hidden");
    slot.classList.add("flex");
    slot.appendChild(clone);

    let secureToken = null;
    let discoveredHwid = null;

    // 2. Start Polling for the ESP32 Hotspot
    const startHeartbeat = () => {
        heartbeatInterval = setInterval(async () => {
            const handshake = await API.checkHotspotHandshake();
            if (handshake && handshake.hw_id) {
                clearInterval(heartbeatInterval);
                secureToken = handshake.session_token;
                discoveredHwid = handshake.hw_id;
                
                // Transition UI (Targeting live DOM elements)
                document.getElementById("txt-found-hwid").innerText = `HW_ID: ${discoveredHwid}`;
                document.getElementById("view-listen").classList.add("hidden");
                document.getElementById("view-found").classList.remove("hidden");
            }
        }, 3000);
    };

    startHeartbeat();

    // 3. Handle Closing the Modal
    const closeModal = (e) => {
        if (e) e.stopPropagation(); // Prevents clicks from misfiring
        clearInterval(heartbeatInterval);
        
        slot.innerHTML = "";

        // If they cancel pairing and have 0 devices, go back to the empty splash screen
        if (Object.keys(DeviceStore.devices).length === 0) {
            renderEmptyState();
        } else {
            // Otherwise, hide the overlay completely
            slot.classList.add("hidden");
            slot.classList.remove("flex");
        }
    };

    // Grab the live button and attach listener
    document.getElementById("btn-close-wizard").addEventListener("click", closeModal);

    // 4. Handle Submitting Credentials
    const btnSend = document.getElementById("btn-send-creds");
    btnSend.addEventListener("click", async () => {
        const ssid = document.getElementById("inp-ssid").value.trim();
        const pass = document.getElementById("inp-pass").value.trim();
        const deviceName = document.getElementById("inp-name").value.trim() || "AquaSync Controller";

        if (!ssid || !pass) {
            alert("Please enter both Wi-Fi Name and Password.");
            return;
        }

        btnSend.innerHTML = `<span class="animate-spin inline-block mr-2">⏳</span> Sending...`;
        btnSend.classList.add("opacity-50", "pointer-events-none");

        // 🔥 PROBLEM 1 FIX: Pass the deviceName into the API so the ESP32 remembers it!
        const success = await API.sendWifiProvisioning(ssid, pass, secureToken, deviceName);

        if (success) {
            btnSend.innerHTML = `✅ Paired!`;
            // Save the new device to browser memory
            DeviceStore.addDevice(discoveredHwid, "AS-Standard", deviceName);
            DeviceStore.updateNetwork(discoveredHwid, null, true); 
            
            setTimeout(() => {
                closeModal();
                if (onComplete) onComplete(); 
            }, 1500);
        } else {
            btnSend.innerHTML = `❌ Failed. Try Again`;
            btnSend.classList.remove("opacity-50", "pointer-events-none");
            setTimeout(() => btnSend.innerHTML = `PAIR DEVICE`, 2000);
        }
    });
}

// Renders the initial "No Devices Linked" screen
export function renderEmptyState() {
    const slot = document.getElementById("slot-global-overlays");
    const template = document.getElementById("tpl-empty-splash");
    if (!template || !slot) return;

    slot.innerHTML = "";
    const clone = template.content.cloneNode(true);
    
    // 1. Append to live DOM immediately!
    slot.classList.remove("hidden");
    slot.classList.add("flex");
    slot.appendChild(clone);

    // 2. Attach the click listener to the live element
    document.getElementById("btn-start-discovery").addEventListener("click", () => {
        renderPairingWizard(() => {
            // Once paired, hide the empty state and reload the UI
            slot.classList.add("hidden");
            slot.classList.remove("flex");
            window.location.reload(); 
        });
    });
}