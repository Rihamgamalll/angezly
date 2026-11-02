import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react';

import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Camera,
  FlipHorizontal2,
  ImagePlus,
  RotateCcw,
  RotateCw,
  Trash2,
  Undo2,
  ZoomIn,
} from 'lucide-react';

import { Alert, Button } from '@/components/ui';
import { getErrorMessage } from '@/lib/format';
import { supabase } from '@/lib/supabase';

// ========================================
// Types
// ========================================

type Kind = 'doctor' | 'teacher';

type Props = {
  kind: Kind;
  professionalId: string;
  initialPhotoUrl: string | null;
  onSaved: () => void;
};

type Offset = {
  x: number;
  y: number;
};

// ========================================
// Settings
// ========================================

const BUCKET = 'professional-avatars';

const MAX_UPLOAD_BYTES = 2 * 1024 * 1024;

const MAX_SOURCE_BYTES = 10 * 1024 * 1024;

const EDITOR_SIZE = 320;

const EXPORT_SIZE = 640;

const ALLOWED_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
]);

// ========================================
// Helpers
// ========================================

function radians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

function clamp(
  value: number,
  min: number,
  max: number
): number {
  return Math.max(min, Math.min(value, max));
}

// ========================================
// Image Scaling
// ========================================

function coverScale(
  img: HTMLImageElement,
  angle: number,
  zoom: number
): number {
  const cosine = Math.abs(Math.cos(radians(angle)));

  const sine = Math.abs(Math.sin(radians(angle)));

  return (
    (EDITOR_SIZE * (cosine + sine)) /
    Math.min(img.naturalWidth, img.naturalHeight)
  ) * zoom;
}

// ========================================
// Image Position
// ========================================

function boundedOffset(
  img: HTMLImageElement,
  angle: number,
  zoom: number,
  proposed: Offset
): Offset {
  const theta = radians(angle);

  const c = Math.cos(theta);
  const s = Math.sin(theta);

  const scale = coverScale(img, angle, zoom);

  const extent =
    EDITOR_SIZE * (Math.abs(c) + Math.abs(s));

  const maxLocalX = Math.max(
    0,
    (img.naturalWidth * scale - extent) / 2
  );

  const maxLocalY = Math.max(
    0,
    (img.naturalHeight * scale - extent) / 2
  );

  const localX = clamp(
    proposed.x * c + proposed.y * s,
    -maxLocalX,
    maxLocalX
  );

  const localY = clamp(
    -proposed.x * s + proposed.y * c,
    -maxLocalY,
    maxLocalY
  );

  return {
    x: localX * c - localY * s,
    y: localX * s + localY * c,
  };
}

// ========================================
// Draw Image
// ========================================

function paintImage(
  canvas: HTMLCanvasElement,
  img: HTMLImageElement,
  angle: number,
  zoom: number,
  position: Offset,
  mirrored: boolean
) {
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    throw new Error(
      'لا يمكن تعديل الصور من هذا المتصفح.'
    );
  }

  const factor = canvas.width / EDITOR_SIZE;

  const offset = boundedOffset(
    img,
    angle,
    zoom,
    position
  );

  ctx.save();

  ctx.setTransform(
    factor,
    0,
    0,
    factor,
    0,
    0
  );

  ctx.clearRect(
    0,
    0,
    EDITOR_SIZE,
    EDITOR_SIZE
  );

  ctx.fillStyle = '#f8faf8';

  ctx.fillRect(
    0,
    0,
    EDITOR_SIZE,
    EDITOR_SIZE
  );

  ctx.translate(
    EDITOR_SIZE / 2 + offset.x,
    EDITOR_SIZE / 2 + offset.y
  );

  ctx.rotate(radians(angle));

  if (mirrored) {
    ctx.scale(-1, 1);
  }

  const scale = coverScale(
    img,
    angle,
    zoom
  );

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  ctx.drawImage(
    img,
    -img.naturalWidth * scale / 2,
    -img.naturalHeight * scale / 2,
    img.naturalWidth * scale,
    img.naturalHeight * scale
  );

  ctx.restore();
}

// ========================================
// Convert Image To JPEG
// ========================================

