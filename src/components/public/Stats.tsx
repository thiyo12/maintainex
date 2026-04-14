export function Stats() {
  const stats = [
    { value: "3.4 million+", label: "Tasks completed" },
    { value: "1.5 million+", label: "Items assembled" },
    { value: "1 million+", label: "Items mounted" },
    { value: "890,000+", label: "Homes cleaned" },
  ];

  return (
    <section className="py-12 bg-primary-light/30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-8">
          {stats.map((stat, idx) => (
            <div key={idx} className="text-center">
              <div className="text-2xl md:text-3xl lg:text-4xl font-bold text-dark mb-2">
                {stat.value}
              </div>
              <div className="text-sm md:text-base text-gray-600">
                {stat.label}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}