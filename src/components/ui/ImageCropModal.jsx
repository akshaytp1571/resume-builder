import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  X,
  Crop,
  Move,
  RotateCw,
  ZoomIn,
  ZoomOut,
  Check,
  Sliders,
  RefreshCw,
} from 'lucide-react';
import { sound } from '../../utils/soundEffects';
import ModalShell from './ModalShell';

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
        {/* Modal Header */}
        <div className="p-4 border-b border-pink-500/20 flex items-center justify-between bg-[#200824]/90 backdrop-blur-xl">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-[#2e0d34] border border-pink-500/40 flex items-center justify-center text-rose-300">
              <Crop size={18} />
            </div>
            <div>
              <h2
                id="image-crop-title"
                className="text-sm font-bold text-pink-50 tracking-wide flex items-center gap-2"
              >
                Photo Framing & Position
              </h2>
              <p className="text-[11px] text-pink-300/70">
                Drag to pan • Scroll to zoom • Calibrate alignment
              </p>
            </div>
          </div>
          <button
            type="button"
            aria-label="Close photo framing dialog"
            onClick={() => {
              sound.playAction();
              onClose();
            }}
            className="p-1.5 rounded-xl text-pink-400/60 hover:text-pink-100 hover:bg-pink-900/30 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#18071c]"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-5 space-y-4 overflow-y-auto">
          {/* Shape Frame Selector */}
          <div className="flex items-center justify-between gap-2 text-xs">
            <span className="text-[11px] font-semibold text-pink-200 tracking-wide flex items-center gap-1.5">
              <Sliders size={13} className="text-rose-400" />
              <span>Frame Mask</span>
            </span>
            <div className="flex items-center gap-1 bg-[#150518] p-1 rounded-xl border border-pink-500/25 text-[11px]">
              {[
                { id: 'square-frame', label: 'Square' },
                { id: 'rounded', label: 'Rounded' },
                { id: 'circle', label: 'Circle' },
              ].map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => {
                    sound.playAction();
                    setAspectShape(s.id);
                  }}
                  className={`px-3 py-1 rounded-lg cursor-pointer transition-all ${
                    aspectShape === s.id
                      ? 'bg-gradient-to-r from-rose-500 to-pink-600 text-white font-semibold shadow-xs'
                      : 'text-pink-300/70 hover:text-pink-100'
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* Interactive Cropper Viewport */}
          <div className="flex justify-center items-center py-2">
            <div
              ref={viewportRef}
              onMouseDown={handleMouseDown}
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
              onWheel={handleWheel}
              className={`w-64 h-64 sm:w-72 sm:h-72 relative overflow-hidden bg-[#120414] border-2 border-pink-400/70 shadow-[0_10px_35px_rgba(225,29,72,0.25)] cursor-grab active:cursor-grabbing flex items-center justify-center ${
                aspectShape === 'circle'
                  ? 'rounded-full'
                  : aspectShape === 'rounded'
                  ? 'rounded-3xl'
                  : 'rounded-xl'
              }`}
              title="Click and drag to reposition • Scroll to zoom"
            >
              {/* Center Crosshair Guides */}
              <div className="absolute inset-0 pointer-events-none z-10 border border-pink-400/20">
                <div className="absolute top-1/2 left-0 right-0 h-[1px] bg-pink-400/20 -translate-y-1/2" />
                <div className="absolute left-1/2 top-0 bottom-0 w-[1px] bg-pink-400/20 -translate-x-1/2" />
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 rounded-full border border-pink-400/30" />
              </div>

              {/* The Image Subject */}
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
                className="select-none pointer-events-none object-cover min-w-full min-h-full"
              />

              {/* Overlay Hint on hover */}
              <div className="absolute bottom-2 left-1/2 -translate-x-1/2 px-2.5 py-0.5 rounded-full bg-black/80 border border-pink-500/40 text-[10px] text-pink-200 pointer-events-none font-sans tracking-wide z-20 flex items-center gap-1 shadow-md">
                <Move size={11} className="text-rose-400" />
                <span>Drag to Pan</span>
              </div>
            </div>
          </div>

          {/* Precision Controls Bar */}
          <div className="p-3.5 rounded-2xl bg-[#1b071e] border border-pink-500/20 space-y-3">
            {/* Zoom Slider */}
            <div>
              <div className="flex items-center justify-between text-[11px] mb-1 font-semibold">
                <span className="text-pink-200 flex items-center gap-1.5">
                  <ZoomIn size={13} className="text-rose-400" />
                  Zoom & Magnification
                </span>
                <span className="text-rose-300 font-mono">{Math.round(zoom * 100)}%</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleZoomOut}
                  className="p-1.5 rounded-lg bg-[#250d2b] hover:bg-[#32113a] text-pink-200 border border-pink-500/30 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#18071c]"
                  title="Zoom Out"
                  aria-label="Zoom out"
                >
                  <ZoomOut size={13} />
                </button>
                <input
                  type="range"
                  min="0.6"
                  max="3.0"
                  step="0.05"
                  value={zoom}
                  onChange={(e) => setZoom(parseFloat(e.target.value))}
                  className="flex-1 accent-rose-500 cursor-pointer h-1.5 bg-[#120414] rounded-lg"
                />
                <button
                  type="button"
                  onClick={handleZoomIn}
                  className="p-1.5 rounded-lg bg-[#250d2b] hover:bg-[#32113a] text-pink-200 border border-pink-500/30 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#18071c]"
                  title="Zoom In"
                  aria-label="Zoom in"
                >
                  <ZoomIn size={13} />
                </button>
              </div>
            </div>

            {/* X / Y Position Sliders */}
            <div className="grid grid-cols-2 gap-3 pt-1">
              <div>
                <div className="flex items-center justify-between text-[10px] text-pink-300/80 mb-1">
                  <span>Pan Horizontal (X)</span>
                  <span className="text-rose-300 font-mono">{position.x}px</span>
                </div>
                <input
                  type="range"
                  min="-150"
                  max="150"
                  step="1"
                  value={position.x}
                  onChange={(e) => setPosition({ ...position, x: parseInt(e.target.value, 10) })}
                  className="w-full accent-rose-500 cursor-pointer h-1.5 bg-[#120414] rounded-lg"
                />
              </div>

              <div>
                <div className="flex items-center justify-between text-[10px] text-pink-300/80 mb-1">
                  <span>Pan Vertical (Y)</span>
                  <span className="text-rose-300 font-mono">{position.y}px</span>
                </div>
                <input
                  type="range"
                  min="-150"
                  max="150"
                  step="1"
                  value={position.y}
                  onChange={(e) => setPosition({ ...position, y: parseInt(e.target.value, 10) })}
                  className="w-full accent-rose-500 cursor-pointer h-1.5 bg-[#120414] rounded-lg"
                />
              </div>
            </div>

            {/* Quick Action Buttons (Rotate, Reset) */}
            <div className="flex items-center justify-between pt-2 border-t border-pink-950/60">
              <button
                type="button"
                onClick={handleRotate}
                className="px-3 py-1.5 text-xs font-semibold rounded-xl bg-[#250d2b] hover:bg-[#32113a] text-pink-200 border border-pink-500/30 flex items-center gap-1.5 cursor-pointer"
                title="Rotate 90 degrees clockwise"
              >
                <RotateCw size={12} className="text-rose-400" />
                <span>Rotate 90°</span>
              </button>

              <button
                type="button"
                onClick={handleReset}
                className="px-3 py-1.5 text-xs font-semibold rounded-xl bg-[#250d2b] hover:bg-[#32113a] text-pink-300/80 hover:text-pink-100 border border-pink-500/20 flex items-center gap-1.5 cursor-pointer"
                title="Reset zoom and center position"
              >
                <RefreshCw size={12} />
                <span>Reset Center</span>
              </button>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-3.5 border-t border-pink-500/20 bg-[#200824]/90 flex items-center justify-between">
          <button
            type="button"
            onClick={() => {
              sound.playAction();
              onClose();
            }}
            className="px-3 py-1.5 text-xs font-semibold rounded-xl text-pink-300/70 hover:text-pink-100 cursor-pointer"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleApply}
            className="px-4 py-2 text-xs font-semibold rounded-xl bg-gradient-to-r from-rose-500 via-pink-600 to-amber-500 hover:opacity-95 text-white shadow-[0_2px_15px_rgba(244,63,94,0.35)] transition-all cursor-pointer active:scale-95 flex items-center gap-1.5"
          >
            <Check size={14} className="stroke-[2.5]" />
            <span>Apply Crop & Save</span>
          </button>
        </div>
      </ModalShell>
  );
}
