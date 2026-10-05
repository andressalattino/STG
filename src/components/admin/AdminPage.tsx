import {
  Edit3,
  FileText,
  ImagePlus,
  LayoutDashboard,
  Lock,
  RefreshCw,
  Save,
  Trash2,
  Upload,
  UsersRound,
  X,
} from "lucide-react";
import Link from "next/link";
import type { FormEvent } from "react";
import { MediaImage, PdfLink } from "@/components/Media";
import { Field } from "@/components/site/shared";
import type { PassengerPhoto, Trip } from "@/types";

type AdminPageProps = {
  uploading: boolean;
  isAdmin: boolean;
  loginError: string;
  trips: Trip[];
  editingTrip: Trip;
  onLogin: (event: FormEvent<HTMLFormElement>) => void;
  onLogout: () => void;
  onSubmitTrip: (event: FormEvent<HTMLFormElement>) => void;
  onUpdateTripField: (field: keyof Trip, value: string | boolean) => void;
  onEditTrip: (trip: Trip) => void;
  onDeleteTrip: (id: string) => void;
  onResetTrip: () => void;
  onUploadTripImage: (file: File) => void;
  onUploadTripPdf: (file: File) => void;
  imageUploadStatus: string;
  pdfUploadStatus: string;
  passengerPhotos: PassengerPhoto[];
  editingPassengerPhoto: PassengerPhoto;
  passengerUploadStatus: string;
  dataStatus: string;
  hasSupabaseAdminSession: boolean;
  isSavingTrip: boolean;
  isSavingPassengerPhoto: boolean;
  isRefreshingData: boolean;
  onRefreshData: () => void;
  onSubmitPassengerPhoto: (event: FormEvent<HTMLFormElement>) => void;
  onUpdatePassengerPhotoField: (
    field: keyof PassengerPhoto,
    value: string,
  ) => void;
  onUploadPassengerImage: (file: File) => void;
  onEditPassengerPhoto: (photo: PassengerPhoto) => void;
  onDeletePassengerPhoto: (id: string) => void;
  onResetPassengerPhoto: () => void;
};

