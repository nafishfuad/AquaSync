// src/components/analytics/Overview.js

export function renderOverview(container, device) {
    const template = document.getElementById("tpl-insights-overview");
    if (!template) return;

    const clone = template.content.cloneNode(true);
    const m = device.metrics;
    const cap = device.capabilities;

    // --- Helper Functions ---
    const formatTime = (timeStr) => {
        if (!timeStr) return "--:--";
        let [h, min] = timeStr.split(':');
        h = parseInt(h);
        const ampm = h >= 12 ? 'PM' : 'AM';
        h = h % 12 || 12;
        return `${h}:${min} ${ampm}`;
    };

    const calcSunset = (startStr, durationHrs) => {
        if (!startStr) return "--:--";
        let [h, min] = startStr.split(':');
        h = (parseInt(h) + durationHrs) % 24;
        let formattedH = h < 10 ? '0' + h : h;
        return formatTime(`${formattedH}:${min}`);
    };

    // --- 1. Dynamic Top Status Grid ---
    const statusGrid = clone.querySelector(".tpl-status-grid");
    let statuses = [];

    statuses.push(`
        <div>
            <p class="text-[10px] text-gray-500 uppercase tracking-wider">Light Status</p>
            <p class="text-xl font-black ${m.isLightOn ? 'text-green-400' : 'text-gray-500'} tracking-wide">
                ${m.isLightOn ? `ON <span class="text-[10px] ml-1">(${m.currentBrightness}%)</span>` : 'OFF'}
            </p>
        </div>
    `);

    if (cap.hasCO2) {
        statuses.push(`
            <div class="${statuses.length === 1 ? 'text-right' : 'text-center'}">
                <p class="text-[10px] text-gray-500 uppercase tracking-wider">CO2 Status</p>
                <p class="text-xl font-black ${m.isCO2On ? 'text-green-400' : 'text-gray-500'} tracking-wide">${m.isCO2On ? 'ON' : 'OFF'}</p>
            </div>
        `);
    }

    if (cap.hasFan && m.isFanEnabled) {
        statuses.push(`
            <div class="text-right">
                <p class="text-[10px] text-gray-500 uppercase tracking-wider">Fan Status</p>
                <p class="text-xl font-black ${m.isFanOn ? 'text-blue-400' : 'text-gray-500'} tracking-wide">${m.isFanOn ? 'ON' : 'OFF'}</p>
            </div>
        `);
    }

    statusGrid.className = `grid grid-cols-${statuses.length} gap-4 pb-4 border-b border-gray-800/60`;
    statusGrid.innerHTML = statuses.join('');


    // --- 2. Standard Lighting Schedule Info ---
    clone.querySelector(".tpl-sunrise-val").innerText = formatTime(m.startTime);
    clone.querySelector(".tpl-sunset-val").innerText = calcSunset(m.startTime, m.photoperiod);
    clone.querySelector(".tpl-photo-val").innerText = `${m.photoperiod} hrs`;
    clone.querySelector(".tpl-recovery-val").innerText = `${m.recoveryMins} min`;


    // --- 3. 🔥 THE NEW LOAD SHEDDING UI ---
    // Extract variables directly from our updated state.js
    const loadSheddingText = device.analyticsData?.today?.loadShedding || "00h 00m";
    const totalBlackoutText = device.analyticsData?.today?.totalBlackout || "00h 00m";
    
    // Only show the warning box if there has actually been a blackout today
    if (loadSheddingText !== "00h 00m" || totalBlackoutText !== "00h 00m") {
        const blackoutWarningHTML = `
            <div class="mt-4 p-3 rounded-lg bg-red-900/20 border border-red-500/30 cursor-pointer transition-colors hover:bg-red-900/30" id="btn-blackout-modal">
                <div class="flex items-center justify-between">
                    <div>
                        <p class="text-[10px] font-bold text-red-400 uppercase tracking-wider flex items-center gap-1">
                            <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
                            Power Outage Detected
                        </p>
                        <p class="text-sm text-gray-300 mt-0.5">Disrupted Light: <span class="text-red-300 font-black">${loadSheddingText}</span></p>
                    </div>
                    <svg class="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path></svg>
                </div>
            </div>
        `;

        // Inject this directly above the dynamic rows (CO2/Fan)
        const dynamicRowsNode = clone.querySelector(".tpl-dynamic-rows");
        dynamicRowsNode.insertAdjacentHTML('beforebegin', blackoutWarningHTML);

        // Attach the click event for the Modal
        const btnBlackout = clone.querySelector("#btn-blackout-modal");
        btnBlackout.addEventListener("click", () => {
            alert(`🔌 TOTAL HOUSE OUTAGE: ${totalBlackoutText}\n☀️ LOST LIGHT SCHEDULE: ${loadSheddingText}\n\nThe 'Lost Light' tracks exactly how many minutes your fish spent in the dark while they were supposed to be illuminated. The 'Total Outage' includes blackouts that happened while the lights were already scheduled to be off.`);
        });
    }

    // --- 4. Dynamic Additional Rows (Separate CO2 & Fan) ---
    const dynamicRows = clone.querySelector(".tpl-dynamic-rows");
    let rowsHTML = "";

    if (cap.hasCO2 && m.isCO2ScheduleSeparate) {
        rowsHTML += `
            <div class="grid grid-cols-2 gap-4 pt-3 border-t border-gray-800/40">
                <div>
                    <p class="text-[10px] text-gray-500 uppercase tracking-wider mb-0.5">CO2 Injection Starts</p>
                    <span class="text-sm font-bold text-gray-300">${formatTime(m.co2OnTime)}</span>
                </div>
                <div class="text-right">
                    <p class="text-[10px] text-gray-500 uppercase tracking-wider mb-0.5">CO2 Injection Ends</p>
                    <span class="text-sm font-bold text-gray-300">${formatTime(m.co2OffTime)}</span>
                </div>
            </div>
        `;
    }

    if (cap.hasFan && m.isFanEnabled) {
        rowsHTML += `
            <div class="grid grid-cols-2 gap-4 pt-3 border-t border-gray-800/40 mt-3">
                <div>
                    <p class="text-[10px] text-gray-500 uppercase tracking-wider mb-0.5">Surface Cooler Starts</p>
                    <span class="text-sm font-bold text-gray-300">${formatTime(m.fanOnTime)}</span>
                </div>
                <div class="text-right">
                    <p class="text-[10px] text-gray-500 uppercase tracking-wider mb-0.5">Surface Cooler Ends</p>
                    <span class="text-sm font-bold text-gray-300">${formatTime(m.fanOffTime)}</span>
                </div>
            </div>
        `;
    }

    dynamicRows.innerHTML = rowsHTML;
    container.appendChild(clone);
}