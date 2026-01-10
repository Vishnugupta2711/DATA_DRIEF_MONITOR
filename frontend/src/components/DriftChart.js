import { useEffect, useRef } from "react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  LineController,
  Tooltip,
  Legend,
  Filler,
} from "chart.js";

ChartJS.register(
  LineController,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
  Filler
);

export default function DriftChart({
  labels,
  values,
  thresholds = null,
  showPrediction = false,
}) {
  const canvasRef = useRef(null);
  const chartRef = useRef(null);

  useEffect(() => {
    if (!canvasRef.current) return;

    // Destroy previous chart instance if it exists
    if (chartRef.current) {
      chartRef.current.destroy();
    }

    // Create gradient
    const ctx = canvasRef.current.getContext("2d");
    const gradient = ctx.createLinearGradient(0, 0, 0, 400);
    gradient.addColorStop(0, "rgba(59, 130, 246, 0.5)");
    gradient.addColorStop(0.5, "rgba(139, 92, 246, 0.3)");
    gradient.addColorStop(1, "rgba(139, 92, 246, 0)");

    // Create danger gradient for high drift areas
    const dangerGradient = ctx.createLinearGradient(0, 0, 0, 400);
    dangerGradient.addColorStop(0, "rgba(239, 68, 68, 0.4)");
    dangerGradient.addColorStop(1, "rgba(239, 68, 68, 0)");

    // Determine colors based on drift severity
    const pointColors = values.map((v) => {
      if (v >= 0.5) return "rgb(239, 68, 68)"; // High - Red
      if (v >= 0.3) return "rgb(251, 146, 60)"; // Medium - Orange
      return "rgb(34, 197, 94)"; // Low - Green
    });

    // Build datasets
    const datasets = [
      {
        label: "Drift Score",
        data: values,
        borderColor: "rgb(59, 130, 246)",
        backgroundColor: gradient,
        borderWidth: 3,
        tension: 0.4,
        fill: true,
        pointRadius: 6,
        pointHoverRadius: 8,
        pointBackgroundColor: pointColors,
        pointBorderColor: "#fff",
        pointBorderWidth: 2,
        pointHoverBackgroundColor: pointColors,
        pointHoverBorderColor: "#fff",
        pointHoverBorderWidth: 3,
        segment: {
          borderColor: (ctx) => {
            // Color segments based on drift level
            const value = ctx.p1.parsed.y;
            if (value >= 0.5) return "rgb(239, 68, 68)";
            if (value >= 0.3) return "rgb(251, 146, 60)";
            return "rgb(59, 130, 246)";
          },
        },
      },
    ];

    // Add threshold lines if provided
    const annotations = [];
    if (thresholds) {
      if (thresholds.high) {
        annotations.push({
          type: "line",
          yMin: thresholds.high,
          yMax: thresholds.high,
          borderColor: "rgba(239, 68, 68, 0.7)",
          borderWidth: 2,
          borderDash: [5, 5],
          label: {
            content: "High Threshold",
            enabled: true,
            position: "end",
            backgroundColor: "rgba(239, 68, 68, 0.8)",
            color: "#fff",
            font: {
              size: 10,
            },
          },
        });
      }
      if (thresholds.medium) {
        annotations.push({
          type: "line",
          yMin: thresholds.medium,
          yMax: thresholds.medium,
          borderColor: "rgba(251, 146, 60, 0.7)",
          borderWidth: 2,
          borderDash: [5, 5],
          label: {
            content: "Medium Threshold",
            enabled: true,
            position: "end",
            backgroundColor: "rgba(251, 146, 60, 0.8)",
            color: "#fff",
            font: {
              size: 10,
            },
          },
        });
      }
    }

    chartRef.current = new ChartJS(canvasRef.current, {
      type: "line",
      data: {
        labels,
        datasets,
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
          mode: "index",
          intersect: false,
        },
        plugins: {
          legend: {
            display: true,
            position: "top",
            labels: {
              color: "#e5e7eb",
              font: {
                size: 12,
                weight: "500",
              },
              padding: 15,
              usePointStyle: true,
              pointStyle: "circle",
              generateLabels: function (chart) {
                const original =
                  ChartJS.defaults.plugins.legend.labels.generateLabels(chart);
                // Add custom legend items for severity levels
                return [
                  ...original,
                  {
                    text: "Low (<30%)",
                    fillStyle: "rgb(34, 197, 94)",
                    strokeStyle: "rgb(34, 197, 94)",
                    lineWidth: 2,
                    hidden: false,
                    index: 1,
                  },
                  {
                    text: "Medium (30-50%)",
                    fillStyle: "rgb(251, 146, 60)",
                    strokeStyle: "rgb(251, 146, 60)",
                    lineWidth: 2,
                    hidden: false,
                    index: 2,
                  },
                  {
                    text: "High (>50%)",
                    fillStyle: "rgb(239, 68, 68)",
                    strokeStyle: "rgb(239, 68, 68)",
                    lineWidth: 2,
                    hidden: false,
                    index: 3,
                  },
                ];
              },
            },
          },
          tooltip: {
            enabled: true,
            backgroundColor: "rgba(15, 23, 42, 0.95)",
            titleColor: "#fff",
            bodyColor: "#e5e7eb",
            borderColor: "rgba(139, 92, 246, 0.5)",
            borderWidth: 1,
            padding: 14,
            displayColors: true,
            callbacks: {
              title: function (context) {
                return context[0].label;
              },
              label: function (context) {
                const value = context.parsed.y;
                const percentage = (value * 100).toFixed(2);
                let severity = "Low";
                let emoji = "✅";

                if (value >= 0.5) {
                  severity = "High";
                  emoji = "🚨";
                } else if (value >= 0.3) {
                  severity = "Medium";
                  emoji = "⚠️";
                }

                return [
                  `Drift Score: ${percentage}%`,
                  `Severity: ${emoji} ${severity}`,
                ];
              },
              afterLabel: function (context) {
                const value = context.parsed.y;

                // Add recommendations
                if (value >= 0.5) {
                  return [
                    "",
                    "💡 Action Required:",
                    "• Consider model retraining",
                    "• Review data pipeline",
                  ];
                } else if (value >= 0.3) {
                  return [
                    "",
                    "💡 Recommendation:",
                    "• Monitor closely",
                    "• Investigate causes",
                  ];
                }
                return "";
              },
            },
          },
        },
        scales: {
          x: {
            type: "category",
            grid: {
              display: true,
              color: "rgba(255, 255, 255, 0.05)",
              drawBorder: false,
            },
            ticks: {
              color: "#9ca3af",
              font: {
                size: 11,
                weight: "500",
              },
              maxRotation: 45,
              minRotation: 0,
              autoSkip: true,
              maxTicksLimit: 10,
            },
            border: {
              display: false,
            },
          },
          y: {
            beginAtZero: true,
            max: 1,
            grid: {
              display: true,
              color: "rgba(255, 255, 255, 0.08)",
              drawBorder: false,
            },
            ticks: {
              color: "#9ca3af",
              font: {
                size: 11,
                weight: "500",
              },
              callback: function (value) {
                return (value * 100).toFixed(0) + "%";
              },
              stepSize: 0.1,
            },
            border: {
              display: false,
            },
          },
        },
        animation: {
          duration: 750,
          easing: "easeInOutQuart",
        },
      },
    });

    return () => {
      if (chartRef.current) {
        chartRef.current.destroy();
      }
    };
  }, [labels, values, thresholds, showPrediction]);

  return (
    <div style={{ position: "relative", height: "350px", width: "100%" }}>
      <canvas ref={canvasRef} />
    </div>
  );
}

