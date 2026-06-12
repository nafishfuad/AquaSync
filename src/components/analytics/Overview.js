// src/components/analytics/Overview.js

export function renderOverview(container, device) {
    const template = document.getElementById("tpl-insights-overview");
    if (!template) return;

    const clone = template.content.cloneNode(true);
    const m = device.metrics;
    const cap = device.capabilities;

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

    const styleTimeStr = (str, colorClass = "text-white") => {
        const hmMatch = str.match(/(\d{2})h (\d{2})m/);
        if (hmMatch) return `<span class="text-3xl font-bold ${colorClass} tracking-tight">${hmMatch[1]}</span><span class="text-xs text-gray-500 font-bold mx-0.5">h</span> <span class="text-3xl font-bold ${colorClass} tracking-tight">${hmMatch[2]}</span><span class="text-xs text-gray-500 font-bold mx-0.5">m</span>`;
        
        const mMatch = String(str).match(/^(\d+)m?$/);
        if (mMatch) return `<span class="text-3xl font-bold ${colorClass} tracking-tight">${String(mMatch[1]).padStart(2, '0')}</span><span class="text-xs text-gray-500 font-bold mx-0.5">m</span>`;
        
        return `<span class="text-3xl font-bold ${colorClass}">${str}</span>`;
    };

    // --- 1. Dynamic Top Status Grid ---
    const statusGrid = clone.querySelector(".tpl-status-grid");
    let statuses = [];

    statuses.push(`
        <div class="text-left">
            <p class="text-[10px] text-gray-500 uppercase tracking-wider font-bold mb-1">Light Status</p>
            <p class="text-3xl font-bold ${m.isLightOn ? 'text-green-400' : 'text-gray-500'} tracking-tight">
                ${m.isLightOn ? `ON <span class="text-sm text-green-400/50 font-bold ml-1">(${m.currentBrightness}%)</span>` : 'OFF'}
            </p>
        </div>
    `);

    if (cap.hasCO2) {
        statuses.push(`
            <div class="${(cap.hasFan && m.isFanEnabled) ? 'text-center' : 'text-right'}">
                <p class="text-[10px] text-gray-500 uppercase tracking-wider font-bold mb-1">CO2 Status</p>
                <p class="text-3xl font-bold ${m.isCO2On ? 'text-green-400' : 'text-gray-500'} tracking-tight">${m.isCO2On ? 'ON' : 'OFF'}</p>
            </div>
        `);
    }

    if (cap.hasFan && m.isFanEnabled) {
        statuses.push(`
            <div class="text-right">
                <p class="text-[10px] text-gray-500 uppercase tracking-wider font-bold mb-1">Fan Status</p>
                <p class="text-3xl font-bold ${m.isFanOn ? 'text-blue-400' : 'text-gray-500'} tracking-tight">${m.isFanOn ? 'ON' : 'OFF'}</p>
            </div>
        `);
    }

    statusGrid.className = `grid grid-cols-${statuses.length} gap-4 pb-6 border-b border-gray-800/40`;
    statusGrid.innerHTML = statuses.join('');

    // --- 2. Clean Row Layout ---
    clone.querySelector(".tpl-sunrise-val").innerHTML = `<span class="text-xl font-bold text-gray-200">${formatTime(m.startTime)}</span>`;
    clone.querySelector(".tpl-sunset-val").innerHTML = `<span class="text-xl font-bold text-gray-200">${calcSunset(m.startTime, m.photoperiod)}</span>`;
    
    clone.querySelector(".tpl-photo-val").innerHTML = styleTimeStr(`${String(m.photoperiod).padStart(2, '0')}h 00m`, "text-white");
    clone.querySelector(".tpl-recovery-val").innerHTML = styleTimeStr(`${m.recoveryMins}m`, "text-red-400");


    // --- 3. The Load Shedding Warning ---
    const loadSheddingText = device.analyticsData?.today?.loadShedding || "00h 00m";
    const totalBlackoutText = device.analyticsData?.today?.totalBlackout || "00h 00m";
    
    if (loadSheddingText !== "00h 00m" || totalBlackoutText !== "00h 00m") {
        const blackoutWarningHTML = `
            <div class="mt-4 p-4 rounded-xl bg-red-900/10 border border-red-900/40 cursor-pointer transition-colors hover:bg-red-900/20" id="btn-blackout-modal">
                <div class="flex items-center justify-between">
                    <div>
                        <p class="text-[10px] font-bold text-red-400 uppercase tracking-wider flex items-center gap-1.5 mb-1">
                            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
                            Power Outage Detected
                        </p>
                        <p class="text-[12px] text-gray-300 font-medium">Disrupted Light: <span class="ml-1 text-red-400">${loadSheddingText}</span></p>
                    </div>
                    <svg class="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path></svg>
                </div>
            </div>
        `;

        const dynamicRowsNode = clone.querySelector(".tpl-dynamic-rows");
        dynamicRowsNode.insertAdjacentHTML('beforebegin', blackoutWarningHTML);

        const btnBlackout = clone.querySelector("#btn-blackout-modal");
        btnBlackout.addEventListener("click", () => {
            alert(`🔌 TOTAL HOUSE OUTAGE: ${totalBlackoutText}\n☀️ LOST LIGHT SCHEDULE: ${loadSheddingText}`);
        });
    }

    // --- 4. Dynamic Additional Rows ---
    const dynamicRows = clone.querySelector(".tpl-dynamic-rows");
    let rowsHTML = "";

    if (cap.hasCO2 && m.isCO2ScheduleSeparate) {
        rowsHTML += `
            <div class="grid grid-cols-2 gap-4 mt-6">
                <div>
                    <p class="text-[10px] text-gray-500 uppercase tracking-wider font-bold mb-1">CO2 Starts</p>
                    <span class="text-xl font-bold text-gray-200">${formatTime(m.co2OnTime)}</span>
                </div>
                <div class="text-right">
                    <p class="text-[10px] text-gray-500 uppercase tracking-wider font-bold mb-1">CO2 Ends</p>
                    <span class="text-xl font-bold text-gray-200">${formatTime(m.co2OffTime)}</span>
                </div>
            </div>
        `;
    }

    if (cap.hasFan && m.isFanEnabled) {
        rowsHTML += `
            <div class="grid grid-cols-2 gap-4 mt-6">
                <div>
                    <p class="text-[10px] text-gray-500 uppercase tracking-wider font-bold mb-1">Fan Starts</p>
                    <span class="text-xl font-bold text-gray-200">${formatTime(m.fanOnTime)}</span>
                </div>
                <div class="text-right">
                    <p class="text-[10px] text-gray-500 uppercase tracking-wider font-bold mb-1">Fan Ends</p>
                    <span class="text-xl font-bold text-gray-200">${formatTime(m.fanOffTime)}</span>
                </div>
            </div>
        `;
    }

    dynamicRows.innerHTML = rowsHTML;
    container.appendChild(clone);
}