export function AdminPage({
  uploading,
  isAdmin,
  loginError,
  trips,
  editingTrip,
  onLogin,
  onLogout,
  onSubmitTrip,
  onUpdateTripField,
  onEditTrip,
  onDeleteTrip,
  onResetTrip,
  onUploadTripImage,
  onUploadTripPdf,
  imageUploadStatus,
  pdfUploadStatus,
  passengerPhotos,
  editingPassengerPhoto,
  passengerUploadStatus,
  dataStatus,
  hasSupabaseAdminSession,
  isSavingTrip,
  isSavingPassengerPhoto,
  isRefreshingData,
  onRefreshData,
  onSubmitPassengerPhoto,
  onUpdatePassengerPhotoField,
  onUploadPassengerImage,
  onEditPassengerPhoto,
  onDeletePassengerPhoto,
  onResetPassengerPhoto,
}: AdminPageProps) {
  if (!isAdmin) {
    return (
      <section className="min-h-[calc(100vh-180px)] py-12 sm:py-16">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 sm:px-6 lg:grid-cols-[0.9fr_1fr] lg:px-8">
          <div className="flex flex-col justify-center">
            <p className="text-sm font-black uppercase tracking-[0.2em] text-stg-blue">
              Acceso privado
            </p>
            <h1 className="mt-4 text-4xl font-black leading-tight text-foreground sm:text-5xl">
              Panel administrativo protegido.
            </h1>
            <p className="mt-5 leading-8 text-muted">
              El apartado de administracion no muestra viajes, formularios ni
              controles internos hasta iniciar sesion como admin.
            </p>
          </div>

          <form onSubmit={onLogin} className="surface-card p-6 sm:p-8">
            <div className="inline-flex h-12 w-12 items-center justify-center rounded-md bg-tint text-foreground">
              <Lock size={24} />
            </div>
            <h2 className="mt-5 text-2xl font-black text-foreground">
              Iniciar sesion
            </h2>
            <div className="mt-6 grid gap-4">
              <label className="grid gap-2 text-sm font-bold text-foreground">
                Correo electrónico
                <input
                  name="username"
                  type="email"
                  autoComplete="username"
                  className="admin-input"
                  placeholder="tu-correo@ejemplo.com"
                  required
                />
              </label>
              <label className="grid gap-2 text-sm font-bold text-foreground">
                Contrasena
                <input
                  name="password"
                  type="password"
                  className="admin-input"
                  autoComplete="current-password"
                  required
                />
              </label>
              <button type="submit" className="btn-primary mt-2">
                <Lock size={18} />
                Entrar al panel
              </button>
              {loginError && (
                <p className="rounded-md bg-danger-soft px-3 py-2 text-sm font-semibold text-danger">
                  {loginError}
                </p>
              )}
              <Link
                href="/admin/recuperar"
                className="text-sm font-bold underline"
              >
                Olvidé mi contraseña
              </Link>
            </div>
          </form>
        </div>
      </section>
    );
  }

  return (
    <section className="py-10 sm:py-12">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mb-6 flex flex-col justify-between gap-4 rounded-lg border border-line bg-tint p-6 text-foreground shadow-[0_18px_45px_rgba(15,23,42,0.08)] sm:flex-row sm:items-center">
          <div>
            <p className="text-sm font-black uppercase tracking-[0.18em] text-stg-blue">
              Panel admin
            </p>
            <h1 className="mt-2 text-3xl font-black">Gestion de viajes STG</h1>
            {dataStatus && (
              <p className="mt-3 text-sm font-semibold text-muted">
                {dataStatus}
              </p>
            )}
            <p className="mt-2 text-xs font-bold uppercase tracking-[0.14em] text-muted">
              {hasSupabaseAdminSession
                ? "Supabase conectado"
                : "Sesión pendiente"}
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={onRefreshData}
              disabled={isRefreshingData}
              className="inline-flex w-fit items-center gap-2 rounded-md border border-line bg-surface px-4 py-2 text-sm font-bold text-foreground transition hover:border-line disabled:cursor-not-allowed disabled:opacity-60"
            >
              <RefreshCw
                size={18}
                className={isRefreshingData ? "animate-spin" : ""}
              />
              {isRefreshingData ? "Refrescando" : "Refrescar datos"}
            </button>
            <button
              type="button"
              onClick={onLogout}
              className="inline-flex w-fit items-center gap-2 rounded-md border border-line bg-surface px-4 py-2 text-sm font-bold text-foreground"
            >
              <X size={18} />
              Cerrar sesion
            </button>
          </div>
        </div>

        <div className="surface-card mb-6 flex flex-wrap items-center justify-between gap-4 p-5">
          <div>
            <h2 className="text-xl font-bold">Recibos STG</h2>
            <p className="mt-1 text-sm text-muted">
              Emití comprobantes A4, consultá el historial y descargá sus PDF.
            </p>
          </div>
          <Link className="btn-primary" href="/admin/recibos">
            <FileText size={18} />
            Abrir sistema de recibos
          </Link>
        </div>

        <div className="grid gap-6 lg:grid-cols-[380px_minmax(0,1fr)]">
          <aside id="admin-trip-form" className="surface-card scroll-mt-28 p-5">
            <h2 className="flex items-center gap-2 text-lg font-black text-foreground">
              <LayoutDashboard size={20} />
              {editingTrip.id ? "Editar viaje" : "Nuevo viaje"}
            </h2>
            <form onSubmit={onSubmitTrip} className="mt-5">
              <fieldset
                disabled={uploading || isSavingTrip}
                className="grid min-w-0 gap-4"
              >
                <Field label="Titulo">
                  <input
                    value={editingTrip.title}
                    onChange={(event) =>
                      onUpdateTripField("title", event.target.value)
                    }
                    className="admin-input"
                    required
                  />
                </Field>
                <Field label="Descripcion">
                  <textarea
                    value={editingTrip.description}
                    onChange={(event) =>
                      onUpdateTripField("description", event.target.value)
                    }
                    className="admin-input min-h-28"
                    required
                  />
                </Field>
                <Field label="URL de imagen">
                  <input
                    value={editingTrip.imageUrl}
                    onChange={(event) =>
                      onUpdateTripField("imageUrl", event.target.value)
                    }
                    className="admin-input"
                    placeholder="/imagenes/viaje.jpg"
                    required
                  />
                </Field>
                <div className="rounded-md border border-dashed border-line bg-subtle p-4">
                  <label className="grid cursor-pointer gap-3 text-sm font-bold text-foreground">
                    <span className="inline-flex items-center gap-2">
                      <Upload size={18} />
                      Subir imagen desde la PC
                    </span>
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/gif,image/avif"
                      className="block w-full text-sm text-muted"
                      disabled={uploading}
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        if (file) onUploadTripImage(file);
                        event.currentTarget.value = "";
                      }}
                    />
                  </label>
                  <p className="mt-3 text-xs leading-5 text-muted">
                    {imageUploadStatus ||
                      (hasSupabaseAdminSession
                        ? "JPG, PNG, WebP, GIF o AVIF. Maximo 8 MB."
                        : "JPG, PNG, WebP, GIF o AVIF; hasta 8 MB. Se guardara solo en este dispositivo hasta conectar Supabase.")}
                  </p>
                </div>
                <Field label="URL del PDF">
                  <input
                    value={editingTrip.pdfUrl}
                    onChange={(event) =>
                      onUpdateTripField("pdfUrl", event.target.value)
                    }
                    className="admin-input"
                    placeholder="https://... o cargar un PDF"
                  />
                </Field>
                {editingTrip.imageUrl && (
                  <MediaImage
                    src={editingTrip.imageUrl}
                    alt="Vista previa del viaje"
                    className="max-h-48 w-full rounded-md object-contain"
                  />
                )}
                {editingTrip.pdfUrl && <PdfLink value={editingTrip.pdfUrl} />}
                <div className="rounded-md border border-dashed border-line bg-subtle p-4">
                  <label className="grid cursor-pointer gap-3 text-sm font-bold text-foreground">
                    <span className="inline-flex items-center gap-2">
                      <FileText size={18} />
                      Subir PDF del viaje
                    </span>
                    <input
                      type="file"
                      accept="application/pdf"
                      className="block w-full text-sm text-muted"
                      disabled={uploading}
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        if (file) onUploadTripPdf(file);
                        event.currentTarget.value = "";
                      }}
                    />
                  </label>
                  <p className="mt-3 text-xs leading-5 text-muted">
                    {pdfUploadStatus ||
                      (hasSupabaseAdminSession
                        ? "PDF de hasta 20 MB."
                        : "PDF de hasta 20 MB. Se guardara solo en este dispositivo hasta conectar Supabase.")}
                  </p>
                </div>
                <label className="flex items-center gap-3 rounded-md border border-line bg-subtle px-3 py-3 text-sm font-bold">
                  <input
                    type="checkbox"
                    checked={Boolean(editingTrip.featured)}
                    onChange={(event) =>
                      onUpdateTripField("featured", event.target.checked)
                    }
                    className="h-5 w-5 accent-stg-yellow"
                  />
                  Destacar en inicio
                </label>
                <div className="flex flex-wrap gap-3">
                  <button
                    type="submit"
                    disabled={isSavingTrip || uploading}
                    className="inline-flex items-center gap-2 rounded-md bg-stg-yellow px-4 py-2 font-black text-ink shadow-[0_10px_22px_rgba(247,198,33,0.25)] transition hover:bg-yellow-300 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <Save size={18} />
                    {isSavingTrip ? "Guardando" : "Guardar"}
                  </button>
                  <button
                    type="button"
                    onClick={onResetTrip}
                    className="rounded-md border border-line bg-surface px-4 py-2 font-bold text-foreground"
                  >
                    Limpiar
                  </button>
                </div>
              </fieldset>
            </form>
          </aside>

          <div className="surface-card overflow-hidden">
            <div className="flex items-center justify-between border-b border-line px-5 py-4">
              <h2 className="text-lg font-black text-foreground">
                Viajes cargados
              </h2>
              <span className="rounded-md bg-subtle px-3 py-1 text-sm font-black text-muted">
                {trips.length} viajes
              </span>
            </div>
            <div className="divide-y divide-line">
              {trips.map((trip) => (
                <article
                  key={trip.id}
                  className="grid gap-4 p-4 sm:grid-cols-[132px_minmax(0,1fr)_auto] sm:items-center"
                >
                  <MediaImage
                    src={trip.imageUrl || "/logo-stg.png"}
                    alt={trip.title}
                    className="h-28 w-full rounded-md object-cover sm:w-32"
                  />
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-lg font-black text-foreground">
                        {trip.title}
                      </h3>
                      {trip.featured && (
                        <span className="rounded-md bg-stg-yellow px-2 py-1 text-xs font-black text-ink">
                          Destacado
                        </span>
                      )}
                    </div>
                    <p className="mt-2 line-clamp-2 text-sm leading-6 text-muted">
                      {trip.description}
                    </p>
                    <p className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-muted">
                      <ImagePlus size={14} />
                      {trip.source === "supabase"
                        ? "Publicado"
                        : "Solo en este dispositivo"}
                    </p>
                  </div>
                  <div className="flex gap-2 sm:flex-col">
                    <button
                      type="button"
                      onClick={() => onEditTrip(trip)}
                      className="inline-flex h-10 w-10 items-center justify-center rounded-md bg-subtle text-foreground"
                      aria-label="Editar viaje"
                    >
                      <Edit3 size={18} />
                    </button>
                    <button
                      type="button"
                      onClick={() => onDeleteTrip(trip.id)}
                      className="inline-flex h-10 w-10 items-center justify-center rounded-md bg-danger-soft text-danger"
                      aria-label="Borrar viaje"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-[380px_minmax(0,1fr)]">
          <aside
            id="admin-passenger-form"
            className="surface-card scroll-mt-28 p-5"
          >
            <h2 className="flex items-center gap-2 text-lg font-black text-foreground">
              <UsersRound size={20} />
              {editingPassengerPhoto.id
                ? "Editar foto"
                : "Nueva foto de pasajeros"}
            </h2>
            <form onSubmit={onSubmitPassengerPhoto} className="mt-5">
              <fieldset
                disabled={uploading || isSavingPassengerPhoto}
                className="grid min-w-0 gap-4"
              >
                <Field label="Titulo">
                  <input
                    value={editingPassengerPhoto.title}
                    onChange={(event) =>
                      onUpdatePassengerPhotoField("title", event.target.value)
                    }
                    className="admin-input"
                    placeholder="Grupo en Mendoza"
                    required
                  />
                </Field>
                <Field label="Descripcion">
                  <textarea
                    value={editingPassengerPhoto.description}
                    onChange={(event) =>
                      onUpdatePassengerPhotoField(
                        "description",
                        event.target.value,
                      )
                    }
                    className="admin-input min-h-24"
                    placeholder="Pasajeros disfrutando una salida organizada por STG."
                    required
                  />
                </Field>
                <Field label="URL de imagen">
                  <input
                    value={editingPassengerPhoto.imageUrl}
                    onChange={(event) =>
                      onUpdatePassengerPhotoField(
                        "imageUrl",
                        event.target.value,
                      )
                    }
                    className="admin-input"
                    placeholder="https://..."
                    required
                  />
                </Field>
                <div className="rounded-md border border-dashed border-line bg-subtle p-4">
                  <label className="grid cursor-pointer gap-3 text-sm font-bold text-foreground">
                    <span className="inline-flex items-center gap-2">
                      <Upload size={18} />
                      Subir foto desde la PC
                    </span>
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/gif,image/avif"
                      className="block w-full text-sm text-muted"
                      disabled={uploading}
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        if (file) onUploadPassengerImage(file);
                        event.currentTarget.value = "";
                      }}
                    />
                  </label>
                  <p className="mt-3 text-xs leading-5 text-muted">
                    {passengerUploadStatus ||
                      (hasSupabaseAdminSession
                        ? "JPG, PNG, WebP, GIF o AVIF. Maximo 8 MB."
                        : "JPG, PNG, WebP, GIF o AVIF; hasta 8 MB. Se guardara solo en este dispositivo hasta conectar Supabase.")}
                  </p>
                </div>
                {editingPassengerPhoto.imageUrl && (
                  <MediaImage
                    src={editingPassengerPhoto.imageUrl}
                    alt="Vista previa de pasajeros"
                    className="max-h-48 w-full rounded-md object-contain"
                  />
                )}
                <div className="flex flex-wrap gap-3">
                  <button
                    type="submit"
                    disabled={isSavingPassengerPhoto || uploading}
                    className="inline-flex items-center gap-2 rounded-md bg-stg-yellow px-4 py-2 font-black text-ink shadow-[0_10px_22px_rgba(247,198,33,0.25)] transition hover:bg-yellow-300 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <Save size={18} />
                    {isSavingPassengerPhoto ? "Guardando" : "Guardar"}
                  </button>
                  <button
                    type="button"
                    onClick={onResetPassengerPhoto}
                    className="rounded-md border border-line bg-surface px-4 py-2 font-bold text-foreground"
                  >
                    Limpiar
                  </button>
                </div>
              </fieldset>
            </form>
          </aside>

          <div className="surface-card overflow-hidden">
            <div className="flex items-center justify-between border-b border-line px-5 py-4">
              <h2 className="text-lg font-black text-foreground">
                Fotos en Nuestros pasajeros
              </h2>
              <span className="rounded-md bg-subtle px-3 py-1 text-sm font-black text-muted">
                {passengerPhotos.length} fotos
              </span>
            </div>
            <div className="grid gap-4 p-4 md:grid-cols-2">
              {passengerPhotos.map((photo) => (
                <article
                  key={photo.id}
                  className="overflow-hidden rounded-lg border border-line bg-surface shadow-sm transition hover:-translate-y-0.5 hover:shadow-[0_18px_45px_rgba(15,23,42,0.1)]"
                >
                  <MediaImage
                    src={photo.imageUrl || "/logo-stg.png"}
                    alt={photo.title}
                    className="aspect-[16/10] w-full object-cover"
                  />
                  <div className="p-4">
                    <h3 className="font-black text-foreground">
                      {photo.title}
                    </h3>
                    <p className="mt-2 line-clamp-2 text-sm leading-6 text-muted">
                      {photo.description}
                    </p>
                    <div className="mt-4 flex gap-2">
                      <button
                        type="button"
                        onClick={() => onEditPassengerPhoto(photo)}
                        className="inline-flex h-10 w-10 items-center justify-center rounded-md bg-subtle text-foreground"
                        aria-label="Editar foto"
                      >
                        <Edit3 size={18} />
                      </button>
                      <button
                        type="button"
                        onClick={() => onDeletePassengerPhoto(photo.id)}
                        className="inline-flex h-10 w-10 items-center justify-center rounded-md bg-danger-soft text-danger"
                        aria-label="Borrar foto"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
