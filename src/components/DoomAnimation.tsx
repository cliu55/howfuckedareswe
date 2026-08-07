import { useEffect, useState } from 'react'

/**
 * The scene: Fry at a desk, Bender walking over to take his job.
 *
 * Bender does not gesture. An earlier version animated an arm winding up a
 * punch, and it read as three disconnected sticks — monospace cannot show
 * rotation, so articulated limbs never land. What monospace renders perfectly
 * is text, so the escalation is carried by Bender's dialogue instead: he simply
 * gets closer, and what he says gets worse.
 *
 * At 100 (the clock at zero) the punch happens between frames, which is both
 * funnier and drawable: Bender delivers the last line, the scene jolts, and
 * Fry is already on the floor.
 */

const strip = (s: string) => s.replace(/^\n/, '').replace(/\n$/, '')

/** Pad every line to the same width so the <pre> box is a known size. */
function block(art: string): { text: string; width: number; rows: number } {
  const lines = strip(art).split('\n')
  const width = Math.max(...lines.map((l) => l.length))
  return {
    text: lines.map((l) => l.padEnd(width)).join('\n'),
    width,
    rows: lines.length,
  }
}

// ── Fry ────────────────────────────────────────────────────────────────────
const FRY_CALM = block(String.raw`
   \ | | /
   .-------.
  /  ^   ^  \
 |     .     |
 |   \___/   |
  \_________/
   /|     |\
  ' |-----| '
    |     |
    |_____|
    ||   ||
`)

const FRY_NERVOUS = block(String.raw`
   \ | | /
   .-------.
  /  O   O  \'
 |     .     |
 |   \~~~~~/ |
  \_________/
   /|     |\
  ' |-----| '
    |     |
    |_____|
    ||   ||
`)

/** Flat on his back — the hair spikes turn sideways so the pose reads flat. */
const FRY_OUT = block(String.raw`
      *    .    *
   .      *
         *


   \
  --.-------.______
   ( x   x  |  |  \
  --'-------'--'---'
   /
`)

// ── Bender ─────────────────────────────────────────────────────────────────
/** One static pose. Only his position and his dialogue change. */
const BENDER = block(String.raw`
       ( )
        H
    .---------.
   /  _______  \
  |  | @   @ |  |
  |  |_______|  |
   \___________/
     |       |
   .-+-------+-.
  O| :+++++++: |O
   | :#######: |
   '-+-------+-'
     ||     ||
`)

/** Column of the antenna, so the speech-bubble tail can point at his head. */
const ANTENNA_COL = BENDER.text.split('\n')[0].indexOf('(')

// ── The speech bubble ──────────────────────────────────────────────────────
const BUBBLE_W = 32

/**
 * Draws an ASCII bubble with its tail aimed at Bender's antenna.
 *
 * Both the bubble and Bender are anchored by their RIGHT edge, so aligning the
 * tail is a matter of counting from the right: whatever the bubble's width, the
 * tail sits the same number of columns from its right edge as the antenna does
 * from Bender's.
 */
function bubble(text: string): string {
  const inner = BUBBLE_W - 4
  const lines: string[] = []
  let cur = ''
  for (const word of text.split(' ')) {
    if ((cur + ' ' + word).trim().length > inner) {
      lines.push(cur.trim())
      cur = word
    } else cur = (cur + ' ' + word).trim()
  }
  if (cur) lines.push(cur)

  const fromRight = BENDER.width - 1 - ANTENNA_COL
  const tailIdx = Math.max(1, BUBBLE_W - 1 - fromRight)
  const bottom = ("'" + '-'.repeat(BUBBLE_W - 2) + "'").split('')
  bottom[tailIdx] = 'v'

  return [
    '.' + '-'.repeat(BUBBLE_W - 2) + '.',
    ...lines.map((l) => '| ' + l.padEnd(inner) + ' |'),
    bottom.join(''),
  ].join('\n')
}

/** What Bender says, by how close the end is. */
const DIALOGUE: [threshold: number, line: string][] = [
  [40, 'Hey, meatbag.'],
  [75, 'I could do your job. Drunk.'],
  [100, 'Bite my shiny metal ass.'],
]
const FINAL_LINE = "IT'S REPLACIN' TIME."

const LOG_LINES = [
  '$ git log --author="you" --since=1.month --oneline | wc -l',
  '0',
  '$ agent status',
  'agent: 14 PRs merged, 0 coffee consumed, 0 complaints filed',
  '$ whoami',
  'code-reviewer (deprecated)',
  '$ ./negotiate_raise.sh',
  'bash: ./negotiate_raise.sh: Permission denied',
  '$ cat /proc/leverage',
  'cat: /proc/leverage: No such file or directory',
  '$ sudo make me relevant',
  'make: *** No rule to make target `relevant`.  Stop.',
  '$ git push --force origin main',
  'remote: rejected — an agent already pushed a better version',
  '$ exit',
  'logout: session held open by 1 background process (you)',
]

/** What the terminal says once Fry is on the floor. */
const KO_LINES = [
  '$ ',
  'Connection to workstation closed by remote host.',
  '$ ',
  'bender: taking it from here, meatbag',
]

