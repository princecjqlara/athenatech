'use client';

import React, { useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    X,
    Upload,
    Video,
    Image as ImageIcon,
    Zap,
    Activity,
    Volume2,
    VolumeX,
    Sun,
    Layers,
    Clock,
    FileText,
    CheckCircle,
    AlertTriangle,
    BarChart2,
} from 'lucide-react';
import { GlassCard } from './GlassCard';
import {
    extractStructure,
    StructureFingerprint,
    ExtractionProgress,
    getMotionIntensityLabel,
    getConfidenceLabel,
    formatDuration,
    formatFileSize,
} from '@/lib/creativeExtractor';

interface UploadCreativeModalProps {
    isOpen: boolean;
    onClose: () => void;
    onCreativeExtracted: (fingerprint: StructureFingerprint, file: File, previewUrl: string) => void;
}

export function UploadCreativeModal({ isOpen, onClose, onCreativeExtracted }: UploadCreativeModalProps) {
    const [file, setFile] = useState<File | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [isExtracting, setIsExtracting] = useState(false);
    const [extractionProgress, setExtractionProgress] = useState<ExtractionProgress | null>(null);
    const [fingerprint, setFingerprint] = useState<StructureFingerprint | null>(null);
    const [error, setError] = useState<string | null>(null);

    const fileInputRef = useRef<HTMLInputElement>(null);
    const dropZoneRef = useRef<HTMLDivElement>(null);

    const handleFileSelect = useCallback((selectedFile: File) => {
        // Validate file type
        const isVideo = selectedFile.type.startsWith('video/');
        const isImage = selectedFile.type.startsWith('image/');

        if (!isVideo && !isImage) {
            setError('Please upload a video (.mp4, .mov, .webm) or image (.jpg, .png, .webp)');
            return;
        }

        // Warn for large files
        const maxSize = 100 * 1024 * 1024; // 100MB
        if (selectedFile.size > maxSize) {
            setError('File is too large. Please upload a file under 100MB.');
            return;
        }

        // Clean up previous preview
        if (previewUrl) {
            URL.revokeObjectURL(previewUrl);
        }

        setFile(selectedFile);
        setPreviewUrl(URL.createObjectURL(selectedFile));
        setError(null);
        setFingerprint(null);
    }, [previewUrl]);

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();

        const droppedFile = e.dataTransfer.files[0];
        if (droppedFile) {
            handleFileSelect(droppedFile);
        }
    }, [handleFileSelect]);

    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
    }, []);

    const handleExtract = useCallback(async () => {
        if (!file) return;

        setIsExtracting(true);
        setError(null);

        try {
            const result = await extractStructure(file, setExtractionProgress);
            setFingerprint(result);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Extraction failed');
        } finally {
            setIsExtracting(false);
            setExtractionProgress(null);
        }
    }, [file]);

    const handleAddToLibrary = useCallback(() => {
        if (fingerprint && file && previewUrl) {
            onCreativeExtracted(fingerprint, file, previewUrl);
            handleClose();
        }
    }, [fingerprint, file, previewUrl, onCreativeExtracted]);

    const handleClose = useCallback(() => {
        if (previewUrl) {
            URL.revokeObjectURL(previewUrl);
        }
        setFile(null);
        setPreviewUrl(null);
        setFingerprint(null);
        setError(null);
        setIsExtracting(false);
        setExtractionProgress(null);
        onClose();
    }, [previewUrl, onClose]);

    const isVideo = file?.type.startsWith('video/');

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
                        onClick={handleClose}
                    />

                    {/* Modal */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                        className="fixed inset-4 md:inset-auto md:left-1/2 md:top-1/2 md:-translate-x-1/2 md:-translate-y-1/2 md:w-[800px] md:max-h-[90vh] bg-[var(--bg-secondary)] border border-[var(--glass-border)] rounded-2xl z-50 overflow-hidden flex flex-col"
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between p-6 border-b border-[var(--glass-border)]">
                            <div>
                                <h2 className="text-xl font-bold">Upload Creative</h2>
                                <p className="text-sm text-[var(--text-muted)]">Extract structure fingerprint for delivery prediction</p>
                            </div>
                            <button
                                onClick={handleClose}
                                className="p-2 rounded-lg hover:bg-[var(--glass-bg)] transition-colors"
                            >
                                <X size={24} />
                            </button>
                        </div>

                        {/* Content */}
                        <div className="flex-1 overflow-y-auto p-6">
                            {!file ? (
                                /* Drop Zone */
                                <div
                                    ref={dropZoneRef}
                                    onDrop={handleDrop}
                                    onDragOver={handleDragOver}
                                    onClick={() => fileInputRef.current?.click()}
                                    className="border-2 border-dashed border-[var(--glass-border)] rounded-xl p-12 text-center cursor-pointer hover:border-[var(--accent-primary)] hover:bg-[var(--glass-bg)] transition-all"
                                >
                                    <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-[var(--accent-soft)] flex items-center justify-center">
                                        <Upload className="text-[var(--accent-primary)]" size={32} />
                                    </div>
                                    <h3 className="text-lg font-semibold mb-2">Drop your creative here</h3>
                                    <p className="text-[var(--text-muted)] mb-4">or click to browse</p>
                                    <div className="flex items-center justify-center gap-4 text-sm text-[var(--text-muted)]">
                                        <span className="flex items-center gap-1">
                                            <Video size={14} /> Video
                                        </span>
                                        <span className="flex items-center gap-1">
                                            <ImageIcon size={14} /> Image
                                        </span>
                                    </div>
                                    <p className="text-xs text-[var(--text-muted)] mt-4">
                                        Supports MP4, MOV, WebM, JPG, PNG, WebP (max 100MB)
                                    </p>
                                    <input
                                        ref={fileInputRef}
                                        type="file"
                                        accept="video/*,image/*"
                                        className="hidden"
                                        onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
                                    />
                                </div>
                            ) : (
                                <div className="space-y-6">
                                    {/* Preview */}
                                    <div className="flex gap-6">
                                        <div className="w-48 h-32 rounded-xl overflow-hidden bg-[var(--bg-tertiary)] flex-shrink-0">
                                            {isVideo ? (
                                                <video
                                                    src={previewUrl!}
                                                    className="w-full h-full object-cover"
                                                    muted
                                                    playsInline
                                                />
                                            ) : (
                                                <img
                                                    src={previewUrl!}
                                                    alt="Preview"
                                                    className="w-full h-full object-cover"
                                                />
                                            )}
                                        </div>
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2 mb-2">
                                                {isVideo ? (
                                                    <Video className="text-[var(--accent-primary)]" size={18} />
                                                ) : (
                                                    <ImageIcon className="text-[var(--accent-primary)]" size={18} />
                                                )}
                                                <span className="font-semibold">{file.name}</span>
                                            </div>
                                            <p className="text-sm text-[var(--text-muted)] mb-4">
                                                {formatFileSize(file.size)} • {file.type}
                                            </p>

                                            {!fingerprint && !isExtracting && (
                                                <button
                                                    onClick={handleExtract}
                                                    className="btn-primary flex items-center gap-2"
                                                >
                                                    <Zap size={18} />
                                                    Extract Structure
                                                </button>
                                            )}

                                            {isExtracting && extractionProgress && (
                                                <div className="space-y-2">
                                                    <div className="flex items-center gap-2 text-sm">
                                                        <div className="spinner-small" />
                                                        <span>{extractionProgress.message}</span>
                                                    </div>
                                                    <div className="w-full h-2 bg-[var(--glass-bg)] rounded-full overflow-hidden">
                                                        <motion.div
                                                            className="h-full bg-[var(--accent-primary)]"
                                                            initial={{ width: 0 }}
                                                            animate={{ width: `${extractionProgress.progress}%` }}
                                                            transition={{ duration: 0.3 }}
                                                        />
                                                    </div>
                                                    <p className="text-xs text-[var(--text-muted)]">
                                                        {extractionProgress.progress.toFixed(0)}% complete
                                                    </p>
                                                </div>
                                            )}

                                            <button
                                                onClick={() => {
                                                    if (previewUrl) URL.revokeObjectURL(previewUrl);
                                                    setFile(null);
                                                    setPreviewUrl(null);
                                                    setFingerprint(null);
                                                }}
                                                className="text-sm text-[var(--text-muted)] hover:text-[var(--text-primary)] mt-2"
                                            >
                                                Choose different file
                                            </button>
                                        </div>
                                    </div>

                                    {/* Error */}
                                    {error && (
                                        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 flex items-center gap-3">
                                            <AlertTriangle size={20} />
                                            <span>{error}</span>
                                        </div>
                                    )}

                                    {/* Fingerprint Results */}
                                    {fingerprint && (
                                        <GlassCard className="p-5">
                                            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                                                <BarChart2 className="text-[var(--accent-primary)]" size={20} />
                                                Structure Fingerprint
                                                <span className={`ml-auto text-xs px-2 py-1 rounded-full ${fingerprint.confidence === 'high' ? 'bg-green-500/20 text-green-400' :
                                                        fingerprint.confidence === 'medium' ? 'bg-yellow-500/20 text-yellow-400' :
                                                            'bg-gray-500/20 text-gray-400'
                                                    }`}>
                                                    {getConfidenceLabel(fingerprint.confidence)}
                                                </span>
                                            </h3>

                                            {/* Basic Info */}
                                            <div className="grid grid-cols-4 gap-3 mb-4">
                                                <div className="p-3 rounded-lg bg-[var(--glass-bg)] text-center">
                                                    <p className="text-xs text-[var(--text-muted)]">Type</p>
                                                    <p className="font-semibold capitalize">{fingerprint.type}</p>
                                                </div>
                                                <div className="p-3 rounded-lg bg-[var(--glass-bg)] text-center">
                                                    <p className="text-xs text-[var(--text-muted)]">Aspect</p>
                                                    <p className="font-semibold">{fingerprint.aspect_ratio}</p>
                                                </div>
                                                {fingerprint.duration_s && (
                                                    <div className="p-3 rounded-lg bg-[var(--glass-bg)] text-center">
                                                        <p className="text-xs text-[var(--text-muted)]">Duration</p>
                                                        <p className="font-semibold">{formatDuration(fingerprint.duration_s)}</p>
                                                    </div>
                                                )}
                                                <div className="p-3 rounded-lg bg-[var(--glass-bg)] text-center">
                                                    <p className="text-xs text-[var(--text-muted)]">Resolution</p>
                                                    <p className="font-semibold">{fingerprint.width}×{fingerprint.height}</p>
                                                </div>
                                            </div>

                                            {/* Motion & Pacing (Video only) */}
                                            {fingerprint.type === 'video' && (
                                                <div className="mb-4">
                                                    <h4 className="text-sm font-medium text-[var(--text-muted)] mb-2 flex items-center gap-2">
                                                        <Activity size={14} />
                                                        Motion & Pacing
                                                    </h4>
                                                    <div className="grid grid-cols-3 gap-3">
                                                        <div className="p-3 rounded-lg bg-[var(--glass-bg)]">
                                                            <p className="text-xs text-[var(--text-muted)]">Motion Onset</p>
                                                            <p className="font-semibold">
                                                                {fingerprint.motion_onset_ms !== null ? `${fingerprint.motion_onset_ms}ms` : 'N/A'}
                                                            </p>
                                                        </div>
                                                        <div className="p-3 rounded-lg bg-[var(--glass-bg)]">
                                                            <p className="text-xs text-[var(--text-muted)]">Intensity</p>
                                                            <p className="font-semibold">{getMotionIntensityLabel(fingerprint.motion_intensity)}</p>
                                                        </div>
                                                        <div className="p-3 rounded-lg bg-[var(--glass-bg)]">
                                                            <p className="text-xs text-[var(--text-muted)]">Cut Density</p>
                                                            <p className="font-semibold">{fingerprint.cut_density.toFixed(1)}/min</p>
                                                        </div>
                                                    </div>

                                                    {/* Segment Motion */}
                                                    <div className="mt-3 space-y-2">
                                                        <p className="text-xs text-[var(--text-muted)]">Motion by Segment:</p>
                                                        <div className="flex gap-2">
                                                            {[
                                                                { label: '0-1s', value: fingerprint.avg_motion_0_1s },
                                                                { label: '1-3s', value: fingerprint.avg_motion_1_3s },
                                                                { label: '3-5s', value: fingerprint.avg_motion_3_5s },
                                                            ].map((seg, i) => (
                                                                <div key={i} className="flex-1">
                                                                    <div className="h-2 bg-[var(--glass-bg)] rounded-full overflow-hidden">
                                                                        <div
                                                                            className="h-full bg-[var(--accent-primary)]"
                                                                            style={{ width: `${(seg.value || 0) * 100}%` }}
                                                                        />
                                                                    </div>
                                                                    <p className="text-xs text-center text-[var(--text-muted)] mt-1">{seg.label}</p>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                </div>
                                            )}

                                            {/* Audio (Video only) */}
                                            {fingerprint.type === 'video' && (
                                                <div className="mb-4">
                                                    <h4 className="text-sm font-medium text-[var(--text-muted)] mb-2 flex items-center gap-2">
                                                        {fingerprint.silence_ratio && fingerprint.silence_ratio < 0.5 ? (
                                                            <Volume2 size={14} />
                                                        ) : (
                                                            <VolumeX size={14} />
                                                        )}
                                                        Audio
                                                    </h4>
                                                    <div className="grid grid-cols-3 gap-3">
                                                        <div className="p-3 rounded-lg bg-[var(--glass-bg)]">
                                                            <p className="text-xs text-[var(--text-muted)]">Audio Onset</p>
                                                            <p className="font-semibold">
                                                                {fingerprint.audio_onset_ms !== null ? `${fingerprint.audio_onset_ms}ms` : 'No audio'}
                                                            </p>
                                                        </div>
                                                        <div className="p-3 rounded-lg bg-[var(--glass-bg)]">
                                                            <p className="text-xs text-[var(--text-muted)]">Silence Ratio</p>
                                                            <p className="font-semibold">
                                                                {fingerprint.silence_ratio !== undefined
                                                                    ? `${(fingerprint.silence_ratio * 100).toFixed(0)}%`
                                                                    : 'N/A'}
                                                            </p>
                                                        </div>
                                                        <div className="p-3 rounded-lg bg-[var(--glass-bg)]">
                                                            <p className="text-xs text-[var(--text-muted)]">Speech Early</p>
                                                            <p className="font-semibold">
                                                                {fingerprint.speech_early ? (
                                                                    <span className="text-green-400">✓ Yes</span>
                                                                ) : (
                                                                    <span className="text-[var(--text-muted)]">✗ No</span>
                                                                )}
                                                            </p>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}

                                            {/* Visual */}
                                            <div className="mb-4">
                                                <h4 className="text-sm font-medium text-[var(--text-muted)] mb-2 flex items-center gap-2">
                                                    <Sun size={14} />
                                                    Visual
                                                </h4>
                                                <div className="grid grid-cols-3 gap-3">
                                                    <div className="p-3 rounded-lg bg-[var(--glass-bg)]">
                                                        <p className="text-xs text-[var(--text-muted)]">Brightness</p>
                                                        <p className="font-semibold">{(fingerprint.brightness_avg * 100).toFixed(0)}%</p>
                                                    </div>
                                                    <div className="p-3 rounded-lg bg-[var(--glass-bg)]">
                                                        <p className="text-xs text-[var(--text-muted)]">Contrast</p>
                                                        <p className="font-semibold">{(fingerprint.contrast_avg * 100).toFixed(0)}%</p>
                                                    </div>
                                                    {fingerprint.edge_density !== undefined && (
                                                        <div className="p-3 rounded-lg bg-[var(--glass-bg)]">
                                                            <p className="text-xs text-[var(--text-muted)]">Edge Density</p>
                                                            <p className="font-semibold">{(fingerprint.edge_density * 100).toFixed(0)}%</p>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Extraction Info */}
                                            <div className="text-xs text-[var(--text-muted)] flex items-center justify-between pt-3 border-t border-[var(--glass-border)]">
                                                <span>Extracted {fingerprint.segments_analyzed} segments in {(fingerprint.extraction_time_ms / 1000).toFixed(1)}s</span>
                                                <span>100% client-side</span>
                                            </div>
                                        </GlassCard>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Footer */}
                        {fingerprint && (
                            <div className="p-6 border-t border-[var(--glass-border)] flex items-center justify-end gap-3">
                                <button
                                    onClick={handleClose}
                                    className="btn-secondary"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleAddToLibrary}
                                    className="btn-primary flex items-center gap-2"
                                >
                                    <CheckCircle size={18} />
                                    Add to Library
                                </button>
                            </div>
                        )}
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}

export default UploadCreativeModal;
