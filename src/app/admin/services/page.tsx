import { db } from "@/lib/db";

export default async function AdminServicesPage() {
  const services = await db.service.findMany({
    include: {
      category: true,
      _count: {
        select: { bookings: true },
      },
    },
    orderBy: { name: "asc" },
  });

  const categories = await db.category.findMany({
    orderBy: { name: "asc" },
  });

  return (
    <div>
      <h1 className="text-2xl font-bold text-white mb-8">Services</h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-dark-mid rounded-xl p-6">
          <h2 className="text-lg font-semibold text-white mb-4">Categories</h2>
          <div className="space-y-2">
            {categories.map((cat) => (
              <div
                key={cat.id}
                className="flex items-center justify-between p-3 bg-gray-800 rounded-lg"
              >
                <div>
                  <p className="text-white font-medium">{cat.name}</p>
                  <p className="text-sm text-gray-400">/{cat.slug}</p>
                </div>
                <span className={`px-2 py-1 rounded text-xs ${cat.isActive ? "bg-success/20 text-success" : "bg-error/20 text-error"}`}>
                  {cat.isActive ? "Active" : "Inactive"}
                </span>
              </div>
            ))}
            {categories.length === 0 && (
              <p className="text-gray-500">No categories</p>
            )}
          </div>
        </div>

        <div className="bg-dark-mid rounded-xl p-6">
          <h2 className="text-lg font-semibold text-white mb-4">All Services</h2>
          <div className="space-y-2">
            {services.map((service) => (
              <div
                key={service.id}
                className="flex items-center justify-between p-3 bg-gray-800 rounded-lg"
              >
                <div>
                  <p className="text-white font-medium">{service.name}</p>
                  <p className="text-sm text-gray-400">
                    {service.category.name} · ${Number(service.price)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-white">{service._count.bookings} bookings</p>
                  <span className={`text-xs ${service.isActive ? "text-success" : "text-error"}`}>
                    {service.isActive ? "Active" : "Inactive"}
                  </span>
                </div>
              </div>
            ))}
            {services.length === 0 && (
              <p className="text-gray-500">No services</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}