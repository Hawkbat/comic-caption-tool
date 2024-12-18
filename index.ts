
const TAIL_SELECT_RADIUS = 20

const bubbles: Bubble[] = []
let loadedImage: HTMLImageElement | null = null
let activeStyle: BubbleStyle = {
    font: "Caveat Brush",
    fontSize: 40,
    textFill: "#000000",
    textStroke: "#FFFFFF",
    textStrokeWidth: 2.5,
    bubblePadding: 15,
    bubbleFill: "#FFFFFF",
    bubbleStroke: "#000000",
    bubbleStrokeWidth: 2.5,
    bubbleOpacity: 1,
}

let clickBubble: Bubble | null = null
let clickedTail = false
let dragBubble: Bubble | null = null
let activeBubble: Bubble | null = null

let flipImage = false

const canvas = document.createElement("canvas")
canvas.width = 1024
canvas.height = 1024
document.body.append(canvas)

const ctx = canvas.getContext("2d")!

const tray = document.createElement("div")
tray.id = "tray"
document.body.append(tray)
tray.style.display = activeBubble ? "" : "none"

const fieldRefreshCallbacks: (() => void)[] = []

makeFieldGroup("Bubble")
const fieldText = makeField("Text", "textarea", [], () => activeBubble?.text ?? "", v => activeBubble ? activeBubble.text = v : void 0)
makeField("Align", "select", [["Left", "left"], ["Center", "center"], ["Right", "right"]], () => activeBubble?.align ?? "left", v => activeBubble ? activeBubble.align = v as Bubble["align"] : void 0)
makeField("Bubble Shape", "select", [["Tight Curves", "fit"], ["Box", "box"]], () => activeBubble?.shape ?? "fit", v => activeBubble ? activeBubble.shape = v as Bubble["shape"] : void 0)
makeField("Tail Shape", "select", [["Point", "point"], ["No Tail", "none"]], () => activeBubble?.tailShape ?? "point", v => activeBubble ? activeBubble.tailShape = v as Bubble["tailShape"] : void 0)
makeField("Tail Width", "number", [], () => String(activeBubble?.tailWidth ?? 0), v => activeBubble ? activeBubble.tailWidth = Number(v) : void 0)
makeFieldGroup("Style")
makeField("Font", "text", [], () => activeStyle.font, v => activeStyle.font = v),
makeField("Font Size", "number", [], () => String(activeStyle.fontSize), v => activeStyle.fontSize = Number(v))
makeField("Text Fill", "color", [], () => activeStyle.textFill, v => activeStyle.textFill = v)
makeField("Text Stroke", "color", [], () => activeStyle.textStroke, v => activeStyle.textStroke = v)
makeField("Text Stroke Width", "number", [], () => String(activeStyle.textStrokeWidth), v => activeStyle.textStrokeWidth = Number(v))
makeField("Bubble Padding", "number", [], () => String(activeStyle.bubblePadding), v => activeStyle.bubblePadding = Number(v))
makeField("Bubble Fill", "color", [], () => activeStyle.bubbleFill, v => activeStyle.bubbleFill = v)
makeField("Bubble Fill Opacity", "number", [], () => String(activeStyle.bubbleOpacity), v => activeStyle.bubbleOpacity = Number(v))
makeField("Bubble Stroke", "color", [], () => activeStyle.bubbleStroke, v => activeStyle.bubbleStroke = v)
makeField("Bubble Stroke Width", "number", [], () => String(activeStyle.bubbleStrokeWidth), v => activeStyle.bubbleStrokeWidth = Number(v))

const refreshFields = () => fieldRefreshCallbacks.forEach(cb => cb())

function makeField(label: string, type: string, options: [label: string, value: string][], read: () => string, write: (value: string) => void) {
    const labelEl = document.createElement("label")
    const spanEl = document.createElement("span")
    spanEl.textContent = label
    labelEl.append(spanEl)
    const inputEl = type === "textarea" ? document.createElement("textarea") : type === "select" ? document.createElement("select") : document.createElement("input")
    if (inputEl instanceof HTMLInputElement) {
        inputEl.type = type
        if (inputEl.type === "number") {
            inputEl.step = "any"
        }
    } else if (inputEl instanceof HTMLSelectElement) {
        for (const [label, value] of options) {
            const optionEl = document.createElement("option")
            optionEl.textContent = label
            optionEl.value = value
            inputEl.append(optionEl)
        }
    }
    inputEl.addEventListener("input", () => {
        write(inputEl.value)
        redraw()
    })
    labelEl.append(inputEl)
    tray.append(labelEl)

    const focus = () => inputEl.focus()
    const refresh = () => inputEl.value = read()
    refresh()
    fieldRefreshCallbacks.push(refresh)
    return { labelEl, spanEl, inputEl, focus, refresh }
}

