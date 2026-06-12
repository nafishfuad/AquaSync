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

    // 🔥 PERFECTED AQUA FISH TYPOGRAPHY
    const styleTimeStr = (str, colorClass="text-white") => {
        const match = str.match(/(\d{2})h (\d{2})m/);
        if (match) return `<span class="text-2xl font-bold ${colorClass} tracking-tight">${match[1]}</span><span class="text-[11px] text-gray-500 font-bold mx-0.5">h</span> <span class="text-2xl font-bold ${colorClass} tracking-tight">${match[2]}</span><span class="text-[11px] text-gray-500 font-bold mx-0.5">m</span>`;
        return `<span class="text-2xl font-bold ${colorClass}">${str}</span>`;
    };

    const createChartCard = (title, statsArray, chartConfigBuilder) => {
        const clone = template.content.cloneNode(true);
        clone.querySelector(".tpl-chart-title").innerText = title;
        
        const statsGrid = clone.querySelector(".tpl-stats-grid");
        statsGrid.className = `grid grid-cols-${statsArray.length} gap-4 mb-2 pb-2 text-xs`;
        
        let statsHTML = "";
        statsArray.forEach((stat, index) => {
            let alignClass = "text-left";
            if (statsArray.length === 2 && index === 1) alignClass = "text-right";
            else if (statsArray.length === 3) {
                if (index === 1) alignClass = "text-center";
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
    // 1. TODAY'S DYNAMIC GRADUAL TIMELINE
    // ==========================================
    let labels = [];
    let scheduleData = [];
    let actualData = [];

    if (m && analyticsData && analyticsData.today) {
        const parseMins = (str) => {
            let [h, min] = str.split(':');
            return (parseInt(h) * 60) + parseInt(min);
        };
        
        const startMins = parseMins(m.startTime);
        const photoMins = m.photoperiod * 60;
        const endMins = startMins + photoMins;
        
        const paddingMins = photoMins * (15 / 70); 
        const graphStart = startMins - paddingMins;
        const graphEnd = endMins + paddingMins;

        const now = new Date();
        const currentMinsOfDay = (now.getHours() * 60) + now.getMinutes();
        const awakeHistory = analyticsData.today.awakeData || Array(24).fill(1); 

        // Generate data points every 5 minutes
        for (let t = graphStart; t <= graphEnd; t += 5) {
            let normalizedT = (t + 1440) % 1440; 
            let h = Math.floor(normalizedT / 60);
            let min = Math.floor(normalizedT % 60);
            
            // X-Axis Labels: Show an hour marker every 2 hours (like Aqua Fish)
            if (min === 0 && h % 2 === 0) {
                let ampm = h >= 12 ? 'PM' : 'AM';
                let dispH = h % 12 || 12;
                labels.push(`${dispH}${ampm}`);
            } else {
                labels.push('');
            }
            
            // 1. Plot the Grey Schedule Track
            let isSched = (endMins > 1440) 
                ? (normalizedT >= startMins || normalizedT <= (endMins % 1440))
                : (normalizedT >= startMins && normalizedT <= endMins);
            scheduleData.push(isSched ? 1 : 0);
            
            // 2. Plot the Live Cyan Fill
            if (t > currentMinsOfDay && !(endMins > 1440 && t < graphEnd)) {
                actualData.push(null); // The future is null, which reveals the grey track beneath!
            } else {
                let isActuallyOn = false;
                if (h === now.getHours()) {
                    isActuallyOn = device.metrics.isLightOn; // Live instant response
                } else {
                    isActuallyOn = analyticsData.today.hourlyGraph[h] > 0; // Past hourly history
                }
                actualData.push(isActuallyOn ? 1 : 0);
            }
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
                        label: 'Schedule Target',
                        data: scheduleData,
                        borderColor: '#374151', // Grey-700
                        borderWidth: 2,
                        stepped: 'middle',
                        fill: false,
                        pointRadius: 0
                    },
                    {
                        label: 'Actual Progress',
                        data: actualData,
                        borderWidth: 3,
                        stepped: 'middle',
                        fill: false, // Solid stepped line, no fill underneath to match screenshot
                        pointRadius: 0,
                        // 🔥 DYNAMIC SEGMENT LOGIC
                        segment: {
                            borderColor: (ctx) => {
                                const i = ctx.p0DataIndex;
                                if (scheduleData[i] === 1 && actualData[i] === 0) {
                                    // It should be ON, but it's OFF. Check if power was out.
                                    let normalizedT = (graphStart + i * 5);
                                    normalizedT = (normalizedT + 1440) % 1440;
                                    let h = Math.floor(normalizedT / 60);
                                    // If awakeData for this hour is 0, it was a blackout -> Paint it RED
                                    if (analyticsData.today.awakeData && analyticsData.today.awakeData[h] === 0) return '#ef4444'; 
                                    return '#374151'; // Otherwise, it was manually turned off -> Paint it GREY
                                }
                                if (actualData[i] === 1) return '#00f2fe'; // Running normally -> Paint it CYAN
                                return 'transparent'; 
                            }
                        }
                    }
                ]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                scales: {
                    y: { 
                        min: -0.1, max: 1.2, 
                        ticks: { stepSize: 1, callback: v => v === 1 ? 'ON' : v === 0 ? 'OFF' : '' }, 
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
                    pointBackgroundColor: '#121212', 
                    pointBorderColor: '#00f2fe',     
                    pointBorderWidth: 2,
                    pointRadius: 5,
                    pointHoverRadius: 7
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
                    y: { beginAtZero: true, suggestedMax: 12, grid: { color: 'rgba(255,255,255,0.05)', drawBorder: false } }, 
                    x: { grid: { display: false }, ticks: { maxTicksLimit: 6 } } 
                }
            }
        })
    );
}