// Additional component for multi-metric comparison chart
export function MultiMetricChart({ labels, datasets }) {
  const canvasRef = useRef(null);
  const chartRef = useRef(null);

  useEffect(() => {
    if (!canvasRef.current) return;

    if (chartRef.current) {
      chartRef.current.destroy();
    }

    // Create different gradients for each dataset
    const colors = [
      { border: "rgb(59, 130, 246)", bg: "rgba(59, 130, 246, 0.2)" },
      { border: "rgb(139, 92, 246)", bg: "rgba(139, 92, 246, 0.2)" },
      { border: "rgb(236, 72, 153)", bg: "rgba(236, 72, 153, 0.2)" },
      { border: "rgb(34, 197, 94)", bg: "rgba(34, 197, 94, 0.2)" },
    ];

    const chartDatasets = datasets.map((dataset, idx) => ({
      label: dataset.label,
      data: dataset.data,
      borderColor: colors[idx % colors.length].border,
      backgroundColor: colors[idx % colors.length].bg,
      borderWidth: 2,
      tension: 0.4,
      fill: true,
      pointRadius: 4,
      pointHoverRadius: 6,
    }));

    chartRef.current = new ChartJS(canvasRef.current, {
      type: "line",
      data: {
        labels,
        datasets: chartDatasets,
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
          mode: "index",
          intersect: false,
        },
        plugins: {
          legend: {
            display: true,
            position: "top",
            labels: {
              color: "#e5e7eb",
              font: {
                size: 12,
              },
              padding: 12,
              usePointStyle: true,
            },
          },
          tooltip: {
            enabled: true,
            backgroundColor: "rgba(15, 23, 42, 0.95)",
            titleColor: "#fff",
            bodyColor: "#e5e7eb",
            borderColor: "rgba(139, 92, 246, 0.5)",
            borderWidth: 1,
            padding: 12,
          },
        },
        scales: {
          x: {
            grid: {
              color: "rgba(255, 255, 255, 0.05)",
            },
            ticks: {
              color: "#9ca3af",
            },
          },
          y: {
            beginAtZero: true,
            grid: {
              color: "rgba(255, 255, 255, 0.05)",
            },
            ticks: {
              color: "#9ca3af",
            },
          },
        },
      },
    });

    return () => {
      if (chartRef.current) {
        chartRef.current.destroy();
      }
    };
  }, [labels, datasets]);

  return (
    <div style={{ position: "relative", height: "350px", width: "100%" }}>
      <canvas ref={canvasRef} />
    </div>
  );
}

