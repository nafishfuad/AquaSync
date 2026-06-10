// src/components/analytics/Charts.js

export function renderCharts(container, analyticsData) {
    const template = document.getElementById("tpl-analytics-chart-card");
    if (!template) return;

    // Apply global Chart.js aesthetic defaults
    Chart.defaults.color = "#6b7280";
    Chart.defaults.font.family = "sans-serif";
    Chart.defaults.plugins.legend.display = false;

    // Factory function to spawn chart layouts safely
    const createChartCard = (title, activeTime, sheddingTime, chartConfig) => {
        const clone = template.content.cloneNode(true);
        
        clone.querySelector(".tpl-chart-title").innerText = title;
        clone.querySelector(".tpl-active-time").innerText = activeTime;
        clone.querySelector(".tpl-shedding-time").innerText = sheddingTime;
        
        const canvas = clone.querySelector(".tpl-chart-canvas");
        
        // Critical: The DOM element must be appended BEFORE Chart.js initializes, 
        // otherwise the canvas won't be able to calculate its parent boundaries correctly.
        container.appendChild(clone); 
        
        new Chart(canvas, chartConfig);
    };

    // 1. TODAY'S HOURLY GRAPH (Stepped Line)
    createChartCard(
        "Today's Hourly Activity", 
        analyticsData.today.totalActive, 
        analyticsData.today.loadShedding,
        {
            type: 'line',
            data: {
                labels: ['12A', '3A', '6A', '9A', '12P', '3P', '6P', '9P'], 
                datasets: [{
                    data: analyticsData.today.hourlyGraph, // Must be array of 24 points
                    borderColor: '#00f2fe',
                    borderWidth: 2,
                    stepped: true,
                    pointRadius: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: { 
                        min: -0.1, max: 1.1, 
                        ticks: { callback: v => v === 1 ? 'ON' : v === 0 ? 'OFF' : '' }, 
                        grid: { color: 'rgba(255,255,255,0.05)', drawBorder: false } 
                    },
                    x: { grid: { display: false } }
                }
            }
        }
    );

    // 2. 7-DAY GRAPH (Curved Area Fill)
    createChartCard(
        "7-Day Overview", 
        analyticsData.week.totalActive, 
        analyticsData.week.loadShedding,
        {
            type: 'line',
            data: {
                labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
                datasets: [{
                    data: analyticsData.week.dailyGraph,
                    borderColor: '#00f2fe',
                    backgroundColor: 'rgba(0, 242, 254, 0.1)',
                    borderWidth: 2,
                    fill: true,
                    tension: 0.4,
                    pointBackgroundColor: '#121212',
                    pointBorderColor: '#00f2fe',
                    pointRadius: 4
                }]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                scales: { 
                    y: { beginAtZero: true, max: 12, grid: { color: 'rgba(255,255,255,0.05)' } }, 
                    x: { grid: { display: false } } 
                }
            }
        }
    );

    // 3. 30-DAY GRAPH (Purple Curved Area Fill)
    createChartCard(
        "30-Day Overview", 
        analyticsData.month.totalActive, 
        analyticsData.month.loadShedding,
        {
            type: 'line',
            data: {
                labels: Array.from({length: 30}, (_, i) => i+1),
                datasets: [{
                    data: analyticsData.month.dailyGraph,
                    borderColor: '#a855f7', // Ambient purple aesthetic
                    backgroundColor: 'rgba(168, 85, 247, 0.1)',
                    borderWidth: 2,
                    fill: true,
                    tension: 0.4,
                    pointRadius: 0
                }]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                scales: { 
                    y: { beginAtZero: true, max: 12, grid: { color: 'rgba(255,255,255,0.05)' } }, 
                    x: { grid: { display: false }, ticks: { maxTicksLimit: 6 } } 
                }
            }
        }
    );
}