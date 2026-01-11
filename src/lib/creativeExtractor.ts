/**
 * Creative Structure Extraction System
 * 
 * 100% client-side extraction of mechanical/temporal structure from photos & videos.
 * Extracts signals for delivery prediction without semantic interpretation.
 * 
 * Non-Goals:
 * - Does NOT understand meaning or emotion
 * - Does NOT interpret copy or persuasion
 * - Does NOT decide why people buy
 * - Does NOT replace creative judgment
 */

// ==================== TYPE DEFINITIONS ====================

export interface StructureFingerprint {
    type: 'video' | 'image';
    filename: string;
    file_size_bytes: number;
    duration_s?: number;
    aspect_ratio: string;
    width: number;
    height: number;

    // Motion (video only)
    motion_onset_ms?: number;
    motion_intensity: 'low' | 'medium' | 'high';
    avg_motion_0_1s?: number;
    avg_motion_1_3s?: number;
    avg_motion_3_5s?: number;

    // Cuts/Pacing (video only)
    cuts_0_1s?: number;
    cuts_1_3s?: number;
    cuts_3_5s?: number;
    avg_shot_length_opening?: number;
    cut_density: number; // cuts per minute

    // Audio (video only)
    audio_onset_ms?: number;
    silence_ratio?: number;
    loudness_curve?: number[];
    speech_early?: boolean;

    // Visual (both)
    brightness_0_1s: number;
    brightness_avg: number;
    contrast_0_1s: number;
    contrast_avg: number;
    brightness_curve?: number[];

    // Image-specific
    edge_density?: number;
    visual_complexity?: number;
    text_area_pct?: number;

    // Confidence & metadata
    confidence: 'high' | 'medium' | 'low';
    extraction_time_ms: number;
    segments_analyzed: number;
}

export interface ExtractionProgress {
    stage: 'loading' | 'frames' | 'motion' | 'audio' | 'finalizing';
    progress: number; // 0-100
    message: string;
}

type ProgressCallback = (progress: ExtractionProgress) => void;

// ==================== CONSTANTS ====================

const DOWNSCALE_WIDTH = 320;
const DOWNSCALE_HEIGHT = 180;
const FPS_FIRST_3S = 5;
const FPS_AFTER_3S = 2;
const CUT_THRESHOLD = 0.35; // Frame difference threshold for cut detection
const SILENCE_THRESHOLD = 0.02; // RMS threshold for silence
const MOTION_THRESHOLD_LOW = 0.1;
const MOTION_THRESHOLD_HIGH = 0.4;

// ==================== MAIN EXTRACTION FUNCTIONS ====================

/**
 * Extract structure fingerprint from a file (video or image)
 */
export async function extractStructure(
    file: File,
    onProgress?: ProgressCallback
): Promise<StructureFingerprint> {
    const startTime = performance.now();

    const isVideo = file.type.startsWith('video/');
    const isImage = file.type.startsWith('image/');

    if (!isVideo && !isImage) {
        throw new Error('Unsupported file type. Please upload a video or image.');
    }

    onProgress?.({ stage: 'loading', progress: 0, message: 'Loading file...' });

    if (isVideo) {
        return extractVideoStructure(file, startTime, onProgress);
    } else {
        return extractImageStructure(file, startTime, onProgress);
    }
}

// ==================== VIDEO EXTRACTION ====================

