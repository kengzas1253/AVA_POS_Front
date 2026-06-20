import { useEffect, useState, type FormEvent } from "react";
import {
  IconCategory,
  IconPencil,
  IconPlus,
  IconTrash,
  IconX,
} from "@tabler/icons-react";
import { ensureValidAccessToken, refreshAccessToken } from "./auth";

interface Category {
  id: number | string;
  category_name: string;
  product_count: number;
  sort_order?: number;
  status?: string;
  created_at?: string;
  [key: string]: unknown;
}

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
  const isAuthenticated = await ensureValidAccessToken();

  if (!isAuthenticated) {
    throw new Error("ไม่สามารถยืนยันตัวตนได้");
  }

  const apiBaseUrl = await getApiBaseUrl();
  let accessToken = await window.electronStore.get("access_token");

  if (typeof accessToken !== "string" || !accessToken.trim()) {
    throw new Error("ไม่พบ access token");
  }

  const request = (token: string) =>
    fetch(`${apiBaseUrl}${path}`, {
      ...init,
      headers: {
        ...init.headers,
        Authorization: `Bearer ${token}`,
      },
    });

  let response = await request(accessToken);

  if (response.status === 401) {
    accessToken = await refreshAccessToken();
    response = await request(accessToken);
  }

  return response;
};

// ฟังก์ชันสำหรับแปลงชื่อหมวดหมู่ให้แสดงผล
const getDisplayCategoryName = (categoryName: string): string => {
  if (categoryName === "General") {
    return "สินค้าทั่วไป";
  }
  return categoryName;
};

