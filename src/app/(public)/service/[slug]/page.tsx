import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { formatCurrency, generateTimeSlots } from "@/lib/utils";
import { Button } from "@/components/ui";
import { Clock, DollarSign, ArrowLeft } from "lucide-react";

async function getService(id: string) {
  const service = await db.service.findUnique({
    where: { 
      id: id,
    },
    include: {
      category: true,
    },
  });
  return service;
}

export default async function ServiceDetailPage({
  params,
}: {
  params: { slug: string };
}) {
  const service = await getService(params.slug);

  if (!service) {
    notFound();
  }

  return (
    <div className="py-12">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <Link 
          href="/services" 
          className="inline-flex items-center gap-2 text-gray-600 hover:text-dark mb-6"
        >
          <ArrowLeft className="w-4 h-4" /> Back to services
        </Link>

        <div className="bg-white rounded-xl border border-gray-100 p-6 md:p-8">
          <div className="mb-6">
            <span className="text-sm text-gray-500 uppercase tracking-wide">
              {service.category.name}
            </span>
            <h1 className="text-3xl md:text-4xl font-bold text-dark mt-2">
              {service.name}
            </h1>
          </div>

          <p className="text-gray-600 mb-8 text-lg">
            {service.description}
          </p>

          <div className="flex flex-wrap gap-6 mb-8">
            <div className="flex items-center gap-2 text-gray-600">
              <Clock className="w-5 h-5" />
              <span>{service.duration} minutes</span>
            </div>
            <div className="flex items-center gap-2 text-gray-600">
              <DollarSign className="w-5 h-5" />
              <span>Starting at {formatCurrency(Number(service.price))}</span>
            </div>
          </div>

          <Link href={`/booking/${service.id}`}>
            <Button size="lg" className="w-full md:w-auto">
              Book now
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}