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

    // Light is always required
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

    // Set grid columns based on how many devices are active (2 or 3)
    statusGrid.className = `grid grid-cols-${statuses.length} gap-4 pb-4 border-b border-gray-800/60`;
    statusGrid.innerHTML = statuses.join('');


    // --- 2. Standard Lighting Schedule Info ---
    clone.querySelector(".tpl-sunrise-val").innerText = formatTime(m.startTime);
    clone.querySelector(".tpl-sunset-val").innerText = calcSunset(m.startTime, m.photoperiod);
    clone.querySelector(".tpl-photo-val").innerText = `${m.photoperiod} hrs`;
    clone.querySelector(".tpl-recovery-val").innerText = `${m.recoveryMins} min`;


    // --- 3. Dynamic Additional Rows (Separate CO2 & Fan) ---
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
            <div class="grid grid-cols-2 gap-4 pt-3 border-t border-gray-800/40">
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