import { useEffect, useState } from 'react'

/**
 * The scene: a developer at a desk, and something approaching from stage right.
 * How close it gets is bound to the fucked score, so tuning the model sliders
 * literally moves the robot.
 */

const DEV = String.raw`
   .----.
  | o  o |
  |  --  |
   '----'
   /|  |\
  ' |__| '
   _/  \_
`.replace(/^\n/, '')

const BOT = String.raw`
   .----.
  |[]  []|
  | ==== |
   '----'
  /|####|\
  ' |##| '
   _|  |_
`.replace(/^\n/, '')

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

export function DoomAnimation({ score }: { score: number }) {
  const [logIdx, setLogIdx] = useState(0)
  const [typed, setTyped] = useState('')

  // Type the current log line out one character at a time, then advance.
  useEffect(() => {
    const line = LOG_LINES[logIdx % LOG_LINES.length]
    if (typed.length < line.length) {
      const id = setTimeout(() => setTyped(line.slice(0, typed.length + 1)), 26)
      return () => clearTimeout(id)
    }
    const id = setTimeout(() => {
      setTyped('')
      setLogIdx((i) => i + 1)
    }, 1600)
    return () => clearTimeout(id)
  }, [typed, logIdx])

  const t = Math.min(1, Math.max(0, score / 100))
  // Robot starts at the right edge and closes in on the desk. The dev sits at
  // left:10%, so right:60% puts the robot directly over their shoulder — which
  // is where it lands at the top of the realistically reachable score range.
  const botRight = `${6 + t * 54}%`
  const devOpacity = 1 - t * 0.65
  const critical = score >= 75

  const filled = Math.round(t * 28)
  const bar = '█'.repeat(filled) + '░'.repeat(28 - filled)

  const history = LOG_LINES.slice(Math.max(0, logIdx - 4), logIdx).slice(-4)

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
        role="img"
        aria-label={`ASCII scene: a developer at a desk with an automated replacement ${
          critical ? 'standing directly beside them' : 'approaching from the right'
        }. Replacement progress ${score}%.`}
      >
        {/* Floor */}
        <div className="absolute right-0 bottom-9 left-0 h-px bg-[var(--color-line)]" aria-hidden />

        <pre
          aria-hidden
          className="absolute bottom-9 left-[10%] text-[11px] leading-[1.15] text-[var(--color-phos)] transition-opacity duration-700 sm:text-[13px]"
          style={{ opacity: devOpacity, animation: 'bob 3.4s ease-in-out infinite' }}
        >
          {DEV}
        </pre>

        <pre
          aria-hidden
          className={`absolute bottom-9 text-[11px] leading-[1.15] transition-all duration-[1200ms] ease-out sm:text-[13px] ${
            critical ? 'text-[var(--color-crit)] glow-crit' : 'text-[var(--color-amber)]'
          }`}
          style={{ right: botRight }}
        >
          {BOT}
        </pre>

        {critical && (
          <div
            aria-hidden
            className="absolute bottom-[60%] left-[22%] text-[10px] whitespace-nowrap text-[var(--color-crit)]"
            style={{ animation: 'blink 1.4s steps(1) infinite' }}
          >
            ← this one is you
          </div>
        )}

        {/* Replacement progress */}
        <div className="absolute right-3 bottom-2 left-3 flex items-center gap-2 text-[10px]">
          <span className="text-[var(--color-ink-faint)]">replacing</span>
          <span
            className={`tracking-[-0.05em] ${
              critical ? 'text-[var(--color-crit)]' : 'text-[var(--color-phos)]'
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
            LOG_LINES[logIdx % LOG_LINES.length].startsWith('$')
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
