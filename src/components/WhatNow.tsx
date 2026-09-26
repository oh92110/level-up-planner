import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useStore } from '../store'
import { Modal } from './ui'
import { useToast } from './Toast'
import { recommendNow } from '../lib/engine'
import { formatDuration } from '../lib/dates'

const BUDGETS = [15, 30, 45, 60, 90]

export function WhatNow() {
  const [open, setOpen] = useState(false)
  return (
    <>
      <motion.button
        onClick={() => setOpen(true)}
        whileTap={{ scale: 0.98 }}
        className="btn-primary w-full py-3 text-[15px] font-semibold animate-breathe"
      >
        What should I do now?
      </motion.button>
      <WhatNowModal open={open} onClose={() => setOpen(false)} />
    </>
  )
}

function WhatNowModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { tasks, projects, commitments, preferences, toggleTask } = useStore()
  const toast = useToast()
  const [budget, setBudget] = useState<number | null>(null)
  const [busy, setBusy] = useState(false)

  const rec = recommendNow({ tasks, projects, commitments, preferences, budgetOverride: budget })

  async function complete() {
    if (!rec.task) return
    setBusy(true)
    try {
      await toggleTask(rec.task)
      toast('Nice work — done.', 'success')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="What should I do now?">
      <div className="space-y-5">
        <div>
          <p className="label">How much time do you actually have?</p>
          <div className="flex flex-wrap gap-2">
            <motion.button
              whileTap={{ scale: 0.94 }}
              onClick={() => setBudget(null)}
              className={`btn text-xs ${budget === null ? 'bg-ink-700 text-slate-100 ring-1 ring-accent/50' : 'btn-ghost'}`}
            >
              Work it out for me
            </motion.button>
            {BUDGETS.map((b) => (
              <motion.button
                key={b}
                whileTap={{ scale: 0.9 }}
                onClick={() => setBudget(b)}
                className={`btn text-xs px-3 ${
                  budget === b ? 'bg-ink-700 text-slate-100 ring-1 ring-accent/50' : 'btn-ghost'
                }`}
              >
                {b < 60 ? `${b}m` : b === 60 ? '1h' : '1.5h'}
              </motion.button>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-ink-700 bg-ink-850 p-4 overflow-hidden">
          <AnimatePresence initial={false}>
            <motion.div
              key={`${rec.kind}-${rec.headline}`}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.18 }}
            >
              {rec.kind === 'task' ? (
                <>
                  <p className="text-xs text-slate-400 mb-2">
                    You have {formatDuration(rec.availableMinutes)} available. Do this:
                  </p>
                  <p className="text-lg font-semibold text-slate-100 leading-snug">{rec.headline}</p>
                  <p className="text-sm text-slate-400 mt-1.5">
                    Estimated {formatDuration(rec.task!.duration_min)}. Start it now.
                  </p>
                  {rec.reasons.length > 0 && (
                    <ul className="mt-3 space-y-1 border-t border-ink-700 pt-3">
                      {rec.reasons.map((r) => (
                        <li key={r} className="text-xs text-slate-400 flex gap-2">
                          <span className="text-accent">•</span>
                          {r}
                        </li>
                      ))}
                    </ul>
                  )}
                </>
              ) : (
                <>
                  <p className="text-lg font-semibold text-slate-100 leading-snug">{rec.headline}</p>
                  <p className="text-sm text-slate-400 mt-2 leading-relaxed">{rec.detail}</p>
                </>
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        {rec.kind === 'task' && (
          <div className="flex gap-2">
            <button onClick={complete} disabled={busy} className="btn-primary flex-1">
              {busy ? 'Saving…' : 'Done — what next?'}
            </button>
            <button onClick={onClose} className="btn-ghost">
              Close
            </button>
          </div>
        )}
      </div>
    </Modal>
  )
}
