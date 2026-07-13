import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  IconBox,
  IconChevronDown,
  IconPencil,
  IconPlus,
  IconRefresh,
  IconSearch,
  IconShoppingCartPlus,
  IconTrash,
  IconX,
} from "@tabler/icons-react";
import { ensureValidAccessToken, refreshAccessToken } from "./auth";

export interface ProductCategory {
  id: number | string;
  category_name: string;
  sort_order?: number;
  status?: string;
  [key: string]: unknown;
}

export interface FavoriteProduct {
  id: number | string;
  product_name: string;
  sale_price: number;
  price_mode?: "FIXED_PRICE" | "WEIGHT_PRICE" | "OPEN_PRICE" | "SERVICE_PRICE";
  unit_code?: string;
  stock_qty?: number;
  allow_discount?: boolean;
  image_url?: string | null;
  sku?: string;
  barcode?: string;
  category_id?: number | string | null;
  category?: ProductCategory | null;
  [key: string]: unknown;
}

interface FavoriteItem {
  id: number | string;
  favorite_group_id?: number | string;
  group_id?: number | string;
  favorite_group?: { id: number | string };
  product_id: number | string;
  product?: FavoriteProduct;
  [key: string]: unknown;
}

interface FavoriteItemsProps {
  groupId: number | string;
  groupName: string;
  onAddToCart: (product: FavoriteProduct) => void;
}

type ListResponse<T> = T[] | { data?: T[] };

interface PaginatedProductsResponse {
  data: FavoriteProduct[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasMore: boolean;
  };
}

const getApiBaseUrl = async (): Promise<string> => {
  const apiPath = await window.electronStore.get("apiPath");
  if (typeof apiPath !== "string" || !apiPath.trim()) {
    throw new Error("ไม่พบ API endpoint ใน store");
  }
  return apiPath.trim().replace(/\/+$/, "");
};

const resolveProductImageUrl = async (
  imageUrl?: string | null,
): Promise<string | null> => {
  if (!imageUrl) return null;

  const value = imageUrl.trim();
  if (!value) return null;

  let filename = value;

  try {
    const parsedUrl = new URL(value);
    filename = parsedUrl.pathname.split("/").filter(Boolean).pop() ?? "";
  } catch {
    filename = value.split("?")[0].split("#")[0].split("/").filter(Boolean).pop() ?? "";
  }

  if (!filename) return null;

  const apiBaseUrl = await getApiBaseUrl();
  let decodedFilename = filename;
  try {
    decodedFilename = decodeURIComponent(filename);
  } catch {
    // ใช้ชื่อไฟล์เดิม หากค่าที่ API ส่งมาไม่ใช่ URL-encoded string ที่สมบูรณ์
  }
  return `${apiBaseUrl}/images/${encodeURIComponent(decodedFilename)}`;
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

  const request = (token: string) => {
    const headers = new Headers(init.headers);
    headers.set("Authorization", `Bearer ${token}`);
    return fetch(`${apiBaseUrl}${path}`, { ...init, headers });
  };

  let response = await request(accessToken);
  if (response.status === 401) {
    accessToken = await refreshAccessToken();
    response = await request(accessToken);
  }
  return response;
};

const readApiError = async (response: Response, fallback: string) => {
  const body = await response.text();
  if (!body) return `${fallback} (${response.status})`;

  try {
    const data = JSON.parse(body) as { message?: string | string[] };
    if (Array.isArray(data.message)) return data.message.join(", ");
    return data.message || `${fallback} (${response.status})`;
  } catch {
    return body;
  }
};

const unwrapList = <T,>(payload: ListResponse<T>): T[] =>
  Array.isArray(payload) ? payload : payload.data ?? [];

const buildProductsPath = (
  page: number,
  limit: number,
  search: string,
  categoryId: string,
) => {
  const params = new URLSearchParams({
    page: String(page),
    limit: String(limit),
  });
  const trimmedSearch = search.trim();
  if (trimmedSearch) params.set("search", trimmedSearch);
  if (categoryId) params.set("category_id", categoryId);
  return `/products?${params.toString()}`;
};

