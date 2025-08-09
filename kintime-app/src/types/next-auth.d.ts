import { UserRole } from "@prisma/client";
import "next-auth";

declare module "next-auth" {
  interface User {
    id: string;
    role: UserRole;
    partnerId: string | null;
    managerId: string | null;
  }

  interface Session {
    user: {
      id: string;
      email: string;
      name: string;
      role: UserRole;
      partnerId: string | null;
      managerId: string | null;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: UserRole;
    partnerId: string | null;
    managerId: string | null;
  }
}