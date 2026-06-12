// src/components/system/Maintenance.js

import { DeviceStore } from '../../state.js';
import { showSystemActionModal } from './SystemModals.js';

export function renderMaintenance(container, commandHook) {
    const div = document.createElement('div');
    div.className = "bg-cardbg rounded-2xl p-5 shadow-lg border border-gray-800";
    
    div.innerHTML = `
        <h2 class="text-sm uppercase text-gray-400 font-semibold tracking-wide mb-4">System Maintenance</h2>
        <div class="space-y-3">
            <button id="btn-reboot" class="w-full bg-[#121212] text-gray-300 border border-gray-700 hover:border-gray-500 hover:text-white font-bold py-3.5 rounded-xl text-[10px] uppercase tracking-widest transition-all active:scale-95 shadow-sm">
                Reboot Controller
            </button>
            <button id="btn-reset" class="w-full bg-red-500/10 text-red-400 border border-red-500/30 hover:bg-red-500 hover:text-white font-bold py-3.5 rounded-xl text-[10px] uppercase tracking-widest transition-all active:scale-95 shadow-[0_0_10px_rgba(239,68,68,0.1)]">
                Factory Reset
            </button>
        </div>
    `;

    const activeDevice = DeviceStore.getActiveDevice();
    const deviceName = activeDevice ? activeDevice.name : "this device";
    const hwid = activeDevice ? activeDevice.hwid : null;

    div.querySelector('#btn-reboot').onclick = () => {
        // Trigger the custom beautiful modal
        showSystemActionModal('reboot', deviceName, () => {
            // Send command to ESP32
            commandHook({ command: "reboot" });
        });
    };

    div.querySelector('#btn-reset').onclick = () => {
        // Trigger the custom beautiful modal (Red Warning)
        showSystemActionModal('reset', deviceName, () => {
            // 1. Send command to ESP32
            commandHook({ command: "factory_reset" });
            
            // 2. 🔥 THE BUG FIX: Surgically remove ONLY this device from memory
            if (hwid) {
                DeviceStore.removeDevice(hwid);
            }

            // 3. Reload the UI gracefully
            setTimeout(() => {
                if (Object.keys(DeviceStore.devices).length === 0) {
                    // Show the empty setup wizard
                    window.location.reload(); 
                } else {
                    // Snap to the next available tank automatically
                    window.location.reload(); 
                }
            }, 1000);
        });
    };

    container.appendChild(div);
}