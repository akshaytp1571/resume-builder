import React, { useState, useRef } from 'react';
import { Camera, Trash2, RotateCcw, User, Crop, AlertCircle } from 'lucide-react';
import { DEFAULT_PHOTO_URL } from '../../assets/defaultPhoto.js';
import { sound } from '../../utils/soundEffects';
import { validateImageFile, readFileAsDataUrl, downscaleImage, CROP_SOURCE_MAX_EDGE } from '../../utils/imageUtils';
import ImageCropModal from '../ui/ImageCropModal';
import { Field, Button, IconButton, SectionIndex, Chip } from '../ui/primitives';

/** The chosen frame, as plain CSS — radii are 0 or 2px, so no rounded-* class. */
const PHOTO_RADIUS = { 'square-frame': 0, rounded: 2, circle: '50%' };

export default function PersonalInfoEditor({ data, onChange }) {
  const fileInputRef = useRef(null);
  const [isCropOpen, setIsCropOpen] = useState(false);
  const [cropSourceImage, setCropSourceImage] = useState(null);
  const [photoError, setPhotoError] = useState(null);

  const handleChange = (field, value) => {
    onChange({
      ...data,
      [field]: value,
    });
  };

  const handlePhotoUpload = async (e) => {
    const file = e.target.files[0];

    // Reset immediately so re-selecting the same file still fires onChange.
    // Done before the awaits below, while the event is still live.
    e.target.value = '';

    if (!file) return;

    // Check the file BEFORE reading it. Reading a 50 MB HEIC into a data URL
    // decodes the whole thing into memory and freezes the tab.
    const check = validateImageFile(file);
    if (!check.ok) {
      setPhotoError(check.error);
      return;
    }

    setPhotoError(null);

    try {
      const rawDataUrl = await readFileAsDataUrl(file);
      // Shrink before the crop modal sees it, so a 12 MP phone photo arrives
      // manageable. Already-small images come back untouched.
      const source = await downscaleImage(rawDataUrl, CROP_SOURCE_MAX_EDGE);
      sound.playAction();
      setCropSourceImage(source);
      setIsCropOpen(true);
    } catch (err) {
      setPhotoError(err?.message || 'That image could not be opened. Please try a different file.');
    }
  };

  const handleOpenCrop = () => {
    sound.playAction();
    const source = data.rawPhoto || data.photo || DEFAULT_PHOTO_URL;
    setCropSourceImage(source);
    setIsCropOpen(true);
  };

  const handleApplyCrop = ({ croppedPhoto, rawPhoto, cropSettings }) => {
    onChange({
      ...data,
      photo: croppedPhoto,
      rawPhoto: rawPhoto,
      photoCrop: cropSettings,
      photoStyle: cropSettings.photoStyle || data.photoStyle,
    });
  };

  return (
    <div className="space-y-5">
      <div>
        <SectionIndex
          index={2}
          title="Identity"
          action={
            <Chip tone={data.fullName && data.title ? 'present' : 'missing'}>
              {data.fullName && data.title ? 'Complete' : 'Needs name + title'}
            </Chip>
          }
        />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field
            className="sm:col-span-2"
            label="Candidate Full Name *"
            value={data.fullName || ''}
            onChange={(e) => handleChange('fullName', e.target.value)}
            placeholder="e.g. Alex Morgan"
          />
          <Field
            className="sm:col-span-2"
            label="Professional Title *"
            value={data.title || ''}
            onChange={(e) => handleChange('title', e.target.value)}
            placeholder="e.g. QA Lead | Functional, API & Performance Testing"
          />
          <Field
            label="Email Address"
            type="email"
            value={data.email || ''}
            onChange={(e) => handleChange('email', e.target.value)}
            placeholder="alex.morgan@example.com"
          />
          <Field
            label="Phone Number"
            type="tel"
            value={data.phone || ''}
            onChange={(e) => handleChange('phone', e.target.value)}
            placeholder="+1 555 0100"
          />
          <Field
            label="Location"
            value={data.location || ''}
            onChange={(e) => handleChange('location', e.target.value)}
            placeholder="Springfield, USA"
          />
          <Field
            label="Relocation Preference"
            value={data.relocation || ''}
            onChange={(e) => handleChange('relocation', e.target.value)}
            placeholder="Relocating to UAE"
          />
          <Field
            label="LinkedIn Profile"
            value={data.linkedin || ''}
            onChange={(e) => handleChange('linkedin', e.target.value)}
            placeholder="linkedin.com/in/example-profile"
          />
          <Field
            label="GitHub / Portfolio"
            value={data.github || ''}
            onChange={(e) => handleChange('github', e.target.value)}
            placeholder="github.com/example-user"
          />
        </div>
      </div>

      {/* portrait — one plate, hairline-separated controls */}
      <div className="border-t border-rule pt-4">
        <span className="dt-label mb-2 block text-bone-52">Portrait</span>

        <div className="flex flex-wrap items-start gap-4">
          <div className="group relative shrink-0">
            <div
              className="relative h-20 w-20 overflow-hidden border border-rule-2 bg-void"
              style={{ borderRadius: PHOTO_RADIUS[data.photoStyle] || 2 }}
            >
              {data.photo ? (
                <img src={data.photo} alt="Avatar" className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-bone-32">
                  <User size={30} />
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => {
                sound.playAction();
                if (data.photo) {
                  handleOpenCrop();
                } else {
                  fileInputRef.current?.click();
                }
              }}
              className="absolute inset-0 flex cursor-pointer flex-col items-center justify-center gap-1 rounded-[2px] bg-void/85 text-bone-70 opacity-0 transition-opacity duration-[90ms] group-hover:opacity-100"
              title={data.photo ? "Crop and position photo" : "Upload new photo"}
            >
              {data.photo ? <Crop size={16} aria-hidden="true" /> : <Camera size={16} aria-hidden="true" />}
              <span className="dt-label text-[9px]">{data.photo ? 'Crop' : 'Upload'}</span>
            </button>

            <input
              type="file"
              ref={fileInputRef}
              onChange={handlePhotoUpload}
              accept="image/*"
              className="hidden"
            />
          </div>

          <div className="min-w-[200px] flex-1 space-y-2.5">
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="quiet"
                size="sm"
                onClick={() => {
                  sound.playAction();
                  fileInputRef.current?.click();
                }}
              >
                <Camera size={12} aria-hidden="true" />
                Upload Photo
              </Button>

              {/* Dedicated Crop & Positioning Button */}
              {data.photo && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleOpenCrop}
                  title="Position and crop photo"
                >
                  <Crop size={12} aria-hidden="true" />
                  Crop & Frame
                </Button>
              )}

              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  sound.playAction();
                  onChange({
                    ...data,
                    photo: DEFAULT_PHOTO_URL,
                    rawPhoto: DEFAULT_PHOTO_URL,
                    photoCrop: null,
                  });
                }}
                title="Reset to default photo"
              >
                <RotateCcw size={11} aria-hidden="true" />
                Original Photo
              </Button>

              {data.photo && (
                <IconButton
                  label="Remove photo"
                  title="Remove photo"
                  tone="alarm"
                  size="sm"
                  onClick={() => {
                    sound.playAction();
                    handleChange('photo', '');
                  }}
                >
                  <Trash2 size={13} aria-hidden="true" />
                </IconButton>
              )}
            </div>

            {/* Upload error. aria-live so screen readers hear the size/type
                rejection without the user having to find it. The region is
                always mounted - a live region added at the same moment as its
                text is often not announced. */}
            <div aria-live="polite" role="status" className="min-h-0">
              {photoError && (
                <p className="flex items-start gap-1.5 text-[11px] leading-relaxed text-alarm">
                  <AlertCircle size={12} className="mt-0.5 shrink-0" aria-hidden="true" />
                  <span>{photoError}</span>
                </p>
              )}
            </div>

            {/* Photo styling toggles */}
            <div className="flex flex-wrap items-center gap-3 pt-1">
              <label className="flex cursor-pointer items-center gap-1.5 font-mono text-[11px] text-bone-52">
                <input
                  type="checkbox"
                  checked={data.showPhoto}
                  onChange={(e) => handleChange('showPhoto', e.target.checked)}
                  className="cursor-pointer accent-[var(--signal)]"
                />
                Show In Resume
              </label>

              <div className="flex items-center gap-1">
                {['square-frame', 'rounded', 'circle'].map((style) => (
                  <button
                    key={style}
                    type="button"
                    onClick={() => {
                      sound.playAction();
                      handleChange('photoStyle', style);
                    }}
                    className={`dt-label cursor-pointer rounded-[2px] border px-2 py-1 capitalize transition-colors duration-[90ms] ${
                      data.photoStyle === style
                        ? 'border-signal/50 text-signal'
                        : 'border-rule text-bone-32 hover:text-bone-70'
                    }`}
                  >
                    {style.replace('-', ' ')}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Interactive Photo Crop & Position Modal */}
      <ImageCropModal
        isOpen={isCropOpen}
        onClose={() => setIsCropOpen(false)}
        imageSrc={cropSourceImage}
        initialCrop={data.photoCrop}
        photoStyle={data.photoStyle}
        onApplyCrop={handleApplyCrop}
      />
    </div>
  );
}