function makeFieldGroup(label: string) {
    const spanEl = document.createElement("span")
    spanEl.textContent = label
    tray.append(spanEl)
    return { spanEl }
}

const flipButton = document.createElement("button")
flipButton.textContent = "Flip Image"
flipButton.addEventListener("click", () => {
    flipImage = !flipImage
    redraw()
})
document.body.append(flipButton)

const instructions = document.createElement("p")
instructions.innerHTML = "Drag and drop an image onto the canvas to begin editing. Double-click on empty spaces to add new speech bubbles, or double-click on existing speech bubbles to remove them. Edit bubble properties and styles using the fields in the bottom tray. You can click and drag bubbles or the tips of the bubble tails to move them around. When you're done editing, you can save the image by right-clicking on the canvas and selecting Save Image As...<br><br>Tips:<br><br>You should be able to use the names of any font installed on your PC.<br>Set bubble stroke with to 0 to disable it if using a lower bubble opacity.<br>Styles affect all bubbles in the image."
document.body.append(instructions)

canvas.addEventListener("dragover", e => {
    e.preventDefault()
    if (e.dataTransfer) {
        e.dataTransfer.dropEffect = "copy"
    }
})

canvas.addEventListener("drop", e => {
    e.preventDefault()
    const file = e.dataTransfer?.files.item(0)
    if (file) {
        const fr = new FileReader()
        fr.addEventListener("load", () => {
            if (typeof fr.result === "string") {
                const dataUrl = fr.result
                const img = new Image()
                img.addEventListener("load", () => {
                    loadImage(img)
                })
                img.src = dataUrl
            }
        })
        fr.readAsDataURL(file)
    }
})

canvas.addEventListener("mousedown", e => {
    clickBubble = getMouseBubble(e)
    if (!clickBubble) {
        clickBubble = getMouseBubbleTail(e)
        clickedTail = !!clickBubble
    } else {
        clickedTail = false
    }
    activeBubble = clickBubble
    refreshFields()
    tray.style.display = activeBubble ? "" : "none"
    fieldText.focus()
    redraw()
})

canvas.addEventListener("mouseup", e => {
    dragBubble = null
    clickBubble = null
    redraw()
})

canvas.addEventListener("mousemove", e => {
    if (clickBubble && e.buttons & 1 && !dragBubble) {
        dragBubble = clickBubble
    }
    if (dragBubble) {
        if (clickedTail) {
            dragBubble.tailPos = [dragBubble.tailPos[0] + e.movementX, dragBubble.tailPos[1] + e.movementY]
        } else {
            dragBubble.pos = [dragBubble.pos[0] + e.movementX, dragBubble.pos[1] + e.movementY]
        }
        redraw()
    } else {
        const hoverBubble = getMouseBubble(e) ?? getMouseBubbleTail(e)
        if (hoverBubble) {
            canvas.style.cursor = "pointer"
        } else {
            canvas.style.cursor = ""
        }
    }
})

canvas.addEventListener("dblclick", e => {
    const existing = getMouseBubble(e)
    if (!existing) {
        const [mx, my] = getMouseCanvasCoords(e)
        const newBubble = makeBubble()
        newBubble.pos = [mx, my]
        newBubble.tailPos = [mx - 100, my + 100]
        bubbles.push(newBubble)
        activeBubble = newBubble
        tray.style.display = activeBubble ? "" : "none"
        fieldText.focus()
    } else {
        bubbles.splice(bubbles.indexOf(existing), 1)
        if (existing === activeBubble) {
            activeBubble = null
        }
        tray.style.display = activeBubble ? "" : "none"
    }
    redraw()
})

function loadImage(img: HTMLImageElement) {
    loadedImage = img
    canvas.width = img.width
    canvas.height = img.height
    redraw()
}