async function extractVideoStructure(
    file: File,
    startTime: number,
    onProgress?: ProgressCallback
): Promise<StructureFingerprint> {
    const url = URL.createObjectURL(file);

    try {
        // Load video metadata
        onProgress?.({ stage: 'loading', progress: 5, message: 'Loading video...' });
        const video = await loadVideo(url);

        const duration = video.duration;
        const width = video.videoWidth;
        const height = video.videoHeight;
        const aspectRatio = getAspectRatio(width, height);

        // Calculate frame timestamps
        const timestamps = generateTimestamps(duration);

        // Extract frames
        onProgress?.({ stage: 'frames', progress: 10, message: 'Extracting frames...' });
        const frames = await extractFrames(video, timestamps, onProgress);

        // Analyze motion
        onProgress?.({ stage: 'motion', progress: 60, message: 'Analyzing motion...' });
        const motionData = analyzeMotion(frames, timestamps);

        // Analyze brightness
        const brightnessData = analyzeBrightness(frames, timestamps);

        // Analyze audio
        onProgress?.({ stage: 'audio', progress: 80, message: 'Analyzing audio...' });
        const audioData = await analyzeAudio(file);

        // Finalize
        onProgress?.({ stage: 'finalizing', progress: 95, message: 'Finalizing...' });

        const extractionTime = performance.now() - startTime;

        const fingerprint: StructureFingerprint = {
            type: 'video',
            filename: file.name,
            file_size_bytes: file.size,
            duration_s: duration,
            aspect_ratio: aspectRatio,
            width,
            height,

            // Motion
            motion_onset_ms: motionData.onset_ms,
            motion_intensity: motionData.intensity,
            avg_motion_0_1s: motionData.avg_0_1s,
            avg_motion_1_3s: motionData.avg_1_3s,
            avg_motion_3_5s: motionData.avg_3_5s,

            // Cuts
            cuts_0_1s: motionData.cuts_0_1s,
            cuts_1_3s: motionData.cuts_1_3s,
            cuts_3_5s: motionData.cuts_3_5s,
            cut_density: motionData.cut_density,
            avg_shot_length_opening: motionData.avg_shot_length,

            // Audio
            audio_onset_ms: audioData.onset_ms,
            silence_ratio: audioData.silence_ratio,
            loudness_curve: audioData.loudness_curve,
            speech_early: audioData.onset_ms !== null && audioData.onset_ms < 500,

            // Brightness
            brightness_0_1s: brightnessData.brightness_0_1s,
            brightness_avg: brightnessData.brightness_avg,
            brightness_curve: brightnessData.curve,
            contrast_0_1s: brightnessData.contrast_0_1s,
            contrast_avg: brightnessData.contrast_avg,

            // Confidence
            confidence: calculateConfidence(duration, frames.length, audioData.hasAudio),
            extraction_time_ms: extractionTime,
            segments_analyzed: frames.length,
        };

        onProgress?.({ stage: 'finalizing', progress: 100, message: 'Complete!' });

        return fingerprint;

    } finally {
        URL.revokeObjectURL(url);
    }
}

// ==================== IMAGE EXTRACTION ====================

async function extractImageStructure(
    file: File,
    startTime: number,
    onProgress?: ProgressCallback
): Promise<StructureFingerprint> {
    const url = URL.createObjectURL(file);

    try {
        onProgress?.({ stage: 'loading', progress: 10, message: 'Loading image...' });

        const img = await loadImage(url);
        const width = img.naturalWidth;
        const height = img.naturalHeight;
        const aspectRatio = getAspectRatio(width, height);

        // Draw to canvas
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d')!;

        // Downscale
        const scale = Math.min(DOWNSCALE_WIDTH / width, DOWNSCALE_HEIGHT / height, 1);
        canvas.width = Math.round(width * scale);
        canvas.height = Math.round(height * scale);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        onProgress?.({ stage: 'motion', progress: 40, message: 'Analyzing structure...' });

        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

        // Analyze brightness & contrast
        const { brightness, contrast } = analyzeImageBrightnessContrast(imageData);

        // Analyze edges (visual complexity)
        onProgress?.({ stage: 'motion', progress: 70, message: 'Detecting edges...' });
        const edgeData = analyzeEdges(imageData, canvas.width, canvas.height);

        onProgress?.({ stage: 'finalizing', progress: 95, message: 'Finalizing...' });

        const extractionTime = performance.now() - startTime;

        const fingerprint: StructureFingerprint = {
            type: 'image',
            filename: file.name,
            file_size_bytes: file.size,
            aspect_ratio: aspectRatio,
            width,
            height,

            motion_intensity: 'low', // Images don't have motion
            cut_density: 0,

            // Visual
            brightness_0_1s: brightness,
            brightness_avg: brightness,
            contrast_0_1s: contrast,
            contrast_avg: contrast,
            edge_density: edgeData.edge_density,
            visual_complexity: edgeData.complexity,

            // Confidence
            confidence: 'high',
            extraction_time_ms: extractionTime,
            segments_analyzed: 1,
        };

        onProgress?.({ stage: 'finalizing', progress: 100, message: 'Complete!' });

        return fingerprint;

    } finally {
        URL.revokeObjectURL(url);
    }
}

