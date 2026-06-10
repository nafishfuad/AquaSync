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
    
    const viewListen = clone.querySelector("#view-listen");
    const viewFound = clone.querySelector("#view-found");
    const txtHwid = clone.querySelector("#txt-found-hwid");
    const btnClose = clone.querySelector("#btn-close-wizard");
    const btnSend = clone.querySelector("#btn-send-creds");

    let secureToken = null;
    let discoveredHwid = null;

    slot.classList.remove("hidden");
    slot.classList.add("flex");
    slot.appendChild(clone);

    // 1. Start Polling for the ESP32 Hotspot
    const startHeartbeat = () => {
        heartbeatInterval = setInterval(async () => {
            const handshake = await API.checkHotspotHandshake();
            if (handshake && handshake.hw_id) {
                clearInterval(heartbeatInterval);
                secureToken = handshake.session_token;
                discoveredHwid = handshake.hw_id;
                
                // Transition UI
                txtHwid.innerText = `HW_ID: ${discoveredHwid}`;
                viewListen.classList.add("hidden");
                viewFound.classList.remove("hidden");
            }
        }, 3000);
    };

    startHeartbeat();

    // 2. Handle Closing the Modal
    const closeModal = () => {
        clearInterval(heartbeatInterval);
        slot.classList.add("hidden");
        slot.classList.remove("flex");
        slot.innerHTML = "";
    };

    btnClose.onclick = closeModal;

    // 3. Handle Submitting Credentials
    btnSend.onclick = async () => {
        const ssid = document.getElementById("inp-ssid").value.trim();
        const pass = document.getElementById("inp-pass").value.trim();
        const deviceName = document.getElementById("inp-name").value.trim() || "AquaSync Controller";

        if (!ssid || !pass) {
            alert("Please enter both Wi-Fi Name and Password.");
            return;
        }

        btnSend.innerHTML = `<span class="animate-spin inline-block mr-2">⏳</span> Sending...`;
        btnSend.classList.add("opacity-50", "pointer-events-none");

        const success = await API.sendWifiProvisioning(ssid, pass, secureToken);

        if (success) {
            btnSend.innerHTML = `✅ Paired!`;
            // Save the new device to browser memory
            DeviceStore.addDevice(discoveredHwid, "AS-Standard", deviceName);
            DeviceStore.updateNetwork(discoveredHwid, null, true); // Mark as initially connected
            
            setTimeout(() => {
                closeModal();
                onComplete(); // Tells main.js to refresh the whole app
            }, 1500);
        } else {
            btnSend.innerHTML = `❌ Failed. Try Again`;
            btnSend.classList.remove("opacity-50", "pointer-events-none");
            setTimeout(() => btnSend.innerHTML = `PAIR DEVICE`, 2000);
        }
    };
}

// Renders the initial "No Devices Linked" screen
export function renderEmptyState(onStartPairing) {
    const slot = document.getElementById("slot-global-overlays");
    const template = document.getElementById("tpl-empty-splash");
    if (!template || !slot) return;

    slot.innerHTML = "";
    const clone = template.content.cloneNode(true);
    
    clone.querySelector("#btn-start-discovery").onclick = () => {
        renderPairingWizard(() => {
            // Once paired, hide the empty state and reload the UI
            slot.classList.add("hidden");
            slot.classList.remove("flex");
            window.location.reload(); 
        });
    };

    slot.classList.remove("hidden");
    slot.classList.add("flex");
    slot.appendChild(clone);
}