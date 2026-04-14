"use client";

import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  BarChart,
  Bar
} from "recharts";

interface ChartData {
  name: string;
  value: number;
}

interface AdminChartProps {
  data: ChartData[];
  type: "line" | "bar";
  title: string;
}

export function AdminChart({ data, type, title }: AdminChartProps) {
  return (
    <div className="bg-dark-mid rounded-xl p-6">
      <h3 className="text-white font-semibold mb-4">{title}</h3>
      <ResponsiveContainer width="100%" height={250}>
        {type === "line" ? (
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="name" stroke="#9CA3AF" fontSize={12} />
            <YAxis stroke="#9CA3AF" fontSize={12} />
            <Tooltip 
              contentStyle={{ 
                backgroundColor: "#1F2937", 
                border: "1px solid #374151",
                borderRadius: "8px" 
              }}
              labelStyle={{ color: "#FFF" }}
            />
            <Line 
              type="monotone" 
              dataKey="value" 
              stroke="#FFC300" 
              strokeWidth={2}
              dot={{ fill: "#FFC300", strokeWidth: 2 }} 
            />
          </LineChart>
        ) : (
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="name" stroke="#9CA3AF" fontSize={12} />
            <YAxis stroke="#9CA3AF" fontSize={12} />
            <Tooltip 
              contentStyle={{ 
                backgroundColor: "#1F2937", 
                border: "1px solid #374151",
                borderRadius: "8px" 
              }}
              labelStyle={{ color: "#FFF" }}
            />
            <Bar dataKey="value" fill="#FFC300" radius={[4, 4, 0, 0]} />
          </BarChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}