<script>
    import * as Y from "yjs"

    import {onMount, createEventDispatcher} from "svelte"
    import {shortcut} from "./shortcut.js"

    import {CodemirrorBinding} from "y-codemirror"
    import CodeMirror from "codemirror"
    import "codemirror/mode/markdown/markdown.js"

    const dispatch = createEventDispatcher()

    let editorDiv, editor, yUndoManager, binding
    export let ytext, awareness, titles

    // Via https://stackoverflow.com/questions/3446170/escape-string-for-use-in-javascript-regex
    function escapeRegex(string) {
        return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") // $& means the whole matched string
    }

    function linkOverlay(titles) {
        const query = new RegExp(
            "\\b(" +
                titles
                    .sort((a, b) => b.length - a.length)
                    .filter((t) => t.length > 0)
                    .map((t) => escapeRegex(t))
                    .join("|") +
                ")",
            "gi",
        )

        return {
            token: function (stream) {
                query.lastIndex = stream.pos
                var match = query.exec(stream.string)
                if (match && match.index == stream.pos) {
                    stream.pos += match[0].length || 1
                    return "link"
                } else if (match) {
                    stream.pos = match.index
                } else {
                    stream.skipToEnd()
                }
            },
            name: "links",
        }
    }

    function checkBoxEmptyOverlay() {
        const query = /\[ \]/g

        return {
            token: function (stream) {
                query.lastIndex = stream.pos
                var match = query.exec(stream.string)
                if (match && match.index == stream.pos) {
                    stream.pos += match[0].length || 1
                    return "checkbox-empty"
                } else if (match) {
                    stream.pos = match.index
                } else {
                    stream.skipToEnd()
                }
            },
        }
    }

    function checkBoxFilledOverlay() {
        const query = /\[x\]/g

        return {
            token: function (stream) {
                query.lastIndex = stream.pos
                var match = query.exec(stream.string)
                if (match && match.index == stream.pos) {
                    stream.pos += match[0].length || 1
                    return "checkbox-filled"
                } else if (match) {
                    stream.pos = match.index
                } else {
                    stream.skipToEnd()
                }
            },
        }
    }

    function urlOverlay() {
        const query = /\b(https?:\/\/\S*\b)/g

        return {
            token: function (stream) {
                query.lastIndex = stream.pos
                var match = query.exec(stream.string)
                if (match && match.index == stream.pos) {
                    stream.pos += match[0].length || 1
                    return "url"
                } else if (match) {
                    stream.pos = match.index
                } else {
                    stream.skipToEnd()
                }
            },
        }
    }

    $: if (editorDiv) {
        if (!editor) {
            let theme = "default"

            if (
                window.matchMedia &&
                window.matchMedia("(prefers-color-scheme: dark)").matches
            ) {
                theme = "gruvbox-dark"
            }
            editor = CodeMirror(editorDiv, {
                lineNumbers: true,
                flattenSpans: false,
                lineWrapping: true,
                mode: "markdown",
                theme: theme,
            })

            editor.addOverlay(urlOverlay())
            editor.addOverlay(checkBoxEmptyOverlay())
            editor.addOverlay(checkBoxFilledOverlay())

            let events = ["mousedown", "touchstart"]
            events.forEach((event) =>
                editor.getWrapperElement().addEventListener(event, (e) => {
                    if (e.which == 1 || e.touches) {
                        if (e.target.classList.contains("cm-url")) {
                            let url = e.target.innerHTML

                            // There might be neighboring cm-url spans that belong to this link. Let's go find them!
                            let scanBack = e.target
                            do {
                                scanBack = scanBack.previousSibling
                                if (
                                    scanBack &&
                                    scanBack.classList &&
                                    scanBack.classList.contains("cm-url")
                                ) {
                                    url = scanBack.innerHTML + url
                                }
                            } while (scanBack)

                            let scanForward = e.target
                            do {
                                scanForward = scanForward.nextSibling
                                if (
                                    scanForward &&
                                    scanForward.classList &&
                                    scanForward.classList.contains("cm-url")
                                ) {
                                    url = url + scanForward.innerHTML
                                }
                            } while (scanForward)

                            window.open(url, "_blank")
                        } else if (e.target.classList.contains("cm-link")) {
                            let title = e.target.innerHTML
                            dispatch("openPage", {title})
                        } else if (
                            e.target.classList.contains("cm-checkbox-empty")
                        ) {
                            let rect = e.target.getBoundingClientRect()
                            let pos = editor.coordsChar({
                                left: rect.x,
                                top: rect.y,
                            })
                            editor.doc.replaceRange("[x]", pos, {
                                line: pos.line,
                                ch: pos.ch + 3,
                            })
                            e.preventDefault()
                        } else if (
                            e.target.classList.contains("cm-checkbox-filled")
                        ) {
                            let rect = e.target.getBoundingClientRect()
                            let pos = editor.coordsChar({
                                left: rect.x,
                                top: rect.y,
                            })
                            editor.doc.replaceRange("[ ]", pos, {
                                line: pos.line,
                                ch: pos.ch + 3,
                            })
                            e.preventDefault()
                        }
                    }
                }),
            )
        }

        if (binding && binding.doc === ytext) {
            // No need to do anything.
        } else {
            if (binding) {
                console.log("destroy binding")
                binding.destroy()
            }
            yUndoManager = new Y.UndoManager(ytext)
            binding = new CodemirrorBinding(ytext, editor, awareness, {
                yUndoManager,
            })

            const selectOnNewPage = () => {
                if (editor.getValue() === "New Page") {
                    editor.doc.setSelection(
                        {line: 0, ch: 0},
                        {
                            line: editor.doc.lastLine(),
                            ch: editor.doc.getLine(editor.doc.lastLine())
                                .length,
                        },
                    )
                    editor.focus()
                }
            }
            selectOnNewPage()
            ytext.observe(selectOnNewPage)
        }
    }

    $: if (editor && titles) {
        console.log("updating overlay")
        editor.removeOverlay("links")
        editor.addOverlay(linkOverlay(titles))
    }

    function currentDate() {
        var today = new Date()
        return (
            today.getFullYear().toString().padStart(2, "0") +
            "-" +
            (today.getMonth() + 1).toString().padStart(2, "0") +
            "-" +
            today.getDate().toString().padStart(2, "0")
        )
    }
