import React, { useState, useRef } from 'react';
import { Camera, Trash2, RotateCcw, User, Briefcase, Mail, Phone, MapPin, Plane, Crop } from 'lucide-react';
import { LinkedinIcon, GithubIcon } from '../ui/Icons';
import { DEFAULT_PHOTO_URL } from '../../assets/defaultPhoto.js';
import { sound } from '../../utils/soundEffects';
import ImageCropModal from '../ui/ImageCropModal';

export default function PersonalInfoEditor({ data, onChange }) {
  const fileInputRef = useRef(null);
  const [isCropOpen, setIsCropOpen] = useState(false);
  const [cropSourceImage, setCropSourceImage] = useState(null);

  const handleChange = (field, value) => {
    onChange({
      ...data,
      [field]: value,
    });
  };

  const handlePhotoUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        sound.playAction();
        // Automatically open the crop & positioning modal upon upload
        setCropSourceImage(reader.result);
        setIsCropOpen(true);
      };
      reader.readAsDataURL(file);
    }
    // Reset file input value so re-selecting the same file works
    e.target.value = '';
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
    <div className="space-y-5 text-xs text-pink-100 animate-fade-in font-sans">
      {/* Photo Upload Pod */}
      <div className="p-4 rounded-2xl bg-[#1c081e] border border-pink-500/25 shadow-[0_4px_20px_rgba(0,0,0,0.3)] relative overflow-hidden">
        <div className="absolute top-0 right-0 px-2.5 py-0.5 bg-pink-950/80 border-b border-l border-pink-500/30 text-[9px] text-pink-300 font-bold tracking-widest uppercase rounded-bl-lg">
          PORTRAIT FRAME
        </div>

        <label className="block text-xs font-bold text-pink-200 tracking-wide mb-3 flex items-center gap-1.5">
          <Camera size={13} className="text-rose-400" />
          ✦ Profile Photo & Crop Framing
        </label>

        <div className="flex flex-wrap items-center gap-4">
          <div className="relative group">
            <div
              className={`w-20 h-20 overflow-hidden bg-[#140616] border-2 border-pink-400/80 shadow-[0_0_15px_rgba(244,63,94,0.25)] relative ${
                data.photoStyle === 'circle'
                  ? 'rounded-full'
                  : data.photoStyle === 'rounded'
                  ? 'rounded-2xl'
                  : 'rounded-lg'
              }`}
            >
              {data.photo ? (
                <img src={data.photo} alt="Avatar" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-pink-400/85">
                  <User size={30} />
                </div>
              )}
            </div>

            <button
              onClick={() => {
                sound.playAction();
                if (data.photo) {
                  handleOpenCrop();
                } else {
                  fileInputRef.current?.click();
                }
              }}
              className="absolute inset-0 bg-black/75 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center text-pink-200 rounded-xl cursor-pointer gap-1"
              title={data.photo ? "Crop and position photo" : "Upload new photo"}
            >
              {data.photo ? <Crop size={18} className="text-rose-400" /> : <Camera size={20} />}
              <span className="text-[10px] font-bold tracking-wider">{data.photo ? 'CROP' : 'UPLOAD'}</span>
            </button>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handlePhotoUpload}
              accept="image/*"
              className="hidden"
            />
          </div>

          <div className="space-y-2.5 flex-1 min-w-[200px]">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  sound.playAction();
                  fileInputRef.current?.click();
                }}
                className="px-3 py-1.5 text-xs font-semibold rounded-xl bg-gradient-to-r from-rose-500 to-pink-500 hover:from-rose-400 hover:to-pink-400 text-white transition-all shadow-[0_2px_10px_rgba(244,63,94,0.3)] flex items-center gap-1.5 cursor-pointer active:scale-95"
              >
                <Camera size={13} />
                Upload Photo
              </button>

              {/* Dedicated Crop & Positioning Button */}
              {data.photo && (
                <button
                  type="button"
                  onClick={handleOpenCrop}
                  className="px-3 py-1.5 text-xs font-semibold rounded-xl bg-[#2a0e2d] hover:bg-[#38133c] text-pink-200 border border-pink-500/30 transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
                  title="Position and crop photo"
                >
                  <Crop size={13} className="text-rose-400" />
                  Crop & Frame
                </button>
              )}

              <button
                type="button"
                onClick={() => {
                  sound.playAction();
                  onChange({
                    ...data,
                    photo: DEFAULT_PHOTO_URL,
                    rawPhoto: DEFAULT_PHOTO_URL,
                    photoCrop: null,
                  });
                }}
                className="px-3 py-1.5 text-xs font-medium rounded-xl bg-[#200b23] hover:bg-[#2b102f] text-pink-200 border border-pink-500/30 transition-all flex items-center gap-1.5 cursor-pointer"
                title="Reset to default photo"
              >
                <RotateCcw size={12} className="text-pink-400" />
                Original Photo
              </button>
              {data.photo && (
                <button
                  type="button"
                  onClick={() => {
                    sound.playAction();
                    handleChange('photo', '');
                  }}
                  className="px-2 py-1.5 text-xs rounded-xl text-rose-400 hover:bg-rose-950/40 border border-rose-900/40 transition-all cursor-pointer"
                  title="Remove photo"
                >
                  <Trash2 size={13} />
                </button>
              )}
            </div>

            {/* Photo styling toggles */}
            <div className="flex items-center gap-3 pt-1">
              <label className="text-xs text-pink-200 flex items-center gap-1.5 cursor-pointer font-sans">
                <input
                  type="checkbox"
                  checked={data.showPhoto}
                  onChange={(e) => handleChange('showPhoto', e.target.checked)}
                  className="rounded text-rose-500 focus:ring-0 bg-[#160618] border-pink-500/40 cursor-pointer"
                />
                Show In Resume
              </label>

              <div className="flex items-center gap-1 bg-[#160618] p-0.5 rounded-xl border border-pink-500/30 text-[10px]">
                {['square-frame', 'rounded', 'circle'].map((style) => (
                  <button
                    key={style}
                    type="button"
                    onClick={() => {
                      sound.playAction();
                      handleChange('photoStyle', style);
                    }}
                    className={`px-2 py-0.5 rounded-lg cursor-pointer capitalize ${
                      data.photoStyle === style
                        ? 'bg-rose-500 text-white font-bold'
                        : 'text-pink-300/70 hover:text-pink-100'
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

      {/* Main details with atelier inputs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
        <div className="sm:col-span-2">
          <label className="block text-xs font-semibold text-pink-200 mb-1">
            Candidate Full Name <span className="text-rose-400">*</span>
          </label>
          <div className="relative">
            <User size={14} className="absolute left-3 top-2.5 text-pink-400/85" />
            <input
              type="text"
              value={data.fullName || ''}
              onChange={(e) => handleChange('fullName', e.target.value)}
              placeholder="e.g. Alex Morgan"
              className="w-full bg-[#18071a] border border-pink-500/25 rounded-xl pl-9 pr-3 py-2 text-xs text-pink-50 placeholder:text-pink-300/70 focus:outline-none focus:border-pink-400 focus:ring-1 focus:ring-pink-400/40 transition-colors"
            />
          </div>
        </div>

        <div className="sm:col-span-2">
          <label className="block text-xs font-semibold text-pink-200 mb-1">
            Professional Title <span className="text-rose-400">*</span>
          </label>
          <div className="relative">
            <Briefcase size={14} className="absolute left-3 top-2.5 text-pink-400/85" />
            <input
              type="text"
              value={data.title || ''}
              onChange={(e) => handleChange('title', e.target.value)}
              placeholder="e.g. QA Lead | Functional, API & Performance Testing"
              className="w-full bg-[#18071a] border border-pink-500/25 rounded-xl pl-9 pr-3 py-2 text-xs text-pink-50 placeholder:text-pink-300/70 focus:outline-none focus:border-pink-400 focus:ring-1 focus:ring-pink-400/40 transition-colors"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-pink-200 mb-1">
            Email Address
          </label>
          <div className="relative">
            <Mail size={14} className="absolute left-3 top-2.5 text-pink-400/85" />
            <input
              type="email"
              value={data.email || ''}
              onChange={(e) => handleChange('email', e.target.value)}
              placeholder="alex.morgan@example.com"
              className="w-full bg-[#18071a] border border-pink-500/25 rounded-xl pl-9 pr-3 py-2 text-xs text-pink-50 placeholder:text-pink-300/70 focus:outline-none focus:border-pink-400 focus:ring-1 focus:ring-pink-400/40 transition-colors"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-pink-200 mb-1">
            Phone Number
          </label>
          <div className="relative">
            <Phone size={14} className="absolute left-3 top-2.5 text-pink-400/85" />
            <input
              type="tel"
              value={data.phone || ''}
              onChange={(e) => handleChange('phone', e.target.value)}
              placeholder="+1 555 0100"
              className="w-full bg-[#18071a] border border-pink-500/25 rounded-xl pl-9 pr-3 py-2 text-xs text-pink-50 placeholder:text-pink-300/70 focus:outline-none focus:border-pink-400 focus:ring-1 focus:ring-pink-400/40 transition-colors"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-pink-200 mb-1">
            Location
          </label>
          <div className="relative">
            <MapPin size={14} className="absolute left-3 top-2.5 text-pink-400/85" />
            <input
              type="text"
              value={data.location || ''}
              onChange={(e) => handleChange('location', e.target.value)}
              placeholder="Springfield, USA"
              className="w-full bg-[#18071a] border border-pink-500/25 rounded-xl pl-9 pr-3 py-2 text-xs text-pink-50 placeholder:text-pink-300/70 focus:outline-none focus:border-pink-400 focus:ring-1 focus:ring-pink-400/40 transition-colors"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-pink-200 mb-1">
            Relocation Preference
          </label>
          <div className="relative">
            <Plane size={14} className="absolute left-3 top-2.5 text-pink-400/85" />
            <input
              type="text"
              value={data.relocation || ''}
              onChange={(e) => handleChange('relocation', e.target.value)}
              placeholder="Relocating to UAE"
              className="w-full bg-[#18071a] border border-pink-500/25 rounded-xl pl-9 pr-3 py-2 text-xs text-pink-50 placeholder:text-pink-300/70 focus:outline-none focus:border-pink-400 focus:ring-1 focus:ring-pink-400/40 transition-colors"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-pink-200 mb-1">
            LinkedIn Profile
          </label>
          <div className="relative">
            <LinkedinIcon size={14} className="absolute left-3 top-2.5 text-pink-400/85" />
            <input
              type="text"
              value={data.linkedin || ''}
              onChange={(e) => handleChange('linkedin', e.target.value)}
              placeholder="linkedin.com/in/example-profile"
              className="w-full bg-[#18071a] border border-pink-500/25 rounded-xl pl-9 pr-3 py-2 text-xs text-pink-50 placeholder:text-pink-300/70 focus:outline-none focus:border-pink-400 focus:ring-1 focus:ring-pink-400/40 transition-colors"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-pink-200 mb-1">
            GitHub / Portfolio
          </label>
          <div className="relative">
            <GithubIcon size={14} className="absolute left-3 top-2.5 text-pink-400/85" />
            <input
              type="text"
              value={data.github || ''}
              onChange={(e) => handleChange('github', e.target.value)}
              placeholder="github.com/example-user"
              className="w-full bg-[#18071a] border border-pink-500/25 rounded-xl pl-9 pr-3 py-2 text-xs text-pink-50 placeholder:text-pink-300/70 focus:outline-none focus:border-pink-400 focus:ring-1 focus:ring-pink-400/40 transition-colors"
            />
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
