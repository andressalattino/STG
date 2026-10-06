"use client";
import { usePathname, useRouter } from "next/navigation";
import {
  type FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { AdminComments, useComments } from "./components/AdminComments";
import { AdminNavigation } from "./components/admin/AdminNavigation";
import { AdminPage } from "./components/admin/AdminPage";
import { DeleteConfirmation } from "./components/DeleteConfirmation";
import { CommunityPage } from "./components/site/CommunityPage";
import { Footer } from "./components/site/Footer";
import { Header } from "./components/site/Header";
import { HomePage } from "./components/site/HomePage";
import { type Page, pagePaths } from "./components/site/navigation";
import { TripsPage } from "./components/site/TripsPage";
import { initialPassengerPhotos, initialTrips } from "./data/site";
import { useAdminSession } from "./features/auth/useAdminSession";
import { ExpensesWorkspace } from "./features/finance/ExpensesWorkspace";
import { StatisticsDashboard } from "./features/finance/StatisticsDashboard";
import { QuotationsWorkspace } from "./features/quotations/QuotationsWorkspace";
import { ReceiptWorkspace } from "./features/receipts/ReceiptWorkspace";
import { documentUrl, storeLocalFile } from "./lib/local-files";
import {
  getStoredPassengerPhotos,
  getStoredTrips,
  saveStoredPassengerPhotos,
  saveStoredTrips,
} from "./lib/storage";
import {
  deletePassengerPhotoFromSupabase,
  deleteTripFromSupabase,
  fetchPassengerPhotosFromSupabase,
  fetchTripsFromSupabase,
  isSupabaseConfigured,
  savePassengerPhotoToSupabase,
  saveTripToSupabase,
  uploadPassengerImage,
  uploadTripImage,
  uploadTripPdf,
  validateUploadFile,
} from "./lib/supabase";
import type { PassengerPhoto, Trip } from "./types";

const blankTrip: Trip = {
  id: "",
  title: "",
  description: "",
  imageUrl: "",
  pdfUrl: "",
  featured: false,
};

const blankPassengerPhoto: PassengerPhoto = {
  id: "",
  title: "",
  description: "",
  imageUrl: "",
};

function applyThemePreference(isDark: boolean) {
  const root = document.documentElement;

  root.classList.remove("dark", "theme-dark", "theme-light");
  root.classList.add(isDark ? "theme-dark" : "theme-light");
  root.style.colorScheme = isDark ? "dark" : "light";
  localStorage.setItem("stg-theme", isDark ? "dark" : "light");
}

function App() {
  const [confirmation, setConfirmation] = useState<{
    message: string;
    resolve: (confirmed: boolean) => void;
  } | null>(null);
  function confirmDelete(message: string) {
    return new Promise<boolean>((resolve) =>
      setConfirmation({ message, resolve }),
    );
  }
  const { comments, setComments, error: commentsError } = useComments();
  const [uploading, setUploading] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const page: Page = pathname.startsWith("/admin")
    ? "admin"
    : pathname === "/viajes"
      ? "viajes"
      : pathname === "/comunidad"
        ? "comunidad"
        : "inicio";
  const showingReceipts = pathname === "/admin/recibos";
  const showingEditor = pathname === "/admin";
  const [hydrated, setHydrated] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [trips, setTrips] = useState<Trip[]>(initialTrips);
  const [passengerPhotos, setPassengerPhotos] = useState<PassengerPhoto[]>(
    initialPassengerPhotos,
  );
  const [activeImage, setActiveImage] = useState(0);
  const {
    status: sessionStatus,
    isAdmin,
    login,
    logout,
    checkSession,
  } = useAdminSession();
  const hasSupabaseAdminSession = isAdmin;
  const sessionReady =
    sessionStatus === "authenticated" || sessionStatus === "anonymous";
  const [loginError, setLoginError] = useState("");
  const [editingTrip, setEditingTrip] = useState<Trip>(blankTrip);
  const [editingPassengerPhoto, setEditingPassengerPhoto] =
    useState<PassengerPhoto>(blankPassengerPhoto);
  const [imageUploadStatus, setImageUploadStatus] = useState("");
  const [pdfUploadStatus, setPdfUploadStatus] = useState("");
  const [passengerUploadStatus, setPassengerUploadStatus] = useState("");
  const [dataStatus, setDataStatus] = useState("");
  const [isSavingTrip, setIsSavingTrip] = useState(false);
  const [isSavingPassengerPhoto, setIsSavingPassengerPhoto] = useState(false);
  const [isRefreshingData, setIsRefreshingData] = useState(false);

  useEffect(() => {
    setTrips(getStoredTrips());
    setPassengerPhotos(getStoredPassengerPhotos());
    setDarkMode(localStorage.getItem("stg-theme") === "dark");
    setHydrated(true);
    const oldPage = window.location.hash.replace("#/", "") as Page;
    if (oldPage in pagePaths) router.replace(pagePaths[oldPage]);
  }, [router]);

  useEffect(() => {
    if (hydrated) applyThemePreference(darkMode);
  }, [darkMode, hydrated]);
  useEffect(() => {
    if (hydrated) saveStoredTrips(trips);
  }, [trips, hydrated]);
  useEffect(() => {
    if (hydrated) saveStoredPassengerPhotos(passengerPhotos);
  }, [passengerPhotos, hydrated]);

  const refreshSupabaseData = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setDataStatus("Falta configurar Supabase para acceder a administración.");
      return;
    }

    setIsRefreshingData(true);
    setDataStatus("Sincronizando con Supabase...");

    try {
      const [remoteTrips, remotePassengerPhotos] = await Promise.all([
        fetchTripsFromSupabase(),
        fetchPassengerPhotosFromSupabase(),
      ]);

      setTrips((current) => [
        ...current.filter(
          (item) =>
            item.source !== "supabase" &&
            !remoteTrips.some((row) => row.id === item.id),
        ),
        ...remoteTrips,
      ]);
      setPassengerPhotos((current) => [
        ...current.filter(
          (item) =>
            item.source !== "supabase" &&
            !remotePassengerPhotos.some((row) => row.id === item.id),
        ),
        ...remotePassengerPhotos,
      ]);
      setDataStatus("Datos sincronizados con Supabase.");
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "No se pudo sincronizar Supabase.";
      setDataStatus(`Supabase pendiente: ${message}`);
    } finally {
      setIsRefreshingData(false);
    }
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured) return;

    void refreshSupabaseData();
  }, [refreshSupabaseData]);

  const featuredTrips = useMemo(
    () => trips.filter((trip) => trip.featured).slice(0, 3),
    [trips],
  );

  function goTo(nextPage: Page) {
    router.push(pagePaths[nextPage]);
    setMobileMenuOpen(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const username = String(formData.get("username"));
    const password = String(formData.get("password"));

    try {
      await login(username.trim(), password);
      setDataStatus("Administrador conectado con Supabase.");
      void refreshSupabaseData();
      setLoginError("");
      form.reset();
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "No se pudo iniciar sesion como administrador.";
      setLoginError(message);
    }
  }

  async function handleSubmitTrip(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (uploading || isSavingTrip) return;
    const draftTrip = {
      ...editingTrip,
      id: editingTrip.id || crypto.randomUUID(),
      title: editingTrip.title.trim(),
      description: editingTrip.description.trim(),
      imageUrl: editingTrip.imageUrl.trim(),
      pdfUrl: editingTrip.pdfUrl.trim(),
    };

    try {
      setIsSavingTrip(true);
      if (!draftTrip.title || !draftTrip.description || !draftTrip.imageUrl)
        throw new Error("Completa el titulo, descripcion e imagen.");
      if (draftTrip.pdfUrl && !documentUrl(draftTrip.pdfUrl))
        throw new Error(
          "El PDF no existe o la URL no es valida. Carga un PDF o deja el campo vacio.",
        );
      if (draftTrip.source === "supabase" && !hasSupabaseAdminSession)
        throw new Error(
          "Conecta el admin de Supabase para editar este viaje publicado.",
        );
      let nextTrip = draftTrip;
      let savedInSupabase = false;

      if (hasSupabaseAdminSession) {
        nextTrip = await saveTripToSupabase(draftTrip);
        savedInSupabase = true;
      } else {
        nextTrip = { ...draftTrip, source: "local" };
      }

      setTrips((current) => {
        const exists = current.some((trip) => trip.id === nextTrip.id);
        return exists
          ? current.map((trip) => (trip.id === nextTrip.id ? nextTrip : trip))
          : [nextTrip, ...current];
      });

      setEditingTrip(blankTrip);
      setDataStatus(
        savedInSupabase
          ? "Viaje guardado en Supabase."
          : "Viaje guardado localmente.",
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "No se pudo guardar el viaje.";
      setDataStatus(message);
    } finally {
      setIsSavingTrip(false);
    }
  }

  async function handleSubmitPassengerPhoto(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (uploading || isSavingPassengerPhoto) return;
    const draftPhoto = {
      ...editingPassengerPhoto,
      id: editingPassengerPhoto.id || crypto.randomUUID(),
      title: editingPassengerPhoto.title.trim(),
      description: editingPassengerPhoto.description.trim(),
      imageUrl: editingPassengerPhoto.imageUrl.trim(),
    };

    try {
      setIsSavingPassengerPhoto(true);
      if (!draftPhoto.title || !draftPhoto.description || !draftPhoto.imageUrl)
        throw new Error("Completa el titulo, descripcion e imagen.");
      if (draftPhoto.source === "supabase" && !hasSupabaseAdminSession)
        throw new Error(
          "Conecta el admin de Supabase para editar esta foto publicada.",
        );
      let nextPhoto = draftPhoto;
      let savedInSupabase = false;

      if (hasSupabaseAdminSession) {
        nextPhoto = await savePassengerPhotoToSupabase(draftPhoto);
        savedInSupabase = true;
      } else {
        nextPhoto = { ...draftPhoto, source: "local" };
      }

      setPassengerPhotos((current) => {
        const exists = current.some((photo) => photo.id === nextPhoto.id);
        return exists
          ? current.map((photo) =>
              photo.id === nextPhoto.id ? nextPhoto : photo,
            )
          : [nextPhoto, ...current];
      });

      setEditingPassengerPhoto(blankPassengerPhoto);
      setDataStatus(
        savedInSupabase
          ? "Foto de pasajeros guardada en Supabase."
          : "Foto guardada localmente.",
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "No se pudo guardar la foto.";
      setDataStatus(message);
    } finally {
      setIsSavingPassengerPhoto(false);
    }
  }

  async function handleDeleteTrip(id: string) {
    if (!(await confirmDelete("Seguro que queres borrar este viaje?"))) return;

    try {
      let deletedInSupabase = false;

      if (trips.find((trip) => trip.id === id)?.source === "supabase") {
        if (!hasSupabaseAdminSession)
          throw new Error(
            "Conecta el admin de Supabase para borrar este viaje publicado.",
          );
        await deleteTripFromSupabase(id);
        deletedInSupabase = true;
      }
      setTrips((current) => current.filter((trip) => trip.id !== id));
      if (editingTrip.id === id) setEditingTrip(blankTrip);
      setDataStatus(
        deletedInSupabase
          ? "Viaje borrado de Supabase."
          : "Viaje borrado localmente.",
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "No se pudo borrar el viaje.";
      setDataStatus(message);
    }
  }

  function updateTripField(field: keyof Trip, value: string | boolean) {
    setEditingTrip((current) => ({ ...current, [field]: value }));
  }

  function updatePassengerPhotoField(
    field: keyof PassengerPhoto,
    value: string,
  ) {
    setEditingPassengerPhoto((current) => ({ ...current, [field]: value }));
  }

  function editTrip(trip: Trip) {
    if (uploading) return;
    setEditingTrip({
      ...trip,
      pdfUrl: documentUrl(trip.pdfUrl) ? trip.pdfUrl : "",
    });
    setImageUploadStatus("");
    setPdfUploadStatus("");
    requestAnimationFrame(() => {
      document
        .getElementById("admin-trip-form")
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  function editPassengerPhoto(photo: PassengerPhoto) {
    if (uploading) return;
    setEditingPassengerPhoto(photo);
    requestAnimationFrame(() => {
      document
        .getElementById("admin-passenger-form")
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  async function handleTripImageUpload(file: File) {
    setUploading(true);
    setImageUploadStatus("Subiendo imagen...");

    try {
      validateUploadFile(file, "image");
      const imageUrl = hasSupabaseAdminSession
        ? await uploadTripImage(file)
        : await storeLocalFile(file);
      setEditingTrip((current) => ({ ...current, imageUrl }));
      setImageUploadStatus(
        hasSupabaseAdminSession
          ? "Imagen subida. Guarda el viaje para publicarla."
          : "Imagen guardada en este dispositivo. No publicada en Internet.",
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "No se pudo subir la imagen.";
      setImageUploadStatus(message);
    } finally {
      setUploading(false);
    }
  }

  async function handleTripPdfUpload(file: File) {
    setUploading(true);
    setPdfUploadStatus("Subiendo PDF...");

    try {
      validateUploadFile(file, "pdf");
      const pdfUrl = hasSupabaseAdminSession
        ? await uploadTripPdf(file)
        : await storeLocalFile(file);
      setEditingTrip((current) => ({ ...current, pdfUrl }));
      setPdfUploadStatus(
        hasSupabaseAdminSession
          ? "PDF subido. Guarda el viaje para publicarlo."
          : "PDF guardado en este dispositivo. No publicado en Internet.",
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "No se pudo subir el PDF.";
      setPdfUploadStatus(message);
    } finally {
      setUploading(false);
    }
  }

  async function handlePassengerImageUpload(file: File) {
    setUploading(true);
    setPassengerUploadStatus("Subiendo imagen...");

    try {
      validateUploadFile(file, "image");
      const imageUrl = hasSupabaseAdminSession
        ? await uploadPassengerImage(file)
        : await storeLocalFile(file);
      setEditingPassengerPhoto((current) => ({ ...current, imageUrl }));
      setPassengerUploadStatus(
        hasSupabaseAdminSession
          ? "Imagen subida. Guarda la foto para publicarla."
          : "Imagen guardada en este dispositivo. No publicada en Internet.",
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "No se pudo subir la imagen.";
      setPassengerUploadStatus(message);
    } finally {
      setUploading(false);
    }
  }

  async function handleDeletePassengerPhoto(id: string) {
    if (!(await confirmDelete("Seguro que queres borrar esta foto?"))) return;

    try {
      let deletedInSupabase = false;

      if (
        passengerPhotos.find((photo) => photo.id === id)?.source === "supabase"
      ) {
        if (!hasSupabaseAdminSession)
          throw new Error(
            "Conecta el admin de Supabase para borrar esta foto publicada.",
          );
        await deletePassengerPhotoFromSupabase(id);
        deletedInSupabase = true;
      }
      setPassengerPhotos((current) =>
        current.filter((photo) => photo.id !== id),
      );
      if (editingPassengerPhoto.id === id)
        setEditingPassengerPhoto(blankPassengerPhoto);
      setActiveImage(0);
      setDataStatus(
        deletedInSupabase
          ? "Foto borrada de Supabase."
          : "Foto borrada localmente.",
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "No se pudo borrar la foto.";
      setDataStatus(message);
    }
  }

  function nextPassengerImage(direction: number) {
    setActiveImage((current) => {
      const next = current + direction;
      if (next < 0) return passengerPhotos.length - 1;
      if (next >= passengerPhotos.length) return 0;
      return next;
    });
  }

  const destinationTiles =
    featuredTrips.length > 0 ? featuredTrips : trips.slice(0, 3);

  return (
    <div className="min-h-screen bg-transparent text-foreground transition-colors">
      <Header
        currentPage={page}
        darkMode={darkMode}
        mobileMenuOpen={mobileMenuOpen}
        onToggleDarkMode={() => {
          setDarkMode((current) => {
            const nextTheme = !current;
            applyThemePreference(nextTheme);
            return nextTheme;
          });
        }}
        onToggleMenu={() => setMobileMenuOpen((current) => !current)}
        onNavigate={goTo}
      />

      <main>
        {page === "admin" && isAdmin && <AdminNavigation />}
        {page === "inicio" && (
          <HomePage
            featuredTrips={featuredTrips}
            destinationTiles={destinationTiles}
            onNavigate={goTo}
          />
        )}
        {page === "viajes" && (
          <TripsPage
            trips={[...trips].sort(
              (a, b) =>
                Number(Boolean(b.featured)) - Number(Boolean(a.featured)),
            )}
          />
        )}
        {page === "comunidad" && (
          <CommunityPage
            comments={comments}
            activeImage={activeImage}
            passengerPhotos={passengerPhotos}
            onNextImage={nextPassengerImage}
          />
        )}
        {page === "admin" && !sessionReady && (
          <section className="mx-auto max-w-xl px-4 py-16">
            {sessionStatus === "checking" ? (
              <p role="status" className="surface-card p-6 text-center">
                Comprobando tu sesión…
              </p>
            ) : (
              <div className="surface-card space-y-4 p-6">
                <p role="alert">
                  No se pudo comprobar tu sesión. Revisá la conexión y volvé a
                  intentar.
                </p>
                <button
                  type="button"
                  className="btn-primary"
                  onClick={() => void checkSession()}
                >
                  Reintentar
                </button>
              </div>
            )}
          </section>
        )}
        {page === "admin" && sessionReady && (showingEditor || !isAdmin) && (
          <AdminPage
            uploading={uploading}
            isAdmin={isAdmin}
            loginError={loginError}
            trips={trips}
            editingTrip={editingTrip}
            onLogin={handleLogin}
            onLogout={() => {
              void logout();
              setEditingTrip(blankTrip);
              setEditingPassengerPhoto(blankPassengerPhoto);
            }}
            onSubmitTrip={handleSubmitTrip}
            onUpdateTripField={updateTripField}
            onEditTrip={editTrip}
            onDeleteTrip={handleDeleteTrip}
            onResetTrip={() => setEditingTrip(blankTrip)}
            onUploadTripImage={handleTripImageUpload}
            onUploadTripPdf={handleTripPdfUpload}
            imageUploadStatus={imageUploadStatus}
            pdfUploadStatus={pdfUploadStatus}
            passengerPhotos={passengerPhotos}
            editingPassengerPhoto={editingPassengerPhoto}
            passengerUploadStatus={passengerUploadStatus}
            dataStatus={dataStatus}
            hasSupabaseAdminSession={hasSupabaseAdminSession}
            isSavingTrip={isSavingTrip}
            isSavingPassengerPhoto={isSavingPassengerPhoto}
            isRefreshingData={isRefreshingData}
            onRefreshData={() => void refreshSupabaseData()}
            onSubmitPassengerPhoto={handleSubmitPassengerPhoto}
            onUpdatePassengerPhotoField={updatePassengerPhotoField}
            onUploadPassengerImage={handlePassengerImageUpload}
            onEditPassengerPhoto={editPassengerPhoto}
            onDeletePassengerPhoto={handleDeletePassengerPhoto}
            onResetPassengerPhoto={() =>
              setEditingPassengerPhoto(blankPassengerPhoto)
            }
          />
        )}
        {page === "admin" && showingReceipts && isAdmin && (
          <ReceiptWorkspace
            onLogout={() => {
              void logout();
            }}
          />
        )}
        {isAdmin && pathname === "/admin/egresos" && (
          <ExpensesWorkspace onLogout={() => void logout()} />
        )}
        {isAdmin && pathname === "/admin/cotizaciones" && (
          <QuotationsWorkspace onLogout={() => void logout()} />
        )}
        {isAdmin && pathname === "/admin/estadisticas" && (
          <StatisticsDashboard onLogout={() => void logout()} />
        )}
      </main>

      {page === "admin" && showingEditor && isAdmin && (
        <AdminComments
          comments={comments}
          onChange={setComments}
          connected={hasSupabaseAdminSession}
          syncError={commentsError}
        />
      )}
      <Footer onNavigate={goTo} />
      {confirmation && (
        <DeleteConfirmation
          message={confirmation.message}
          onResolve={(confirmed) => {
            confirmation.resolve(confirmed);
            setConfirmation(null);
          }}
        />
      )}
    </div>
  );
}

export default App;
