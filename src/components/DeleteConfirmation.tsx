import { useEffect, useRef } from "react";

export function DeleteConfirmation({
  message,
  onResolve,
}: {
  message: string;
  onResolve: (confirmed: boolean) => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    ref.current?.showModal();
  }, []);
  return (
    <dialog
      ref={ref}
      className="delete-dialog"
      onCancel={(event) => {
        event.preventDefault();
        onResolve(false);
      }}
      aria-labelledby="delete-title"
    >
      <h2 id="delete-title" className="text-xl font-bold">
        Confirmar eliminacion
      </h2>
      <p className="mt-3 text-muted">
        {message} Esta accion no se puede deshacer.
      </p>
      <div className="mt-6 flex flex-wrap justify-end gap-3">
        <button
          type="button"
          className="btn-ghost"
          onClick={() => onResolve(false)}
        >
          Cancelar
        </button>
        <button
          type="button"
          className="btn-danger"
          onClick={() => onResolve(true)}
        >
          Eliminar
        </button>
      </div>
    </dialog>
  );
}