function toJpegBlob(
  canvas: HTMLCanvasElement,
  quality: number
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(
            new Error('تعذّر تجهيز الصورة.')
          );
        }
      },
      'image/jpeg',
      quality
    );
  });
}

// ========================================
// Export Cropped Image
// ========================================

async function croppedPhoto(
  img: HTMLImageElement,
  angle: number,
  zoom: number,
  offset: Offset,
  mirrored: boolean
): Promise<File> {
  const canvas = document.createElement('canvas');

  canvas.width = EXPORT_SIZE;
  canvas.height = EXPORT_SIZE;

  paintImage(
    canvas,
    img,
    angle,
    zoom,
    offset,
    mirrored
  );

  let blob: Blob | null = null;

  for (const quality of [0.9, 0.8, 0.68]) {
    blob = await toJpegBlob(
      canvas,
      quality
    );

    if (blob.size <= MAX_UPLOAD_BYTES) {
      break;
    }
  }

  if (!blob || blob.size > MAX_UPLOAD_BYTES) {
    throw new Error(
      'حجم الصورة بعد التعديل كبير. اختاري صورة أخرى.'
    );
  }

  return new File(
    [blob],
    'profile-photo.jpg',
    {
      type: 'image/jpeg',
    }
  );
}

// ========================================
// Stored Photo Path
// ========================================

function ownStoredPhoto(
  url: string | null,
  kind: Kind,
  professionalId: string
): string | null {
  if (!url) return null;

  try {
    const parsed = new URL(url);

    if (
      parsed.origin !==
      new URL(
        import.meta.env.VITE_SUPABASE_URL
      ).origin
    ) {
      return null;
    }

    const marker =
      `/storage/v1/object/public/${BUCKET}/`;

    if (!parsed.pathname.startsWith(marker)) {
      return null;
    }

    const path = decodeURIComponent(
      parsed.pathname.slice(marker.length)
    );

    return path.startsWith(
      `${kind}/${professionalId}/`
    )
      ? path
      : null;

  } catch {
    return null;
  }
}

// ========================================
// Main Component
// ========================================

