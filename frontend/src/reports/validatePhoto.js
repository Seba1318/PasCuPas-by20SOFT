// Poza raportului: doar JPEG sau PNG, maxim 8 MB, verificat după conținut (primii octeți),
// nu după extensie. Serverul verifică din nou cu Pillow; aici spunem devreme și pe înțeles.
export const MAX_PHOTO_BYTES = 8 * 1024 * 1024;

const SIGNATURES = [
  [0xff, 0xd8, 0xff], // JPEG
  [0x89, 0x50, 0x4e, 0x47], // PNG
];

const megabytes = (bytes) => Math.round(bytes / (1024 * 1024));

export async function validatePhoto(file) {
  const head = new Uint8Array(await file.slice(0, 8).arrayBuffer());
  const known = SIGNATURES.some((sig) => sig.every((byte, i) => head[i] === byte));
  if (!known) {
    return `Fișierul „${file.name}” nu e o poză JPEG sau PNG. Pozele HEIC de pe iPhone se pot salva ca JPEG din setările camerei.`;
  }
  if (file.size > MAX_PHOTO_BYTES) {
    return `Folosește o poză JPEG sau PNG de maxim 8 MB. „${file.name}” are ${megabytes(file.size)} MB.`;
  }
  return null;
}

// Copia pozei în memorie, făcută când e aleasă. Safari citește fișierul de pe disc abia la
// trimitere; dacă între timp câmpul de poză a dispărut din pagină sau fișierul s-a mutat,
// trimite o cerere goală. Cu copia, ce trimitem nu mai depinde de fișierul de pe disc.
export async function copyToMemory(file) {
  const bytes = await file.arrayBuffer();
  return new File([bytes], file.name, { type: file.type, lastModified: file.lastModified });
}

export const UNREADABLE_PHOTO =
  'Nu am putut citi poza. Dacă e în iCloud, descarc-o întâi pe dispozitiv, apoi alege-o din nou.';
