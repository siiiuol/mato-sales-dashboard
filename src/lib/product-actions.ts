"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "./db";
import { audit, requireUser } from "./dal";
import { formObject, idSchema } from "./validation";
import { storeImage, UploadError } from "./storage";

export type ProductImageState = {
  error?: string;
  ok?: boolean;
};

/**
 * Productfoto uploaden voor factuur-/contractpreview.
 */
export async function updateProductImage(
  _previous: ProductImageState,
  formData: FormData
): Promise<ProductImageState> {
  try {
    const user = await requireUser(["admin"]);
    const parsed = z
      .object({ productId: idSchema })
      .safeParse(formObject(formData));
    if (!parsed.success) {
      return { error: "Product niet gevonden" };
    }

    const photo = formData.get("photo");
    if (!(photo instanceof File) || photo.size === 0) {
      return { error: "Kies een afbeelding" };
    }

    let imageUrl: string;
    try {
      imageUrl = await storeImage(photo, "product");
    } catch (err) {
      return {
        error:
          err instanceof UploadError
            ? err.message
            : "Upload mislukt",
      };
    }

    await prisma.product.update({
      where: { id: parsed.data.productId },
      data: { imageUrl },
    });

    await audit(user.id, "product.image_updated", "product", parsed.data.productId, {
      imageUrl,
    });

    revalidatePath("/settings/producten");
    revalidatePath("/leads");
    return { ok: true };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Foto kon niet worden bewaard",
    };
  }
}

export async function clearProductImage(formData: FormData) {
  const user = await requireUser(["admin"]);
  const raw = formData.get("productId");
  const productId = idSchema.parse(typeof raw === "string" ? raw : "");
  await prisma.product.update({
    where: { id: productId },
    data: { imageUrl: null },
  });
  await audit(user.id, "product.image_cleared", "product", productId);
  revalidatePath("/settings/producten");
}
