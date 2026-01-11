'use client';

import React, { useState } from 'react';
import { ONBOARDING_SCREENS, OnboardingScreen } from '@/lib/onboarding';

/**
 * Onboarding Modal
 * 
 * GAP 3: 2-screen blocking flow, one-time only.
 * Cannot be skipped or dismissed without completing.
 */

interface OnboardingModalProps {
    onComplete: () => void;
}

export function OnboardingModal({ onComplete }: OnboardingModalProps) {
    const [currentScreen, setCurrentScreen] = useState(0);

    const screen = ONBOARDING_SCREENS[currentScreen];
    const isLastScreen = currentScreen === ONBOARDING_SCREENS.length - 1;

    const handleNext = () => {
        if (isLastScreen) {
            onComplete();
        } else {
            setCurrentScreen(prev => prev + 1);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80">
            <div className="w-full max-w-lg mx-4 bg-[var(--glass-bg)] border border-[var(--border-subtle)] 
                            rounded-xl shadow-2xl overflow-hidden">
                {/* Progress indicator */}
                <div className="flex gap-2 p-4 border-b border-[var(--border-subtle)]">
                    {ONBOARDING_SCREENS.map((_, idx) => (
                        <div
                            key={idx}
                            className={`h-1 flex-1 rounded-full transition-colors ${idx <= currentScreen
                                    ? 'bg-primary-500'
                                    : 'bg-[var(--glass-bg)]'
                                }`}
                        />
                    ))}
                </div>

                {/* Content */}
                <div className="p-8">
                    <h2 className="text-2xl font-bold mb-6 text-[var(--text-primary)]">
                        {screen.title}
                    </h2>

                    <div className="space-y-2 text-[var(--text-secondary)]">
                        {screen.content.map((line, idx) => (
                            <p key={idx} className={`${line === '' ? 'my-4' : ''} ${line.startsWith('✓') ? 'text-green-400' : ''
                                } ${line.startsWith('→') ? 'ml-4' : ''
                                } ${line.startsWith('⚠️') ? 'text-amber-400 font-medium mt-4' : ''
                                }`}>
                                {line}
                            </p>
                        ))}
                    </div>
                </div>

                {/* Footer */}
                <div className="p-6 border-t border-[var(--border-subtle)] bg-[var(--glass-bg)]">
                    <button
                        onClick={handleNext}
                        className="w-full py-3 px-6 bg-primary-600 hover:bg-primary-700 
                                   text-white font-medium rounded-lg transition-colors"
                    >
                        {screen.buttonText}
                    </button>

                    {/* No skip button - intentional */}
                    <p className="text-center text-xs text-[var(--text-muted)] mt-4">
                        {currentScreen + 1} of {ONBOARDING_SCREENS.length}
                    </p>
                </div>
            </div>
        </div>
    );
}

/**
 * Onboarding wrapper that checks if onboarding is needed.
 */
interface OnboardingGateProps {
    children: React.ReactNode;
    showOnboarding: boolean;
    onComplete: () => void;
}

export function OnboardingGate({ children, showOnboarding, onComplete }: OnboardingGateProps) {
    if (showOnboarding) {
        return <OnboardingModal onComplete={onComplete} />;
    }

    return <>{children}</>;
}
