"use client";

import { useActionState } from "react";
import {
  clearProductImage,
  updateProductImage,
  type ProductImageState,
} from "@/lib/product-actions";

const EMPTY: ProductImageState = {};

export function ProductImageForm({
  productId,
  imageUrl,
}: {
  productId: string;
  imageUrl: string | null;
}) {
  const [state, action, pending] = useActionState(updateProductImage, EMPTY);

  return (
    <div className="space-y-2">
      {imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={imageUrl}
          alt=""
          className="doc-product-img border border-[var(--border)]"
        />
      ) : (
        <p className="text-xs text-[var(--text-dim)]">Geen foto</p>
      )}
      <form action={action} className="flex flex-wrap items-center gap-2">
        <input type="hidden" name="productId" value={productId} />
        <input
          name="photo"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="text-xs max-w-[12rem]"
          required
        />
        <button type="submit" className="btn btn-sm" disabled={pending}>
          {pending ? "…" : "Upload"}
        </button>
      </form>
      {imageUrl ? (
        <form action={clearProductImage}>
          <input type="hidden" name="productId" value={productId} />
          <button type="submit" className="btn btn-sm btn-ghost">
            Foto weg
          </button>
        </form>
      ) : null}
      {state.error ? (
        <p className="text-xs" style={{ color: "var(--alert)" }}>
          {state.error}
        </p>
      ) : null}
      {state.ok ? (
        <p className="text-xs text-[var(--accent)]">Opgeslagen</p>
      ) : null}
    </div>
  );
}
