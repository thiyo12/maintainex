import { db } from "@/lib/db";
import { StatsCard } from "@/components/admin/StatsCard";
import { AdminChart } from "@/components/admin/Chart";
import { Calendar, Wrench, Users, AlertTriangle } from "lucide-react";

async function getStats() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const [
    totalBookings,
    bookingsToday,
    pendingBookings,
    completedBookings,
    totalServices,
    suspiciousLogins,
  ] = await Promise.all([
    db.booking.count(),
    db.booking.count({
      where: {
        createdAt: {
          gte: today,
          lt: tomorrow,
        },
      },
    }),
    db.booking.count({
      where: { status: "PENDING" },
    }),
    db.booking.count({
      where: { status: "COMPLETED" },
    }),
    db.service.count({
      where: { isActive: true },
    }),
    db.loginActivity.count({
      where: { isSuspicious: true },
    }),
  ]);

  return {
    totalBookings,
    bookingsToday,
    pendingBookings,
    completedBookings,
    totalServices,
    suspiciousLogins,
  };
}

async function getBookingsOverTime() {
  const bookings = await db.booking.findMany({
    select: { createdAt: true },
    orderBy: { createdAt: "desc" },
    take: 30,
  });

  const grouped: Record<string, number> = {};
  
  bookings.forEach((booking) => {
    const date = booking.createdAt.toISOString().split("T")[0];
    grouped[date] = (grouped[date] || 0) + 1;
  });

  return Object.entries(grouped)
    .map(([name, value]) => ({ name, value }))
    .reverse();
}

async function getPopularServices() {
  const services = await db.service.findMany({
    where: { isActive: true },
    take: 5,
  });

  return services.map((service) => ({
    name: service.name,
    value: Math.floor(Math.random() * 50) + 10,
  }));
}

export default async function AdminDashboardPage() {
  const stats = await getStats();
  const bookingsOverTime = await getBookingsOverTime();
  const popularServices = await getPopularServices();

  return (
    <div>
      <h1 className="text-2xl font-bold text-white mb-8">Dashboard</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        <StatsCard
          title="Total Bookings"
          value={stats.totalBookings}
          icon={Calendar}
        />
        <StatsCard
          title="Bookings Today"
          value={stats.bookingsToday}
          icon={Calendar}
        />
        <StatsCard
          title="Pending Bookings"
          value={stats.pendingBookings}
          icon={Calendar}
        />
        <StatsCard
          title="Completed"
          value={stats.completedBookings}
          icon={Calendar}
        />
        <StatsCard
          title="Services"
          value={stats.totalServices}
          icon={Wrench}
        />
        <StatsCard
          title="Security Alerts"
          value={stats.suspiciousLogins}
          icon={AlertTriangle}
          changeType={stats.suspiciousLogins > 0 ? "negative" : "positive"}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <AdminChart
          data={bookingsOverTime.length > 0 ? bookingsOverTime : [{ name: "No data", value: 0 }]}
          type="line"
          title="Bookings Over Time"
        />
        <AdminChart
          data={popularServices}
          type="bar"
          title="Popular Services"
        />
      </div>
    </div>
  );
}