function dist(x0: number, y0: number, x1: number, y1: number): number {
    const dx = x1 - x0
    const dy = y1 - y0
    return Math.sqrt(dx * dx + dy * dy)
}

function magnitude(x: number, y: number): number {
    return dist(0, 0, x, y)
}

function normalize(x: number, y: number): Vec2 {
    const d = magnitude(x, y)
    return [x / d, y / d]
}

function lerp(x0: number, y0: number, x1: number, y1: number, t: number): Vec2 {
    return [x0 + (x1 - x0) * t, y0 + (y1 - y0) * t]
}

function getMouseCanvasCoords(e: MouseEvent): Vec2 {
    return [e.pageX - canvas.offsetLeft, e.pageY - canvas.offsetTop]
}

function getMouseBubble(e: MouseEvent): Bubble | null {
    const [mx, my] = getMouseCanvasCoords(e)
    const bubble = bubbles.find(b => ctx.isPointInPath(calculatePath(b).path, mx, my))
    return bubble ?? null
}

function getMouseBubbleTail(e: MouseEvent): Bubble | null {
    const [mx, my] = getMouseCanvasCoords(e)
    let closestDist = Infinity
    let closestTail: Bubble | null = null
    for (const bubble of bubbles) {
        if (bubble.tailShape === "none") continue
        const [tailX, tailY] = bubble.tailPos
        const d = dist(mx, my, tailX, tailY)
        if (d < TAIL_SELECT_RADIUS && d < closestDist) {
            closestDist = d
            closestTail = bubble
        }
    }
    return closestTail
}

function makeBubble(): Bubble {
    return { text: "", align: "left", shape: "fit", pos: [0, 0], tailShape: "point", tailWidth: 15, tailPos: [0, 0] }
}

function vec2(x: number, y: number): Vec2 {
    return [x, y]
}

redraw()

function calculatePath(bubble: Bubble) {
    const lines = bubble.text.split("\n")
    const [x, y] = bubble.pos

    ctx.font = `${activeStyle.fontSize}px ${activeStyle.font}`
    ctx.strokeStyle = activeStyle.bubbleStroke
    ctx.lineWidth = activeStyle.bubbleStrokeWidth
    ctx.fillStyle = activeStyle.bubbleFill

    const measure = ctx.measureText("gG")
    const lineHeight = measure.actualBoundingBoxAscent + measure.actualBoundingBoxDescent + 4
    
    const path = new Path2D()
    const textCoords: Vec2[] = []

    const lineWidths = lines.map(line => ctx.measureText(line).width)
    const maxLineWidth = lineWidths.reduce((p, c) => Math.max(p, c))
    const lineOffsets = lineWidths.map(width => {
        if (bubble.align === "center") return maxLineWidth / 2 - width / 2
        else if (bubble.align === "right") return maxLineWidth - width
        else return 0
    })

    const pad = activeStyle.bubblePadding
    if (lines.length > 1) {
        for (let i = 0; i < lines.length; i++) {
            const padX = pad
            const padY = i === 0 ? -pad : i === lines.length - 1 ? pad : 0
            if (i === 0 || lineWidths[i] >= lineWidths[i - 1]) {
                textCoords.push([x + lineOffsets[i] + lineWidths[i] + padX, y + lineHeight * i + padY])
            }
            if (i === lines.length - 1 || lineWidths[i] >= lineWidths[i + 1]) {
                textCoords.push([x + lineOffsets[i] + lineWidths[i] + padX, y + lineHeight * (i + 1) + padY])
            }
        }
        for (let i = lines.length - 1; i >= 0; i--) {
            const padX = -pad
            const padY = i === 0 ? -pad : i === lines.length - 1 ? pad : 0
            if (i === lines.length - 1 || lineWidths[i] >= lineWidths[i + 1]) {
                textCoords.push([x + lineOffsets[i] + padX, y + lineHeight * (i + 1) + padY])
            }
            if (i === 0 || lineWidths[i] >= lineWidths[i - 1]) {
                textCoords.push([x + lineOffsets[i] + padX, y + lineHeight * i + padY])
            }
        }
    } else if (lines.length === 1) {
        textCoords.push(
            [x + lineOffsets[0] + lineWidths[0] + pad, y - pad],
            [x + lineOffsets[0] + lineWidths[0] + pad, y + lineHeight + pad],
            [x + lineOffsets[0] - pad, y + lineHeight + pad],
            [x + lineOffsets[0] - pad, y - pad],
        )
    }

    const bounds = {
        min: textCoords.reduce((p, c) => [Math.min(p[0], c[0]), Math.min(p[1], c[1])]),
        max: textCoords.reduce((p, c) => [Math.max(p[0], c[0]), Math.max(p[1], c[1])]),
        center: lerp(0, 0, ...textCoords.reduce((p, c) => [p[0] + c[0], p[1] + c[1]]), 1 / textCoords.length),
    }

    if (bubble.shape === "fit") {
        path.moveTo(...lerp(...textCoords[textCoords.length - 1], ...textCoords[0], 0.5))
        for (let i = 0; i < textCoords.length; i++) {
            const [ax, ay] = textCoords[i]
            const [bx, by] = textCoords[(i + 1) % textCoords.length]
            const [cx, cy] = lerp(ax, ay, bx, by, 0.5)
            path.quadraticCurveTo(ax, ay, cx, cy)
        }
    } else if (bubble.shape === "box") {
        path.moveTo(...textCoords[0])
        for (let i = 1; i < textCoords.length; i++) {
            path.lineTo(...textCoords[i])
        }
        path.lineTo(...textCoords[0])
    }

    if (bubble.tailShape !== "none") {
        const [tailX, tailY] = bubble.tailPos
        const [tailOriginX, tailOriginY] = bounds.center
        const [tailDX, tailDY] = normalize(tailX - tailOriginX, tailY - tailOriginY)
        const [tailPerpX, tailPerpY] = [tailDY, -tailDX]
        const [tailStartX, tailStartY] = [tailOriginX + tailPerpX * bubble.tailWidth * 0.5, tailOriginY + tailPerpY * bubble.tailWidth * 0.5]
        const [tailEndX, tailEndY] = [tailOriginX + -tailPerpX * bubble.tailWidth * 0.5, tailOriginY + -tailPerpY * bubble.tailWidth * 0.5]
        
        path.moveTo(tailStartX, tailStartY)
        path.lineTo(tailX, tailY)
        path.lineTo(tailEndX, tailEndY)
    }

    return { path, lineHeight, lineOffsets, bounds }
}

