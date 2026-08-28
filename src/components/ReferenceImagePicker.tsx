import { useRef, useState, type DragEvent } from "react";
import { Image as ImageIcon, RefreshCw, Trash2, UploadCloud } from "lucide-react";

export interface PendingReferenceImage {
  filename: string;
  mimeType: "image/png" | "image/jpeg" | "image/webp";
  base64: string;
}

const mimeFor = (file: File): PendingReferenceImage["mimeType"] | undefined => {
  if (["image/png", "image/jpeg", "image/webp"].includes(file.type)) return file.type as PendingReferenceImage["mimeType"];
  const extension = file.name.toLowerCase().split(".").pop();
  if (extension === "jpg" || extension === "jpeg") return "image/jpeg";
  if (extension === "png") return "image/png";
  if (extension === "webp") return "image/webp";
  return undefined;
};

export function ReferenceImagePicker({
  value,
  onChange,
  title = "Drop a reference image here",
  detail = "PNG, JPG, JPEG, or WEBP · maximum 12 MB",
  compact = false,
}: {
  value?: PendingReferenceImage;
  onChange: (value?: PendingReferenceImage) => void;
  title?: string;
  detail?: string;
  compact?: boolean;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string>();

  const read = (file?: File) => {
    if (!file) return;
    const mimeType = mimeFor(file);
    if (!mimeType) { setError("Choose a PNG, JPG, JPEG, or WEBP image."); return; }
    if (file.size > 12 * 1024 * 1024) { setError("The image is larger than 12 MB."); return; }
    const reader = new FileReader();
    reader.onload = () => {
      setError(undefined);
      onChange({ filename: file.name, mimeType, base64: String(reader.result) });
    };
    reader.onerror = () => setError("The image could not be read.");
    reader.readAsDataURL(file);
  };
  const drop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragging(false);
    read(event.dataTransfer.files?.[0]);
  };

  return <div className={`reference-picker ${compact ? "compact" : ""} ${dragging ? "dragging" : ""} ${value ? "has-preview" : ""}`}
    onDragEnter={(event) => { event.preventDefault(); setDragging(true); }}
    onDragOver={(event) => event.preventDefault()}
    onDragLeave={() => setDragging(false)}
    onDrop={drop}>
    <input ref={input} type="file" accept=".png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp" onChange={(event) => { read(event.target.files?.[0]); event.target.value = ""; }} />
    {value ? <>
      <img src={value.base64} alt="Selected reference preview" />
      <div className="reference-picker-copy"><span className="eyebrow">Preview ready</span><strong>{value.filename}</strong><small>The protected original will be stored separately from generated sheets.</small></div>
      <div className="reference-picker-actions"><button type="button" className="button secondary" onClick={() => input.current?.click()}><RefreshCw size={13} /> Replace Image</button><button type="button" className="button danger" onClick={() => onChange(undefined)}><Trash2 size={13} /> Remove Image</button></div>
    </> : <button type="button" className="reference-picker-empty" onClick={() => input.current?.click()}>
      {compact ? <ImageIcon size={22} /> : <UploadCloud size={34} />}
      <strong>{title}</strong><span>{detail}</span><em>Choose Image</em>
    </button>}
    {error ? <p className="reference-picker-error">{error}</p> : null}
  </div>;
}