export function ProfessionalPhotoEditor({
  kind,
  professionalId,
  initialPhotoUrl,
  onSaved,
}: Props) {

  // ========================================
  // State
  // ========================================

  const [currentUrl, setCurrentUrl] =
    useState<string | null>(initialPhotoUrl);

  const [chosenFile, setChosenFile] =
    useState<File | null>(null);

  const [image, setImage] =
    useState<HTMLImageElement | null>(null);

  const [zoom, setZoom] = useState(1);

  const [quarterTurn, setQuarterTurn] =
    useState(0);

  const [straighten, setStraighten] =
    useState(0);

  const [offset, setOffset] = useState<Offset>({
    x: 0,
    y: 0,
  });

  const [mirrored, setMirrored] =
    useState(false);

  const [busy, setBusy] = useState(false);

  const [error, setError] = useState('');

  const [success, setSuccess] = useState('');

  const [inputKey, setInputKey] =
    useState(0);

  // ========================================
  // Refs
  // ========================================

  const canvasRef =
    useRef<HTMLCanvasElement>(null);

  const dragRef = useRef<{
    x: number;
    y: number;
    pointerId: number;
  } | null>(null);

  const angle =
    quarterTurn * 90 + straighten;

  // ========================================
  // Sync Current Photo
  // ========================================

  useEffect(() => {
    setCurrentUrl(initialPhotoUrl);
  }, [
    kind,
    professionalId,
    initialPhotoUrl,
  ]);

  // ========================================
  // Load Selected Image
  // ========================================

  useEffect(() => {
    if (!chosenFile) {
      setImage(null);
      return;
    }

    let active = true;

    const url = URL.createObjectURL(chosenFile);

    const loaded = new Image();

    loaded.onload = () => {
      if (
        active &&
        loaded.naturalWidth > 0 &&
        loaded.naturalHeight > 0
      ) {
        setImage(loaded);
      }
    };

    loaded.onerror = () => {
      if (active) {
        setError(
          'تعذّر فتح الصورة. اختاري ملف صورة آخر.'
        );
      }
    };

    loaded.src = url;

    return () => {
      active = false;
      URL.revokeObjectURL(url);
    };

  }, [chosenFile]);

  // ========================================
  // Live Image Preview
  // ========================================

  useEffect(() => {
    if (!image || !canvasRef.current) {
      return;
    }

    try {
      paintImage(
        canvasRef.current,
        image,
        angle,
        zoom,
        offset,
        mirrored
      );

      const ctx =
        canvasRef.current.getContext('2d');

      if (!ctx) return;

      // Circle framing guide

      ctx.save();

      ctx.lineWidth = 1.5;

      ctx.strokeStyle =
        'rgba(255,255,255,.95)';

      ctx.setLineDash([5, 7]);

      ctx.beginPath();

      ctx.arc(
        EDITOR_SIZE / 2,
        EDITOR_SIZE / 2,
        143,
        0,
        Math.PI * 2
      );

      ctx.stroke();

      ctx.restore();

    } catch {
      setError(
        'تعذّر عرض معاينة الصورة.'
      );
    }

  }, [
    image,
    angle,
    zoom,
    offset,
    mirrored,
  ]);

  // ========================================
  // Reset Image Editor
  // ========================================

  const resetEdit = () => {
    setZoom(1);
    setQuarterTurn(0);
    setStraighten(0);
    setOffset({ x: 0, y: 0 });
    setMirrored(false);
  };

  // ========================================
  // Select Image
  // ========================================

  const chooseFile = (
    file: File | null
  ) => {
    setError('');
    setSuccess('');
    resetEdit();

    if (!file) {
      setChosenFile(null);
      return;
    }

    if (
      !ALLOWED_TYPES.has(file.type) ||
      file.size === 0 ||
      file.size > MAX_SOURCE_BYTES
    ) {
      setChosenFile(null);

      setError(
        'يرجى اختيار صورة JPG أو PNG أو WebP بحجم لا يتجاوز 10 ميجابايت.'
      );

      return;
    }

    setImage(null);

    setChosenFile(file);
  };

  // ========================================
  // Move Image
  // ========================================

  const move = (
    x: number,
    y: number
  ) => {
    if (!image) return;

    setOffset((old) =>
      boundedOffset(
        image,
        angle,
        zoom,
        {
          x: old.x + x,
          y: old.y + y,
        }
      )
    );
  };

  // ========================================
  // Drag Start
  // ========================================

  const onPointerDown = (
    event: ReactPointerEvent<HTMLCanvasElement>
  ) => {
    if (
      !image ||
      busy ||
      event.button !== 0
    ) {
      return;
    }

    dragRef.current = {
      x: event.clientX,
      y: event.clientY,
      pointerId: event.pointerId,
    };

    event.currentTarget.setPointerCapture(
      event.pointerId
    );
  };

  // ========================================
  // Drag Move
  // ========================================

  const onPointerMove = (
    event: ReactPointerEvent<HTMLCanvasElement>
  ) => {
    if (
      !dragRef.current ||
      dragRef.current.pointerId !==
        event.pointerId
    ) {
      return;
    }

    const bounds =
      event.currentTarget.getBoundingClientRect();

    const factor =
      EDITOR_SIZE / bounds.width;

    const dx =
      (event.clientX - dragRef.current.x) *
      factor;

    const dy =
      (event.clientY - dragRef.current.y) *
      factor;

    dragRef.current = {
      x: event.clientX,
      y: event.clientY,
      pointerId: event.pointerId,
    };

    move(dx, dy);
  };

  // ========================================
  // Drag End
  // ========================================

  const endDrag = (
    event: ReactPointerEvent<HTMLCanvasElement>
  ) => {
    if (
      dragRef.current?.pointerId ===
      event.pointerId
    ) {
      dragRef.current = null;
    }

    if (
      event.currentTarget.hasPointerCapture(
        event.pointerId
      )
    ) {
      event.currentTarget.releasePointerCapture(
        event.pointerId
      );
    }
  };

  // ========================================
  // Upload Photo To Supabase
  // ========================================

  const uploadPhoto = async (
    event: FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();

    if (!chosenFile || !image || busy) {
      return;
    }

    setError('');
    setSuccess('');
    setBusy(true);

    try {
      const path =
        `${kind}/${professionalId}/${crypto.randomUUID()}.jpg`;

      const file = await croppedPhoto(
        image,
        angle,
        zoom,
        offset,
        mirrored
      );

      const { error: uploadError } =
        await supabase.storage
          .from(BUCKET)
          .upload(path, file, {
            upsert: false,
            contentType: 'image/jpeg',
            cacheControl: '3600',
          });

      if (uploadError) {
        throw uploadError;
      }

      const { data } =
        supabase.storage
          .from(BUCKET)
          .getPublicUrl(path);

      const nextUrl = data.publicUrl;

      const table =
        kind === 'doctor'
          ? 'doctors'
          : 'teachers';

      const {
        data: changed,
        error: updateError,
      } = await supabase
        .from(table)
        .update({
          photo_url: nextUrl,
        })
        .eq('id', professionalId)
        .select('id')
        .maybeSingle();

      if (updateError || !changed) {
        await supabase.storage
          .from(BUCKET)
          .remove([path]);

        throw (
          updateError ||
          new Error(
            'لم يتم حفظ الصورة في ملفك.'
          )
        );
      }

      const previousPath = ownStoredPhoto(
        currentUrl,
        kind,
        professionalId
      );

      setCurrentUrl(nextUrl);

      setChosenFile(null);

      setImage(null);

      setInputKey((key) => key + 1);

      resetEdit();

      setSuccess(
        'تم حفظ صورتك بعد التعديل، وستظهر في صفحة الحجز الخاصة بك.'
      );

      onSaved();

      if (
        previousPath &&
        previousPath !== path
      ) {
        void supabase.storage
          .from(BUCKET)
          .remove([previousPath]);
      }

    } catch (e) {
      setError(
        `تعذّر حفظ الصورة: ${getErrorMessage(e)}`
      );

    } finally {
      setBusy(false);
    }
  };

  // ========================================
  // Delete Photo
  // ========================================

  const deletePhoto = async () => {
    if (
      !currentUrl ||
      busy ||
      !window.confirm(
        'هل تريد إزالة الصورة الشخصية من صفحتك؟'
      )
    ) {
      return;
    }

    setError('');
    setSuccess('');
    setBusy(true);

    try {
      const table =
        kind === 'doctor'
          ? 'doctors'
          : 'teachers';

      const {
        data,
        error: updateError,
      } = await supabase
        .from(table)
        .update({
          photo_url: null,
        })
        .eq('id', professionalId)
        .select('id')
        .maybeSingle();

      if (updateError || !data) {
        throw (
          updateError ||
          new Error(
            'لم يتم حفظ التغيير.'
          )
        );
      }

      const path = ownStoredPhoto(
        currentUrl,
        kind,
        professionalId
      );

      setCurrentUrl(null);

      setSuccess(
        'تمت إزالة الصورة الشخصية.'
      );

      onSaved();

      if (path) {
        void supabase.storage
          .from(BUCKET)
          .remove([path]);
      }

    } catch (e) {
      setError(
        `لم تُحذف الصورة: ${getErrorMessage(e)}`
      );

    } finally {
      setBusy(false);
    }
  };

  // ========================================
  // UI
  // ========================================

  return (
    <section
      className="
        mb-6
        rounded-2xl
        border border-ink-100
        bg-ink-50
        p-4
        sm:p-5
      "
      aria-label="صورتك الشخصية"
    >

      {/* Header */}

      <div className="mb-4 flex items-start gap-3">

        <span className="rounded-xl bg-brand-50 p-2.5 text-brand-700">
          <Camera
            className="h-5 w-5"
            aria-hidden="true"
          />
        </span>

        <div>
          <h3 className="text-lg font-extrabold text-ink-900">
            صورتك الشخصية (اختياري)
          </h3>

          <p className="mt-1 text-xs leading-6 text-ink-600">
            يمكنك ضبط موضع الوجه وزاوية الصورة قبل حفظها،
            لتظهر بشكل مناسب على صفحة الحجز.
          </p>
        </div>

      </div>

      <form
        onSubmit={uploadPhoto}
        className="space-y-4"
      >

        {/* Current Photo */}

        <div className="flex flex-wrap items-start gap-4">

          <div
            className="
              flex h-24 w-24
              shrink-0
              items-center justify-center
              overflow-hidden
              rounded-2xl
              bg-white
              text-brand-600
              ring-1 ring-ink-100
            "
          >

            {currentUrl ? (
              <img
                src={currentUrl}
                alt="صورتك الحالية"
                className="h-full w-full object-cover"
              />
            ) : (
              <Camera
                className="h-9 w-9"
                aria-hidden="true"
              />
            )}

          </div>

          {/* File Upload */}

          <div className="min-w-0 flex-1 space-y-2">

            <label
              className="block text-sm font-bold text-ink-800"
              htmlFor={`${kind}-avatar`}
            >
              اختيار صورة جديدة
            </label>

            <input
              key={inputKey}
              id={`${kind}-avatar`}
              type="file"
              accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
              disabled={busy}
              onChange={(event) =>
                chooseFile(
                  event.target.files?.[0] || null
                )
              }
              className="
                block w-full min-w-0
                rounded-xl
                border border-ink-200
                bg-white
                p-2
                text-sm
                file:me-2
                file:rounded-lg
                file:border-0
                file:bg-brand-50
                file:px-3
                file:py-2
                file:text-brand-800
              "
            />

            <p className="text-xs leading-5 text-ink-500">
              JPG أو PNG أو WebP · حتى 10 ميجابايت
              قبل التعديل. تُحفظ الصورة مربّعة
              وبحجم مناسب تلقائيًا.
            </p>

          </div>

        </div>

        {/* Image Loading */}

        {chosenFile && !image && !error && (
          <p
            className="text-sm text-ink-500"
            role="status"
          >
            جاري تجهيز معاينة الصورة...
          </p>
        )}

        {/* Image Editor */}

        {image && (

          <div
            className="
              rounded-2xl
              border border-ink-100
              bg-white
              p-3
              sm:p-5
            "
          >

            <h4 className="mb-1 text-base font-extrabold text-ink-900">
              ضبط الصورة قبل الحفظ
            </h4>

            <p className="mb-4 text-xs leading-6 text-ink-500">
              يمكنك سحب الصورة داخل الإطار لتوسيط الوجه،
              أو استخدام الأسهم للتحريك.
              الدائرة المنقّطة دليل لمكان الوجه فقط.
            </p>

            <div className="flex flex-col gap-5 md:flex-row md:items-start">

              {/* Canvas Preview */}

              <canvas
                ref={canvasRef}
                width={EDITOR_SIZE}
                height={EDITOR_SIZE}
                role="img"
                aria-label="معاينة قص الصورة. يمكن تحريك الصورة باللمس أو الماوس أو باستخدام الأسهم."
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={endDrag}
                onPointerCancel={endDrag}
                className="
                  mx-auto
                  aspect-square
                  w-full
                  max-w-[320px]
                  touch-none
                  cursor-grab
                  rounded-2xl
                  border border-ink-200
                  bg-ink-50
                  active:cursor-grabbing
                "
              />

              {/* Controls */}

              <div className="min-w-0 flex-1 space-y-4">

                {/* Zoom */}

                <div>

                  <label
                    htmlFor={`${kind}-photo-zoom`}
                    className="mb-1 flex items-center gap-2 text-sm font-bold text-ink-800"
                  >
                    <ZoomIn className="h-4 w-4" />

                    تكبير وتصغير · {Math.round(zoom * 100)}%
                  </label>

                  <input
                    id={`${kind}-photo-zoom`}
                    type="range"
                    min="1"
                    max="3"
                    step="0.05"
                    value={zoom}
                    onChange={(event) =>
                      setZoom(Number(event.target.value))
                    }
                    disabled={busy}
                    className="w-full accent-emerald-700"
                  />

                </div>

                {/* Straighten */}

                <div>

                  <label
                    htmlFor={`${kind}-photo-angle`}
                    className="mb-1 block text-sm font-bold text-ink-800"
                  >
                    تعديل الميل · {straighten}°
                  </label>

                  <input
                    id={`${kind}-photo-angle`}
                    type="range"
                    min="-30"
                    max="30"
                    step="1"
                    value={straighten}
                    onChange={(event) =>
                      setStraighten(
                        Number(event.target.value)
                      )
                    }
                    disabled={busy}
                    className="w-full accent-emerald-700"
                  />

                </div>

                {/* Rotate */}

                <div className="flex flex-wrap gap-2">

                  <button
                    type="button"
                    disabled={busy}
                    onClick={() =>
                      setQuarterTurn((n) => n - 1)
                    }
                    aria-label="تدوير الصورة 90 درجة لليسار"
                    className="inline-flex min-h-11 items-center gap-1 rounded-xl border border-ink-200 px-3 text-sm font-bold hover:bg-brand-50 disabled:opacity-50"
                  >
                    <RotateCcw className="h-4 w-4" />
                    تدوير لليسار
                  </button>

                  <button
                    type="button"
                    disabled={busy}
                    onClick={() =>
                      setQuarterTurn((n) => n + 1)
                    }
                    aria-label="تدوير الصورة 90 درجة لليمين"
                    className="inline-flex min-h-11 items-center gap-1 rounded-xl border border-ink-200 px-3 text-sm font-bold hover:bg-brand-50 disabled:opacity-50"
                  >
                    <RotateCw className="h-4 w-4" />
                    تدوير لليمين
                  </button>

                  <button
                    type="button"
                    disabled={busy}
                    onClick={() =>
                      setMirrored((v) => !v)
                    }
                    aria-label="عكس الصورة أفقيًا"
                    className="inline-flex min-h-11 items-center gap-1 rounded-xl border border-ink-200 px-3 text-sm font-bold hover:bg-brand-50 disabled:opacity-50"
                  >
                    <FlipHorizontal2 className="h-4 w-4" />
                    انعكاس
                  </button>

                </div>

                {/* Move Image */}

                <div>

                  <p className="mb-2 text-sm font-bold text-ink-800">
                    تحريك الصورة بدقة
                  </p>

                  <div
                    className="flex flex-wrap gap-2"
                    role="group"
                    aria-label="أزرار تحريك الصورة"
                  >

                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => move(0, -15)}
                      aria-label="أعلى"
                      className="flex h-11 w-11 items-center justify-center rounded-xl border border-ink-200 hover:bg-brand-50"
                    >
                      <ArrowUp className="h-5 w-5" />
                    </button>

                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => move(0, 15)}
                      aria-label="أسفل"
                      className="flex h-11 w-11 items-center justify-center rounded-xl border border-ink-200 hover:bg-brand-50"
                    >
                      <ArrowDown className="h-5 w-5" />
                    </button>

                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => move(-15, 0)}
                      aria-label="يسار"
                      className="flex h-11 w-11 items-center justify-center rounded-xl border border-ink-200 hover:bg-brand-50"
                    >
                      <ArrowLeft className="h-5 w-5" />
                    </button>

                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => move(15, 0)}
                      aria-label="يمين"
                      className="flex h-11 w-11 items-center justify-center rounded-xl border border-ink-200 hover:bg-brand-50"
                    >
                      <ArrowRight className="h-5 w-5" />
                    </button>

                  </div>

                </div>

                {/* Reset */}

                <button
                  type="button"
                  disabled={busy}
                  onClick={resetEdit}
                  className="inline-flex min-h-11 items-center gap-2 rounded-xl px-3 text-sm font-semibold text-brand-700 hover:bg-brand-50"
                >
                  <Undo2 className="h-4 w-4" />
                  إعادة ضبط الصورة
                </button>

              </div>

            </div>

          </div>

        )}

        {/* Save / Delete */}

        <div className="flex flex-wrap gap-2">

          <Button
            type="submit"
            loading={busy}
            disabled={!image || busy}
          >
            <ImagePlus
              className="h-4 w-4"
              aria-hidden="true"
            />

            حفظ الصورة بعد التعديل
          </Button>

          {currentUrl && (

            <Button
              type="button"
              variant="secondary"
              disabled={busy}
              onClick={() => void deletePhoto()}
            >
              <Trash2
                className="h-4 w-4"
                aria-hidden="true"
              />

              إزالة الصورة الحالية
            </Button>

          )}

        </div>

      </form>

      {/* Error Message */}

      {error && (
        <div className="mt-3">
          <Alert tone="error">
            {error}
          </Alert>
        </div>
      )}

      {/* Success Message */}

      {success && (
        <div className="mt-3">
          <Alert tone="success">
            {success}
          </Alert>
        </div>
      )}

    </section>
  );
}