const mergeUniqueProducts = (
  currentProducts: FavoriteProduct[],
  nextProducts: FavoriteProduct[],
) => {
  const byId = new Map<string, FavoriteProduct>();
  currentProducts.forEach((product) => byId.set(String(product.id), product));
  nextProducts.forEach((product) => byId.set(String(product.id), product));
  return Array.from(byId.values());
};

const getItemGroupId = (item: FavoriteItem) =>
  item.favorite_group_id ?? item.group_id ?? item.favorite_group?.id;

const getProductPriceLabel = (product: FavoriteProduct): string =>
  product.price_mode === "SERVICE_PRICE"
    ? "กรอกราคาตอนขาย"
    : `฿${Number(product.sale_price || 0).toFixed(2)}`;

interface AllProductsProps {
  searchQuery: string;
  onAddToCart: (product: FavoriteProduct) => void;
}

export function AllProducts({
  searchQuery,
  onAddToCart,
}: AllProductsProps) {
  const [products, setProducts] = useState<FavoriteProduct[]>([]);
  const [imageUrls, setImageUrls] = useState<Record<string, string>>({});
  const [failedImageIds, setFailedImageIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [page, setPage] = useState(1);
  const [limit] = useState(50);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>("");
  const loadingRef = useRef(false);

  const fetchCategories = async () => {
    try {
      const response = await authorizedFetch("/categories");
      if (!response.ok) return;
      const payload = (await response.json()) as ListResponse<ProductCategory>;
      setCategories(unwrapList(payload));
    } catch (err) {
      console.error("Error fetching product categories:", err);
    }
  };

  const loadProducts = useCallback(
    async ({
      pageToLoad,
      searchKeyword,
      categoryId,
      reset,
    }: {
      pageToLoad: number;
      searchKeyword: string;
      categoryId: string;
      reset: boolean;
    }) => {
      if (loadingRef.current) return;

      loadingRef.current = true;
      setLoading(true);
      setError(null);

      try {
        const response = await authorizedFetch(
          buildProductsPath(pageToLoad, limit, searchKeyword, categoryId),
        );
        if (!response.ok) {
          throw new Error(await readApiError(response, "โหลดสินค้าไม่สำเร็จ"));
        }

        const payload = (await response.json()) as PaginatedProductsResponse;
        const list = Array.isArray(payload.data) ? payload.data : [];
        setProducts((currentProducts) =>
          reset ? list : mergeUniqueProducts(currentProducts, list),
        );
        setPage(payload.pagination?.page ?? pageToLoad);
        setHasMore(Boolean(payload.pagination?.hasMore));

        const entries = await Promise.all(
          list.map(async (product) => [
            String(product.id),
            await resolveProductImageUrl(product.image_url),
          ] as const),
        );
        const nextImageUrls: Record<string, string> = {};
        entries.forEach(([productId, imageUrl]) => {
          if (imageUrl) nextImageUrls[productId] = imageUrl;
        });
        setImageUrls((currentUrls) =>
          reset ? nextImageUrls : { ...currentUrls, ...nextImageUrls },
        );
        if (reset) setFailedImageIds(new Set());
      } catch (err) {
        console.error("Error fetching all products:", err);
        setError(
          err instanceof Error ? err.message : "ไม่สามารถโหลดสินค้าได้",
        );
      } finally {
        loadingRef.current = false;
        setLoading(false);
      }
    },
    [limit],
  );

  useEffect(() => {
    void fetchCategories();
  }, []);

  useEffect(() => {
    setSearch(searchQuery);
  }, [searchQuery]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setDebouncedSearch(search.trim());
    }, 400);
    return () => window.clearTimeout(timeoutId);
  }, [search]);

  useEffect(() => {
    setProducts([]);
    setImageUrls({});
    setFailedImageIds(new Set());
    setPage(1);
    setHasMore(true);
    void loadProducts({
      pageToLoad: 1,
      searchKeyword: debouncedSearch,
      categoryId: selectedCategoryId,
      reset: true,
    });
  }, [debouncedSearch, loadProducts, selectedCategoryId]);

  const handleProductsScroll = (event: React.UIEvent<HTMLDivElement>) => {
    const element = event.currentTarget;
    const distanceFromBottom =
      element.scrollHeight - element.scrollTop - element.clientHeight;
    if (distanceFromBottom > 240 || loading || !hasMore) return;
    void loadProducts({
      pageToLoad: page + 1,
      searchKeyword: debouncedSearch,
      categoryId: selectedCategoryId,
      reset: false,
    });
  };

  const sortedCategories = useMemo(() => {
    return [...categories].sort((a, b) => {
      const sortDiff = (a.sort_order ?? 0) - (b.sort_order ?? 0);
      if (sortDiff !== 0) return sortDiff;
      return a.category_name.localeCompare(b.category_name, "th");
    });
  }, [categories]);

  const handleSelectCategory = (categoryId: string) => {
    setProducts([]);
    setImageUrls({});
    setFailedImageIds(new Set());
    setPage(1);
    setHasMore(true);
    setSelectedCategoryId(categoryId);
  };

  const filteredProducts = products;

  if (loading && products.length === 0) {
    return (
      <div className="grid flex-1 place-items-center text-sm text-slate-400">
        กำลังโหลดสินค้า...
      </div>
    );
  }

  if (error) {
    return (
      <div className="grid flex-1 place-items-center text-center">
        <div>
          <p className="text-sm text-red-500">{error}</p>
          <button
            type="button"
            onClick={() =>
              void loadProducts({
                pageToLoad: 1,
                searchKeyword: debouncedSearch,
                categoryId: selectedCategoryId,
                reset: true,
              })
            }
            className="mx-auto mt-3 flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-600"
          >
            <IconRefresh size={16} />
            ลองอีกครั้ง
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-0 flex-1 overflow-y-auto" onScroll={handleProductsScroll}>
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h2 className="font-bold text-slate-900">สินค้าทั้งหมด</h2>
          <p className="mt-0.5 text-xs text-slate-500">
            รายการสินค้าจากระบบ
          </p>
        </div>
        <div className="relative">
          <select
            value={selectedCategoryId}
            onChange={(event) => handleSelectCategory(event.target.value)}
            className="h-9 appearance-none rounded-lg border border-slate-200 bg-white pl-3 pr-9 text-sm text-slate-700 outline-none focus:border-[#1d6fd8]"
          >
            <option value="">ทุกประเภทสินค้า</option>
            {sortedCategories.map((category) => (
              <option key={category.id} value={String(category.id)}>
                {category.category_name.trim().toLowerCase() === "general"
                  ? "สินค้าทั่วไป"
                  : category.category_name}
              </option>
            ))}
          </select>
          <IconChevronDown
            size={16}
            className="pointer-events-none absolute inset-y-0 right-3 my-auto text-slate-400"
          />
        </div>
      </div>

      {filteredProducts.length === 0 ? (
        <div className="grid min-h-64 place-items-center text-center text-slate-400">
          <div>
            <IconBox size={40} className="mx-auto mb-2" />
            <p className="text-sm">ไม่พบสินค้า</p>
          </div>
        </div>
      ) : (
        <div className="grid auto-rows-min grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-4">
          {filteredProducts.map((product) => {
            const productId = String(product.id);
            const imageSrc = imageUrls[productId];
            const hasImage =
              Boolean(imageSrc) && !failedImageIds.has(productId);

            return (
              <button
                key={product.id}
                type="button"
                onClick={() => onAddToCart(product)}
                className="rounded-xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:border-[#4d9bf0] hover:shadow-md"
              >
                <div className="mb-3 flex h-12 w-12 items-center justify-center overflow-hidden rounded-xl bg-[#4d9bf0]/10 text-[#1d6fd8]">
                  {hasImage ? (
                    <img
                      src={imageSrc}
                      alt={product.product_name}
                      className="h-full w-full object-cover"
                      onError={() =>
                        setFailedImageIds((current) => {
                          const next = new Set(current);
                          next.add(productId);
                          return next;
                        })
                      }
                    />
                  ) : (
                    <IconBox size={24} />
                  )}
                </div>
                <p className="truncate text-sm font-semibold text-slate-900">
                  {product.product_name}
                </p>
                <p className="mt-2 text-lg font-bold text-[#1d6fd8]">
                  {getProductPriceLabel(product)}
                </p>
                <span className="mt-2 flex items-center gap-1 text-xs text-slate-400">
                  <IconShoppingCartPlus size={14} />
                  กดเพื่อเพิ่มลงตะกร้า
                </span>
              </button>
            );
          })}
        </div>
      )}
      {loading && products.length > 0 ? (
        <p className="py-4 text-center text-sm text-slate-400">
          กำลังโหลดสินค้า...
        </p>
      ) : null}
      {!loading && products.length > 0 && !hasMore ? (
        <p className="py-4 text-center text-sm text-slate-400">
          แสดงสินค้าทั้งหมดแล้ว
        </p>
      ) : null}
    </div>
  );
}

