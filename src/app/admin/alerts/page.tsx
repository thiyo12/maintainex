import { db } from "@/lib/db";
import { AlertTriangle } from "lucide-react";

export default async function AdminAlertsPage() {
  const suspiciousLogins = await db.loginActivity.findMany({
    where: { isSuspicious: true },
    include: {
      user: { select: { name: true, email: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return (
    <div>
      <div className="flex items-center gap-3 mb-8">
        <AlertTriangle className="w-6 h-6 text-warning" />
        <h1 className="text-2xl font-bold text-white">Security Alerts</h1>
      </div>

      {suspiciousLogins.length > 0 && (
        <div className="bg-error/10 border border-error/30 rounded-xl p-4 mb-6">
          <p className="text-error font-medium">
            {suspiciousLogins.length} suspicious login(s) detected
          </p>
        </div>
      )}

      <div className="bg-dark-mid rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-800">
              <tr>
                <th className="px-6 py-4 text-left text-gray-400 font-medium">Time</th>
                <th className="px-6 py-4 text-left text-gray-400 font-medium">User</th>
                <th className="px-6 py-4 text-left text-gray-400 font-medium">Email</th>
                <th className="px-6 py-4 text-left text-gray-400 font-medium">IP Address</th>
                <th className="px-6 py-4 text-left text-gray-400 font-medium">Device</th>
                <th className="px-6 py-4 text-left text-gray-400 font-medium">Reason</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700">
              {suspiciousLogins.map((login) => (
                <tr key={login.id} className="hover:bg-gray-800/50">
                  <td className="px-6 py-4 text-gray-400">
                    {login.createdAt.toLocaleString()}
                  </td>
                  <td className="px-6 py-4 text-white">
                    {login.user?.name || "Unknown"}
                  </td>
                  <td className="px-6 py-4 text-gray-300">{login.email}</td>
                  <td className="px-6 py-4 text-gray-300 font-mono text-sm">
                    {login.ipAddress}
                  </td>
                  <td className="px-6 py-4 text-gray-400 text-sm max-w-xs truncate">
                    {login.userAgent}
                  </td>
                  <td className="px-6 py-4">
                    <span className="px-3 py-1 rounded-full text-xs font-medium bg-error/20 text-error">
                      {login.reason || "Suspicious"}
                    </span>
                  </td>
                </tr>
              ))}
              {suspiciousLogins.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                    No security alerts
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}