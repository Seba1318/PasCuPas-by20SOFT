import { useEffect, useRef, useState } from 'react';
import { Camera, ImagePlus, CircleAlert } from 'lucide-react';
import { copyToMemory, UNREADABLE_PHOTO, validatePhoto } from '../../reports/validatePhoto.js';
import Spot from '../../ui/Spot.jsx';

/**
 * Poza raportului. Telefon (E4): „Deschide camera” sau „alege din galerie”.
 * Desktop (W14, W15): zonă în care tragi poza sau alegi un fișier. Erorile spun motivul (G6).
 */
export default function PhotoPicker({ phone, file, onChange, error, onError }) {
  const camera = useRef(null);
  const gallery = useRef(null);
  const [over, setOver] = useState(false);
  const [preview, setPreview] = useState(null);

  useEffect(() => {
    if (!file) {
      setPreview(null);
      return undefined;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const accept = async (f) => {
    if (!f) return;
    let problem;
    let copy = null;
    try {
      problem = await validatePhoto(f);
      if (!problem) copy = await copyToMemory(f);
    } catch {
      problem = UNREADABLE_PHOTO;
    }
    if (problem) {
      onChange(null);
      onError(problem);
    } else {
      onError(null);
      onChange(copy);
    }
  };

  const inputs = (
    <>
      <input
        ref={camera}
        type="file"
        accept="image/jpeg,image/png"
        capture="environment"
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
        onChange={(e) => accept(e.target.files?.[0])}
      />
      <input
        ref={gallery}
        id="report-photo"
        type="file"
        accept="image/jpeg,image/png"
        className="sr-only"
        aria-invalid={error ? true : undefined}
        aria-describedby="report-photo-help"
        onChange={(e) => accept(e.target.files?.[0])}
      />
    </>
  );

  return (
    <div className="flex flex-col gap-2">
      <span id="report-photo-label" className="text-label">
        Poză
      </span>
      {inputs}
      {preview && !error && (
        <div className="flex items-center gap-3 rounded-field border-2 border-success bg-success-bg p-2">
          <img src={preview} alt="Poza aleasă" className="h-20 w-20 flex-none rounded-icon object-cover" />
          <span className="flex-1 break-all text-[17px] font-semibold">{file.name}</span>
          <button
            type="button"
            onClick={() => gallery.current?.click()}
            className="h-12 flex-none rounded-icon px-3 text-[17px] font-bold underline underline-offset-2 hover:bg-surface"
          >
            Schimbă
          </button>
        </div>
      )}
      {error && (
        <div className="flex flex-col items-center gap-2 rounded-card border-2 border-error bg-error-bg p-4 text-center">
          <Spot kind="photo" w={140} />
          <div role="alert" className="flex items-start gap-2 text-left">
            <CircleAlert aria-hidden="true" className="mt-0.5 h-[22px] w-[22px] flex-none text-error" strokeWidth={2.5} />
            <span className="flex flex-col">
              <span className="text-[18px] font-bold">Nu am putut folosi poza</span>
              <span className="text-[17px] leading-6">{error}</span>
            </span>
          </div>
        </div>
      )}
      {!preview || error ? (
        phone ? (
          <div className="flex flex-col gap-2">
            <button
              type="button"
              onClick={() => camera.current?.click()}
              className="flex h-14 items-center justify-center gap-2.5 rounded-field bg-primary text-[18px] font-bold text-on-primary hover:bg-primary-hover"
            >
              <Camera aria-hidden="true" className="h-6 w-6" strokeWidth={2.5} />
              {error ? 'Fă o poză nouă' : 'Deschide camera'}
            </button>
            <button
              type="button"
              onClick={() => gallery.current?.click()}
              className="flex h-12 items-center justify-center rounded-field text-[17px] font-bold text-info underline underline-offset-2 hover:bg-info-bg"
            >
              {error ? 'Alege altă poză din galerie' : 'sau alege din galerie'}
            </button>
          </div>
        ) : (
          <label
            htmlFor="report-photo"
            onDragOver={(e) => {
              e.preventDefault();
              setOver(true);
            }}
            onDragLeave={() => setOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setOver(false);
              accept(e.dataTransfer.files?.[0]);
            }}
            className={`flex min-h-[132px] cursor-pointer flex-col items-center justify-center gap-2 rounded-card border-[3px] border-dashed p-4 text-center has-[:focus-visible]:outline ${
              over ? 'border-info bg-info-bg' : 'border-border-strong bg-surface hover:bg-subtle'
            }`}
          >
            <ImagePlus aria-hidden="true" className="h-8 w-8" strokeWidth={2.25} />
            <span className="text-[18px] font-bold">{over ? 'Eliberează ca să adaugi poza' : error ? 'Alege altă poză' : 'Trage poza aici sau alege un fișier'}</span>
          </label>
        )
      ) : null}
      <span id="report-photo-help" className="text-caption text-ink-muted">
        JPEG sau PNG, max. 8 MB. Poza se salvează fără metadate și se șterge după 30 de zile.
      </span>
    </div>
  );
}
