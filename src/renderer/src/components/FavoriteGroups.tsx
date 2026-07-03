import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import {
  IconApple,
  IconBottle,
  IconCarrot,
  IconCategory,
  IconDiamond,
  IconFishHook,
  IconGift,
  IconHeart,
  IconMeat,
  IconNotebook,
  IconPencil,
  IconPlant,
  IconPlus,
  IconPaw,
  IconRefresh,
  IconSalt,
  IconShirt,
  IconStar,
  IconTrash,
  IconX,
} from "@tabler/icons-react";
import { ensureValidAccessToken, refreshAccessToken } from "./auth";
import FavoriteItems, { type FavoriteProduct } from "./FavoriteItems";

export interface FavoriteGroup {
  id: number | string;
  group_name?: string;
  favorite_group_name?: string;
  name?: string;
  icon?: string;
  icon_name?: string;
  icon_css?: string;
  group_icon?: string;
  product_count?: number;
  [key: string]: unknown;
}

export const favoriteGroupIcons = [
  { value: "star", label: "ดาว", Icon: IconStar },
  { value: "shirt", label: "เสื้อผ้า", Icon: IconShirt },
  { value: "paw", label: "สัตว์", Icon: IconPaw },
  { value: "symbol", label: "สัญลักษณ์", Icon: IconCategory },
  { value: "heart", label: "หัวใจ", Icon: IconHeart },
  { value: "gift", label: "ของขวัญ", Icon: IconGift },
  { value: "diamond", label: "เพชร", Icon: IconDiamond },
  { value: "seasoning", label: "เครื่องปรุง", Icon: IconSalt },
  { value: "drink", label: "เครื่องดื่ม", Icon: IconBottle },
  { value: "fishing", label: "อุปกรณ์ตกปลา", Icon: IconFishHook },
  { value: "plant", label: "ต้นไม้", Icon: IconPlant },
  { value: "vegetable", label: "ผัก", Icon: IconCarrot },
  { value: "fruit", label: "ผลไม้", Icon: IconApple },
  { value: "meat", label: "เนื้อสัตว์", Icon: IconMeat },
  { value: "stationery", label: "เครื่องเขียน", Icon: IconNotebook },
] as const;

export type FavoriteGroupIcon = (typeof favoriteGroupIcons)[number]["value"];

const normalizeFavoriteGroupIcon = (value: unknown): FavoriteGroupIcon => {
  if (typeof value !== "string") return "star";

  const normalizedValue = value
    .trim()
    .toLowerCase()
    .replace(/^icon-/, "")
    .replace(/^ti ti-/, "");

  return favoriteGroupIcons.some((option) => option.value === normalizedValue)
    ? (normalizedValue as FavoriteGroupIcon)
    : "star";
};

export const getFavoriteGroupIconName = (
  group: FavoriteGroup,
): FavoriteGroupIcon =>
  normalizeFavoriteGroupIcon(
    group.icon ?? group.icon_name ?? group.icon_css ?? group.group_icon,
  );

export const getFavoriteGroupIcon = (group: FavoriteGroup) =>
  favoriteGroupIcons.find(
    (option) => option.value === getFavoriteGroupIconName(group),
  )?.Icon ?? IconStar;

type ApiResponse =
  | FavoriteGroup
  | FavoriteGroup[]
  | { data?: FavoriteGroup | FavoriteGroup[] };

const getApiBaseUrl = async (): Promise<string> => {
  const apiPath = await window.electronStore.get("apiPath");
  if (typeof apiPath !== "string" || !apiPath.trim()) {
    throw new Error("ไม่พบ API endpoint ใน store");
  }
  return apiPath.trim().replace(/\/+$/, "");
};

const authorizedFetch = async (
  path: string,
  init: RequestInit = {},
): Promise<Response> => {
  if (!(await ensureValidAccessToken())) {
    throw new Error("ไม่สามารถยืนยันตัวตนได้");
  }

  const apiBaseUrl = await getApiBaseUrl();
  let accessToken = await window.electronStore.get("access_token");
  if (typeof accessToken !== "string" || !accessToken.trim()) {
    throw new Error("ไม่พบ access token");
  }

  const requestUrl = `${apiBaseUrl}${path}`;
  const request = (token: string) => {
    const headers = new Headers(init.headers);
    headers.set("Authorization", `Bearer ${token}`);

    return fetch(requestUrl, {
      ...init,
      headers,
    });
  };

  let response = await request(accessToken);
  if (response.status === 401) {
    accessToken = await refreshAccessToken();
    response = await request(accessToken);
  }
  return response;
};

