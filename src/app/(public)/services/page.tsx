import Link from "next/link";
import { db } from "@/lib/db";
import { 
  Sofa, 
  MonitorUp, 
  Truck, 
  Sparkles, 
  Trees, 
  Wrench, 
  Paintbrush 
} from "lucide-react";

const categoryIcons: Record<string, any> = {
  assembly: Sofa,
  mounting: MonitorUp,
  moving: Truck,
  cleaning: Sparkles,
  outdoor: Trees,
  repairs: Wrench,
  painting: Paintbrush,
};

async function getCategories() {
  const categories = await db.category.findMany({
    where: { isActive: true },
    include: {
      services: {
        where: { isActive: true },
        select: {
          id: true,
          name: true,
          slug: true,
          price: true,
          duration: true,
        },
      },
    },
    orderBy: { name: "asc" },
  });
  return categories;
}

export default async function ServicesPage() {
  const categories = await getCategories();

  return (
    <div className="py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-bold text-dark mb-4">
            All Services
          </h1>
          <p className="text-lg text-gray-600">
            Find the right professional for your home task
          </p>
        </div>

        <div className="space-y-12">
          {categories.map((category) => {
            const Icon = categoryIcons[category.slug] || Wrench;
            return (
              <div key={category.id} className="bg-white rounded-xl border border-gray-100 p-6 md:p-8">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-12 h-12 bg-primary rounded-lg flex items-center justify-center">
                    <Icon className="w-6 h-6 text-dark" />
                  </div>
                  <h2 className="text-2xl font-bold text-dark">{category.name}</h2>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {category.services.map((service) => (
                    <Link
                      key={service.id}
                      href={`/booking/${service.id}`}
                      className="p-4 border border-gray-100 rounded-lg hover:border-primary hover:bg-primary-light/20 transition-all group"
                    >
                      <h3 className="font-semibold text-dark mb-2 group-hover:text-primary-dark transition-colors">
                        {service.name}
                      </h3>
                      <div className="flex justify-between items-center">
                        <span className="text-primary-dark font-semibold">
                          ${Number(service.price)}
                        </span>
                        <span className="text-sm text-gray-500">
                          {service.duration} min
                        </span>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}