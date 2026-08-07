import { useEffect, useState } from 'react'

/**
 * The scene: a developer at a desk, and something approaching from stage right
 * with its fist up. How close it gets — and how high the fist is raised — is
 * bound to the doom score, so tuning the model sliders winds up the punch.
 *
 * At 100 (the clock at zero) the punch lands and the developer goes down.
 *
 * All art is bottom-aligned on the floor line and every pose has the same row
 * count, so switching poses never makes the figure jump. The robot's art is
 * padded on the left to give the arm its own columns — the body always sits at
 * the same offset, only the arm and fist move.
 */

const strip = (s: string) => s.replace(/^\n/, '').replace(/\n$/, '')

// ── The developer ──────────────────────────────────────────────────────────
const DEV_CALM = strip(String.raw`
   .----.
  | o  o |
  |  --  |
   '----'
   /|  |\
  ' |__| '
   _/  \_
`)

/** Same figure, sweating. Used once the club is up. */
const DEV_NERVOUS = strip(String.raw`
   .----.
  | O  O |'
  |  ~~  |
   '----'
   /|  |\
  ' |__| '
   _/  \_
`)

/** Flat on the floor, X eyes, seeing stars. Same 7 rows, weight at the bottom. */
const DEV_OUT = strip(String.raw`
    *  .  *
      .   *


   ______
  ( x  x )___
   ‾‾‾‾‾‾   \__
`)

// ── The robot, by punch pose ───────────────────────────────────────────────
/**
 * The body is identical in every pose; only the arm and fist move. Rather than
 * hand-align four copies (which is how the arm ended up a column off the first
 * time, and how an earlier draft overwrote the robot's own head), the poses are
 * composed: the body is padded left to reserve columns for the arm, then marks
 * are stamped into a character grid at exact coordinates.
 */
const BODY = [
  '', // spare row above the head: the raised club lives here
  '   .----.',
  '  |[]  []|',
  '  | ==== |',
  "   '----'",
  '  /|####|\\',
  "  ' |##| '",
  '   _|  |_',
]
/** Columns reserved to the left of the body for the arm and fist. */
const ARM_PAD = 5

type Mark = [row: number, col: number, text: string]

function pose(...marks: Mark[]): string {
  const grid = BODY.map((r) => (' '.repeat(ARM_PAD) + r).split(''))
  const width = Math.max(...grid.map((g) => g.length)) + 4
  for (const g of grid) while (g.length < width) g.push(' ')
  for (const [row, col, text] of marks) {
    for (let i = 0; i < text.length; i++) grid[row][col + i] = text[i]
  }
  return grid.map((g) => g.join('').replace(/\s+$/, '')).join('\n')
}

/**
 * Row 1 of this grid lines up with the developer's head, because both figures
 * are bottom-anchored and the developer's art is one row shorter. That is why
 * the punch lands on row 1.
 */
/** Fist down at its side. */
const BOT_LOW = pose([6, 5, 'o'])
/** Fist up at chest height, arm half out. */
const BOT_MID = pose([5, 4, 'o──'])
/** Fist raised to head height, cocked. */
const BOT_HIGH = pose([2, 4, 'o──'])
/** Arm fully extended, fist through where the developer's head was. */
const BOT_STRIKE = pose([1, 0, 'o══════'], [2, 6, '\\'])

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

/** What the terminal says once the developer is on the floor. */
const KO_LINES = [
  '$ ',
  'Connection to workstation closed by remote host.',
  '$ ',
  'agent: taking it from here',
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

  // The punch winds up as the robot closes: side → chest → head → thrown.
  const bot = knockedOut
    ? BOT_STRIKE
    : t < 0.4
      ? BOT_LOW
      : t < 0.75
        ? BOT_MID
        : BOT_HIGH
  const dev = knockedOut ? DEV_OUT : t >= 0.75 ? DEV_NERVOUS : DEV_CALM

  // Robot starts at the right edge and closes in. Stops where the swung CLUB
  // overlaps the developer's head but the two bodies stay clear of each other —
  // closer than this and the scene collapses into unreadable overlapping ASCII.
  const botRight = `${6 + t * 50}%`
  const devOpacity = knockedOut ? 1 : 1 - t * 0.35

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
        className="relative h-[188px] overflow-hidden"
        style={knockedOut ? { animation: 'impact 620ms ease-out 1' } : undefined}
        role="img"
        aria-label={
          knockedOut
            ? 'ASCII scene: the automated replacement has landed its punch and the developer is flat on the floor, seeing stars. Replacement complete.'
            : `ASCII scene: a developer at a desk with an automated replacement approaching from the right, fist ${
                t < 0.4 ? 'down at its side' : t < 0.75 ? 'raised to chest height' : 'cocked at head height'
              }. Replacement progress ${score}%.`
        }
      >
        {/* Floor */}
        <div className="absolute right-0 bottom-9 left-0 h-px bg-[var(--color-line)]" aria-hidden />

        <pre
          aria-hidden
          className={`absolute bottom-9 left-[10%] text-[11px] leading-[1.15] transition-opacity duration-700 sm:text-[13px] ${
            knockedOut ? 'text-[var(--color-crit)] glow-crit' : 'text-[var(--color-phos)]'
          }`}
          style={{
            opacity: devOpacity,
            animation: knockedOut ? undefined : 'bob 3.4s ease-in-out infinite',
          }}
        >
          {dev}
        </pre>

        <pre
          aria-hidden
          className={`absolute bottom-9 text-[11px] leading-[1.15] transition-all duration-[900ms] ease-out sm:text-[13px] ${
            t >= 0.75 ? 'text-[var(--color-crit)] glow-crit' : 'text-[var(--color-amber)]'
          }`}
          style={{ right: botRight }}
        >
          {bot}
        </pre>

        {knockedOut && (
          <div
            aria-hidden
            className="absolute bottom-[63%] left-[19%] text-[17px] font-bold text-[var(--color-amber)] glow-amber"
            style={{ animation: 'blink 420ms steps(1) 4' }}
          >
            ✷
          </div>
        )}
        {knockedOut && (
          <div
            aria-hidden
            className="absolute top-2 right-3 text-[11px] font-bold tracking-[0.1em] text-[var(--color-crit)] glow-crit"
            style={{ animation: 'blink 1.1s steps(1) infinite' }}
          >
            ✷ ROLE ELIMINATED
          </div>
        )}
        {!knockedOut && t >= 0.75 && (
          <div
            aria-hidden
            className="absolute bottom-[82%] left-[9%] text-[10px] whitespace-nowrap text-[var(--color-crit)]"
            style={{ animation: 'blink 1.4s steps(1) infinite' }}
          >
            ↓ this one is you
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