export default function Categories() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const [editingCategory, setEditingCategory] = useState<Category | null>(
    null,
  );
  const [editCategoryName, setEditCategoryName] = useState("");
  const [isEditSubmitting, setIsEditSubmitting] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const [deletingCategory, setDeletingCategory] = useState<Category | null>(
    null,
  );
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const fetchCategories = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await authorizedFetch("/categories");

      if (!response.ok) {
        throw new Error(`โหลดข้อมูลไม่สำเร็จ (${response.status})`);
      }

      const data: Category[] | { data?: Category[] } = await response.json();
      const list = Array.isArray(data) ? data : data.data ?? [];
      setCategories(list);
    } catch (err) {
      console.error("Error fetching categories:", err);
      setError("ไม่สามารถโหลดข้อมูลหมวดหมู่ได้ กรุณาลองใหม่อีกครั้ง");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  const openModal = () => {
    setNewCategoryName("");
    setSubmitError(null);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    if (isSubmitting) {
      return;
    }
    setIsModalOpen(false);
  };

  const handleAddCategory = async (event: FormEvent) => {
    event.preventDefault();

    const trimmedName = newCategoryName.trim();
    if (!trimmedName) {
      setSubmitError("กรุณากรอกชื่อหมวดหมู่");
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const response = await authorizedFetch("/categories", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ category_name: trimmedName }),
      });

      if (!response.ok) {
        // ตรวจสอบ status code 409 (Conflict) สำหรับกรณีข้อมูลซ้ำ
        if (response.status === 409) {
          const errorData = await response.json().catch(() => ({}));
          if (errorData.message?.includes("Duplicate category")) {
            setSubmitError("ไม่สามารถเพิ่มหมวดหมู่ได้ เนื่องจากมีข้อมูลนี้อยู่ในระบบแล้ว");
            return;
          }
        }
        throw new Error(`เพิ่มหมวดหมู่ไม่สำเร็จ (${response.status})`);
      }

      setIsModalOpen(false);
      setNewCategoryName("");
      await fetchCategories();
    } catch (err) {
      console.error("Error adding category:", err);
      setSubmitError("ไม่สามารถเพิ่มหมวดหมู่ได้ กรุณาลองใหม่อีกครั้ง");
    } finally {
      setIsSubmitting(false);
    }
  };

  const openEditModal = (category: Category) => {
    setEditingCategory(category);
    setEditCategoryName(category.category_name);
    setEditError(null);
  };

  const closeEditModal = () => {
    if (isEditSubmitting) {
      return;
    }
    setEditingCategory(null);
    setEditCategoryName("");
    setEditError(null);
  };

  const handleEditCategory = async (event: FormEvent) => {
    event.preventDefault();

    if (!editingCategory) {
      return;
    }

    const trimmedName = editCategoryName.trim();
    if (!trimmedName) {
      setEditError("กรุณากรอกชื่อหมวดหมู่");
      return;
    }

    setIsEditSubmitting(true);
    setEditError(null);

    try {
      const response = await authorizedFetch(
        `/categories/${editingCategory.id}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ category_name: trimmedName }),
        },
      );

      if (!response.ok) {
        // ตรวจสอบ status code 409 (Conflict) สำหรับกรณีข้อมูลซ้ำในการแก้ไข
        if (response.status === 409) {
          const errorData = await response.json().catch(() => ({}));
          if (errorData.message?.includes("Duplicate category")) {
            setEditError("ไม่สามารถแก้ไขหมวดหมู่ได้ เนื่องจากมีข้อมูลนี้อยู่ในระบบแล้ว");
            return;
          }
        }
        throw new Error(`แก้ไขหมวดหมู่ไม่สำเร็จ (${response.status})`);
      }

      setEditingCategory(null);
      setEditCategoryName("");
      await fetchCategories();
    } catch (err) {
      console.error("Error editing category:", err);
      setEditError("ไม่สามารถแก้ไขหมวดหมู่ได้ กรุณาลองใหม่อีกครั้ง");
    } finally {
      setIsEditSubmitting(false);
    }
  };

  const openDeleteDialog = (category: Category) => {
    setDeletingCategory(category);
    setDeleteError(null);
  };

  const closeDeleteDialog = () => {
    if (isDeleting) {
      return;
    }
    setDeletingCategory(null);
    setDeleteError(null);
  };

  const handleDeleteCategory = async () => {
    if (!deletingCategory) {
      return;
    }

    setIsDeleting(true);
    setDeleteError(null);

    try {
      const response = await authorizedFetch(
        `/categories/${deletingCategory.id}`,
        {
          method: "DELETE",
        },
      );

      if (!response.ok) {
        throw new Error(`ลบหมวดหมู่ไม่สำเร็จ (${response.status})`);
      }

      setDeletingCategory(null);
      await fetchCategories();
    } catch (err) {
      console.error("Error deleting category:", err);
      setDeleteError("ไม่สามารถลบหมวดหมู่ได้ กรุณาลองใหม่อีกครั้ง");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="flex h-full flex-col bg-slate-50 px-6 py-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">หมวดหมู่สินค้า</h1>
          <p className="mt-1 text-sm text-slate-500">
            จัดการหมวดหมู่สำหรับจัดกลุ่มสินค้าในร้านของคุณ
          </p>
        </div>

        <button
          type="button"
          onClick={openModal}
          className="flex items-center gap-2 rounded-xl bg-[#1d6fd8] px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-[#1a5fc0]"
        >
          <IconPlus size={18} />
          เพิ่มหมวดหมู่
        </button>
      </div>

      <div className="flex-1 overflow-y-auto rounded-2xl bg-white p-4 shadow-sm">
        {isLoading ? (
          <div className="flex h-40 items-center justify-center text-sm text-slate-400">
            กำลังโหลดข้อมูล...
          </div>
        ) : error ? (
          <div className="flex h-40 flex-col items-center justify-center gap-3 text-center">
            <p className="text-sm text-red-500">{error}</p>
            <button
              type="button"
              onClick={fetchCategories}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
            >
              ลองอีกครั้ง
            </button>
          </div>
        ) : categories.length === 0 ? (
          <div className="flex h-40 flex-col items-center justify-center gap-2 text-center text-slate-400">
            <IconCategory size={32} className="text-slate-300" />
            <p className="text-sm">ยังไม่มีหมวดหมู่ กดปุ่ม "เพิ่มหมวดหมู่" เพื่อเริ่มต้น</p>
          </div>
        ) : (
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {categories.map((category) => (
              <li
                key={category.id}
                className="flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50 px-4 py-3"
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#1d6fd8]/10">
                  <IconCategory size={18} className="text-[#1d6fd8]" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-700">
                    {getDisplayCategoryName(category.category_name)}
                  </p>
                  <p className="text-sm text-slate-500">
                    จำนวนสินค้า {category.product_count ?? 0} รายการ
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <button
                    type="button"
                    onClick={() => openEditModal(category)}
                    aria-label="แก้ไขหมวดหมู่"
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-200 hover:text-slate-600"
                  >
                    <IconPencil size={16} />
                  </button>
                  <button
                    type="button"
                    onClick={() => openDeleteDialog(category)}
                    aria-label="ลบหมวดหมู่"
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-500"
                  >
                    <IconTrash size={16} />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {isModalOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
          onClick={closeModal}
        >
          <div
            className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-800">เพิ่มหมวดหมู่</h2>
              <button
                type="button"
                onClick={closeModal}
                className="text-slate-400 hover:text-slate-600"
              >
                <IconX size={20} />
              </button>
            </div>

            <form onSubmit={handleAddCategory} className="space-y-4">
              <div>
                <label
                  htmlFor="category-name"
                  className="mb-1.5 block text-sm font-medium text-slate-600"
                >
                  ชื่อหมวดหมู่
                </label>
                <input
                  id="category-name"
                  type="text"
                  value={newCategoryName}
                  onChange={(event) => setNewCategoryName(event.target.value)}
                  placeholder="เช่น เครื่องดื่ม, ขนม, ของใช้ในบ้าน"
                  autoFocus
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-[#1d6fd8] focus:ring-2 focus:ring-[#1d6fd8]/20"
                />
                {submitError ? (
                  <p className="mt-1.5 text-sm text-red-500">{submitError}</p>
                ) : null}
              </div>

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
                  className="flex-1 rounded-xl bg-[#1d6fd8] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#1a5fc0] disabled:opacity-50"
                >
                  {isSubmitting ? "กำลังบันทึก..." : "บันทึก"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {editingCategory ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
          onClick={closeEditModal}
        >
          <div
            className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-800">แก้ไขหมวดหมู่</h2>
              <button
                type="button"
                onClick={closeEditModal}
                className="text-slate-400 hover:text-slate-600"
              >
                <IconX size={20} />
              </button>
            </div>

            <form onSubmit={handleEditCategory} className="space-y-4">
              <div>
                <label
                  htmlFor="edit-category-name"
                  className="mb-1.5 block text-sm font-medium text-slate-600"
                >
                  ชื่อหมวดหมู่
                </label>
                <input
                  id="edit-category-name"
                  type="text"
                  value={editCategoryName}
                  onChange={(event) => setEditCategoryName(event.target.value)}
                  placeholder="เช่น เครื่องดื่ม, ขนม, ของใช้ในบ้าน"
                  autoFocus
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-[#1d6fd8] focus:ring-2 focus:ring-[#1d6fd8]/20"
                />
                {editError ? (
                  <p className="mt-1.5 text-sm text-red-500">{editError}</p>
                ) : null}
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={closeEditModal}
                  disabled={isEditSubmitting}
                  className="flex-1 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={isEditSubmitting}
                  className="flex-1 rounded-xl bg-[#1d6fd8] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#1a5fc0] disabled:opacity-50"
                >
                  {isEditSubmitting ? "กำลังบันทึก..." : "บันทึก"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {deletingCategory ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
          onClick={closeDeleteDialog}
        >
          <div
            className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-800">ลบหมวดหมู่</h2>
              <button
                type="button"
                onClick={closeDeleteDialog}
                className="text-slate-400 hover:text-slate-600"
              >
                <IconX size={20} />
              </button>
            </div>

            <p className="text-sm text-slate-600">
              ต้องการลบหมวดหมู่ "
              <span className="font-medium text-slate-800">
                {getDisplayCategoryName(deletingCategory.category_name)}
              </span>
              " ใช่หรือไม่? การลบนี้ไม่สามารถย้อนกลับได้
            </p>

            {deleteError ? (
              <p className="mt-2 text-sm text-red-500">{deleteError}</p>
            ) : null}

            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={closeDeleteDialog}
                disabled={isDeleting}
                className="flex-1 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={handleDeleteCategory}
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