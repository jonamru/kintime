// 共通の型定義

export interface User {
  id: string;
  email: string;
  name: string;
  customRoleId: string;
  customRole?: {
    id: string;
    name: string;
    displayName: string;
    permissions: Record<string, unknown>;
    pageAccess: Record<string, unknown>;
  };
  partnerId?: string;
  partner?: {
    id: string;
    name: string;
  };
  managerId?: string;
  manager?: User;
  createdAt?: Date | string;
  updatedAt?: Date | string;
}

export interface Attendance {
  id: string;
  userId: string;
  user?: User;
  date: Date | string;
  type: 'CLOCK_IN' | 'CLOCK_OUT' | 'WAKE_UP' | 'DEPARTURE';
  clockTime: Date | string;
  latitude?: number | null;
  longitude?: number | null;
  corrections?: Correction[];
  createdAt?: Date | string;
  updatedAt?: Date | string;
}

export interface Correction {
  id: string;
  attendanceId: string;
  attendance?: Attendance;
  oldTime: Date | string;
  newTime: Date | string;
  reason: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  comment?: string;
  approvedBy?: string;
  createdAt?: Date | string;
  updatedAt?: Date | string;
}

export interface Shift {
  id: string;
  userId: string;
  user?: User;
  projectId: string;
  project?: Project;
  date: Date | string;
  startTime: Date | string;
  endTime: Date | string;
  shiftType: 'REGULAR' | 'SPOT';
  location?: string;
  status: 'DRAFT' | 'CONFIRMED' | 'CANCELLED';
  createdAt?: Date | string;
  updatedAt?: Date | string;
}

export interface ShiftRequest {
  id: string;
  userId: string;
  user?: User;
  date: Date | string;
  isAvailable: boolean;
  note?: string;
  createdAt?: Date | string;
  updatedAt?: Date | string;
}

export interface Project {
  id: string;
  name: string;
  client: string;
  location: string;
  description?: string;
  contractPrice?: number;
  paymentPrice?: number;
  createdAt?: Date | string;
  updatedAt?: Date | string;
}

export interface Expense {
  id: string;
  userId: string;
  user?: User;
  date: Date | string;
  type: 'TRANSPORT' | 'LODGING';
  amount: number;
  description?: string;
  departure?: string;
  arrival?: string;
  route?: string;
  referenceUrl?: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  comment?: string;
  approvedBy?: string;
  tripType?: 'ONE_WAY' | 'ROUND_TRIP';
  validFrom?: Date | string;
  validUntil?: Date | string;
  createdAt?: Date | string;
  updatedAt?: Date | string;
}

export interface CommutePass {
  id: string;
  userId: string;
  user?: User;
  startStation: string;
  endStation: string;
  validFrom: Date | string;
  validUntil: Date | string;
  imageUrl?: string;
  createdAt?: Date | string;
  updatedAt?: Date | string;
}

export interface Partner {
  id: string;
  name: string;
  users?: User[];
  createdAt?: Date | string;
  updatedAt?: Date | string;
}

export interface CustomRole {
  id: string;
  name: string;
  displayName: string;
  isSystem: boolean;
  permissions: {
    userManagement?: {
      create?: boolean;
      edit?: boolean;
      delete?: boolean;
      view?: boolean;
    };
    shiftManagement?: {
      approve?: boolean;
      edit?: boolean;
      delete?: boolean;
      view?: boolean;
      forceRegister?: boolean;
      lock?: boolean;
    };
    attendanceManagement?: {
      viewAll?: boolean;
      forceClock?: boolean;
      editOthers?: boolean;
    };
    expenseManagement?: {
      approve?: boolean;
      viewAll?: boolean;
      lock?: boolean;
      delete?: boolean;
    };
    systemSettings?: {
      manageCompany?: boolean;
      manageRoles?: boolean;
      managePartners?: boolean;
    };
  };
  pageAccess: Record<string, boolean>;
  users?: User[];
  createdAt?: Date | string;
  updatedAt?: Date | string;
}

export interface BulkEditPermissions {
  canEditAttendance: boolean;
  canEditShift: boolean;
  canEditExpense: boolean;
  canApproveShift: boolean;
  canApproveExpense: boolean;
  canDeleteExpense: boolean;
}

export interface ApiResponse<T = unknown> {
  data?: T;
  error?: string;
  message?: string;
  success?: boolean;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}

export interface RequestQuery {
  page?: string;
  limit?: string;
  search?: string;
  userId?: string;
  date?: string;
  month?: string;
  year?: string;
  type?: string;
  status?: string;
  [key: string]: string | undefined;
}