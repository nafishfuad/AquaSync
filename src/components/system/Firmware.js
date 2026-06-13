// src/components/system/Firmware.js

import { DeviceStore } from '../../state.js'; // Needed to grab the exact device model

export function renderFirmware(container, fwState, commandHook) {
    const div = document.createElement('div');
    div.className = "bg-cardbg rounded-2xl p-5 shadow-lg border border-gray-800";
    
    // Determine update logic
    const isUpdateAvailable = (fwState.current !== fwState.latest) && (fwState.latest !== "Checking..." && fwState.latest !== "Unknown");
    const statusText = isUpdateAvailable ? "New firmware found! Ready to install." : "Your device is up to date.";
    const statusColor = isUpdateAvailable ? "text-green-400" : "text-gray-500";
    
    // Styling for active vs disabled buttons
    const btnStyle = isUpdateAvailable 
        ? "bg-aqua/10 text-aqua border-aqua/50 hover:bg-aqua hover:text-black shadow-[0_0_15px_rgba(0,242,254,0.15)] cursor-pointer" 
        : "bg-[#121212] text-gray-600 border-gray-800 opacity-50 cursor-not-allowed";

    div.innerHTML = `
        <h2 class="text-sm uppercase text-gray-400 font-semibold tracking-wide mb-4">Firmware Update</h2>
        
        <div class="flex justify-between text-[10px] text-gray-400 mb-4 bg-[#121212] p-3 rounded-xl border border-gray-800 shadow-inner">
            <span>Device: <span class="text-white font-bold tracking-wider">${fwState.current}</span></span>
            <span>Latest: <span class="text-aqua font-bold tracking-wider">${fwState.latest}</span></span>
        </div>

        <p id="txt-fw-status" class="text-[10px] ${statusColor} mb-4 leading-relaxed text-center font-medium">
            ${statusText}
        </p>

        <button id="btn-fw-execute" ${!isUpdateAvailable ? 'disabled' : ''} class="w-full ${btnStyle} font-bold py-3.5 rounded-xl border text-[10px] uppercase tracking-widest transition-all active:scale-95">
            Download & Install Update
        </button>
    `;

    const btnExecute = div.querySelector('#btn-fw-execute');
    const statusTxt = div.querySelector('#txt-fw-status');

    if (btnExecute && isUpdateAvailable) {
        btnExecute.onclick = () => {
            if (confirm("Begin OTA firmware update? The device will pull the update directly from the cloud and reboot automatically.")) {
                
                // 1. Lock the UI
                btnExecute.innerHTML = `<span class="animate-spin inline-block mr-2">⏳</span> Instructing Device...`;
                btnExecute.classList.add("opacity-50", "pointer-events-none");
                
                statusTxt.innerText = "Connecting to ESP32...";
                statusTxt.classList.replace("text-green-400", "text-amber-400");

                // Grab the model for verification
                const activeModel = DeviceStore.getActiveDevice()?.model || "AS-Standard";

                // 2. Fire the Universal Payload!
                commandHook({ 
                    command: "execute_ota",
                    device_model: activeModel,
                    version: fwState.latest,
                    firmware_url: fwState.downloadUrl
                });

                // 3. UI Animation Sequence
                setTimeout(() => {
                    statusTxt.innerText = "The ESP32 is currently downloading and installing the file...";
                }, 2000);

                setTimeout(() => {
                    btnExecute.innerHTML = `✅ Update Sent`;
                    statusTxt.innerText = "Installation command sent. Waiting for device to reboot and reconnect... (Auto-reloading in 15s)";
                    statusTxt.classList.replace("text-amber-400", "text-aqua");
                    
                    // 4. Force a page reload after 15 seconds to fetch the new version from the ESP32
                    setTimeout(() => window.location.reload(), 15000);
                }, 7000); 
            }
        };
    }

    container.appendChild(div);
}