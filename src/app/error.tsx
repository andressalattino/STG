"use client";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="mx-auto max-w-3xl px-6 py-20">
      <h1 className="text-3xl font-bold">No pudimos cargar esta página</h1>
      <p className="my-6">
        Intentá nuevamente. Los recibos emitidos permanecen guardados.
      </p>
      <button type="button" className="btn-primary" onClick={reset}>
        Reintentar
      </button>
    </main>
  );
}
