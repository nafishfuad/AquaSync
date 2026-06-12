// src/components/analytics/Charts.js

import { DeviceStore } from '../../state.js';

export function renderCharts(container, analyticsData) {
    const template = document.getElementById("tpl-analytics-chart-card");
    if (!template) return;

    const device = DeviceStore.getActiveDevice();
    const m = device ? device.metrics : null;

    Chart.defaults.color = "#6b7280";
    Chart.defaults.font.family = "sans-serif";
    Chart.defaults.plugins.legend.display = false;

    // 🔥 PRECISE TYPOGRAPHY: Shrunk to text-2xl and uses whitespace-nowrap
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
        
        // Exact timeline framing: Strictly 2 hours before start, 2 hours after end (No % padding)
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

        // 🔥 BULLETPROOF FIX: Generate exactly ONE continuous line
        for (let t = graphStartMins; t <= graphEndMins; t += 5) {
            let normalizedT = (t + 1440) % 1440; 
            let h = Math.floor(normalizedT / 60);
            let min = Math.floor(normalizedT % 60);
            
            // X-Axis labels: Show text exactly on the hour
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
                if (h === now.getHours() && t >= (nowMins - (nowMins % 5))) {
                    isActuallyOn = device.metrics.isLightOn;
                } else {
                    // Force the chart to respect the schedule bounds to prevent "broken" overhangs
                    if (isSched) isActuallyOn = hourlyGraph[h] > 0;
                }

                // If scheduled to be ON, but it is OFF, AND power dropped -> Paint it RED
                if (isSched && !isActuallyOn && hasLoadShedding && awakeHistory[h] === 0) {
                    isBlackout = true;
                }
            }

            // Determine the Y-position for this slice
            let y = (isSched || isActuallyOn) ? 1 : 0;
            chartData.push(y);

            // Determine the dynamic color for this exact 5-minute slice
            let sliceColor = '#374151'; // Default Grey for OFF / Future
            if (y === 1) {
                if (isFuture) sliceColor = '#374151'; 
                else if (isActuallyOn) sliceColor = '#fbbf24'; // Amber Active (Matches text!)
                else if (isBlackout) sliceColor = '#ef4444'; // Red Blackout
                else sliceColor = '#374151'; // Manually off -> Grey
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
                        // 🔥 THE MAGIC COLOR ENGINE: Maps the colors directly to the single continuous line!
                        segment: {
                            borderColor: (ctx) => {
                                // If it's a bottom flat line, paint it faint grey
                                if (ctx.p0.parsed.y === 0 && ctx.p1.parsed.y === 0) return '#1f2937'; 
                                // If it's a top flat line, paint it the assigned color (Amber/Red/Grey)
                                if (ctx.p0.parsed.y === 1 && ctx.p1.parsed.y === 1) return segmentColors[ctx.p0DataIndex];
                                // If it's a vertical rising/falling edge, match the color of the active point
                                return segmentColors[ctx.p0.parsed.y === 1 ? ctx.p0DataIndex : ctx.p1DataIndex] || '#fbbf24';
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
                        grid: { color: 'rgba(255,255,255,0.05)', drawBorder: false } 
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
    // 2. 7-DAY GRAPH (Cyan Area & Hollow Dots)
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
                    pointBackgroundColor: '#121212', 
                    pointBorderColor: '#00f2fe',     
                    pointBorderWidth: 2,
                    pointRadius: 4,
                    pointHoverRadius: 6
                }]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                scales: { 
                    y: { beginAtZero: true, suggestedMax: 12, grid: { color: 'rgba(255,255,255,0.05)', drawBorder: false } }, 
                    x: { grid: { display: false } } 
                }
            }
        })
    );


    // ==========================================
    // 3. 30-DAY GRAPH (Purple Area, No Dots)
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
                    y: { beginAtZero: true, suggestedMax: 12, grid: { color: 'rgba(255,255,255,0.05)', drawBorder: false } }, 
                    x: { grid: { display: false }, ticks: { maxTicksLimit: 6 } } 
                }
            }
        })
    );
}