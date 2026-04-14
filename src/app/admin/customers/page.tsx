import { db } from "@/lib/db";

export default async function AdminCustomersPage() {
  const users = await db.user.findMany({
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      role: true,
      isActive: true,
      createdAt: true,
      _count: {
        select: { bookings: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div>
      <h1 className="text-2xl font-bold text-white mb-8">Customers</h1>

      <div className="bg-dark-mid rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-800">
              <tr>
                <th className="px-6 py-4 text-left text-gray-400 font-medium">Name</th>
                <th className="px-6 py-4 text-left text-gray-400 font-medium">Email</th>
                <th className="px-6 py-4 text-left text-gray-400 font-medium">Phone</th>
                <th className="px-6 py-4 text-left text-gray-400 font-medium">Role</th>
                <th className="px-6 py-4 text-left text-gray-400 font-medium">Status</th>
                <th className="px-6 py-4 text-left text-gray-400 font-medium">Bookings</th>
                <th className="px-6 py-4 text-left text-gray-400 font-medium">Joined</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700">
              {users.map((user) => (
                <tr key={user.id} className="hover:bg-gray-800/50">
                  <td className="px-6 py-4 text-white">{user.name}</td>
                  <td className="px-6 py-4 text-gray-300">{user.email}</td>
                  <td className="px-6 py-4 text-gray-300">{user.phone || "-"}</td>
                  <td className="px-6 py-4">
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                      user.role === "ADMIN" 
                        ? "bg-primary/20 text-primary" 
                        : user.role === "PROVIDER"
                        ? "bg-blue-500/20 text-blue-400"
                        : "bg-gray-600/20 text-gray-400"
                    }`}>
                      {user.role}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                      user.isActive 
                        ? "bg-success/20 text-success" 
                        : "bg-error/20 text-error"
                    }`}>
                      {user.isActive ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-white">{user._count.bookings}</td>
                  <td className="px-6 py-4 text-gray-400">
                    {user.createdAt.toLocaleDateString()}
                  </td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-gray-500">
                    No customers yet
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