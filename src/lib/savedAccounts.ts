'use client';

export interface SavedAccount {
    email: string;
    fullName?: string;
    avatarUrl?: string;
    lastSignedIn: string;
}

const STORAGE_KEY = 'athena_saved_accounts';

export function getSavedAccounts(): SavedAccount[] {
    if (typeof window === 'undefined') return [];

    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (!stored) return [];
        return JSON.parse(stored);
    } catch {
        return [];
    }
}

export function saveAccount(account: Omit<SavedAccount, 'lastSignedIn'>): void {
    if (typeof window === 'undefined') return;

    const accounts = getSavedAccounts();

    // Remove existing entry for this email if present
    const filtered = accounts.filter(a => a.email !== account.email);

    // Add new entry at the beginning
    const newAccount: SavedAccount = {
        ...account,
        lastSignedIn: new Date().toISOString(),
    };

    filtered.unshift(newAccount);

    // Keep only latest 5 accounts
    const trimmed = filtered.slice(0, 5);

    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
}

export function removeAccount(email: string): void {
    if (typeof window === 'undefined') return;

    const accounts = getSavedAccounts();
    const filtered = accounts.filter(a => a.email !== email);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
}

export function clearAllAccounts(): void {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(STORAGE_KEY);
}