// ==================== HELPER FUNCTIONS ====================

function loadVideo(url: string): Promise<HTMLVideoElement> {
    return new Promise((resolve, reject) => {
        const video = document.createElement('video');
        video.crossOrigin = 'anonymous';
        video.muted = true;
        video.preload = 'auto';

        video.onloadedmetadata = () => resolve(video);
        video.onerror = () => reject(new Error('Failed to load video'));

        video.src = url;
        video.load();
    });
}

function loadImage(url: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';

        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error('Failed to load image'));

        img.src = url;
    });
}

function getAspectRatio(width: number, height: number): string {
    const gcd = (a: number, b: number): number => b === 0 ? a : gcd(b, a % b);
    const divisor = gcd(width, height);
    const w = width / divisor;
    const h = height / divisor;

    // Common aspect ratios
    if (Math.abs(w / h - 16 / 9) < 0.1) return '16:9';
    if (Math.abs(w / h - 9 / 16) < 0.1) return '9:16';
    if (Math.abs(w / h - 4 / 3) < 0.1) return '4:3';
    if (Math.abs(w / h - 1) < 0.1) return '1:1';
    if (Math.abs(w / h - 4 / 5) < 0.1) return '4:5';

    return `${w}:${h}`;
}

function generateTimestamps(duration: number): number[] {
    const timestamps: number[] = [];

    // 0-3s at 5 FPS
    for (let t = 0; t < Math.min(3, duration); t += 1 / FPS_FIRST_3S) {
        timestamps.push(t);
    }

    // 3s+ at 2 FPS
    for (let t = 3; t < duration; t += 1 / FPS_AFTER_3S) {
        timestamps.push(t);
    }

    return timestamps;
}

interface FrameData {
    timestamp: number;
    pixels: Uint8ClampedArray;
    width: number;
    height: number;
}

async function extractFrames(
    video: HTMLVideoElement,
    timestamps: number[],
    onProgress?: ProgressCallback
): Promise<FrameData[]> {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d')!;

    // Downscale dimensions
    const scale = Math.min(DOWNSCALE_WIDTH / video.videoWidth, DOWNSCALE_HEIGHT / video.videoHeight, 1);
    canvas.width = Math.round(video.videoWidth * scale);
    canvas.height = Math.round(video.videoHeight * scale);

    const frames: FrameData[] = [];

    for (let i = 0; i < timestamps.length; i++) {
        const t = timestamps[i];

        // Seek to timestamp
        await seekVideo(video, t);

        // Draw frame
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

        frames.push({
            timestamp: t,
            pixels: imageData.data,
            width: canvas.width,
            height: canvas.height,
        });

        // Update progress
        const progress = 10 + (i / timestamps.length) * 50;
        onProgress?.({ stage: 'frames', progress, message: `Extracting frame ${i + 1}/${timestamps.length}` });
    }

    return frames;
}

function seekVideo(video: HTMLVideoElement, time: number): Promise<void> {
    return new Promise((resolve) => {
        video.currentTime = time;
        video.onseeked = () => resolve();
    });
}

interface MotionAnalysis {
    onset_ms: number | null;
    intensity: 'low' | 'medium' | 'high';
    avg_0_1s: number;
    avg_1_3s: number;
    avg_3_5s: number;
    cuts_0_1s: number;
    cuts_1_3s: number;
    cuts_3_5s: number;
    cut_density: number;
    avg_shot_length: number;
}