function redraw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    if (loadedImage) {
        if (flipImage) {
            ctx.save()
            ctx.translate(canvas.width, 0)
            ctx.scale(-1, 1)
            ctx.drawImage(loadedImage, 0, 0)
            ctx.restore()
        } else {
            ctx.drawImage(loadedImage, 0, 0)
        }
    }
    for (const bubble of bubbles) {
        const lines = bubble.text.split("\n")
        const [x, y] = bubble.pos

        ctx.font = `${activeStyle.fontSize}px ${activeStyle.font}`
        ctx.strokeStyle = activeStyle.bubbleStroke
        ctx.lineWidth = activeStyle.bubbleStrokeWidth
        ctx.fillStyle = activeStyle.bubbleFill
        
        const { path, lineHeight, lineOffsets } = calculatePath(bubble)

        if (activeStyle.bubbleStrokeWidth) {
            ctx.stroke(path)
        }
        ctx.globalAlpha = activeStyle.bubbleOpacity
        ctx.fill(path)
        ctx.globalAlpha = 1

        ctx.font = `${activeStyle.fontSize}px ${activeStyle.font}`
        ctx.strokeStyle = activeStyle.textStroke
        ctx.lineWidth = activeStyle.textStrokeWidth
        ctx.fillStyle = activeStyle.textFill
        ctx.textBaseline = "top"

        lines.forEach((line, i) => {
            if (activeStyle.textStrokeWidth){
                ctx.strokeText(line, x + lineOffsets[i], y + i * lineHeight)
            }
            ctx.fillText(line, x + lineOffsets[i], y + i * lineHeight)
        })
    }
}

interface BubbleStyle {
    font: string
    fontSize: number
    textFill: string
    textStroke: string
    textStrokeWidth: number
    bubbleFill: string
    bubbleStroke: string
    bubbleStrokeWidth: number
    bubblePadding: number
    bubbleOpacity: number
}

interface Bubble {
    text: string
    align: "left" | "center" | "right"
    shape: "fit" | "box"
    pos: Vec2
    tailShape: "point" | "none"
    tailWidth: number
    tailPos: Vec2
}

type Vec2 = [x: number, y: number]
