// Currency formatting utilities for PHP (Philippine Peso)

export function formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-PH', {
        style: 'currency',
        currency: 'PHP',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(amount);
}

export function formatCurrencyCompact(amount: number): string {
    if (amount >= 1000000) {
        return `₱${(amount / 1000000).toFixed(1)}M`;
    }
    if (amount >= 1000) {
        return `₱${(amount / 1000).toFixed(1)}K`;
    }
    return formatCurrency(amount);
}

export const CURRENCY_SYMBOL = '₱';
export const CURRENCY_CODE = 'PHP';
