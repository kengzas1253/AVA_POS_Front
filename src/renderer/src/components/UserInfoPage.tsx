import { useEffect, useState } from "react";
import { IconDeviceLaptop, IconId, IconUser, IconUserShield } from "@tabler/icons-react";

interface UserInfo {
  device_name: string;
  username: string;
  full_name: string;
  role: string;
}

interface StoredUser {
  username?: string;
  full_name?: string;
  role?: string;
}

interface StoredDevice {
  device_name?: string;
  pos_device?: {
    device_name?: string;
  };
}

const fallbackUserInfo: UserInfo = {
  device_name: "-",
  username: "-",
  full_name: "ผู้ใช้งาน",
  role: "-",
};

const getDeviceName = (value: unknown): string => {
  if (!value || typeof value !== "object") {
    return "-";
  }

  const device = value as StoredDevice;
  return device.device_name || device.pos_device?.device_name || "-";
};

const getUserInfo = (value: unknown): Omit<UserInfo, "device_name"> => {
  if (!value || typeof value !== "object") {
    return {
      username: "-",
      full_name: "ผู้ใช้งาน",
      role: "-",
    };
  }

  const user = value as StoredUser;

  return {
    username: user.username || "-",
    full_name: user.full_name || user.username || "ผู้ใช้งาน",
    role: user.role || "-",
  };
};

export function UserInfoPage() {
  const [userInfo, setUserInfo] = useState<UserInfo>(fallbackUserInfo);

  useEffect(() => {
    let isMounted = true;

    const loadUserInfo = async () => {
      const [storedUser, storedDevice] = await Promise.all([
        window.electronStore.get("user"),
        window.electronStore.get("pos_device"),
      ]);

      if (!isMounted) {
        return;
      }

      const user = getUserInfo(storedUser);
      setUserInfo({
        ...user,
        device_name: getDeviceName(storedDevice),
      });
    };

    loadUserInfo().catch((error) => {
      console.error("Error loading user info:", error);
    });

    return () => {
      isMounted = false;
    };
  }, []);

  const cards = [
    { label: "device_name", value: userInfo.device_name, icon: IconDeviceLaptop },
    { label: "username", value: userInfo.username, icon: IconId },
    { label: "full_name", value: userInfo.full_name, icon: IconUser },
    { label: "role", value: userInfo.role, icon: IconUserShield },
  ];

  return (
    <main className="min-h-0 flex-1 overflow-y-auto bg-slate-50 p-6">
      <div className="mx-auto max-w-4xl">
        <div className="mb-6">
          <p className="text-sm font-semibold uppercase tracking-wide text-[#1d6fd8]">
            AVA MY POS
          </p>
          <h1 className="mt-2 text-2xl font-bold text-slate-900">
            ข้อมูลผู้ใช้งาน
          </h1>
        </div>

        <section className="grid gap-4 md:grid-cols-2">
          {cards.map((card) => {
            const Icon = card.icon;

            return (
              <article
                key={card.label}
                className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
              >
                <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-[#1d6fd8]/10 text-[#1d6fd8]">
                  <Icon size={22} />
                </div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                  {card.label}
                </p>
                <p className="mt-2 break-words text-lg font-bold text-slate-900">
                  {card.value || "-"}
                </p>
              </article>
            );
          })}
        </section>
      </div>
    </main>
  );
}