export default function FavoriteItems({
  groupId,
  groupName,
  onAddToCart,
}: FavoriteItemsProps) {
  const [items, setItems] = useState<FavoriteItem[]>([]);
  const [productsById, setProductsById] = useState<
    Record<string, FavoriteProduct>
  >({});
  const [resolvedImageUrls, setResolvedImageUrls] = useState<
    Record<string, string>
  >({});
  const [failedImageIds, setFailedImageIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [products, setProducts] = useState<FavoriteProduct[]>([]);
  const [page, setPage] = useState(1);
  const [limit] = useState(50);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [pickerError, setPickerError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedProductId, setSelectedProductId] = useState<string>("");
  const [editingItem, setEditingItem] = useState<FavoriteItem | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deletingItem, setDeletingItem] = useState<FavoriteItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const productsLoadingRef = useRef(false);

  const fetchProductDetail = async (
    productId: number | string,
  ): Promise<FavoriteProduct | null> => {
    const response = await authorizedFetch(`/products/${productId}`);
    if (!response.ok) return null;
    const payload = (await response.json()) as
      | FavoriteProduct
      | { data?: FavoriteProduct };
    if (
      typeof payload === "object" &&
      payload !== null &&
      "data" in payload
    ) {
      return (payload as { data?: FavoriteProduct }).data ?? null;
    }
    return payload as FavoriteProduct;
  };

  const fetchItems = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await authorizedFetch("/favorite-items");
      if (!response.ok) {
        throw new Error(await readApiError(response, "โหลดรายการ Favorite ไม่สำเร็จ"));
      }

      const allItems = unwrapList(
        (await response.json()) as ListResponse<FavoriteItem>,
      );
      const groupItems = allItems.filter(
        (item) => String(getItemGroupId(item)) === String(groupId),
      );
      setItems(groupItems);

      const productDetails = groupItems.reduce<Record<string, FavoriteProduct>>(
        (result, item) => {
          if (item.product) result[String(item.product.id)] = item.product;
          return result;
        },
        {},
      );
      const productIds = Array.from(
        new Set(groupItems.map((item) => String(item.product_id))),
      );
      const details = await Promise.all(
        productIds.map((productId) => fetchProductDetail(productId)),
      );
      details.forEach((product) => {
        if (product) productDetails[String(product.id)] = product;
      });
      setProductsById(productDetails);
    } catch (err) {
      console.error("Error fetching favorite items:", err);
      setError(
        err instanceof Error
          ? err.message
          : "ไม่สามารถโหลดสินค้า Favorite ได้",
      );
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void fetchItems();
  }, [groupId]);

  useEffect(() => {
    let isCancelled = false;

    const resolveImages = async () => {
      const entries = await Promise.all(
        Object.values(productsById).map(async (product) => {
          const url = await resolveProductImageUrl(product.image_url);
          return [String(product.id), url] as const;
        }),
      );

      if (isCancelled) return;

      const nextUrls: Record<string, string> = {};
      entries.forEach(([productId, url]) => {
        if (url) nextUrls[productId] = url;
      });
      setResolvedImageUrls(nextUrls);
      setFailedImageIds(new Set());
    };

    void resolveImages();
    return () => {
      isCancelled = true;
    };
  }, [productsById]);

  const loadProducts = useCallback(
    async ({
      pageToLoad,
      searchKeyword,
      reset,
    }: {
      pageToLoad: number;
      searchKeyword: string;
      reset: boolean;
    }) => {
      if (productsLoadingRef.current) return;

      productsLoadingRef.current = true;
      setLoading(true);
      setPickerError(null);

      try {
        const response = await authorizedFetch(
          buildProductsPath(pageToLoad, limit, searchKeyword, ""),
        );
        if (!response.ok) {
          throw new Error(await readApiError(response, "โหลดสินค้าไม่สำเร็จ"));
        }

        const payload = (await response.json()) as PaginatedProductsResponse;
        const list = Array.isArray(payload.data) ? payload.data : [];
        setProducts((currentProducts) =>
          reset ? list : mergeUniqueProducts(currentProducts, list),
        );
        setPage(payload.pagination?.page ?? pageToLoad);
        setHasMore(Boolean(payload.pagination?.hasMore));
      } catch (err) {
        console.error("Error fetching products:", err);
        setPickerError(
          err instanceof Error ? err.message : "ไม่สามารถโหลดสินค้าได้",
        );
      } finally {
        productsLoadingRef.current = false;
        setLoading(false);
      }
    },
    [limit],
  );

  const openProductPicker = async (item: FavoriteItem | null = null) => {
    setEditingItem(item);
    setSelectedProductId(item ? String(item.product_id) : "");
    setProducts([]);
    setPage(1);
    setHasMore(true);
    setSearchQuery("");
    setDebouncedSearch("");
    setPickerError(null);
    setIsPickerOpen(true);

    if (!item) return;

    try {
      const itemResponse = await authorizedFetch(`/favorite-items/${item.id}`);
      if (itemResponse.ok) {
        const payload = (await itemResponse.json()) as
          | FavoriteItem
          | { data?: FavoriteItem };
        const detail =
          typeof payload === "object" && payload !== null && "data" in payload
            ? (payload as { data?: FavoriteItem }).data
            : (payload as FavoriteItem);
        if (detail) {
          setEditingItem(detail);
          setSelectedProductId(String(detail.product_id));
        }
      }
    } catch (err) {
      console.error("Error fetching favorite item detail:", err);
      setPickerError(
        err instanceof Error ? err.message : "ไม่สามารถโหลดรายละเอียด Favorite ได้",
      );
    }
  };

  const closeProductPicker = () => {
    if (isSubmitting) return;
    setIsPickerOpen(false);
    setEditingItem(null);
    setPickerError(null);
  };

  useEffect(() => {
    if (!isPickerOpen) return;

    const timeoutId = window.setTimeout(() => {
      setDebouncedSearch(searchQuery.trim());
    }, 400);
    return () => window.clearTimeout(timeoutId);
  }, [isPickerOpen, searchQuery]);

  useEffect(() => {
    if (!isPickerOpen) return;

    setProducts([]);
    setPage(1);
    setHasMore(true);
    void loadProducts({
      pageToLoad: 1,
      searchKeyword: debouncedSearch,
      reset: true,
    });
  }, [debouncedSearch, isPickerOpen, loadProducts]);

  const handlePickerProductsScroll = (event: React.UIEvent<HTMLDivElement>) => {
    const element = event.currentTarget;
    const distanceFromBottom =
      element.scrollHeight - element.scrollTop - element.clientHeight;
    if (distanceFromBottom > 180 || loading || !hasMore) return;
    void loadProducts({
      pageToLoad: page + 1,
      searchKeyword: debouncedSearch,
      reset: false,
    });
  };

  const saveFavoriteItem = async () => {
    if (!selectedProductId) {
      setPickerError("กรุณาเลือกสินค้า");
      return;
    }

    setIsSubmitting(true);
    setPickerError(null);
    try {
      const response = await authorizedFetch(
        editingItem ? `/favorite-items/${editingItem.id}` : "/favorite-items",
        {
          method: editingItem ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            favorite_group_id: groupId,
            product_id: selectedProductId,
          }),
        },
      );
      if (!response.ok) {
        throw new Error(
          await readApiError(response, "บันทึกสินค้า Favorite ไม่สำเร็จ"),
        );
      }
      setIsPickerOpen(false);
      setEditingItem(null);
      await fetchItems();
    } catch (err) {
      console.error("Error saving favorite item:", err);
      setPickerError(
        err instanceof Error
          ? err.message
          : "ไม่สามารถบันทึกสินค้า Favorite ได้",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const deleteFavoriteItem = async () => {
    if (!deletingItem) return;
    setIsDeleting(true);
    try {
      const response = await authorizedFetch(
        `/favorite-items/${deletingItem.id}`,
        { method: "DELETE" },
      );
      if (!response.ok) {
        throw new Error(
          await readApiError(response, "ลบสินค้า Favorite ไม่สำเร็จ"),
        );
      }
      setDeletingItem(null);
      await fetchItems();
    } catch (err) {
      console.error("Error deleting favorite item:", err);
      setError(
        err instanceof Error ? err.message : "ไม่สามารถลบสินค้า Favorite ได้",
      );
    } finally {
      setIsDeleting(false);
    }
  };

  const filteredProducts = useMemo(() => {
    return products.filter((product) => {
      const alreadyAdded = items.some(
        (item) =>
          String(item.product_id) === String(product.id) &&
          item.id !== editingItem?.id,
      );
      return !alreadyAdded;
    });
  }, [editingItem?.id, items, products]);

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h2 className="font-bold text-slate-900">{groupName}</h2>
          <p className="mt-0.5 text-xs text-slate-500">
            รายการสินค้าในกลุ่ม Favorite
          </p>
        </div>
        <button
          type="button"
          onClick={() => void openProductPicker()}
          className="flex h-9 items-center gap-2 rounded-lg bg-[#1d6fd8] px-3 text-sm font-medium text-white hover:bg-[#1557ad]"
        >
          <IconPlus size={16} />
          เพิ่มสินค้า
        </button>
      </div>

      {isLoading ? (
        <div className="grid flex-1 place-items-center text-sm text-slate-400">
          กำลังโหลดสินค้า...
        </div>
      ) : error ? (
        <div className="grid flex-1 place-items-center text-center">
          <div>
            <p className="text-sm text-red-500">{error}</p>
            <button
              type="button"
              onClick={() => void fetchItems()}
              className="mx-auto mt-3 flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-600"
            >
              <IconRefresh size={16} />
              ลองอีกครั้ง
            </button>
          </div>
        </div>
      ) : items.length === 0 ? (
        <div className="grid flex-1 place-items-center text-center text-slate-400">
          <div>
            <IconBox size={40} className="mx-auto mb-2 text-amber-400" />
            <p className="text-sm">ยังไม่มีสินค้าในกลุ่ม {groupName}</p>
          </div>
        </div>
      ) : (
        <div className="grid auto-rows-min grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-4">
          {items.map((item) => {
            const product = productsById[String(item.product_id)] ?? item.product;
            if (!product) return null;
            const imageSrc = resolvedImageUrls[String(product.id)];
            const hasImage =
              Boolean(imageSrc) && !failedImageIds.has(String(product.id));

            return (
              <article
                key={item.id}
                className="group relative rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-[#4d9bf0] hover:shadow-md"
              >
                <button
                  type="button"
                  onClick={() => onAddToCart(product)}
                  className="w-full text-left"
                >
                  <div className="mb-3 flex h-12 w-12 items-center justify-center overflow-hidden rounded-xl bg-[#4d9bf0]/10 text-[#1d6fd8]">
                    {hasImage ? (
                      <img
                        src={imageSrc}
                        alt={product.product_name}
                        className="h-full w-full object-cover"
                        onError={() =>
                          setFailedImageIds((current) => {
                            const next = new Set(current);
                            next.add(String(product.id));
                            return next;
                          })
                        }
                      />
                    ) : (
                      <IconBox size={24} />
                    )}
                  </div>
                  <p className="truncate text-sm font-semibold text-slate-900">
                    {product.product_name}
                  </p>
                  <p className="mt-2 text-lg font-bold text-[#1d6fd8]">
                    {getProductPriceLabel(product)}
                  </p>
                  <span className="mt-2 flex items-center gap-1 text-xs text-slate-400">
                    <IconShoppingCartPlus size={14} />
                    กดเพื่อเพิ่มลงตะกร้า
                  </span>
                </button>
                <div className="absolute right-2 top-2 flex gap-1">
                  <button
                    type="button"
                    onClick={() => void openProductPicker(item)}
                    className="flex h-7 w-7 items-center justify-center rounded-lg bg-white text-slate-400 shadow hover:text-[#1d6fd8]"
                    aria-label="เปลี่ยนสินค้า"
                  >
                    <IconPencil size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeletingItem(item)}
                    className="flex h-7 w-7 items-center justify-center rounded-lg bg-white text-slate-400 shadow hover:text-red-500"
                    aria-label="ลบสินค้า Favorite"
                  >
                    <IconTrash size={14} />
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {isPickerOpen ? (
        <div
          className="fixed inset-0 z-[110] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
          onClick={closeProductPicker}
        >
          <div
            className="flex max-h-[80vh] w-full max-w-2xl flex-col rounded-2xl bg-white p-6 shadow-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-800">
                {editingItem ? "เปลี่ยนสินค้า Favorite" : "เพิ่มสินค้า Favorite"}
              </h3>
              <button type="button" onClick={closeProductPicker}>
                <IconX size={20} className="text-slate-400" />
              </button>
            </div>
            <div className="relative mt-4">
              <IconSearch
                size={16}
                className="absolute inset-y-0 left-3 my-auto text-slate-400"
              />
              <input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="ค้นหาชื่อสินค้า, SKU หรือบาร์โค้ด"
                className="h-10 w-full rounded-xl border border-slate-200 pl-9 pr-3 text-sm outline-none focus:border-[#1d6fd8]"
              />
            </div>
            <div
              className="mt-3 min-h-0 flex-1 overflow-y-auto"
              onScroll={handlePickerProductsScroll}
            >
              {loading && products.length === 0 ? (
                <p className="py-10 text-center text-sm text-slate-400">
                  กำลังโหลดสินค้า...
                </p>
              ) : filteredProducts.length === 0 ? (
                <p className="py-10 text-center text-sm text-slate-400">
                  ไม่พบสินค้า
                </p>
              ) : (
                <>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {filteredProducts.map((product) => (
                      <button
                        key={product.id}
                        type="button"
                        onClick={() => setSelectedProductId(String(product.id))}
                        className={`rounded-xl border p-3 text-left transition ${
                          selectedProductId === String(product.id)
                            ? "border-[#1d6fd8] bg-blue-50"
                            : "border-slate-200 hover:bg-slate-50"
                        }`}
                      >
                        <p className="truncate text-sm font-semibold text-slate-800">
                          {product.product_name}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          {getProductPriceLabel(product)}
                        </p>
                      </button>
                    ))}
                  </div>
                  {loading ? (
                    <p className="py-4 text-center text-sm text-slate-400">
                      กำลังโหลดสินค้า...
                    </p>
                  ) : null}
                  {!loading && products.length > 0 && !hasMore ? (
                    <p className="py-4 text-center text-sm text-slate-400">
                      แสดงสินค้าทั้งหมดแล้ว
                    </p>
                  ) : null}
                </>
              )}
            </div>
            {pickerError ? (
              <p className="mt-3 text-sm text-red-500">{pickerError}</p>
            ) : null}
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={closeProductPicker}
                disabled={isSubmitting}
                className="flex-1 rounded-xl border border-slate-200 py-2.5 text-sm font-medium text-slate-600"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={() => void saveFavoriteItem()}
                disabled={isSubmitting || !selectedProductId}
                className="flex-1 rounded-xl bg-[#1d6fd8] py-2.5 text-sm font-medium text-white disabled:opacity-50"
              >
                {isSubmitting ? "กำลังบันทึก..." : "บันทึก"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {deletingItem ? (
        <div className="fixed inset-0 z-[120] grid place-items-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="text-lg font-bold text-slate-800">
              ลบสินค้า Favorite
            </h3>
            <p className="mt-2 text-sm text-slate-600">
              ต้องการนำสินค้านี้ออกจากกลุ่ม {groupName} ใช่หรือไม่?
            </p>
            <div className="mt-5 flex gap-2">
              <button
                type="button"
                onClick={() => setDeletingItem(null)}
                disabled={isDeleting}
                className="flex-1 rounded-xl border border-slate-200 py-2.5 text-sm text-slate-600"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={() => void deleteFavoriteItem()}
                disabled={isDeleting}
                className="flex-1 rounded-xl bg-red-500 py-2.5 text-sm text-white disabled:opacity-50"
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

