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

export default function DriftChart({ labels, values }) {
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
    gradient.addColorStop(0, "rgba(59, 130, 246, 0.4)");
    gradient.addColorStop(0.5, "rgba(139, 92, 246, 0.2)");
    gradient.addColorStop(1, "rgba(139, 92, 246, 0)");

    chartRef.current = new ChartJS(canvasRef.current, {
      type: "line",
      data: {
        labels,
        datasets: [
          {
            label: "Drift Score",
            data: values,
            borderColor: "rgb(59, 130, 246)",
            backgroundColor: gradient,
            borderWidth: 3,
            tension: 0.4,
            fill: true,
            pointRadius: 5,
            pointHoverRadius: 7,
            pointBackgroundColor: "rgb(139, 92, 246)",
            pointBorderColor: "#fff",
            pointBorderWidth: 2,
            pointHoverBackgroundColor: "rgb(59, 130, 246)",
            pointHoverBorderColor: "#fff",
            pointHoverBorderWidth: 3,
          },
        ],
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
            },
          },
          tooltip: {
            enabled: true,
            backgroundColor: "rgba(15, 23, 42, 0.9)",
            titleColor: "#fff",
            bodyColor: "#e5e7eb",
            borderColor: "rgba(139, 92, 246, 0.5)",
            borderWidth: 1,
            padding: 12,
            displayColors: true,
            callbacks: {
              label: function (context) {
                return `Drift Score: ${(context.parsed.y * 100).toFixed(2)}%`;
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
            },
            ticks: {
              color: "#9ca3af",
              font: {
                size: 11,
              },
              maxRotation: 45,
              minRotation: 0,
            },
          },
          y: {
            beginAtZero: true,
            max: 1,
            grid: {
              display: true,
              color: "rgba(255, 255, 255, 0.05)",
            },
            ticks: {
              color: "#9ca3af",
              font: {
                size: 11,
              },
              callback: function (value) {
                return (value * 100).toFixed(0) + "%";
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
  }, [labels, values]);

  return (
    <div style={{ position: "relative", height: "350px", width: "100%" }}>
      <canvas ref={canvasRef} />
    </div>
  );
}
