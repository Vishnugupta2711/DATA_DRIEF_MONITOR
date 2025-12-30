import { Line } from "react-chartjs-2";

export default function DriftChart({ labels, values }) {
  return (
    <Line
      data={{
        labels,
        datasets: [
          {
            label: "Drift Score",
            data: values,
            borderColor: "#2563eb",
            tension: 0.3,
          },
        ],
      }}
    />
  );
}