const getResponseError = async (
  response: Response,
  fallbackMessage: string,
): Promise<string> => {
  const responseBody = await response.text();

  if (responseBody) {
    try {
      const parsed = JSON.parse(responseBody) as { message?: unknown };
      if (typeof parsed.message === "string" && parsed.message.trim()) {
        return parsed.message;
      }
    } catch {
      return responseBody;
    }
  }

  return `${fallbackMessage} (${response.status})`;
};

export const getFavoriteGroupName = (group: FavoriteGroup): string =>
  group.group_name ?? group.favorite_group_name ?? group.name ?? "-";

const unwrapData = (payload: ApiResponse) =>
  typeof payload === "object" && payload !== null && "data" in payload
    ? payload.data
    : payload;

interface FavoriteGroupsProps {
  activeGroupId?: FavoriteGroup["id"] | null;
  onGroupsChange?: (groups: FavoriteGroup[]) => void;
  onAddToCart?: (product: FavoriteProduct) => void;
  rootContent?: ReactNode;
  createRequestKey?: number;
  editGroupRequest?: { key: number; group: FavoriteGroup } | null;
  deleteGroupRequest?: { key: number; group: FavoriteGroup } | null;
}

export default function FavoriteGroups({
  activeGroupId = null,
  onGroupsChange,
  onAddToCart,
  rootContent,
  createRequestKey = 0,
  editGroupRequest = null,
  deleteGroupRequest = null,
}: FavoriteGroupsProps) {
  const [groups, setGroups] = useState<FavoriteGroup[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalMode, setModalMode] = useState<"create" | "edit" | null>(null);
  const [selectedGroup, setSelectedGroup] = useState<FavoriteGroup | null>(null);
  const [groupName, setGroupName] = useState("");
  const [groupIcon, setGroupIcon] = useState<FavoriteGroupIcon>("star");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [deletingGroup, setDeletingGroup] = useState<FavoriteGroup | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const lastCreateRequestKey = useRef(createRequestKey);
  const lastEditRequestKey = useRef(editGroupRequest?.key ?? 0);
  const lastDeleteRequestKey = useRef(deleteGroupRequest?.key ?? 0);

  const fetchGroups = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await authorizedFetch("/favorite-groups");
      if (!response.ok) {
        throw new Error(`โหลดกลุ่ม Favorite ไม่สำเร็จ (${response.status})`);
      }
      const data = unwrapData((await response.json()) as ApiResponse);
      const nextGroups = Array.isArray(data) ? data : data ? [data] : [];
      setGroups(nextGroups);
      onGroupsChange?.(nextGroups);
    } catch (err) {
      console.error("Error fetching favorite groups:", err);
      setError("ไม่สามารถโหลดกลุ่ม Favorite ได้ กรุณาลองใหม่อีกครั้ง");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void fetchGroups();
  }, []);

  const openCreateModal = () => {
    setSelectedGroup(null);
    setGroupName("");
    setGroupIcon("star");
    setSubmitError(null);
    setModalMode("create");
  };

  useEffect(() => {
    if (createRequestKey !== lastCreateRequestKey.current) {
      lastCreateRequestKey.current = createRequestKey;
      openCreateModal();
    }
  }, [createRequestKey]);

  useEffect(() => {
    if (
      editGroupRequest &&
      editGroupRequest.key !== lastEditRequestKey.current
    ) {
      lastEditRequestKey.current = editGroupRequest.key;
      void openEditModal(editGroupRequest.group);
    }
  }, [editGroupRequest]);

  useEffect(() => {
    if (
      deleteGroupRequest &&
      deleteGroupRequest.key !== lastDeleteRequestKey.current
    ) {
      lastDeleteRequestKey.current = deleteGroupRequest.key;
      setDeletingGroup(deleteGroupRequest.group);
      setDeleteError(null);
    }
  }, [deleteGroupRequest]);

  const openEditModal = async (group: FavoriteGroup) => {
    setSelectedGroup(group);
    setGroupName(getFavoriteGroupName(group));
    setGroupIcon(getFavoriteGroupIconName(group));
    setSubmitError(null);
    setModalMode("edit");

    try {
      const response = await authorizedFetch(`/favorite-groups/${group.id}`);
      if (!response.ok) {
        throw new Error(`โหลดรายละเอียดกลุ่มไม่สำเร็จ (${response.status})`);
      }
      const data = unwrapData((await response.json()) as ApiResponse);
      const detail = Array.isArray(data) ? data[0] : data;
      if (detail) {
        setSelectedGroup(detail);
        setGroupName(getFavoriteGroupName(detail));
        setGroupIcon(getFavoriteGroupIconName(detail));
      }
    } catch (err) {
      console.error("Error fetching favorite group detail:", err);
      setSubmitError("ไม่สามารถโหลดรายละเอียดล่าสุดได้");
    }
  };

  const closeModal = () => {
    if (isSubmitting) return;
    setModalMode(null);
    setSelectedGroup(null);
    setSubmitError(null);
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const trimmedName = groupName.trim();
    if (!trimmedName) {
      setSubmitError("กรุณากรอกชื่อกลุ่ม Favorite");
      return;
    }
    if (modalMode === "edit" && !selectedGroup) return;

    setIsSubmitting(true);
    setSubmitError(null);
    try {
      const isEditing = modalMode === "edit";
      const response = await authorizedFetch(
        isEditing
          ? `/favorite-groups/${selectedGroup?.id}`
          : "/favorite-groups",
        {
          method: isEditing ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            group_name: trimmedName,
            icon: groupIcon,
          }),
        },
      );

      if (!response.ok) {
        const action = isEditing ? "แก้ไข" : "เพิ่ม";
        const responseMessage = await getResponseError(
          response,
          `${action}กลุ่มไม่สำเร็จ`,
        );
        const method = isEditing ? "PUT" : "POST";
        const path = isEditing
          ? `/favorite-groups/${selectedGroup?.id}`
          : "/favorite-groups";

        throw new Error(
          `${responseMessage} [${method} ${path}, HTTP ${response.status}]`,
        );
      }

      setModalMode(null);
      setSelectedGroup(null);
      await fetchGroups();
    } catch (err) {
      console.error("Error saving favorite group:", err);
      setSubmitError(
        err instanceof Error ? err.message : "ไม่สามารถบันทึกกลุ่ม Favorite ได้",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingGroup) return;
    setIsDeleting(true);
    setDeleteError(null);
    try {
      const response = await authorizedFetch(
        `/favorite-groups/${deletingGroup.id}`,
        { method: "DELETE" },
      );
      if (!response.ok) {
        throw new Error(`ลบกลุ่มไม่สำเร็จ (${response.status})`);
      }
      setDeletingGroup(null);
      await fetchGroups();
    } catch (err) {
      console.error("Error deleting favorite group:", err);
      setDeleteError("ไม่สามารถลบกลุ่ม Favorite ได้ กรุณาลองใหม่อีกครั้ง");
    } finally {
      setIsDeleting(false);
    }
  };

  const activeGroup = groups.find(
    (group) => String(group.id) === String(activeGroupId),
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-4">
      {!activeGroupId && !rootContent ? (
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h2 className="font-bold text-slate-900">กลุ่ม Favorite</h2>
            <p className="mt-0.5 text-xs text-slate-500">
              จัดกลุ่มสินค้าที่ใช้งานบ่อยเพื่อเลือกขายได้รวดเร็วขึ้น
            </p>
          </div>
          <button
            type="button"
            onClick={openCreateModal}
            className="flex h-9 items-center gap-2 rounded-lg bg-[#1d6fd8] px-3 text-sm font-medium text-white hover:bg-[#1557ad]"
          >
            <IconPlus size={16} />
            เพิ่มกลุ่ม
          </button>
        </div>
      ) : null}

      {isLoading ? (
        <div className="grid flex-1 place-items-center text-sm text-slate-400">
          กำลังโหลดข้อมูล...
        </div>
      ) : error ? (
        <div className="grid flex-1 place-items-center text-center">
          <div>
            <p className="text-sm text-red-500">{error}</p>
            <button
              type="button"
              onClick={() => void fetchGroups()}
              className="mx-auto mt-3 flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50"
            >
              <IconRefresh size={16} />
              ลองอีกครั้ง
            </button>
          </div>
        </div>
      ) : activeGroupId && activeGroup ? (
        <FavoriteItems
          groupId={activeGroup.id}
          groupName={getFavoriteGroupName(activeGroup)}
          onAddToCart={onAddToCart ?? (() => undefined)}
        />
      ) : !activeGroupId && rootContent ? (
        rootContent
      ) : groups.length === 0 ? (
        <div className="grid flex-1 place-items-center text-center text-slate-400">
          <div>
            <IconStar size={38} className="mx-auto mb-2 text-amber-400" />
            <p className="text-sm">ยังไม่มีกลุ่ม Favorite</p>
          </div>
        </div>
      ) : (
        <ul className="grid auto-rows-min grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {groups.map((group) => {
            const GroupIcon = getFavoriteGroupIcon(group);

            return (
              <li
                key={group.id}
                className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-500">
                  <GroupIcon size={20} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-slate-800">
                    {getFavoriteGroupName(group)}
                  </p>
                  {typeof group.product_count === "number" ? (
                    <p className="mt-0.5 text-xs text-slate-500">
                      {group.product_count} สินค้า
                    </p>
                  ) : null}
                </div>
                <button
                  type="button"
                  onClick={() => void openEditModal(group)}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-[#1d6fd8]"
                  aria-label="แก้ไขกลุ่ม Favorite"
                >
                  <IconPencil size={16} />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setDeletingGroup(group);
                    setDeleteError(null);
                  }}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-500"
                  aria-label="ลบกลุ่ม Favorite"
                >
                  <IconTrash size={16} />
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {modalMode ? (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
          onClick={closeModal}
        >
          <div
            className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-800">
                {modalMode === "create" ? "เพิ่มกลุ่ม Favorite" : "แก้ไขกลุ่ม Favorite"}
              </h3>
              <button
                type="button"
                onClick={closeModal}
                className="text-slate-400 hover:text-slate-600"
              >
                <IconX size={20} />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label
                  htmlFor="favorite-group-name"
                  className="mb-1.5 block text-sm font-medium text-slate-600"
                >
                  ชื่อกลุ่ม
                </label>
                <input
                  id="favorite-group-name"
                  value={groupName}
                  onChange={(event) => setGroupName(event.target.value)}
                  autoFocus
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-[#1d6fd8] focus:ring-2 focus:ring-[#1d6fd8]/20"
                  placeholder="เช่น สินค้าขายดี"
                />
              </div>
              <fieldset>
                <legend className="mb-2 block text-sm font-medium text-slate-600">
                  ไอคอนกลุ่ม
                </legend>
                <div className="grid grid-cols-4 gap-2">
                  {favoriteGroupIcons.map(({ value, label, Icon }) => {
                    const isSelected = groupIcon === value;

                    return (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setGroupIcon(value)}
                        className={`flex min-w-0 flex-col items-center gap-1 rounded-xl border px-2 py-2.5 text-xs transition ${
                          isSelected
                            ? "border-[#1d6fd8] bg-blue-50 text-[#1d6fd8] ring-2 ring-[#1d6fd8]/15"
                            : "border-slate-200 text-slate-500 hover:border-blue-200 hover:bg-slate-50"
                        }`}
                        aria-label={`เลือกไอคอน${label}`}
                        aria-pressed={isSelected}
                      >
                        <Icon size={21} />
                        <span className="w-full truncate">{label}</span>
                      </button>
                    );
                  })}
                </div>
              </fieldset>
              {submitError ? (
                <p className="text-sm text-red-500">{submitError}</p>
              ) : null}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={closeModal}
                  disabled={isSubmitting}
                  className="flex-1 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 rounded-xl bg-[#1d6fd8] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#1557ad] disabled:opacity-50"
                >
                  {isSubmitting ? "กำลังบันทึก..." : "บันทึก"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {deletingGroup ? (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
          onClick={() => !isDeleting && setDeletingGroup(null)}
        >
          <div
            className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <h3 className="text-lg font-bold text-slate-800">ลบกลุ่ม Favorite</h3>
            <p className="mt-2 text-sm text-slate-600">
              ต้องการลบกลุ่ม “{getFavoriteGroupName(deletingGroup)}” ใช่หรือไม่?
            </p>
            {deleteError ? (
              <p className="mt-2 text-sm text-red-500">{deleteError}</p>
            ) : null}
            <div className="mt-5 flex gap-2">
              <button
                type="button"
                onClick={() => setDeletingGroup(null)}
                disabled={isDeleting}
                className="flex-1 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={() => void handleDelete()}
                disabled={isDeleting}
                className="flex-1 rounded-xl bg-red-500 px-4 py-2.5 text-sm font-medium text-white hover:bg-red-600 disabled:opacity-50"
              >
                {isDeleting ? "กำลังลบ..." : "ลบ"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
