import { useEffect, useState } from "react";
import { IconUser } from "@tabler/icons-react";

interface AccountBarProps {
  isOpen: boolean;
}

interface StoredUser {
  username?: string;
  full_name?: string;
  role?: string;
}

interface AccountData {
  fullName: string;
  role: string;
}

const fallbackAccount: AccountData = {
  fullName: "ผู้ใช้งาน",
  role: "-",
};

const getAccountData = (value: unknown): AccountData => {
  if (!value || typeof value !== "object") {
    return fallbackAccount;
  }

  const user = value as StoredUser;

  return {
    fullName: user.full_name || user.username || fallbackAccount.fullName,
    role: user.role || fallbackAccount.role,
  };
};

const getRoleLabel = (role: string): string => {
  const roleMap: Record<string, string> = {
    owner: "เจ้าของร้าน",
    admin: "ผู้ดูแลระบบ",
    manager: "ผู้จัดการ",
    staff: "พนักงาน",
    cashier: "พนักงานคิดเงิน",
  };

  return roleMap[role.toLowerCase()] || role;
};

export default function AccountBar({ isOpen }: AccountBarProps) {
  const [account, setAccount] = useState<AccountData>(fallbackAccount);

  useEffect(() => {
    let isMounted = true;

    const loadAccount = async () => {
      try {
        const storedUser = await window.electronStore.get("user");

        if (isMounted) {
          setAccount(getAccountData(storedUser));
        }
      } catch (error) {
        console.error("Error loading account data:", error);
      }
    };

    loadAccount();

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <div
      className={`border-b border-white/20 px-4 py-4 ${
        isOpen ? "block" : "flex justify-center"
      }`}
    >
      {isOpen ? (
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/20">
              <IconUser size={16} className="text-white" />
            </div>
            <p className="min-w-0 truncate text-sm font-semibold text-white">
              {account.fullName}
            </p>
          </div>
          <div className="pl-10">
            <span className="inline-flex items-center rounded-full bg-white/20 px-3 py-1 text-sm font-semibold leading-5 text-white">
              {getRoleLabel(account.role)}
            </span>
          </div>
        </div>
      ) : (
        <div
          className="flex h-10 w-10 items-center justify-center rounded-full bg-white/20"
          title={`${account.fullName} (${getRoleLabel(account.role)})`}
        >
          <IconUser size={18} className="text-white" />
        </div>
      )}
    </div>
  );
}
