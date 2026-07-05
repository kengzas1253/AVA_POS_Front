import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from "react";
import {
  IconBox,
  IconChevronDown,
  IconPencil,
  IconPhoto,
  IconPlus,
  IconSearch,
  IconTrash,
  IconUpload,
  IconX,
} from "@tabler/icons-react";
import { ensureValidAccessToken, refreshAccessToken } from "./auth";
import { normalizeBarcode } from "./BarcodeNormalizer";

interface Category {
  id: number | string;
  category_name: string;
  product_count?: number;
  [key: string]: unknown;
}

interface Product {
  id: number | string;
  sku?: string;
  barcode?: string;
  description?: string | null;
  product_name: string;
  category_id: number | string;
  unit_code: string;
  price_mode: PriceMode;
  cost_price: number;
  sale_price: number;
  stock_qty: number;
  min_stock_qty: number;
  track_stock: boolean;
  allow_discount: boolean;
  status?: string;
  image_url?: string | null;
  [key: string]: unknown;
}

type PriceMode = "FIXED_PRICE" | "WEIGHT_PRICE" | "OPEN_PRICE" | "SERVICE_PRICE";

interface ScannedProduct {
  id: number | string;
  barcode?: string;
  name: string;
  product_type: "FIXED_PRICE" | "WEIGHT" | "WEIGHT_PRICE" | "OPEN_PRICE" | "SERVICE_PRICE";
  sale_price?: number;
  stock_qty?: number;
}

interface ScanProductResponse {
  success: boolean;
  code?: string;
  message?: string;
  product?: ScannedProduct;
}

const PRICE_MODE_OPTIONS: { value: PriceMode; label: string; hint: string }[] = [
  {
    value: "FIXED_PRICE",
    label: "สินค้าปกติ",
    hint: "ราคา = จำนวน × ราคาต่อหน่วย",
  },
  {
    value: "WEIGHT_PRICE",
    label: "สินค้าชั่งน้ำหนัก",
    hint: "ราคา = น้ำหนัก × ราคาต่อกก./หน่วยน้ำหนัก",
  },
  {
    value: "OPEN_PRICE",
    label: "สินค้าปรับราคาได้",
    hint: "พนักงานกรอกราคาเองตอนขาย",
  },
  {
    value: "SERVICE_PRICE",
    label: "บริการ",
    hint: "ไม่มีต้นทุน กรอกเฉพาะราคาขาย เช่น บริการโอนเงิน 1,000 บาท",
  },
];

const EMPTY_FORM = {
  sku: "",
  barcode: "",
  description: "",
  product_name: "",
  category_id: "",
  unit_code: "",
  price_mode: "FIXED_PRICE" as PriceMode,
  cost_price: "",
  sale_price: "",
  stock_qty: "",
  min_stock_qty: "",
  track_stock: true,
  allow_discount: true,
  image_url: "" as string | null | "",
};

const getDisplayCategoryName = (categoryName: string): string =>
  categoryName === "General" ? "สินค้าทั่วไป" : categoryName;

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
      headers: (() => {
        const headers = new Headers(init.headers);
        headers.set("Authorization", `Bearer ${token}`);
        return headers;
      })(),
    });

  let response = await request(accessToken);

  if (response.status === 401) {
    accessToken = await refreshAccessToken();
    response = await request(accessToken);
  }

  return response;
};

const getStoredMachineId = (storedDevice: unknown): string | null => {
  if (!storedDevice || typeof storedDevice !== "object") {
    return null;
  }

  const device = storedDevice as {
    machine_id?: unknown;
    pos_device?: { machine_id?: unknown };
  };
  const machineId = device.machine_id ?? device.pos_device?.machine_id;

  return typeof machineId === "string" && machineId.trim()
    ? machineId.trim()
    : null;
};

const scanProductByBarcode = async (
  barcode: string,
): Promise<ScanProductResponse> => {
  const storedDevice = await window.electronStore.get("pos_device");
  const machineId = getStoredMachineId(storedDevice);

  if (!machineId) {
    throw new Error("ไม่พบ machine_id กรุณาลงทะเบียนเครื่อง POS ก่อน");
  }

  const response = await authorizedFetch("/pos/scan-product", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      barcode,
      machine_id: machineId,
    }),
  });

  const data = (await response.json().catch(() => ({}))) as ScanProductResponse;

  if (!response.ok && data.code !== "PRODUCT_NOT_FOUND") {
    throw new Error(data.message || `สแกนสินค้าไม่สำเร็จ (${response.status})`);
  }

  return data;
};

const getApiErrorMessage = async (
  response: Response,
  fallback: string,
): Promise<string> => {
  try {
    const data: { message?: string | string[]; error?: string } =
      await response.json();

    if (Array.isArray(data.message)) {
      return data.message.join(", ");
    }

    return data.message || data.error || fallback;
  } catch {
    return fallback;
  }
};