function analyzeMotion(frames: FrameData[], timestamps: number[]): MotionAnalysis {
    const motionScores: { t: number; score: number }[] = [];
    const cuts: number[] = [];

    for (let i = 1; i < frames.length; i++) {
        const prev = frames[i - 1];
        const curr = frames[i];

        // Calculate frame difference
        const diff = calculateFrameDifference(prev.pixels, curr.pixels);
        motionScores.push({ t: curr.timestamp, score: diff });

        // Detect cuts
        if (diff > CUT_THRESHOLD) {
            cuts.push(curr.timestamp);
        }
    }

    // Calculate segment averages
    const avg_0_1s = averageInRange(motionScores, 0, 1);
    const avg_1_3s = averageInRange(motionScores, 1, 3);
    const avg_3_5s = averageInRange(motionScores, 3, 5);

    // Calculate cuts per segment
    const cuts_0_1s = cuts.filter(t => t >= 0 && t < 1).length;
    const cuts_1_3s = cuts.filter(t => t >= 1 && t < 3).length;
    const cuts_3_5s = cuts.filter(t => t >= 3 && t < 5).length;

    // Motion onset (first significant motion)
    const onsetFrame = motionScores.find(m => m.score > MOTION_THRESHOLD_LOW);
    const onset_ms = onsetFrame ? Math.round(onsetFrame.t * 1000) : null;

    // Overall intensity
    const avgMotion = motionScores.reduce((sum, m) => sum + m.score, 0) / motionScores.length;
    const intensity: 'low' | 'medium' | 'high' =
        avgMotion < MOTION_THRESHOLD_LOW ? 'low' :
            avgMotion < MOTION_THRESHOLD_HIGH ? 'medium' : 'high';

    // Cut density (cuts per minute)
    const duration = timestamps[timestamps.length - 1] || 1;
    const cut_density = (cuts.length / duration) * 60;

    // Average shot length in opening (first 3s)
    const openingCuts = cuts.filter(t => t < 3);
    const avg_shot_length = openingCuts.length > 0 ? 3 / (openingCuts.length + 1) : 3;

    return {
        onset_ms,
        intensity,
        avg_0_1s,
        avg_1_3s,
        avg_3_5s,
        cuts_0_1s,
        cuts_1_3s,
        cuts_3_5s,
        cut_density,
        avg_shot_length,
    };
}

function calculateFrameDifference(prev: Uint8ClampedArray, curr: Uint8ClampedArray): number {
    let diff = 0;
    const pixelCount = prev.length / 4;

    for (let i = 0; i < prev.length; i += 4) {
        // Compare RGB, skip alpha
        diff += Math.abs(prev[i] - curr[i]) / 255;
        diff += Math.abs(prev[i + 1] - curr[i + 1]) / 255;
        diff += Math.abs(prev[i + 2] - curr[i + 2]) / 255;
    }

    return diff / (pixelCount * 3);
}

function averageInRange(scores: { t: number; score: number }[], start: number, end: number): number {
    const inRange = scores.filter(s => s.t >= start && s.t < end);
    if (inRange.length === 0) return 0;
    return inRange.reduce((sum, s) => sum + s.score, 0) / inRange.length;
}

interface BrightnessAnalysis {
    brightness_0_1s: number;
    brightness_avg: number;
    contrast_0_1s: number;
    contrast_avg: number;
    curve: number[];
}

function analyzeBrightness(frames: FrameData[], timestamps: number[]): BrightnessAnalysis {
    const brightnessValues: { t: number; brightness: number; contrast: number }[] = [];

    for (const frame of frames) {
        const { brightness, contrast } = analyzeImageBrightnessContrast({
            data: frame.pixels,
            width: frame.width,
            height: frame.height,
        } as ImageData);

        brightnessValues.push({ t: frame.timestamp, brightness, contrast });
    }

    const in0_1s = brightnessValues.filter(b => b.t >= 0 && b.t < 1);
    const brightness_0_1s = in0_1s.length > 0
        ? in0_1s.reduce((sum, b) => sum + b.brightness, 0) / in0_1s.length
        : 0;
    const contrast_0_1s = in0_1s.length > 0
        ? in0_1s.reduce((sum, b) => sum + b.contrast, 0) / in0_1s.length
        : 0;

    const brightness_avg = brightnessValues.reduce((sum, b) => sum + b.brightness, 0) / brightnessValues.length;
    const contrast_avg = brightnessValues.reduce((sum, b) => sum + b.contrast, 0) / brightnessValues.length;

    return {
        brightness_0_1s,
        brightness_avg,
        contrast_0_1s,
        contrast_avg,
        curve: brightnessValues.map(b => b.brightness),
    };
}

function analyzeImageBrightnessContrast(imageData: ImageData): { brightness: number; contrast: number } {
    const data = imageData.data;
    let sum = 0;
    let sumSquared = 0;
    const pixelCount = data.length / 4;

    for (let i = 0; i < data.length; i += 4) {
        // Convert to grayscale
        const gray = (data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114) / 255;
        sum += gray;
        sumSquared += gray * gray;
    }

    const brightness = sum / pixelCount;
    const variance = (sumSquared / pixelCount) - (brightness * brightness);
    const contrast = Math.sqrt(Math.max(0, variance));

    return { brightness, contrast };
}

