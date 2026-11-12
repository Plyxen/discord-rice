/*
 * discord-rice (https://github.com/Plyxen/discord-rice)
 * Copyright (c) 2026 Pota
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

// Stands in for "@webpack/common" and Vencord's "@components/...": React's hooks, Discord's stores, and
// plain versions of the few interface pieces the shared code uses (buttons, a dialog, a text box, a
// drop-down). Their looks are in shims.css.

import type { ReactNode } from "react";

declare const BdApi: any;

export const { useState, useEffect, useReducer, useRef, useMemo, useCallback } = BdApi.React;

/* ---------------- Discord's own data ---------------- */

// looked up when first used, because Discord may not have loaded a store yet when the plugin starts
function store(name: string) {
    return new Proxy({} as any, {
        get(_, key: string) {
            const found = BdApi.Webpack.getStore(name);
            const value = found?.[key];
            return typeof value === "function" ? value.bind(found) : value;
        }
    });
}

export const GuildStore = store("GuildStore");
export const SortedGuildStore = store("SortedGuildStore");
export const UserStore = store("UserStore");

export const IconUtils = {
    getGuildIconURL({ id, icon, size = 32 }: { id: string; icon: string; size?: number; canAnimate?: boolean; }) {
        return `https://cdn.discordapp.com/icons/${id}/${icon}.webp?size=${size}`;
    }
};

export function showToast({ text, variant }: { text: string; variant?: string; }) {
    BdApi.UI.showToast(text, { type: variant === "critical" ? "error" : variant === "positive" ? "success" : "info" });
}

// Discord's own menu pieces, which BetterDiscord hands out. Read when a menu is drawn, not before
export const Menu = {
    get MenuItem() { return BdApi.ContextMenu.Item; },
    get MenuGroup() { return BdApi.ContextMenu.Group; },
    get MenuSeparator() { return BdApi.ContextMenu.Separator; }
};

/* ---------------- a window on top of Discord ---------------- */

interface ModalProps { onClose(): void; transitionState: number; }

const openModals = new Set<() => void>();

/** Closes every window opened with openModal. For when a plugin is turned off. */
export function closeAllModals() {
    [...openModals].forEach(close => close());
}

export function openModal(render: (props: ModalProps) => ReactNode) {
    const host = document.createElement("div");
    host.className = "rice-bd-host";
    document.body.appendChild(host);
    const root = BdApi.ReactDOM.createRoot(host);

    const close = () => {
        if (!openModals.delete(close)) return;
        document.removeEventListener("keydown", onKey, true);
        root.unmount();
        host.remove();
    };
    // Esc closes it, and goes no further (Discord would close something of its own too)
    const onKey = (e: KeyboardEvent) => {
        if (e.key !== "Escape") return;
        e.stopPropagation();
        close();
    };
    document.addEventListener("keydown", onKey, true);
    openModals.add(close);

    root.render(
        <div className="rice-bd-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) close(); }}>
            {render({ onClose: close, transitionState: 1 })}
        </div>
    );
    return close;
}

interface ModalAction { text: string; variant?: string; onClick(): void; loading?: boolean; disabled?: boolean; }

/** A small dialog: a title, a line under it, the content, and buttons at the bottom. */
export function Modal({ title, subtitle, notice, actions = [], children }: {
    title: string; subtitle?: string; notice?: { message: string; type?: string; }; actions?: ModalAction[]; children?: ReactNode;
}) {
    return (
        <div className="rice-bd-dialog" role="dialog" aria-modal aria-label={title}>
            <h2>{title}</h2>
            {subtitle && <p>{subtitle}</p>}
            {notice && <p className="rice-bd-notice" role="alert">{notice.message}</p>}
            {children}
            <div className="rice-bd-actions">
                {actions.map(a => (
                    <Button key={a.text} variant={a.variant} disabled={a.disabled || a.loading} onClick={a.onClick}>
                        {a.loading ? "…" : a.text}
                    </Button>
                ))}
            </div>
        </div>
    );
}

export function TextInput({ value, onChange, placeholder, maxLength, autoFocus }: {
    value: string; onChange(value: string): void; placeholder?: string; maxLength?: number; autoFocus?: boolean;
}) {
    return (
        <input className="rice-bd-input" value={value} placeholder={placeholder} maxLength={maxLength} autoFocus={autoFocus}
            spellCheck={false} onChange={e => onChange(e.currentTarget.value)} />
    );
}

export function Select<T>({ options, placeholder, isSelected, select, serialize }: {
    options: { label: string; value: T; }[]; placeholder?: string; isSelected(value: T): boolean; select(value: T): void;
    serialize(value: T): string; closeOnSelect?: boolean;
}) {
    const current = options.find(o => isSelected(o.value));
    return (
        <select className="rice-bd-input" value={current ? serialize(current.value) : ""}
            onChange={e => {
                const picked = options.find(o => serialize(o.value) === e.currentTarget.value);
                if (picked) select(picked.value);
            }}>
            <option value="" disabled>{placeholder ?? "Choose…"}</option>
            {options.map(o => <option key={serialize(o.value)} value={serialize(o.value)}>{o.label}</option>)}
        </select>
    );
}

/* ---------------- @components/... ---------------- */

export function Button({ variant = "primary", size = "medium", className, children, ...rest }: any) {
    return <button className={`rice-bd-btn ${variant} ${size}${className ? " " + className : ""}`} {...rest}>{children}</button>;
}

export function Paragraph({ children }: { children?: ReactNode; }) {
    return <p className="rice-bd-p">{children}</p>;
}

/** Vencord wraps a settings page in this for its margins. BetterDiscord's settings window has its own. */
export function SettingsTab({ children }: { children?: ReactNode; }) {
    return <div className="rice-bd-page">{children}</div>;
}

/** If something inside breaks while drawing, show a line of text there instead of taking Discord down. */
export default class ErrorBoundary extends BdApi.React.Component<{ noop?: boolean; children?: ReactNode; }, { failed: boolean; }> {
    state = { failed: false };

    static getDerivedStateFromError() {
        return { failed: true };
    }

    componentDidCatch(error: unknown) {
        console.error("[discord-rice]", error);
    }

    render() {
        if (!this.state.failed) return this.props.children;
        return this.props.noop ? null : <p className="rice-bd-notice">Something went wrong drawing this. The console has the details.</p>;
    }
}
