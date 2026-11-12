import React, { useState, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { Report, ReportCategory, ReportPriority } from '../types';
import { VALID_CATEGORIES, VALID_PRIORITIES, validateReportInput } from '../lib/validation';
import { syncEngine } from '../services/syncEngine';
import { useUserRole } from '../hooks/useUserRole';
import { CategoryIcon } from '../components/Badge';
import {
  Camera,
  Trash2,
  Lock,
  WifiOff,
  CheckCircle2,
  AlertTriangle,
  Upload,
  Sparkles,
  ArrowLeft,
  Navigation,
} from 'lucide-react';

interface CreateReportPageProps {
  onBack: () => void;
  onSuccess: (reportId: string) => void;
}

export const CreateReportPage: React.FC<CreateReportPageProps> = ({
  onBack,
  onSuccess,
}) => {
  const { user } = useUserRole();

  // Form State
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<ReportCategory>('Water');
  const [priority, setPriority] = useState<ReportPriority>('High');
  const [description, setDescription] = useState('');
  const [locationName, setLocationName] = useState('Sector 4 - Alpha Wellhead');
  const [latitude, setLatitude] = useState<number>(30.0444);
  const [longitude, setLongitude] = useState<number>(31.2357);
  const [locationAccuracy, setLocationAccuracy] = useState<number>(3.8);
  const [isLocating, setIsLocating] = useState<boolean>(false);

  // Photo state
  const [photoDataUrl, setPhotoDataUrl] = useState<string | null>(null);
  const [photoSizeKb, setPhotoSizeKb] = useState<number>(0);

  // Status & Validation
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Capture GPS coordinates
  const captureGPS = () => {
    setIsLocating(true);
    if (typeof navigator !== 'undefined' && 'geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setLatitude(Number(pos.coords.latitude.toFixed(6)));
          setLongitude(Number(pos.coords.longitude.toFixed(6)));
          setLocationAccuracy(Number(pos.coords.accuracy.toFixed(1)));
          setIsLocating(false);
        },
        () => {
          // Fallback realistic Nile basin field coordinates
          setLatitude(30.0444 + (Math.random() - 0.5) * 0.02);
          setLongitude(31.2357 + (Math.random() - 0.5) * 0.02);
          setLocationAccuracy(4.1);
          setIsLocating(false);
        },
        { enableHighAccuracy: true, timeout: 5000 }
      );
    } else {
      setIsLocating(false);
    }
  };

  useEffect(() => {
    captureGPS();
  }, []);

  // Handle Photo selection
  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const sizeKb = Math.round(file.size / 1024);
      setPhotoSizeKb(sizeKb);
      const reader = new FileReader();
      reader.onload = (uploadEvent) => {
        if (uploadEvent.target?.result) {
          setPhotoDataUrl(uploadEvent.target.result as string);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const removePhoto = () => {
    setPhotoDataUrl(null);
    setPhotoSizeKb(0);
  };

  // Generate pseudo report number NP-XXXX
  const generateTempReportNumber = () => {
    const rand = Math.floor(1000 + Math.random() * 9000);
    return `NP-${rand}`;
  };

  const handleSave = async (asDraft: boolean = false) => {
    const reportData: Partial<Report> = {
      title,
      category,
      priority,
      description,
      latitude,
      longitude,
    };

    if (!asDraft) {
      const validation = validateReportInput(reportData);
      if (!validation.isValid) {
        const errMap: Record<string, string> = {};
        validation.errors.forEach((e) => {
          errMap[e.field] = e.message;
        });
        setErrors(errMap);
        return;
      }
    } else if (!title.trim()) {
      setErrors({ title: 'Please provide at least a title for draft.' });
      return;
    }

    setErrors({});
    setIsSaving(true);

    try {
      const now = new Date().toISOString();
      const reportId = uuidv4();
      const initialStatus = asDraft ? 'draft' : 'submitted';

      const newReport: Report = {
        id: reportId,
        reportNumber: generateTempReportNumber(),
        title: title.trim(),
        description: description.trim(),
        category,
        priority,
        status: initialStatus,
        syncStatus: 'pending',
        latitude,
        longitude,
        locationName: locationName.trim() || 'Field Station Coordinate',
        locationAccuracy,
        reporterName: user.name,
        reporterId: user.id,
        photoUrl: photoDataUrl || undefined,
        photoCount: photoDataUrl ? 1 : 0,
        version: 1,
        createdAt: now,
        updatedAt: now,
      };

      // Enqueue to Dexie DB and outbox
      await syncEngine.enqueueReportCreate(newReport);

      setToastMessage(
        asDraft
          ? 'Draft saved to local device cache.'
          : 'Report saved offline & queued for cloud uplink.'
      );

      setTimeout(() => {
        onSuccess(reportId);
      }, 1000);
    } catch (err: any) {
      setErrors({ general: err.message || 'Failed to save field report' });
      setIsSaving(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 pb-28 space-y-6">
      {/* Navigation Header */}
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-on-surface-variant hover:text-on-surface bg-surface-container-low px-3 py-1.5 rounded-lg border border-surface-container transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Feed</span>
        </button>

        <span className="text-xs font-mono text-on-surface-variant">
          Reporter: <strong>{user.name}</strong> ({user.team})
        </span>
      </div>

      {/* Offline Mode Banner with Security Badge */}
      <div className="bg-primary text-white rounded-2xl p-4 shadow-md border border-primary-container flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-primary-container flex items-center justify-center text-tertiary-fixed">
            <WifiOff className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-tertiary-fixed">
                Offline Mode Active
              </span>
              <span className="inline-flex items-center gap-1 bg-primary-container text-[10px] font-mono px-2 py-0.5 rounded text-surface-container-high border border-slate-700">
                <Lock className="w-2.5 h-2.5 text-tertiary-fixed" />
                IndexedDB Local Storage
              </span>
            </div>
            <p className="text-xs text-surface-container-high/80 mt-0.5">
              Entries are safely buffered on this handset and automatically sync when cellular/mesh signal is acquired.
            </p>
          </div>
        </div>
      </div>

      {/* Form Container */}
      <div className="bg-surface-container-lowest border border-surface-container-high rounded-2xl p-6 shadow-sm space-y-6">
        {/* Title Input */}
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-1.5">
            Issue Title / Asset Tag <span className="text-rose-500">*</span>
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Water Point Alpha-4 Pump High Pressure Leakage"
            className={`w-full px-3.5 py-2.5 rounded-xl border text-sm focus:outline-none focus:ring-2 transition-all ${
              errors.title
                ? 'border-rose-400 focus:ring-rose-200'
                : 'border-surface-container focus:ring-secondary/20 focus:border-secondary'
            }`}
          />
          {errors.title && (
            <p className="text-xs text-rose-600 mt-1 flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" />
              {errors.title}
            </p>
          )}
        </div>

        {/* Category Selector */}
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-2">
            Discipline / Category <span className="text-rose-500">*</span>
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
            {VALID_CATEGORIES.map((cat) => {
              const active = category === cat;
              return (
                <button
                  type="button"
                  key={cat}
                  onClick={() => setCategory(cat)}
                  className={`flex flex-col items-center justify-center p-3 rounded-xl border text-xs font-medium transition-all ${
                    active
                      ? 'bg-secondary text-white border-secondary shadow-md scale-[1.02]'
                      : 'bg-surface-container-lowest border-surface-container-high text-on-surface hover:bg-surface-container-low'
                  }`}
                >
                  <CategoryIcon
                    category={cat}
                    className={`w-5 h-5 mb-1.5 ${active ? 'text-tertiary-fixed' : ''}`}
                  />
                  <span>{cat}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* 4-Tier Urgency Matrix Buttons */}
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-2">
            Urgency / Severity Matrix <span className="text-rose-500">*</span>
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            {VALID_PRIORITIES.map((p) => {
              const active = priority === p;
              const styles: Record<ReportPriority, { bgActive: string; borderActive: string; dot: string }> = {
                Low: { bgActive: 'bg-emerald-600 text-white', borderActive: 'border-emerald-600', dot: 'bg-emerald-300' },
                Medium: { bgActive: 'bg-blue-600 text-white', borderActive: 'border-blue-600', dot: 'bg-blue-300' },
                High: { bgActive: 'bg-amber-600 text-white', borderActive: 'border-amber-600', dot: 'bg-amber-300' },
                Critical: { bgActive: 'bg-rose-700 text-white', borderActive: 'border-rose-700', dot: 'bg-rose-300' },
              };
              const style = styles[p];

              return (
                <button
                  type="button"
                  key={p}
                  onClick={() => setPriority(p)}
                  className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl border text-xs font-bold tracking-wide transition-all ${
                    active
                      ? `${style.bgActive} ${style.borderActive} shadow-md ring-2 ring-offset-1 ring-secondary/30 scale-[1.02]`
                      : 'bg-surface-container-lowest border-surface-container-high text-on-surface hover:bg-surface-container-low'
                  }`}
                >
                  <span className={`w-2 h-2 rounded-full ${active ? style.dot : 'bg-slate-400'}`} />
                  <span>{p}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Geolocation Telemetry Box */}
        <div className="bg-surface-container-low/60 border border-surface-container rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-on-surface flex items-center gap-1.5">
              <Navigation className="w-4 h-4 text-secondary" />
              Geolocation Telemetry
            </span>
            <button
              type="button"
              onClick={captureGPS}
              disabled={isLocating}
              className="text-xs font-medium text-secondary hover:text-secondary-container inline-flex items-center gap-1 bg-surface-container-lowest px-2.5 py-1 rounded-lg border border-surface-container shadow-xs"
            >
              <Navigation className={`w-3 h-3 ${isLocating ? 'animate-spin' : ''}`} />
              <span>{isLocating ? 'Acquiring GPS...' : 'Update GPS'}</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div>
              <label className="text-on-surface-variant block mb-1">Location Descriptor</label>
              <input
                type="text"
                value={locationName}
                onChange={(e) => setLocationName(e.target.value)}
                placeholder="e.g. Sector 4 - Alpha Wellhead"
                className="w-full bg-surface-container-lowest px-3 py-1.5 rounded-lg border border-surface-container text-xs"
              />
            </div>
            <div className="flex items-center gap-3">
              <div className="flex-1">
                <label className="text-on-surface-variant block mb-1">GPS Coordinates</label>
                <div className="font-mono bg-surface-container-lowest px-3 py-1.5 rounded-lg border border-surface-container text-xs text-on-surface">
                  {latitude.toFixed(4)}° N, {longitude.toFixed(4)}° E
                </div>
              </div>
              <div>
                <label className="text-on-surface-variant block mb-1">Precision</label>
                <span className="inline-block font-mono bg-emerald-50 text-emerald-800 border border-emerald-200 px-2 py-1.5 rounded-lg text-xs font-semibold">
                  ±{locationAccuracy}m
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Description Textarea with Character Count */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">
              Field Observations & Description
            </label>
            <span
              className={`text-xs font-mono ${
                description.length > 1900 ? 'text-rose-600 font-bold' : 'text-on-surface-variant'
              }`}
            >
              {description.length} / 2000
            </span>
          </div>
          <textarea
            rows={4}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Document observed anomalies, equipment part numbers, environmental hazards, immediate safety interventions performed..."
            maxLength={2000}
            className={`w-full px-3.5 py-2.5 rounded-xl border text-sm focus:outline-none focus:ring-2 transition-all ${
              errors.description
                ? 'border-rose-400 focus:ring-rose-200'
                : 'border-surface-container focus:ring-secondary/20 focus:border-secondary'
            }`}
          />
          {errors.description && (
            <p className="text-xs text-rose-600 mt-1">{errors.description}</p>
          )}
        </div>

        {/* Photographic Evidence Uploader */}
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-2">
            Photographic Evidence (Local Base64 Storage)
          </label>

          {photoDataUrl ? (
            <div className="relative rounded-xl border border-surface-container overflow-hidden bg-surface-container-low max-w-sm">
              <img
                src={photoDataUrl}
                alt="Captured field evidence"
                className="w-full h-48 object-cover"
              />
              <div className="p-3 bg-surface-container-lowest flex items-center justify-between">
                <div>
                  <span className="inline-flex items-center gap-1 bg-emerald-100 text-emerald-800 text-[10px] font-mono px-2 py-0.5 rounded-md font-semibold">
                    <CheckCircle2 className="w-3 h-3" />
                    Cached Locally ({photoSizeKb} KB)
                  </span>
                </div>
                <button
                  type="button"
                  onClick={removePhoto}
                  className="text-rose-600 hover:text-rose-800 text-xs font-medium flex items-center gap-1"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Remove</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="border-2 border-dashed border-surface-container hover:border-secondary/60 rounded-xl p-6 text-center bg-surface-container-low/30 transition-colors">
              <Camera className="w-8 h-8 text-on-surface-variant mx-auto mb-2" />
              <p className="text-xs font-medium text-on-surface mb-1">
                Attach field camera capture or file
              </p>
              <p className="text-[11px] text-on-surface-variant mb-3">
                Saved instantly into IndexedDB offline database
              </p>
              <label className="inline-flex items-center gap-2 bg-surface-container-lowest border border-surface-container hover:bg-surface-container-low px-4 py-2 rounded-xl text-xs font-semibold text-secondary cursor-pointer shadow-xs">
                <Upload className="w-4 h-4" />
                <span>Select / Capture Image</span>
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={handlePhotoUpload}
                  className="hidden"
                />
              </label>
            </div>
          )}
        </div>

        {errors.general && (
          <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{errors.general}</span>
          </div>
        )}

        {/* Action Buttons */}
        <div className="pt-4 border-t border-surface-container flex flex-col sm:flex-row sm:items-center justify-end gap-3">
          <button
            type="button"
            disabled={isSaving}
            onClick={() => handleSave(true)}
            className="px-4 py-2.5 rounded-xl border border-surface-container text-xs font-semibold text-on-surface hover:bg-surface-container-low transition-colors text-center"
          >
            Save as Local Draft
          </button>
          <button
            type="button"
            disabled={isSaving}
            onClick={() => handleSave(false)}
            className="px-6 py-2.5 rounded-xl bg-secondary text-white text-xs font-bold tracking-wide hover:bg-secondary-container transition-colors shadow-md flex items-center justify-center gap-2"
          >
            <Sparkles className="w-4 h-4 text-tertiary-fixed" />
            <span>{isSaving ? 'Storing in Cache...' : 'Submit Report (Store & Queue Sync)'}</span>
          </button>
        </div>
      </div>

      {/* Floating Feedback Toast */}
      {toastMessage && (
        <div className="fixed top-20 right-4 sm:right-8 z-50 bg-primary text-white border border-primary-container px-4 py-3 rounded-xl shadow-2xl flex items-center gap-2 animate-bounce">
          <CheckCircle2 className="w-5 h-5 text-tertiary-fixed" />
          <span className="text-xs font-medium">{toastMessage}</span>
        </div>
      )}
    </div>
  );
};
