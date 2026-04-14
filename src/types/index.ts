export type Role = "CUSTOMER" | "PROVIDER" | "ADMIN";
export type BookingStatus = "PENDING" | "CONFIRMED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";

export interface User {
  id: string;
  email: string;
  name: string;
  phone?: string;
  role: Role;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  icon?: string;
  image?: string;
  isActive: boolean;
  createdAt: Date;
  services?: Service[];
}

export interface Service {
  id: string;
  name: string;
  description: string;
  categoryId: string;
  category?: Category;
  price: number;
  duration: number;
  isActive: boolean;
  image?: string;
  createdAt: Date;
}

export interface Branch {
  id: string;
  name: string;
  address: string;
  city: string;
  phone?: string;
  isActive: boolean;
  createdAt: Date;
}

export interface Booking {
  id: string;
  userId: string;
  user?: User;
  serviceId: string;
  service?: Service;
  branchId: string;
  branch?: Branch;
  date: Date;
  timeSlot: string;
  status: BookingStatus;
  notes?: string;
  totalPrice: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface Application {
  id: string;
  name: string;
  email: string;
  phone: string;
  service: string;
  experience: string;
  resumeUrl?: string;
  status: string;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Review {
  id: string;
  userId: string;
  user?: User;
  serviceId: string;
  service?: Service;
  rating: number;
  comment?: string;
  createdAt: Date;
}

export interface LoginActivity {
  id: string;
  userId?: string;
  user?: User;
  email: string;
  ipAddress: string;
  userAgent: string;
  location?: string;
  isNewIP: boolean;
  isNewDevice: boolean;
  isSuspicious: boolean;
  reason?: string;
  createdAt: Date;
}

export interface DashboardStats {
  totalBookings: number;
  bookingsToday: number;
  pendingBookings: number;
  completedBookings: number;
  totalServices: number;
  suspiciousLogins: number;
}