export function DoomAnimation({ score }: { score: number }) {
  const [logIdx, setLogIdx] = useState(0)
  const [typed, setTyped] = useState('')

  const t = Math.min(1, Math.max(0, score / 100))
  const knockedOut = score >= 100
  const lines = knockedOut ? KO_LINES : LOG_LINES

  // Type the current log line out one character at a time, then advance.
  useEffect(() => {
    const line = lines[logIdx % lines.length]
    if (typed.length < line.length) {
      const id = setTimeout(() => setTyped(line.slice(0, typed.length + 1)), 26)
      return () => clearTimeout(id)
    }
    const id = setTimeout(() => {
      setTyped('')
      setLogIdx((i) => i + 1)
    }, 1600)
    return () => clearTimeout(id)
  }, [typed, logIdx, lines])

  const said = knockedOut
    ? FINAL_LINE
    : (DIALOGUE.find(([limit]) => score < limit) ?? DIALOGUE[DIALOGUE.length - 1])[1]
  const fry = knockedOut ? FRY_OUT : t >= 0.75 ? FRY_NERVOUS : FRY_CALM

  // Bender closes in from the right. He stops short of Fry — the bodies never
  // overlap, because two figures sharing columns is unreadable in ASCII.
  const botRight = `${8 + t * 40}%`

  const filled = Math.round(t * 28)
  const bar = '█'.repeat(filled) + '░'.repeat(28 - filled)
  const history = lines.slice(Math.max(0, logIdx - 4), logIdx).slice(-4)

  return (
    <div className="border border-[var(--color-line)] bg-[var(--color-void)]">
      {/* Fake window chrome */}
      <div className="flex items-center gap-2 border-b border-[var(--color-line)] px-3 py-1.5">
        <span className="flex gap-1.5" aria-hidden>
          <i className="block h-2 w-2 rounded-full bg-[var(--color-crit)]/60" />
          <i className="block h-2 w-2 rounded-full bg-[var(--color-amber)]/60" />
          <i className="block h-2 w-2 rounded-full bg-[var(--color-phos)]/60" />
        </span>
        <span className="text-[10px] text-[var(--color-ink-faint)]">
          ~/career — zsh — 80×24
        </span>
      </div>

      {/* The scene */}
      <div
        className="relative h-[272px] overflow-hidden"
        style={knockedOut ? { animation: 'impact 620ms ease-out 1' } : undefined}
        role="img"
        aria-label={
          knockedOut
            ? `ASCII scene: Fry is flat on the floor seeing stars, and the robot says “${FINAL_LINE}”. Replacement complete.`
            : `ASCII scene: Fry at his desk with a robot approaching from the right, saying “${said}”. Replacement progress ${score}%.`
        }
      >
        {/* Floor */}
        <div className="absolute right-0 bottom-9 left-0 h-px bg-[var(--color-line)]" aria-hidden />

        <pre
          aria-hidden
          className={`absolute bottom-9 left-[8%] text-[9px] leading-[1.1] transition-opacity duration-700 sm:text-[11px] ${
            knockedOut ? 'text-[var(--color-crit)] glow-crit' : 'text-[var(--color-phos)]'
          }`}
          style={{
            opacity: knockedOut ? 1 : 1 - t * 0.3,
            animation: knockedOut ? undefined : 'bob 3.4s ease-in-out infinite',
          }}
        >
          {fry.text}
        </pre>

        {/* Bender, and his bubble directly above him — same right anchor, so the
            tail lines up with his antenna wherever he is. */}
        <pre
          aria-hidden
          className={`absolute bottom-9 text-[9px] leading-[1.1] transition-all duration-[900ms] ease-out sm:text-[11px] ${
            t >= 0.75 ? 'text-[var(--color-crit)] glow-crit' : 'text-[var(--color-amber)]'
          }`}
          style={{ right: botRight }}
        >
          {BENDER.text}
        </pre>
        <pre
          aria-hidden
          className={`absolute text-[9px] leading-[1.1] transition-all duration-[900ms] ease-out sm:text-[11px] ${
            knockedOut
              ? 'text-[var(--color-crit)] glow-crit'
              : t >= 0.75
                ? 'text-[var(--color-crit)]'
                : 'text-[var(--color-ink)]'
          }`}
          style={{ right: botRight, bottom: 'calc(2.25rem + 14.6em)' }}
        >
          {bubble(said)}
        </pre>

        {knockedOut && (
          <div
            aria-hidden
            className="absolute top-2 right-3 text-[11px] font-bold tracking-[0.1em] text-[var(--color-crit)] glow-crit"
            style={{ animation: 'blink 1.1s steps(1) infinite' }}
          >
            ✷ ROLE ELIMINATED
          </div>
        )}

        {/* Replacement progress */}
        <div className="absolute right-3 bottom-2 left-3 flex items-center gap-2 text-[10px]">
          <span className="text-[var(--color-ink-faint)]">
            {knockedOut ? 'replaced' : 'replacing'}
          </span>
          <span
            className={`tracking-[-0.05em] ${
              t >= 0.75 ? 'text-[var(--color-crit)]' : 'text-[var(--color-phos)]'
            }`}
          >
            {bar}
          </span>
          <span className="tabular-nums text-[var(--color-ink-mute)]">{score}%</span>
        </div>
      </div>

      {/* Terminal log */}
      <div className="h-[104px] overflow-hidden border-t border-[var(--color-line)] px-3 py-2 text-[10px] leading-[1.65] sm:text-[11px]">
        {history.map((l, i) => (
          <div
            key={`${logIdx}-${i}`}
            className={
              l.startsWith('$') ? 'text-[var(--color-phos-dim)]' : 'text-[var(--color-ink-faint)]'
            }
          >
            {l}
          </div>
        ))}
        <div
          className={
            lines[logIdx % lines.length].startsWith('$')
              ? 'cursor text-[var(--color-phos)]'
              : 'cursor text-[var(--color-ink-mute)]'
          }
        >
          {typed}
        </div>
      </div>
    </div>
  )
}
