// src/components/analytics/Charts.js

import { DeviceStore } from '../../state.js';

export function renderCharts(container, analyticsData) {
    const template = document.getElementById("tpl-analytics-chart-card");
    if (!template) return;

    const device = DeviceStore.getActiveDevice();
    const m = device ? device.metrics : null;

    const isLightMode = document.body.classList.contains("light-theme");
    const gridColor = isLightMode ? 'rgba(0, 0, 0, 0.05)' : 'rgba(255, 255, 255, 0.05)';
    Chart.defaults.color = isLightMode ? "#64748b" : "#6b7280"; 
    Chart.defaults.font.family = "sans-serif";
    Chart.defaults.plugins.legend.display = false;

    const styleTimeStr = (str, colorClass="text-white") => {
        const match = str.match(/(\d{2})h (\d{2})m/);
        if (match) return `<div class="whitespace-nowrap"><span class="text-2xl font-bold ${colorClass} tracking-tight">${match[1]}</span><span class="text-[11px] text-gray-500 font-bold mx-0.5">h</span><span class="text-2xl font-bold ${colorClass} tracking-tight">${match[2]}</span><span class="text-[11px] text-gray-500 font-bold mx-0.5">m</span></div>`;
        return `<div class="whitespace-nowrap text-2xl font-bold ${colorClass}">${str}</div>`;
    };

    const createChartCard = (title, statsArray, chartConfigBuilder) => {
        const clone = template.content.cloneNode(true);
        clone.querySelector(".tpl-chart-title").innerText = title;
        
        const statsGrid = clone.querySelector(".tpl-stats-grid");
        statsGrid.className = `grid grid-cols-${statsArray.length} gap-2 mb-2 pb-4 text-xs`;
        
        let statsHTML = "";
        statsArray.forEach((stat, index) => {
            let alignClass = "text-left";
            if (statsArray.length === 2 && index === 1) alignClass = "text-right";
            else if (statsArray.length === 3) {
                if (index === 1) alignClass = "text-center border-x border-gray-800/60 px-2";
                if (index === 2) alignClass = "text-right";
            }
            statsHTML += `
                <div class="${alignClass}">
                    <p class="text-[10px] text-gray-500 uppercase tracking-wider mb-1 font-bold">${stat.label}</p>
                    <div>${styleTimeStr(stat.value, stat.color)}</div>
                </div>
            `;
        });
        statsGrid.innerHTML = statsHTML;
        
        const canvas = clone.querySelector(".tpl-chart-canvas");
        container.appendChild(clone); 
        
        const ctx = canvas.getContext('2d');
        const finalConfig = chartConfigBuilder(ctx);
        new Chart(canvas, finalConfig);
    };

    const getGradient = (ctx, r, g, b) => {
        const gradient = ctx.createLinearGradient(0, 0, 0, 150);
        gradient.addColorStop(0, `rgba(${r}, ${g}, ${b}, 0.35)`); 
        gradient.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0.0)`); 
        return gradient;
    };


    // ==========================================
    // 1. TODAY'S UNIFIED SINGLE-LINE TIMELINE
    // ==========================================
    let labels = [];
    let chartData = [];
    let segmentColors = [];

    if (m && analyticsData && analyticsData.today) {
        const parseMins = (str) => {
            let [h, min] = str.split(':');
            return (parseInt(h) * 60) + parseInt(min);
        };
        
        const startMins = parseMins(m.startTime);
        const photoMins = m.photoperiod * 60;
        const endMins = startMins + photoMins;
        
        const graphStartMins = startMins - 120; 
        const graphEndMins = endMins + 120; 

        const now = new Date();
        const nowMins = (now.getHours() * 60) + now.getMinutes();
        
        let relativeNowMins = nowMins;
        if (relativeNowMins < graphStartMins) {
            relativeNowMins += 1440; 
        }

        const hourlyGraph = analyticsData.today.hourlyGraph || Array(24).fill(0);
        const awakeHistory = analyticsData.today.awakeData || Array(24).fill(1);
        const hasLoadShedding = analyticsData.today.loadShedding !== "00h 00m";

        for (let t = graphStartMins; t <= graphEndMins; t += 5) {
            let normalizedT = (t + 1440) % 1440; 
            let h = Math.floor(normalizedT / 60);
            let min = Math.floor(normalizedT % 60);
            
            if (min === 0) {
                let ampm = h >= 12 ? 'PM' : 'AM';
                let dispH = h % 12 || 12;
                labels.push(`${dispH}${ampm}`);
            } else {
                labels.push('');
            }
            
            let isSched = (endMins > 1440) 
                ? (normalizedT >= startMins || normalizedT <= (endMins % 1440))
                : (normalizedT >= startMins && normalizedT <= endMins);
            
            let isFuture = t > relativeNowMins;
            let isActuallyOn = false;
            let isBlackout = false;

            if (!isFuture) {
                if (isSched) {
                    isActuallyOn = hourlyGraph[h] > 0;
                    
                    // 🔥 LIVE OVERRIDE: If the light is physically ON right now, force the chart 
                    // to paint Cyan up to the current minute, overriding any delays in the ESP32 array sync!
                    if (h === now.getHours() && device.metrics.isLightOn) {
                        isActuallyOn = true;
                    }
                }

                if (isSched && !isActuallyOn && hasLoadShedding && awakeHistory[h] === 0) {
                    isBlackout = true;
                }
            }

            let y = (isSched || isActuallyOn) ? 1 : 0;
            chartData.push(y);

            let sliceColor = isLightMode ? '#cbd5e1' : '#374151'; // Lighter grey track for light mode
            if (y === 1) {
                if (isFuture) sliceColor = isLightMode ? '#cbd5e1' : '#374151'; 
                else if (isActuallyOn) sliceColor = '#00f2fe'; // Aqua Blue Active Time
                else if (isBlackout) sliceColor = '#ef4444'; 
                else sliceColor = isLightMode ? '#cbd5e1' : '#374151'; 
            }
            segmentColors.push(sliceColor);
        }
    }

    createChartCard(
        "Today's Hourly Activity", 
        [
            { label: "Total Active", value: analyticsData.today.totalActive, color: "text-white" },
            { label: "Load Shedding", value: analyticsData.today.loadShedding, color: "text-red-500" }
        ],
        (ctx) => ({
            type: 'line',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: 'Activity',
                        data: chartData,
                        borderWidth: 2,
                        stepped: 'middle', 
                        fill: false,   
                        pointRadius: 0,
                        segment: {
                            borderColor: (ctx) => {
                                if (ctx.p0.parsed.y === 0 && ctx.p1.parsed.y === 0) return isLightMode ? '#e2e8f0' : '#1f2937'; 
                                if (ctx.p0.parsed.y === 1 && ctx.p1.parsed.y === 1) return segmentColors[ctx.p0DataIndex];
                                return segmentColors[ctx.p0.parsed.y === 1 ? ctx.p0DataIndex : ctx.p1DataIndex] || '#00f2fe';
                            }
                        }
                    }
                ]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                scales: {
                    y: { 
                        min: -0.1, max: 1.1, 
                        ticks: { stepSize: 1, callback: v => v === 1 ? 'ON' : (v === 0 ? 'OFF' : '') }, 
                        grid: { color: gridColor, drawBorder: false } 
                    },
                    x: { 
                        grid: { display: false }, 
                        ticks: { autoSkip: false, maxRotation: 45, minRotation: 45, callback: function(val, index) { return labels[index]; } } 
                    }
                }
            }
        })
    );


    // ==========================================
    // 2. 7-DAY GRAPH 
    // ==========================================
    const getLast7DaysLabels = () => {
        const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        const labels = [];
        const today = new Date().getDay();
        for (let i = 6; i >= 0; i--) labels.push(days[(today - i + 7) % 7]);
        return labels;
    };

    createChartCard(
        "7-Day Overview", 
        [
            { label: "Total Active", value: analyticsData.week.totalActive, color: "text-white" },
            { label: "Daily Avg", value: analyticsData.week.avgLight, color: "text-aqua" },
            { label: "Load Shedding", value: analyticsData.week.loadShedding, color: "text-red-500" }
        ],
        (ctx) => ({
            type: 'line',
            data: {
                labels: getLast7DaysLabels(),
                datasets: [{
                    data: analyticsData.week.dailyGraph,
                    borderColor: '#00f2fe',
                    backgroundColor: getGradient(ctx, 0, 242, 254),
                    borderWidth: 2,
                    fill: true,
                    tension: 0.4, 
                    pointBackgroundColor: isLightMode ? '#ffffff' : '#121212', 
                    pointBorderColor: '#00f2fe',     
                    pointBorderWidth: 2,
                    pointRadius: 4,
                    pointHoverRadius: 6
                }]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                scales: { 
                    y: { beginAtZero: true, suggestedMax: 12, grid: { color: gridColor, drawBorder: false } }, 
                    x: { grid: { display: false } } 
                }
            }
        })
    );


    // ==========================================
    // 3. 30-DAY GRAPH
    // ==========================================
    createChartCard(
        "30-Day Overview", 
        [
            { label: "Total Active", value: analyticsData.month.totalActive, color: "text-white" },
            { label: "Daily Avg", value: analyticsData.month.avgLight, color: "text-purple-400" },
            { label: "Load Shedding", value: analyticsData.month.loadShedding, color: "text-red-500" }
        ],
        (ctx) => ({
            type: 'line',
            data: {
                labels: Array.from({length: 30}, (_, i) => i+1),
                datasets: [{
                    data: analyticsData.month.dailyGraph,
                    borderColor: '#a855f7', 
                    backgroundColor: getGradient(ctx, 168, 85, 247),
                    borderWidth: 2,
                    fill: true,
                    tension: 0.4,
                    pointRadius: 0 
                }]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                scales: { 
                    y: { beginAtZero: true, suggestedMax: 12, grid: { color: gridColor, drawBorder: false } }, 
                    x: { grid: { display: false }, ticks: { maxTicksLimit: 6 } } 
                }
            }
        })
    );
}