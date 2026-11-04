interface Props {
  titulo: string;
  detalle?: string;
  /** Si se pasa, se muestra el botón "Reintentar". */
  onReintentar?: () => void;
  /** "alert" interrumpe al lector de pantalla; "status" lo anuncia sin interrumpir. */
  rol?: "alert" | "status";
}

export function AvisoError({ titulo, detalle, onReintentar, rol = "alert" }: Props) {
  return (
    <div className="aviso-error" role={rol}>
      <div className="aviso-error__texto">
        <p className="aviso-error__titulo">{titulo}</p>
        {detalle && <p className="aviso-error__detalle">{detalle}</p>}
      </div>
      {onReintentar && (
        <button type="button" className="boton" onClick={onReintentar}>
          Reintentar
        </button>
      )}
    </div>
  );
}
