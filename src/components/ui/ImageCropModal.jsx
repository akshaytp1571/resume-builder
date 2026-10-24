import React, { useState, useRef, useCallback, useEffect } from 'react';
import { X, Move, RotateCw, ZoomIn, ZoomOut, RefreshCw } from 'lucide-react';
import { sound } from '../../utils/soundEffects';
import ModalShell from './ModalShell';
import { Button, IconButton } from './primitives';

const FRAME_SHAPES = [
  { id: 'square-frame', label: 'Square' },
  { id: 'rounded', label: 'Rounded' },
  { id: 'circle', label: 'Circle' },
];

/** The mask preview radius. 0 for the square frame — the default. */
function frameRadius(shape) {
  if (shape === 'circle') return '50%';
  if (shape === 'rounded') return '6px';
  return 0;
}

export default function ImageCropModal({
  isOpen,
  onClose,
  imageSrc,
  initialCrop,
  photoStyle = 'square-frame',
  onApplyCrop,
}) {
  const [zoom, setZoom] = useState(initialCrop?.zoom || 1);
  const [position, setPosition] = useState({
    x: initialCrop?.x || 0,
    y: initialCrop?.y || 0,
  });
  const [rotation, setRotation] = useState(initialCrop?.rotation || 0);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [aspectShape, setAspectShape] = useState(photoStyle || 'square-frame');

  // Reset the editor whenever a different image (or a different saved crop)
  // is handed to us. Doing this during render instead of in an effect avoids
  // a cascading render and the one-frame flash of the previous photo.
  const [resetKey, setResetKey] = useState(imageSrc);
  if (resetKey !== imageSrc) {
    setResetKey(imageSrc);
    setZoom(initialCrop?.zoom || 1);
    setPosition({ x: initialCrop?.x || 0, y: initialCrop?.y || 0 });
    setRotation(initialCrop?.rotation || 0);
    setAspectShape(photoStyle || 'square-frame');
  }

  const viewportRef = useRef(null);
  const imageRef = useRef(null);

  // Handle Dragging
  const handleMouseDown = (e) => {
    e.preventDefault();
    setIsDragging(true);
    setDragStart({
      x: e.clientX - position.x,
      y: e.clientY - position.y,
    });
  };

  const handleMouseMove = useCallback(
    (e) => {
      if (!isDragging) return;
      setPosition({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      });
    },
    [isDragging, dragStart]
  );

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Track the drag on the window, not on a wrapper: ModalShell owns the
  // backdrop, so there is no full-viewport div left to catch moves once the
  // cursor leaves the panel. Without this the photo stops panning mid-drag.
  useEffect(() => {
    if (!isDragging) return;
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, handleMouseMove]);

  // Touch Support for mobile/tablets
  const handleTouchStart = (e) => {
    if (e.touches.length === 1) {
      setIsDragging(true);
      setDragStart({
        x: e.touches[0].clientX - position.x,
        y: e.touches[0].clientY - position.y,
      });
    }
  };

  const handleTouchMove = (e) => {
    if (!isDragging || e.touches.length !== 1) return;
    setPosition({
      x: e.touches[0].clientX - dragStart.x,
      y: e.touches[0].clientY - dragStart.y,
    });
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
  };

  // Wheel Zoom
  const handleWheel = (e) => {
    e.preventDefault();
    const delta = e.deltaY * -0.0015;
    setZoom((prev) => Math.min(3.5, Math.max(0.6, prev + delta)));
  };

  // Quick Zoom adjustments
  const handleZoomIn = () => {
    sound.playBlip(750, 1000, 0.02);
    setZoom((prev) => Math.min(3.5, Number((prev + 0.15).toFixed(2))));
  };

  const handleZoomOut = () => {
    sound.playBlip(1000, 750, 0.02);
    setZoom((prev) => Math.max(0.6, Number((prev - 0.15).toFixed(2))));
  };

  const handleRotate = () => {
    sound.playAction();
    setRotation((prev) => (prev + 90) % 360);
  };

  const handleReset = () => {
    sound.playAction();
    setZoom(1);
    setPosition({ x: 0, y: 0 });
    setRotation(0);
  };

  // Generate cropped image on canvas
  const handleApply = () => {
    sound.playSuccess();
    if (!imageRef.current || !viewportRef.current) {
      onClose();
      return;
    }

    const img = imageRef.current;
    const viewport = viewportRef.current;
    const viewportRect = viewport.getBoundingClientRect();
    const outputSize = 480; // High-res square output (480x480px)

    const canvas = document.createElement('canvas');
    canvas.width = outputSize;
    canvas.height = outputSize;
    const ctx = canvas.getContext('2d');

    // Fill white background for transparency safety
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, outputSize, outputSize);

    // Calculate scale factor from viewport to output canvas
    const scaleToCanvas = outputSize / viewportRect.width;

    ctx.save();
    // Center canvas
    ctx.translate(outputSize / 2, outputSize / 2);
    // Apply position offset scaled to canvas
    ctx.translate(position.x * scaleToCanvas, position.y * scaleToCanvas);
    // Apply rotation
    ctx.rotate((rotation * Math.PI) / 180);
    // Apply zoom
    ctx.scale(zoom, zoom);

    // Calculate image base display dimensions in viewport
    const imgAspect = img.naturalWidth / img.naturalHeight;
    let baseWidth, baseHeight;

    if (imgAspect >= 1) {
      baseHeight = viewportRect.height;
      baseWidth = baseHeight * imgAspect;
    } else {
      baseWidth = viewportRect.width;
      baseHeight = baseWidth / imgAspect;
    }

    const canvasImgW = baseWidth * scaleToCanvas;
    const canvasImgH = baseHeight * scaleToCanvas;

    // Draw centered
    ctx.drawImage(
      img,
      -canvasImgW / 2,
      -canvasImgH / 2,
      canvasImgW,
      canvasImgH
    );
    ctx.restore();

    // Export high-quality JPEG
    const croppedDataUrl = canvas.toDataURL('image/jpeg', 0.95);

    onApplyCrop({
      croppedPhoto: croppedDataUrl,
      rawPhoto: imageSrc,
      cropSettings: {
        zoom,
        x: position.x,
        y: position.y,
        rotation,
        photoStyle: aspectShape,
      },
    });

    onClose();
  };

  if (!isOpen || !imageSrc) return null;

  return (
    <ModalShell onClose={onClose} labelledBy="image-crop-title" className="max-w-lg">
      {/* Header */}
      <div className="flex items-start justify-between border-b border-rule bg-housing px-4 py-3">
        <div className="min-w-0">
          <div className="flex items-baseline gap-2.5">
            <span className="dt-serif text-[13px] text-signal">IMG</span>
            <h2 id="image-crop-title" className="dt-label text-bone">
              Photo Framing &amp; Position
            </h2>
          </div>
          <p className="dt-data mt-1 text-bone-32">
            Drag to pan • Scroll to zoom • Calibrate alignment
          </p>
        </div>
        <button
          type="button"
          aria-label="Close photo framing dialog"
          onClick={() => {
            sound.playAction();
            onClose();
          }}
          className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-[2px] border border-transparent text-bone-52 transition-colors duration-[90ms] hover:bg-[rgba(237,232,220,0.05)] hover:text-bone"
        >
          <X size={15} aria-hidden="true" />
        </button>
      </div>

      {/* Body */}
      <div className="space-y-5 overflow-y-auto p-4 text-[13px] sm:p-5">
        {/* Frame mask: mono segmented hairline */}
        <div className="flex items-center justify-between gap-2">
          <span className="dt-label text-bone-52">Frame Mask</span>
          <div className="flex items-center overflow-hidden rounded-[2px] border border-rule-2">
            {FRAME_SHAPES.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => {
                  sound.playAction();
                  setAspectShape(s.id);
                }}
                aria-pressed={aspectShape === s.id}
                className={`cursor-pointer px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.08em] transition-colors duration-[90ms] ${
                  aspectShape === s.id
                    ? 'bg-signal text-void'
                    : 'text-bone-70 hover:bg-[rgba(237,232,220,0.05)] hover:text-bone'
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        {/* Interactive cropper viewport — behaviour unchanged, chrome calmed. */}
        <div className="flex items-center justify-center py-2">
          <div
            ref={viewportRef}
            onMouseDown={handleMouseDown}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            onWheel={handleWheel}
            title="Click and drag to reposition • Scroll to zoom"
            className="relative flex h-64 w-64 cursor-grab items-center justify-center overflow-hidden border border-rule-2 bg-void active:cursor-grabbing sm:h-72 sm:w-72"
            style={{ borderRadius: frameRadius(aspectShape) }}
          >
            {/* Center crosshair guides */}
            <div className="pointer-events-none absolute inset-0 z-10">
              <div className="absolute left-0 right-0 top-1/2 h-px -translate-y-1/2 bg-[var(--rule-2)]" />
              <div className="absolute bottom-0 left-1/2 top-0 w-px -translate-x-1/2 bg-[var(--rule-2)]" />
            </div>

            {/* The image subject */}
            <img
              ref={imageRef}
              src={imageSrc}
              alt="Framing preview"
              draggable={false}
              style={{
                transform: `translate(${position.x}px, ${position.y}px) rotate(${rotation}deg) scale(${zoom})`,
                transformOrigin: 'center center',
                maxWidth: 'none',
                maxHeight: 'none',
                transition: isDragging ? 'none' : 'transform 0.08s ease-out',
              }}
              className="pointer-events-none min-h-full min-w-full select-none object-cover"
            />

            {/* Drag affordance */}
            <span className="pointer-events-none absolute bottom-2 left-1/2 z-20 flex -translate-x-1/2 items-center gap-1">
              <Move size={10} className="text-signal" aria-hidden="true" />
              <span className="dt-label text-bone-70">Drag to Pan</span>
            </span>
          </div>
        </div>

        {/* Precision controls */}
        <div className="border-t border-rule pt-3">
          {/* Zoom slider */}
          <div>
            <div className="mb-1 flex items-baseline justify-between gap-2">
              <span className="dt-label text-bone-52">Zoom &amp; Magnification</span>
              <span className="dt-data text-bone-70">{Math.round(zoom * 100)}%</span>
            </div>
            <div className="flex items-center gap-2">
              <IconButton size="sm" label="Zoom out" title="Zoom Out" onClick={handleZoomOut}>
                <ZoomOut size={13} aria-hidden="true" />
              </IconButton>
              <input
                type="range"
                min="0.6"
                max="3.0"
                step="0.05"
                value={zoom}
                onChange={(e) => setZoom(parseFloat(e.target.value))}
                aria-label="Zoom & Magnification"
                className="h-[3px] flex-1 cursor-pointer appearance-none bg-[var(--rule)]"
                style={{ accentColor: 'var(--signal)' }}
              />
              <IconButton size="sm" label="Zoom in" title="Zoom In" onClick={handleZoomIn}>
                <ZoomIn size={13} aria-hidden="true" />
              </IconButton>
            </div>
          </div>

          {/* X / Y position sliders */}
          <div className="mt-3 grid grid-cols-2 gap-3">
            <div>
              <div className="mb-1 flex items-baseline justify-between gap-2">
                <span className="dt-label text-bone-32">Pan X</span>
                <span className="dt-data text-bone-70">{position.x}px</span>
              </div>
              <input
                type="range"
                min="-150"
                max="150"
                step="1"
                value={position.x}
                onChange={(e) => setPosition({ ...position, x: parseInt(e.target.value, 10) })}
                aria-label="Pan Horizontal (X)"
                className="h-[3px] w-full cursor-pointer appearance-none bg-[var(--rule)]"
                style={{ accentColor: 'var(--signal)' }}
              />
            </div>

            <div>
              <div className="mb-1 flex items-baseline justify-between gap-2">
                <span className="dt-label text-bone-32">Pan Y</span>
                <span className="dt-data text-bone-70">{position.y}px</span>
              </div>
              <input
                type="range"
                min="-150"
                max="150"
                step="1"
                value={position.y}
                onChange={(e) => setPosition({ ...position, y: parseInt(e.target.value, 10) })}
                aria-label="Pan Vertical (Y)"
                className="h-[3px] w-full cursor-pointer appearance-none bg-[var(--rule)]"
                style={{ accentColor: 'var(--signal)' }}
              />
            </div>
          </div>

          {/* Rotate / reset */}
          <div className="mt-3 flex items-center justify-between gap-2 border-t border-rule pt-2">
            <Button size="sm" onClick={handleRotate} title="Rotate 90 degrees clockwise">
              <RotateCw size={12} aria-hidden="true" />
              <span>Rotate 90°</span>
            </Button>
            <Button size="sm" onClick={handleReset} title="Reset zoom and center position">
              <RefreshCw size={12} aria-hidden="true" />
              <span>Reset Center</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="flex justify-end gap-2 border-t border-rule bg-housing px-4 py-2.5">
        <Button
          onClick={() => {
            sound.playAction();
            onClose();
          }}
          className="mr-auto"
        >
          Cancel
        </Button>

        <Button variant="signal" onClick={handleApply}>
          <span>Apply Crop &amp; Save</span>
        </Button>
      </div>
    </ModalShell>
  );
}
