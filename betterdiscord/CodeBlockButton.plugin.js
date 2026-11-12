/**
 * @name CodeBlockButton
 * @author Pota
 * @description Adds a code block (```) button next to the inline code button in the popup that appears when you select text in the chat box. Click it again to unwrap.
 * @version 1.0.0
 * @source https://github.com/Plyxen/discord-rice
 * @website https://github.com/Plyxen/discord-rice
 */

/*
 * discord-rice (https://github.com/Plyxen/discord-rice)
 * Copyright (c) 2026 Pota
 * SPDX-License-Identifier: GPL-3.0-or-later
 *
 * The Vencord plugin of the same name rewrites Discord's own formatting code to know about ```.
 * BetterDiscord can't rewrite Discord's code, so this one works from the outside: when Discord's
 * formatting popup shows up, it adds a button to it that looks like the others, and the button replaces
 * the selected text with the same text inside ``` (or takes the ``` off again).
 *
 * The popup is found by the id Discord gives it (slate-toolbar), and the new button copies its looks
 * from the button next to it, so nothing here depends on Discord's class names.
 */

const FENCE = "```";
const MARK = "rice-codeblock-btn";
const ICON = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'
    + '<rect x="2.5" y="4" width="19" height="16" rx="3"/><path d="M9.5 9 6.5 12l3 3M14.5 9l3 3-3 3"/></svg>';

/** The text inside the ```, or null if the text isn't wrapped in them. */
function unwrapped(text) {
    const match = /^```\n?([\s\S]*?)\n?```$/.exec(text);
    return match ? match[1] : null;
}

/** The same text inside ```. Several lines get the ``` on lines of their own, so the first line isn't read as a language name. */
function wrapped(text) {
    return text.includes("\n") ? `${FENCE}\n${text}\n${FENCE}` : FENCE + text + FENCE;
}

/** Which end of a selection comes first in the text. */
function startOf({ anchor, focus }) {
    for (let i = 0; i < Math.max(anchor.path.length, focus.path.length); i++) {
        const a = anchor.path[i] ?? -1, f = focus.path[i] ?? -1;
        if (a !== f) return a < f ? anchor : focus;
    }
    return anchor.offset <= focus.offset ? anchor : focus;
}

module.exports = class CodeBlockButton {
    start() {
        // Discord shows the popup a moment after the mouse button comes up over selected text
        this.onMouseUp = () => {
            this.timers?.forEach(clearTimeout);
            this.timers = [150, 400].map(ms => setTimeout(() => this.add(), ms));
        };
        document.addEventListener("mouseup", this.onMouseUp, true);
    }

    stop() {
        document.removeEventListener("mouseup", this.onMouseUp, true);
        this.timers?.forEach(clearTimeout);
        document.querySelectorAll("." + MARK).forEach(button => button.remove());
    }

    add() {
        const toolbar = document.getElementById("slate-toolbar");
        if (!toolbar) return;
        if (toolbar.querySelector("." + MARK)) return this.refresh(toolbar);

        // the last button is the spoiler eye, and inline code (<>) sits right before it
        const buttons = toolbar.querySelectorAll("button[aria-pressed]");
        const last = buttons[buttons.length - 1];
        if (!last) return;

        const button = document.createElement("button");
        button.type = "button";
        button.className = `${last.className} ${MARK}`;
        button.setAttribute("aria-label", "Code Block");
        button.title = "Code Block";
        button.innerHTML = ICON;
        const iconClass = last.querySelector("svg")?.getAttribute("class");
        if (iconClass) button.firstElementChild.setAttribute("class", iconClass);
        button.addEventListener("click", event => {
            event.preventDefault();
            event.stopPropagation();
            this.toggle(toolbar);
            this.refresh(toolbar);
        });
        last.parentElement.insertBefore(button, last);
        this.refresh(toolbar);
    }

    /** Lights the button up while the selection is a code block, like Discord's own buttons. */
    refresh(toolbar) {
        const button = toolbar.querySelector("." + MARK);
        const text = window.getSelection()?.toString() ?? "";
        button?.setAttribute("aria-pressed", String(unwrapped(text) != null));
    }

    /** Discord's text editor behind the popup, which the popup is handed when it is drawn. */
    editor(toolbar) {
        try {
            let node = BdApi.ReactUtils.getInternalInstance(toolbar.firstElementChild ?? toolbar);
            for (let i = 0; node && i < 8; i++, node = node.return) {
                if (node.memoizedProps?.slateEditor) return node.memoizedProps.slateEditor;
            }
        } catch { }
        return null;
    }

    toggle(toolbar) {
        const text = window.getSelection()?.toString() ?? "";
        if (!text) return;
        const next = unwrapped(text) ?? wrapped(text);

        const editor = this.editor(toolbar);
        const start = editor?.selection ? startOf(editor.selection) : null;
        if (typeof editor?.insertData === "function") {
            // the way pasted text goes in: it replaces the selection and keeps line breaks as lines
            const data = new DataTransfer();
            data.setData("text/plain", next);
            editor.insertData(data);
        } else {
            document.execCommand("insertText", false, next);
        }

        // select what was put in, so a second click takes the ``` off again
        try {
            if (start && editor.selection) {
                editor.apply({
                    type: "set_selection",
                    properties: editor.selection,
                    newProperties: { anchor: start, focus: editor.selection.focus }
                });
            }
        } catch { }
    }
};