</script>

<div
    class="editor flex-grow"
    bind:this={editorDiv}
    use:shortcut={{
        control: true,
        code: "End",
        callback: () => {
            editor.focus()
            editor.doc.setCursor(
                editor.doc.lastLine(),
                editor.doc.getLine(editor.doc.lastLine()).length,
            )
        },
    }}
    use:shortcut={{
        code: "F9",
        callback: () => {
            if (editor.hasFocus()) {
                editor.replaceSelection(currentDate())
            }
        },
    }}
/>

<style>
    .editor {
        font-family: "Iosevka Web" !important;
        font-size: 105%;
    }
    :global(.CodeMirror) {
        height: 100% !important;
        width: 100% !important;
    }
    :global(.cm-link),
    :global(.cm-url) {
        cursor: pointer;
        font-weight: bold;
        color: darkblue !important;
        text-decoration: none !important;
    }
    :global(.cm-checkbox-empty),
    :global(.cm-checkbox-filled) {
        cursor: pointer;
        font-weight: bold;
        text-decoration: none !important;
    }
    :global(.cm-checkbox-empty) {
        color: white !important;
        background: #c12f2f !important;
    }
    :global(.remote-caret:hover > div) {
        visibility: visible;
    }
    :global(.remote-caret) {
        position: absolute;
        border-left: black;
        border-left-style: solid;
        border-left-width: 3px;
        height: 1em;
    }
    :global(.remote-caret > div) {
        visibility: hidden;
        position: relative;
        top: -1.05em;
        font-size: 13px;
        background-color: rgb(250, 129, 0);
        font-style: normal;
        font-weight: normal;
        line-height: normal;
        user-select: none;
        color: white;
        padding-left: 2px;
        padding-right: 2px;
        z-index: 3;
    }
    @media (prefers-color-scheme: dark) {
        :global(.cm-link),
        :global(.cm-url) {
            color: #3d80eb !important;
        }
    }
</style>