// Component for feature-level drift visualization
export function FeatureDriftChart({ features }) {
  const canvasRef = useRef(null);
  const chartRef = useRef(null);

  useEffect(() => {
    if (!canvasRef.current || !features || features.length === 0) return;

    if (chartRef.current) {
      chartRef.current.destroy();
    }

    // Sort features by drift score
    const sortedFeatures = [...features]
      .sort((a, b) => b.drift_score - a.drift_score)
      .slice(0, 10);
    const labels = sortedFeatures.map((f) => f.name);
    const values = sortedFeatures.map((f) => f.drift_score);

    // Color bars based on drift level
    const backgroundColors = values.map((v) => {
      if (v >= 0.5) return "rgba(239, 68, 68, 0.7)";
      if (v >= 0.3) return "rgba(251, 146, 60, 0.7)";
      return "rgba(34, 197, 94, 0.7)";
    });

    chartRef.current = new ChartJS(canvasRef.current, {
      type: "bar",
      data: {
        labels,
        datasets: [
          {
            label: "Drift Score",
            data: values,
            backgroundColor: backgroundColors,
            borderColor: backgroundColors.map((c) => c.replace("0.7", "1")),
            borderWidth: 2,
            borderRadius: 6,
            borderSkipped: false,
          },
        ],
      },
      options: {
        indexAxis: "y",
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: false,
          },
          tooltip: {
            backgroundColor: "rgba(15, 23, 42, 0.95)",
            titleColor: "#fff",
            bodyColor: "#e5e7eb",
            padding: 12,
            callbacks: {
              label: function (context) {
                return `Drift: ${(context.parsed.x * 100).toFixed(1)}%`;
              },
            },
          },
        },
        scales: {
          x: {
            beginAtZero: true,
            max: 1,
            grid: {
              color: "rgba(255, 255, 255, 0.05)",
            },
            ticks: {
              color: "#9ca3af",
              callback: function (value) {
                return (value * 100).toFixed(0) + "%";
              },
            },
          },
          y: {
            grid: {
              display: false,
            },
            ticks: {
              color: "#e5e7eb",
              font: {
                size: 11,
              },
            },
          },
        },
      },
    });

    return () => {
      if (chartRef.current) {
        chartRef.current.destroy();
      }
    };
  }, [features]);

  return (
    <div style={{ position: "relative", height: "400px", width: "100%" }}>
      <canvas ref={canvasRef} />
    </div>
  );
}
