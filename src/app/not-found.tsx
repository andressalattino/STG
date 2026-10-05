import Link from "next/link";
export default function NotFound() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-20">
      <h1 className="text-3xl font-bold">No encontramos esa página</h1>
      <p className="my-6 text-muted">
        Podés volver al inicio o ingresar a administración.
      </p>
      <Link href="/" className="btn-primary">
        Volver al inicio
      </Link>
    </main>
  );
}