interface AudioAnalysis {
    onset_ms: number | null;
    silence_ratio: number;
    loudness_curve: number[];
    hasAudio: boolean;
}

async function analyzeAudio(file: File): Promise<AudioAnalysis> {
    try {
        const arrayBuffer = await file.arrayBuffer();
        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();

        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
        const channelData = audioBuffer.getChannelData(0); // Mono
        const sampleRate = audioBuffer.sampleRate;

        // Analyze in 100ms windows
        const windowSamples = Math.floor(sampleRate * 0.1);
        const loudnessValues: number[] = [];
        let silentWindows = 0;
        let onset_ms: number | null = null;

        for (let i = 0; i < channelData.length; i += windowSamples) {
            const window = channelData.slice(i, i + windowSamples);
            const rms = calculateRMS(window);
            loudnessValues.push(rms);

            if (rms < SILENCE_THRESHOLD) {
                silentWindows++;
            } else if (onset_ms === null) {
                onset_ms = Math.round((i / sampleRate) * 1000);
            }
        }

        const silence_ratio = loudnessValues.length > 0 ? silentWindows / loudnessValues.length : 1;

        await audioContext.close();

        return {
            onset_ms,
            silence_ratio,
            loudness_curve: loudnessValues,
            hasAudio: true,
        };

    } catch (error) {
        // No audio track or decode error
        return {
            onset_ms: null,
            silence_ratio: 1,
            loudness_curve: [],
            hasAudio: false,
        };
    }
}

function calculateRMS(samples: Float32Array): number {
    let sum = 0;
    for (let i = 0; i < samples.length; i++) {
        sum += samples[i] * samples[i];
    }
    return Math.sqrt(sum / samples.length);
}

interface EdgeAnalysis {
    edge_density: number;
    complexity: number;
}

function analyzeEdges(imageData: ImageData, width: number, height: number): EdgeAnalysis {
    const data = imageData.data;

    // Convert to grayscale array
    const gray: number[] = [];
    for (let i = 0; i < data.length; i += 4) {
        gray.push(data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114);
    }

    // Sobel edge detection
    let edgeSum = 0;

    for (let y = 1; y < height - 1; y++) {
        for (let x = 1; x < width - 1; x++) {
            const idx = y * width + x;

            // Sobel X
            const gx =
                -gray[idx - width - 1] + gray[idx - width + 1] +
                -2 * gray[idx - 1] + 2 * gray[idx + 1] +
                -gray[idx + width - 1] + gray[idx + width + 1];

            // Sobel Y
            const gy =
                -gray[idx - width - 1] - 2 * gray[idx - width] - gray[idx - width + 1] +
                gray[idx + width - 1] + 2 * gray[idx + width] + gray[idx + width + 1];

            const magnitude = Math.sqrt(gx * gx + gy * gy);
            edgeSum += magnitude;
        }
    }

    const pixelCount = (width - 2) * (height - 2);
    const edge_density = edgeSum / (pixelCount * 255);

    // Complexity is normalized edge density
    const complexity = Math.min(1, edge_density * 2);

    return { edge_density, complexity };
}

function calculateConfidence(duration: number, frameCount: number, hasAudio: boolean): 'high' | 'medium' | 'low' {
    if (duration > 60) return 'low'; // Too long
    if (frameCount < 5) return 'low'; // Too few frames
    if (duration < 3 && !hasAudio) return 'medium'; // Short without audio
    if (duration <= 15 && frameCount >= 10) return 'high';
    return 'medium';
}

// ==================== UTILITY EXPORTS ====================

export function getMotionIntensityLabel(intensity: 'low' | 'medium' | 'high'): string {
    return {
        low: '🐢 Low Motion',
        medium: '🏃 Medium Motion',
        high: '⚡ High Motion',
    }[intensity];
}

export function getConfidenceLabel(confidence: 'high' | 'medium' | 'low'): string {
    return {
        high: '✅ High Confidence',
        medium: '⚠️ Medium Confidence',
        low: '❓ Low Confidence',
    }[confidence];
}

export function formatDuration(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
}

export function formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
