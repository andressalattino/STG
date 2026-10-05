// Supabase Auth and Storage are accessed here; data moves through Next.js.
import type { Comment, PassengerPhoto, Trip } from "../types";
import { ApiError, apiRequest } from "./api";
import { isLocalFile, readLocalFile } from "./local-files";
import { supabase } from "./supabase-client";

export { isSupabaseConfigured, supabase } from "./supabase-client";

function assertSupabaseConfigured() {
  if (!supabase) {
    throw new Error("Faltan las variables de Supabase en el archivo .env");
  }
  return supabase;
}

function buildStoragePath(folder: string, file: File) {
  const extension = file.name.split(".").pop() || "jpg";
  const safeName = file.name
    .replace(/\.[^/.]+$/, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

  return `${folder}/${Date.now()}-${safeName}.${extension}`;
}

export function validateUploadFile(file: File, acceptedType: "image" | "pdf") {
  const maxImageSize = 8 * 1024 * 1024;
  const maxPdfSize = 20 * 1024 * 1024;

  if (
    acceptedType === "image" &&
    ![
      "image/jpeg",
      "image/png",
      "image/webp",
      "image/gif",
      "image/avif",
    ].includes(file.type)
  ) {
    throw new Error("El archivo seleccionado no es una imagen valida.");
  }

  if (acceptedType === "pdf" && file.type !== "application/pdf") {
    throw new Error("El archivo seleccionado no es un PDF valido.");
  }

  if (acceptedType === "image" && file.size > maxImageSize) {
    throw new Error("La imagen no puede superar los 8 MB.");
  }

  if (acceptedType === "pdf" && file.size > maxPdfSize) {
    throw new Error("El PDF no puede superar los 20 MB.");
  }
}

async function uploadPublicFile(
  bucket: string,
  folder: string,
  file: File,
  acceptedType: "image" | "pdf",
) {
  const client = assertSupabaseConfigured();
  validateUploadFile(file, acceptedType);
  const path = buildStoragePath(folder, file);

  const { error } = await client.storage.from(bucket).upload(path, file, {
    cacheControl: "3600",
    upsert: false,
  });

  if (error) {
    throw new Error(error.message);
  }

  const { data } = client.storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
}

export function uploadTripImage(file: File) {
  return uploadPublicFile("trip-images", "viajes", file, "image");
}

export function uploadPassengerImage(file: File) {
  return uploadPublicFile("passenger-images", "pasajeros", file, "image");
}

export function uploadTripPdf(file: File) {
  return uploadPublicFile("trip-pdfs", "viajes", file, "pdf");
}

export async function signInAdmin(email: string, password: string) {
  const client = assertSupabaseConfigured();

  const { error } = await client.auth.signInWithPassword({
    email,
    password,
  });
  if (error) {
    if (error.code === "invalid_credentials") {
      throw new Error(
        "El correo o la contraseña no son correctos. Podés usar «Olvidé mi contraseña» para recuperar el acceso.",
      );
    }
    throw new Error(error.message);
  }
}

export async function signOutAdmin() {
  if (!supabase) return;
  await supabase.auth.signOut();
}

export async function hasAdminSession() {
  if (!supabase) return false;
  const { data } = await supabase.auth.getSession();
  if (!data.session) return false;
  try {
    await apiRequest("/api/admin/session");
    return true;
  } catch (error) {
    if (error instanceof ApiError && [401, 403].includes(error.status))
      return false;
    throw error;
  }
}
export async function fetchTripsFromSupabase() {
  return apiRequest<Trip[]>("/api/content/trips");
}
export async function saveTripToSupabase(trip: Trip) {
  const payload = {
    ...trip,
    imageUrl: isLocalFile(trip.imageUrl)
      ? await uploadTripImage(await readLocalFile(trip.imageUrl))
      : trip.imageUrl,
    pdfUrl: isLocalFile(trip.pdfUrl)
      ? await uploadTripPdf(await readLocalFile(trip.pdfUrl))
      : trip.pdfUrl,
  };
  return apiRequest<Trip>("/api/content/trips", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
export async function deleteTripFromSupabase(id: string) {
  return apiRequest(`/api/content/trips?id=${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}
export async function fetchPassengerPhotosFromSupabase() {
  return apiRequest<PassengerPhoto[]>("/api/content/photos");
}
export async function savePassengerPhotoToSupabase(photo: PassengerPhoto) {
  const payload = {
    ...photo,
    imageUrl: isLocalFile(photo.imageUrl)
      ? await uploadPassengerImage(await readLocalFile(photo.imageUrl))
      : photo.imageUrl,
  };
  return apiRequest<PassengerPhoto>("/api/content/photos", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
export async function deletePassengerPhotoFromSupabase(id: string) {
  return apiRequest(`/api/content/photos?id=${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}
export async function fetchComments() {
  return apiRequest<Comment[]>("/api/content/comments");
}
export async function saveComment(comment: Comment) {
  return apiRequest<Comment & { id: string; source: "supabase" }>(
    "/api/content/comments",
    { method: "POST", body: JSON.stringify(comment) },
  );
}
export async function deleteComment(id: string) {
  return apiRequest(`/api/content/comments?id=${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}
