/*
 * discord-rice (https://github.com/Plyxen/discord-rice)
 * Copyright (c) 2026 Pota
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

/*
 * CodeBlockButton, a Vencord user plugin.
 * Adds a ``` button next to the <> (inline code) button in the popup you get when you select text in
 * the chat box. Click it to wrap the selection in ``` ```, click again to unwrap.
 *
 * It reuses Discord's own formatting code: the popup's buttons all go through one function that
 * wraps or unwraps a selection with a marker from a small table (** for bold, ` for code, || for
 * spoilers...). The patches add ``` to that table, teach the "is this already wrapped?" check to
 * spot it, and add the button.
 */

import definePlugin from "@utils/types";

function CodeBlockIcon({ className }: { className?: string; }) {
    return (
        <svg
            className={className}
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
        >
            <rect x="2.5" y="4" width="19" height="16" rx="3" />
            <path d="M9.5 9 6.5 12l3 3M14.5 9l3 3-3 3" />
        </svg>
    );
}

export default definePlugin({
    name: "CodeBlockButton",
    description: "Adds a code block (```) button next to the inline code button in the text formatting popup.",
    authors: [{ name: "Pota", id: 0n }],
    enabledByDefault: true,

    CodeBlockIcon,

    patches: [
        {
            // the wrap/unwrap logic shared by every formatting button
            find: 'strikethrough:"~~",inlineCode:"`"',
            replacement: [
                {
                    // marker table: add ``` next to `
                    match: /inlineCode:"`",/,
                    replace: '$&codeBlock:"```",'
                },
                {
                    // "already wrapped?" check, so the button lights up and a second click unwraps
                    match: /(\i)\((\i),(\i),(\i),"`","inlineCode"\)/,
                    replace: '$&,$1($2,$3,$4,"```","codeBlock")'
                }
            ]
        },
        {
            // the popup's buttons
            find: 'markdownSyntax:"inlineCode"',
            replacement: [
                {
                    // add our button right after the <> one, built the same way
                    match: /\(0,(\i)\.jsx\)\((\i),\{slateEditor:(\i),markdownSyntax:"inlineCode",children:\(0,\i\.jsx\)\(\i\.AngleBracketsIcon,\{[^}]*?className:([^}]+?)\}\)\}\)/,
                    replace: '$&,(0,$1.jsx)($2,{slateEditor:$3,markdownSyntax:"codeBlock",children:(0,$1.jsx)($self.CodeBlockIcon,{className:$4})})'
                },
                {
                    // its label for screen readers
                    match: /case"inlineCode":return \i\.intl\.string\(\i\.t\.\i\);/,
                    replace: '$&case"codeBlock":return"Code Block";'
                }
            ]
        }
    ]
});
