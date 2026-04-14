import { LucideIcon } from "lucide-react";

interface StatsCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  change?: string;
  changeType?: "positive" | "negative";
}

export function StatsCard({ title, value, icon: Icon, change, changeType }: StatsCardProps) {
  return (
    <div className="bg-dark-mid rounded-xl p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-gray-400 text-sm mb-1">{title}</p>
          <p className="text-2xl font-bold text-white">{value}</p>
          {change && (
            <p className={`text-sm mt-2 ${changeType === "positive" ? "text-success" : "text-error"}`}>
              {change}
            </p>
          )}
        </div>
        <div className="w-12 h-12 bg-primary/20 rounded-lg flex items-center justify-center">
          <Icon className="w-6 h-6 text-primary" />
        </div>
      </div>
    </div>
  );
}