// แปลง image_url ที่ได้จาก API (เช่น "/images/xxx.jpg") ให้เป็น URL เต็มสำหรับแสดงผล <img>
const resolveImageUrl = async (
  imageUrl?: string | null,
): Promise<string | null> => {
  if (!imageUrl) {
    return null;
  }

  if (/^https?:\/\//i.test(imageUrl)) {
    return imageUrl;
  }

  try {
    const apiBaseUrl = await getApiBaseUrl();
    return `${apiBaseUrl}${imageUrl.startsWith("/") ? "" : "/"}${imageUrl}`;
  } catch {
    return imageUrl;
  }
};

// แยกชื่อไฟล์ออกจาก image_url เพื่อใช้เรียก DELETE /images/:filename
const getImageFilename = (imageUrl?: string | null): string | null => {
  if (!imageUrl) {
    return null;
  }
  const parts = imageUrl.split("/").filter(Boolean);
  return parts.length > 0 ? parts[parts.length - 1] : null;
};

// อัปโหลดรูปสินค้า -> POST /images/upload (multipart/form-data) คืนค่า url ของรูปที่อัปโหลดแล้ว
const uploadProductImage = async (file: File): Promise<string> => {
  const formData = new FormData();
  formData.append("file", file);

  const response = await authorizedFetch("/images/upload", {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    const message = await getApiErrorMessage(
      response,
      `อัปโหลดรูปไม่สำเร็จ (${response.status})`,
    );
    throw new Error(message);
  }

  const data: {
    url?: string;
    image_url?: string;
    imageUrl?: string;
    path?: string;
    filename?: string;
    data?:
      | string
      | {
          url?: string;
          image_url?: string;
          imageUrl?: string;
          path?: string;
          filename?: string;
        };
  } = await response.json().catch(() => ({}));

  const nestedData = typeof data.data === "object" ? data.data : undefined;
  const uploadedImageUrl =
    data.url ||
    data.image_url ||
    data.imageUrl ||
    data.path ||
    (typeof data.data === "string" ? data.data : undefined) ||
    nestedData?.url ||
    nestedData?.image_url ||
    nestedData?.imageUrl ||
    nestedData?.path ||
    (data.filename ? `/images/${data.filename}` : undefined) ||
    (nestedData?.filename ? `/images/${nestedData.filename}` : undefined) ||
    response.headers.get("Location");

  if (!uploadedImageUrl) {
    throw new Error("อัปโหลดรูปสำเร็จ แต่ไม่พบ URL ของรูปที่อัปโหลด");
  }

  return uploadedImageUrl;
};

// ลบรูปสินค้าเดิม -> DELETE /images/:filename (ไม่ทำให้ทั้ง flow ล้มเหลวถ้าลบรูปไม่สำเร็จ)
const deleteProductImage = async (imageUrl?: string | null): Promise<void> => {
  const filename = getImageFilename(imageUrl);

  if (!filename) {
    return;
  }

  try {
    await authorizedFetch(`/images/${filename}`, {
      method: "DELETE",
    });
  } catch (err) {
    console.error("Error deleting image:", err);
  }
};

export default function ProductLandingpage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>("ALL");
  const [isCategoryMenuOpen, setIsCategoryMenuOpen] = useState(false);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProductId, setEditingProductId] = useState<
    Product["id"] | null
  >(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isScanningBarcode, setIsScanningBarcode] = useState(false);

  // รูปสินค้าที่เลือกใหม่ (ยังไม่อัปโหลด) + พรีวิวในฟอร์ม
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // แคช URL เต็มของรูปสินค้าแต่ละชิ้น (key = product id)
  const [resolvedImageUrls, setResolvedImageUrls] = useState<
    Record<string, string>
  >({});

  // url รูปเดิมของสินค้าที่กำลังแก้ไข (ใช้เทียบเพื่อรู้ว่าต้องลบรูปเดิมออกจาก server หรือไม่)
  const [originalImageUrl, setOriginalImageUrl] = useState<string | null>(
    null,
  );
  const [deletingProductId, setDeletingProductId] = useState<
    Product["id"] | null
  >(null);
  const [productPendingDelete, setProductPendingDelete] =
    useState<Product | null>(null);

  const fetchCategories = async () => {
    try {
      const response = await authorizedFetch("/categories");
      if (!response.ok) {
        return;
      }
      const data: Category[] | { data?: Category[] } = await response.json();
      const list = Array.isArray(data) ? data : data.data ?? [];
      setCategories(list);
    } catch (err) {
      console.error("Error fetching categories:", err);
    }
  };

  const fetchProducts = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await authorizedFetch("/products");

      if (!response.ok) {
        throw new Error(`โหลดข้อมูลไม่สำเร็จ (${response.status})`);
      }

      const data: Product[] | { data?: Product[] } = await response.json();
      const list = Array.isArray(data) ? data : data.data ?? [];
      setProducts(list);
    } catch (err) {
      console.error("Error fetching products:", err);
      setError("ไม่สามารถโหลดข้อมูลสินค้าได้ กรุณาลองใหม่อีกครั้ง");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCategories();
    fetchProducts();
  }, []);

  useEffect(() => {
    if (
      isModalOpen &&
      editingProductId === null &&
      !form.category_id &&
      categories.length > 0
    ) {
      setForm((current) => ({
        ...current,
        category_id: String(categories[0].id),
      }));
    }
  }, [categories, editingProductId, form.category_id, isModalOpen]);

  // เมื่อรายการสินค้าเปลี่ยน ให้แปลง image_url ของแต่ละสินค้าเป็น URL เต็มสำหรับแสดงผล
  useEffect(() => {
    let isCancelled = false;

    const resolveAll = async () => {
      const entries = await Promise.all(
        products
          .filter((product) => product.image_url)
          .map(async (product) => {
            const fullUrl = await resolveImageUrl(product.image_url);
            return [String(product.id), fullUrl] as const;
          }),
      );

      if (isCancelled) {
        return;
      }

      const next: Record<string, string> = {};
      entries.forEach(([id, url]) => {
        if (url) {
          next[id] = url;
        }
      });
      setResolvedImageUrls(next);
    };

    resolveAll();

    return () => {
      isCancelled = true;
    };
  }, [products]);

  // จัดเรียงหมวดหมู่ โดยให้ "สินค้าทั่วไป" (General) ขึ้นก่อน
  const sortedCategories = useMemo(() => {
    return [...categories].sort((a, b) => {
      const aName = a.category_name;
      const bName = b.category_name;
      
      // ให้ "General" อยู่ก่อน
      if (aName === "General") return -1;
      if (bName === "General") return 1;
      
      // เรียงตามชื่อตามปกติ
      return aName.localeCompare(bName);
    });
  }, [categories]);

  const categoryNameById = useMemo(() => {
    const map = new Map<string, string>();
    sortedCategories.forEach((category) => {
      map.set(
        String(category.id),
        getDisplayCategoryName(category.category_name),
      );
    });
    return map;
  }, [sortedCategories]);

  const selectedCategoryLabel =
    selectedCategoryId === "ALL"
      ? "สินค้าทั้งหมด"
      : categoryNameById.get(selectedCategoryId) ?? "สินค้าทั้งหมด";

  const filteredProducts = useMemo(() => {
    const keyword = searchTerm.trim().toLowerCase();

    return products.filter((product) => {
      const matchesCategory =
        selectedCategoryId === "ALL" ||
        String(product.category_id) === selectedCategoryId;

      if (!matchesCategory) {
        return false;
      }

      if (!keyword) {
        return true;
      }

      const haystack = [
        product.product_name,
        product.description ?? "",
        product.sku ?? "",
        product.barcode ?? "",
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(keyword);
    });
  }, [products, searchTerm, selectedCategoryId]);

  const resetImageSelection = () => {
    if (imagePreviewUrl) {
      URL.revokeObjectURL(imagePreviewUrl);
    }
    setImageFile(null);
    setImagePreviewUrl(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const openAddModal = () => {
    setEditingProductId(null);
    setForm({
      ...EMPTY_FORM,
      category_id: sortedCategories.length > 0 ? String(sortedCategories[0].id) : "",
    });
    setSubmitError(null);
    setOriginalImageUrl(null);
    resetImageSelection();
    setIsModalOpen(true);
  };

  const openEditModal = (product: Product) => {
    setEditingProductId(product.id);
    setForm({
      sku: product.sku ?? "",
      barcode: product.barcode ?? "",
      description: product.description ?? "",
      product_name: product.product_name ?? "",
      category_id: product.category_id ? String(product.category_id) : "",
      unit_code: product.unit_code ?? "",
      price_mode: (product.price_mode as PriceMode) ?? "FIXED_PRICE",
      cost_price:
        product.cost_price !== undefined && product.cost_price !== null
          ? String(product.cost_price)
          : "",
      sale_price:
        product.sale_price !== undefined && product.sale_price !== null
          ? String(product.sale_price)
          : "",
      stock_qty:
        product.stock_qty !== undefined && product.stock_qty !== null
          ? String(product.stock_qty)
          : "",
      min_stock_qty:
        product.min_stock_qty !== undefined &&
        product.min_stock_qty !== null
          ? String(product.min_stock_qty)
          : "",
      track_stock: Boolean(product.track_stock),
      allow_discount: Boolean(product.allow_discount),
      image_url: product.image_url ?? "",
    });
    setSubmitError(null);
    setOriginalImageUrl(product.image_url ?? null);
    resetImageSelection();
    setIsModalOpen(true);
  };

  const openEditModalFromScannedProduct = (scannedProduct: ScannedProduct) => {
    const existingProduct = products.find(
      (product) =>
        String(product.id) === String(scannedProduct.id) ||
        (scannedProduct.barcode &&
          product.barcode === scannedProduct.barcode),
    );

    if (existingProduct) {
      openEditModal(existingProduct);
      return;
    }

    const scannedPriceMode: PriceMode =
      scannedProduct.product_type === "WEIGHT"
        ? "WEIGHT_PRICE"
        : scannedProduct.product_type;

    openEditModal({
      id: scannedProduct.id,
      barcode: scannedProduct.barcode ?? form.barcode.trim(),
      product_name: scannedProduct.name,
      category_id:
        form.category_id ||
        (sortedCategories.length > 0 ? String(sortedCategories[0].id) : ""),
      unit_code: "",
      price_mode: scannedPriceMode,
      cost_price: 0,
      sale_price: Number(scannedProduct.sale_price) || 0,
      stock_qty: Number(scannedProduct.stock_qty) || 0,
      min_stock_qty: 0,
      track_stock: scannedProduct.product_type !== "SERVICE_PRICE",
      allow_discount: true,
      status: "ACTIVE",
      image_url: null,
    });
  };

  const handleBarcodeEnter = async () => {
    const barcode = normalizeBarcode(form.barcode);

    if (!barcode || isScanningBarcode) {
      return;
    }

    if (barcode !== form.barcode) {
      updateForm("barcode", barcode);
    }

    setIsScanningBarcode(true);
    setSubmitError(null);

    try {
      const result = await scanProductByBarcode(barcode);

      if (result.code === "PRODUCT_NOT_FOUND" || !result.success) {
        setEditingProductId(null);
        setSubmitError("ไม่มีสินค้าในระบบ สามารถเพิ่มสินค้าได้");
        return;
      }

      if (!result.product) {
        setSubmitError("ไม่พบข้อมูลสินค้า");
        return;
      }

      openEditModalFromScannedProduct(result.product);
    } catch (err) {
      console.error("Error scanning product:", err);
      setSubmitError(
        err instanceof Error ? err.message : "ไม่สามารถสแกนสินค้าได้",
      );
    } finally {
      setIsScanningBarcode(false);
    }
  };

  const closeModal = () => {
    if (isSubmitting) {
      return;
    }
    resetImageSelection();
    setEditingProductId(null);
    setOriginalImageUrl(null);
    setIsModalOpen(false);
  };

  const updateForm = <K extends keyof typeof EMPTY_FORM>(
    key: K,
    value: (typeof EMPTY_FORM)[K],
  ) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSelectImage = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    if (imagePreviewUrl) {
      URL.revokeObjectURL(imagePreviewUrl);
    }

    setImageFile(file);
    setImagePreviewUrl(URL.createObjectURL(file));
  };

  const handleRemoveSelectedImage = () => {
    resetImageSelection();
    updateForm("image_url", "");
  };

  // ตรวจสอบว่าสามารถบันทึกได้หรือไม่
  const isFormValid = useMemo(() => {
    const trimmedBarcode = form.barcode.trim();
    const trimmedUnitCode = form.unit_code.trim();
    const trimmedProductName = form.product_name.trim();
    
    return trimmedBarcode !== "" && trimmedUnitCode !== "" && trimmedProductName !== "";
  }, [form.barcode, form.unit_code, form.product_name]);

  const handleSubmitProduct = async (event: FormEvent) => {
    event.preventDefault();

    const trimmedName = form.product_name.trim();
    const trimmedBarcode = normalizeBarcode(form.barcode);
    const trimmedUnitCode = form.unit_code.trim();

    // เพิ่มการตรวจสอบหน่วย
    if (!trimmedUnitCode) {
      setSubmitError("กรุณากรอกหน่วย");
      return;
    }

    if (!trimmedBarcode) {
      setSubmitError("กรุณากรอกบาร์โค้ด");
      return;
    }

    if (trimmedBarcode !== form.barcode) {
      updateForm("barcode", trimmedBarcode);
    }

    if (!trimmedName) {
      setSubmitError("กรุณากรอกชื่อสินค้า");
      return;
    }

    if (!form.category_id) {
      setSubmitError("กรุณาเลือกหมวดหมู่");
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);

    const isEditing = editingProductId !== null;

    try {
      // ถ้ามีการเลือกรูปใหม่ ให้อัปโหลดก่อน แล้วค่อยเอา url ไปบันทึกกับสินค้า
      let imageUrl: string | null | "" = form.image_url;

      if (imageFile) {
        setIsUploadingImage(true);
        try {
          imageUrl = await uploadProductImage(imageFile);
        } finally {
          setIsUploadingImage(false);
        }
      }

      const trimmedSku = form.sku.trim();
      const trimmedDescription = form.description.trim();

      // ตอนเพิ่มสินค้าใหม่: ไม่ส่ง image_url ถ้าไม่มีรูป
      // ตอนแก้ไข: ถ้าผู้ใช้กดเอารูปออก ให้ส่ง null เพื่อล้างค่าใน database
      const imageUrlForPayload = imageUrl
        ? imageUrl
        : isEditing
          ? null
          : undefined;

      const isService = form.price_mode === "SERVICE_PRICE";

      const basePayload = {
        sku: trimmedSku || undefined,
        barcode: trimmedBarcode,
        description: trimmedDescription || (isService ? "" : isEditing ? null : undefined),
        product_name: trimmedName,
        category_id: Number(form.category_id) || form.category_id,
        unit_code: trimmedUnitCode,
        price_mode: form.price_mode,
        cost_price: isService ? 0 : Number(form.cost_price) || 0,
        sale_price: isService ? 0 : Number(form.sale_price) || 0,
        track_stock: isService ? false : form.track_stock,
        allow_discount: isService ? false : form.allow_discount,
        status: "ACTIVE",
        ...(imageUrlForPayload !== undefined
          ? { image_url: imageUrlForPayload }
          : {}),
      };

      const payload = isService
        ? basePayload
        : {
            ...basePayload,
            stock_qty: Number(form.stock_qty) || 0,
            min_stock_qty: Number(form.min_stock_qty) || 0,
          };

      const response = await authorizedFetch(
        isEditing ? `/products/${editingProductId}` : "/products",
        {
          method: isEditing ? "PUT" : "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        },
      );

      if (!response.ok) {
        const message = await getApiErrorMessage(
          response,
          isEditing
            ? `บันทึกการแก้ไขไม่สำเร็จ (${response.status})`
            : `เพิ่มสินค้าไม่สำเร็จ (${response.status})`,
        );
        throw new Error(message);
      }

      setIsModalOpen(false);
      setEditingProductId(null);
      setForm(EMPTY_FORM);
      resetImageSelection();

      // ถ้ามีการเปลี่ยน/ลบรูประหว่างแก้ไข ให้ลบรูปเดิมออกจาก server ทิ้ง
      if (
        isEditing &&
        originalImageUrl &&
        originalImageUrl !== imageUrlForPayload
      ) {
        await deleteProductImage(originalImageUrl);
      }

      await fetchProducts();
    } catch (err) {
      console.error("Error saving product:", err);
      setSubmitError(
        err instanceof Error
          ? err.message
          : isEditing
            ? "ไม่สามารถบันทึกการแก้ไขได้ กรุณาลองใหม่อีกครั้ง"
            : "ไม่สามารถเพิ่มสินค้าได้ กรุณาลองใหม่อีกครั้ง",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const requestDeleteProduct = (product: Product) => {
    setProductPendingDelete(product);
  };

  const cancelDeleteProduct = () => {
    if (deletingProductId !== null) {
      return;
    }
    setProductPendingDelete(null);
  };

  const confirmDeleteProduct = async () => {
    if (!productPendingDelete) {
      return;
    }

    const product = productPendingDelete;
    setDeletingProductId(product.id);

    try {
      const response = await authorizedFetch(`/products/${product.id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const message = await getApiErrorMessage(
          response,
          `ลบสินค้าไม่สำเร็จ (${response.status})`,
        );
        throw new Error(message);
      }

      // ลบรูปสินค้าที่ผูกอยู่ด้วย (ถ้ามี)
      await deleteProductImage(product.image_url);

      setProductPendingDelete(null);
      await fetchProducts();
    } catch (err) {
      console.error("Error deleting product:", err);
      setError(
        err instanceof Error
          ? err.message
          : "ไม่สามารถลบสินค้าได้ กรุณาลองใหม่อีกครั้ง",
      );
    } finally {
      setDeletingProductId(null);
    }
  };

  return (
    <div className="flex h-full flex-col bg-slate-50 px-6 py-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">สินค้าทั้งหมด</h1>
          <p className="mt-1 text-sm text-slate-500">
            ดูและจัดการรายการสินค้าทั้งหมดในร้านของคุณ
          </p>
        </div>

        <button
          type="button"
          onClick={openAddModal}
          className="flex items-center gap-2 rounded-xl bg-[#1d6fd8] px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-[#1a5fc0]"
        >
          <IconPlus size={18} />
          เพิ่มสินค้า
        </button>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <IconSearch
            size={18}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
          />
          <input
            type="text"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="ค้นหาสินค้าด้วยชื่อ, SKU หรือบาร์โค้ด"
            className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-3 text-sm text-slate-700 outline-none focus:border-[#1d6fd8] focus:ring-2 focus:ring-[#1d6fd8]/20"
          />
        </div>

        <div className="relative">
          <button
            type="button"
            onClick={() => setIsCategoryMenuOpen((prev) => !prev)}
            className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
          >
            {selectedCategoryLabel}
            <IconChevronDown size={16} className="text-slate-400" />
          </button>

          {isCategoryMenuOpen ? (
            <>
              <div
                className="fixed inset-0 z-10"
                onClick={() => setIsCategoryMenuOpen(false)}
              />
              <div className="absolute right-0 z-20 mt-2 w-56 overflow-hidden rounded-xl border border-slate-100 bg-white shadow-lg">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedCategoryId("ALL");
                    setIsCategoryMenuOpen(false);
                  }}
                  className={`block w-full px-4 py-2.5 text-left text-sm hover:bg-slate-50 ${
                    selectedCategoryId === "ALL"
                      ? "font-medium text-[#1d6fd8]"
                      : "text-slate-600"
                  }`}
                >
                  สินค้าทั้งหมด
                </button>
                {sortedCategories.map((category) => (
                  <button
                    key={category.id}
                    type="button"
                    onClick={() => {
                      setSelectedCategoryId(String(category.id));
                      setIsCategoryMenuOpen(false);
                    }}
                    className={`block w-full px-4 py-2.5 text-left text-sm hover:bg-slate-50 ${
                      selectedCategoryId === String(category.id)
                        ? "font-medium text-[#1d6fd8]"
                        : "text-slate-600"
                    }`}
                  >
                    {getDisplayCategoryName(category.category_name)}
                  </button>
                ))}
              </div>
            </>
          ) : null}
        </div>
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
              onClick={fetchProducts}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
            >
              ลองอีกครั้ง
            </button>
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="flex h-40 flex-col items-center justify-center gap-2 text-center text-slate-400">
            <IconBox size={32} className="text-slate-300" />
            <p className="text-sm">
              {searchTerm || selectedCategoryId !== "ALL"
                ? "ไม่พบสินค้าที่ตรงกับเงื่อนไข"
                : "ยังไม่มีสินค้า กดปุ่ม \"เพิ่มสินค้า\" เพื่อเริ่มต้น"}
            </p>
          </div>
        ) : (
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {filteredProducts.map((product) => {
              const priceModeInfo = PRICE_MODE_OPTIONS.find(
                (option) => option.value === product.price_mode,
              );
              const imageSrc = resolvedImageUrls[String(product.id)];
              const isDeletingThis = deletingProductId === product.id;

              return (
                <li
                  key={product.id}
                  className="flex flex-col gap-2 rounded-xl border border-slate-100 bg-slate-50 px-4 py-3"
                >
                  <div className="flex items-start gap-3">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-[#1d6fd8]/10">
                      {imageSrc ? (
                        <img
                          src={imageSrc}
                          alt={product.product_name}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <IconBox size={20} className="text-[#1d6fd8]" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-slate-700">
                        {product.product_name}
                      </p>
                      {product.sku ? (
                        <p className="text-sm text-slate-500">
                          SKU: {product.sku}
                        </p>
                      ) : null}
                      {product.barcode ? (
                        <p className="text-sm text-slate-500">
                          บาร์โค้ด: {product.barcode}
                        </p>
                      ) : null}
                      {product.description ? (
                        <p className="mt-1 line-clamp-2 whitespace-pre-line break-words text-sm text-slate-500">
                          {product.description}
                        </p>
                      ) : null}
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <button
                        type="button"
                        onClick={() => openEditModal(product)}
                        title="แก้ไขสินค้า"
                        className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-white hover:text-[#1d6fd8]"
                      >
                        <IconPencil size={16} />
                      </button>
                      <button
                        type="button"
                        onClick={() => requestDeleteProduct(product)}
                        disabled={isDeletingThis}
                        title="ลบสินค้า"
                        className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-white hover:text-red-500 disabled:opacity-50"
                      >
                        <IconTrash size={16} />
                      </button>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <span className="rounded-full bg-white px-2.5 py-1 text-slate-500">
                      {categoryNameById.get(String(product.category_id)) ??
                        "ไม่ระบุหมวดหมู่"}
                    </span>
                    <span className="rounded-full bg-white px-2.5 py-1 text-slate-500">
                      {priceModeInfo?.label ?? product.price_mode}
                    </span>
                    {product.track_stock ? (
                      <span className="rounded-full bg-white px-2.5 py-1 text-slate-500">
                        คงเหลือ {product.stock_qty}
                      </span>
                    ) : null}
                  </div>

                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                    <span className="font-semibold text-[#1d6fd8]">
                      {product.price_mode === "SERVICE_PRICE"
                        ? "กรอกราคาตอนขาย"
                        : `฿${Number(product.sale_price).toLocaleString()}`}
                    </span>
                    {product.price_mode === "OPEN_PRICE" ? (
                      <span className="font-medium text-slate-500">
                        สามารถเปลี่ยนแปลงราคาตอนขายได้
                      </span>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {isModalOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
          onClick={closeModal}
        >
          <div
            className="w-full max-w-3xl max-h-[95vh] overflow-y-auto rounded-2xl bg-white p-6 shadow-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-800">
                {editingProductId !== null ? "แก้ไขสินค้า" : "เพิ่มสินค้า"}
              </h2>
              <button
                type="button"
                onClick={closeModal}
                className="text-slate-400 hover:text-slate-600"
              >
                <IconX size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmitProduct} className="space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-600">
                  รูปสินค้า
                </label>
                <div className="flex items-center gap-3">
                  <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-dashed border-slate-200 bg-slate-50">
                    {imagePreviewUrl ? (
                      <img
                        src={imagePreviewUrl}
                        alt="พรีวิวรูปสินค้า"
                        className="h-full w-full object-cover"
                      />
                    ) : form.image_url ? (
                      <img
                        src={resolvedImageUrls[String(editingProductId)] ?? ""}
                        alt="รูปสินค้าปัจจุบัน"
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <IconPhoto size={24} className="text-slate-300" />
                    )}
                  </div>
                  <div className="flex flex-1 flex-col gap-2">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleSelectImage}
                      className="hidden"
                      id="product-image-input"
                    />
                    <div className="flex gap-2">
                      <label
                        htmlFor="product-image-input"
                        className="flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
                      >
                        <IconUpload size={16} />
                        เลือกรูป
                      </label>
                      {imagePreviewUrl || form.image_url ? (
                        <button
                          type="button"
                          onClick={handleRemoveSelectedImage}
                          className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-500 hover:bg-slate-50"
                        >
                          เอารูปออก
                        </button>
                      ) : null}
                    </div>
                    <p className="text-sm text-slate-400">
                      รองรับไฟล์ JPG, PNG
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-4 gap-3">
                <div className="col-span-2">
                  <label className="mb-1.5 block text-sm font-medium text-slate-600">
                    บาร์โค้ด <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={form.barcode}
                    onChange={(event) =>
                      updateForm("barcode", event.target.value)
                    }
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        handleBarcodeEnter();
                      }
                    }}
                    placeholder="8850000000001"
                    autoFocus
                    disabled={isScanningBarcode}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-[#1d6fd8] focus:ring-2 focus:ring-[#1d6fd8]/20"
                  />
                  {isScanningBarcode ? (
                    <p className="mt-1 text-xs text-slate-400">
                      กำลังตรวจสอบบาร์โค้ด...
                    </p>
                  ) : null}
                </div>

                <div className="col-span-2">
                  <label className="mb-1.5 block text-sm font-medium text-slate-600">
                    SKU <span className="text-slate-400">(ไม่บังคับ)</span>
                  </label>
                  <input
                    type="text"
                    value={form.sku}
                    onChange={(event) => updateForm("sku", event.target.value)}
                    placeholder="COFFEE-001"
                    className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-[#1d6fd8] focus:ring-2 focus:ring-[#1d6fd8]/20"
                  />
                </div>

                <div className="col-span-3">
                  <label className="mb-1.5 block text-sm font-medium text-slate-600">
                    ชื่อสินค้า <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={form.product_name}
                    onChange={(event) =>
                      updateForm("product_name", event.target.value)
                    }
                    placeholder="เช่น กาแฟเย็น"
                    className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-[#1d6fd8] focus:ring-2 focus:ring-[#1d6fd8]/20"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-600">
                    หน่วย <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={form.unit_code}
                    onChange={(event) =>
                      updateForm("unit_code", event.target.value)
                    }
                    placeholder="เช่น CUP, ชิ้น, กก."
                    className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-[#1d6fd8] focus:ring-2 focus:ring-[#1d6fd8]/20"
                  />
                </div>

                <div className="col-span-4">
                  <label className="mb-1.5 block text-sm font-medium text-slate-600">
                    รายละเอียดสินค้า
                  </label>
                  <textarea
                    value={form.description}
                    onChange={(event) =>
                      updateForm("description", event.target.value)
                    }
                    placeholder="เช่น รายละเอียด รสชาติ ขนาด หรือหมายเหตุของสินค้า"
                    rows={2}
                    className="w-full resize-y rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-[#1d6fd8] focus:ring-2 focus:ring-[#1d6fd8]/20"
                  />
                </div>

                <div className="col-span-4">
                  <label className="mb-1.5 block text-sm font-medium text-slate-600">
                    หมวดหมู่
                  </label>
                  <select
                    value={form.category_id}
                    onChange={(event) =>
                      updateForm("category_id", event.target.value)
                    }
                    className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-[#1d6fd8] focus:ring-2 focus:ring-[#1d6fd8]/20"
                  >
                    {sortedCategories.map((category) => (
                      <option key={category.id} value={String(category.id)}>
                        {getDisplayCategoryName(category.category_name)}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="col-span-4">
                  <label className="mb-1.5 block text-sm font-medium text-slate-600">
                    รูปแบบการคิดราคา
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {PRICE_MODE_OPTIONS.map((option) => (
                      <label
                        key={option.value}
                        className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 px-3 py-2.5 hover:bg-slate-50"
                      >
                        <input
                          type="radio"
                          name="price_mode"
                          value={option.value}
                          checked={form.price_mode === option.value}
                          onChange={() => {
                            updateForm("price_mode", option.value);
                            // บริการไม่มีต้นทุน/ไม่ตัดสต๊อก/ไม่มีส่วนลด/ไม่กรอกราคาที่นี่ ล้างค่าที่เกี่ยวข้องเมื่อเปลี่ยนมาโหมดนี้
                            if (option.value === "SERVICE_PRICE") {
                              updateForm("cost_price", "");
                              updateForm("sale_price", "");
                              updateForm("track_stock", false);
                              updateForm("allow_discount", false);
                            }
                          }}
                          className="mt-0.5 h-4 w-4 accent-[#1d6fd8]"
                        />
                        <span>
                          <span className="block text-sm font-medium text-slate-700">
                            {option.label}
                          </span>
                          <span className="block text-sm text-slate-500">
                            {option.hint}
                          </span>
                        </span>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="col-span-2">
                  <label className="mb-1.5 block text-sm font-medium text-slate-600">
                    ราคาทุน
                  </label>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={form.cost_price}
                    onChange={(event) =>
                      updateForm("cost_price", event.target.value)
                    }
                    disabled={form.price_mode === "SERVICE_PRICE"}
                    placeholder={
                      form.price_mode === "SERVICE_PRICE"
                        ? "บริการไม่มีต้นทุน"
                        : "0.00"
                    }
                    className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-[#1d6fd8] focus:ring-2 focus:ring-[#1d6fd8]/20 disabled:bg-slate-100 disabled:text-slate-400"
                  />
                </div>

                <div className="col-span-2">
                  <label className="mb-1.5 block text-sm font-medium text-slate-600">
                    {form.price_mode === "WEIGHT_PRICE"
                      ? "ราคาขาย / กก."
                      : form.price_mode === "SERVICE_PRICE"
                        ? "ราคาบริการ"
                        : "ราคาขาย"}
                  </label>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={form.sale_price}
                    onChange={(event) =>
                      updateForm("sale_price", event.target.value)
                    }
                    disabled={form.price_mode === "SERVICE_PRICE"}
                    placeholder={
                      form.price_mode === "OPEN_PRICE"
                        ? "ราคาเริ่มต้น (แก้ไขได้ตอนขาย)"
                        : form.price_mode === "SERVICE_PRICE"
                          ? "กรอกราคาตอนขาย"
                          : "0.00"
                    }
                    className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-[#1d6fd8] focus:ring-2 focus:ring-[#1d6fd8]/20 disabled:bg-slate-100 disabled:text-slate-400"
                  />
                </div>

                {form.price_mode !== "SERVICE_PRICE" ? (
                  <>
                    <div className="col-span-2 flex items-center gap-3 rounded-xl border border-slate-200 px-3 py-2.5">
                      <button
                        type="button"
                        role="switch"
                        aria-checked={form.track_stock}
                        onClick={() =>
                          updateForm("track_stock", !form.track_stock)
                        }
                        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
                          form.track_stock
                            ? "border-[#1d6fd8] bg-[#1d6fd8]"
                            : "border-slate-300 bg-white"
                        }`}
                      >
                        {form.track_stock ? (
                          <span className="h-2 w-2 rounded-full bg-white" />
                        ) : null}
                      </button>
                      <span
                        className="cursor-pointer text-sm text-slate-600"
                        onClick={() => updateForm("track_stock", !form.track_stock)}
                      >
                        ตัดสต๊อกสินค้านี้ (Track stock)
                      </span>
                    </div>

                    <div className="col-span-2 flex items-center gap-3 rounded-xl border border-slate-200 px-3 py-2.5">
                      <button
                        type="button"
                        role="switch"
                        aria-checked={form.allow_discount}
                        onClick={() =>
                          updateForm("allow_discount", !form.allow_discount)
                        }
                        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
                          form.allow_discount
                            ? "border-[#1d6fd8] bg-[#1d6fd8]"
                            : "border-slate-300 bg-white"
                        }`}
                      >
                        {form.allow_discount ? (
                          <span className="h-2 w-2 rounded-full bg-white" />
                        ) : null}
                      </button>
                      <span
                        className="cursor-pointer text-sm text-slate-600"
                        onClick={() =>
                          updateForm("allow_discount", !form.allow_discount)
                        }
                      >
                        อนุญาตให้ส่วนลดสินค้านี้
                      </span>
                    </div>

                    {form.track_stock ? (
                      <>
                        <div className="col-span-2">
                          <label className="mb-1.5 block text-sm font-medium text-slate-600">
                            จำนวนสต๊อก
                          </label>
                          <input
                            type="number"
                            min={0}
                            value={form.stock_qty}
                            onChange={(event) =>
                              updateForm("stock_qty", event.target.value)
                            }
                            placeholder="0"
                            className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-[#1d6fd8] focus:ring-2 focus:ring-[#1d6fd8]/20"
                          />
                        </div>

                        <div className="col-span-2">
                          <label className="mb-1.5 block text-sm font-medium text-slate-600">
                            สต๊อกขั้นต่ำ
                          </label>
                          <input
                            type="number"
                            min={0}
                            value={form.min_stock_qty}
                            onChange={(event) =>
                              updateForm("min_stock_qty", event.target.value)
                            }
                            placeholder="0"
                            className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-[#1d6fd8] focus:ring-2 focus:ring-[#1d6fd8]/20"
                          />
                        </div>
                      </>
                    ) : null}
                  </>
                ) : null}
              </div>

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
                  disabled={isSubmitting || !isFormValid}
                  className={`flex-1 rounded-xl px-4 py-2.5 text-sm font-medium text-white transition-colors ${
                    isSubmitting || !isFormValid
                      ? "bg-slate-400 cursor-not-allowed"
                      : "bg-[#1d6fd8] hover:bg-[#1a5fc0]"
                  }`}
                >
                  {isSubmitting
                    ? isUploadingImage
                      ? "กำลังอัปโหลดรูป..."
                      : "กำลังบันทึก..."
                    : editingProductId !== null
                      ? "บันทึกการแก้ไข"
                      : "บันทึก"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {productPendingDelete ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
          onClick={cancelDeleteProduct}
        >
          <div
            className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <h2 className="text-lg font-semibold text-slate-800">
              ลบสินค้านี้?
            </h2>
            <p className="mt-2 text-sm text-slate-500">
              คุณต้องการลบ "{productPendingDelete.product_name}" ใช่หรือไม่
              การลบไม่สามารถย้อนกลับได้
            </p>

            <div className="mt-5 flex gap-2">
              <button
                type="button"
                onClick={cancelDeleteProduct}
                disabled={deletingProductId !== null}
                className="flex-1 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={confirmDeleteProduct}
                disabled={deletingProductId !== null}
                className="flex-1 rounded-xl bg-red-500 px-4 py-2.5 text-sm font-medium text-white hover:bg-red-600 disabled:opacity-50"
              >
                {deletingProductId !== null ? "กำลังลบ..." : "ลบสินค้า"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
