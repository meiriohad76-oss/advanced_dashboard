import React, { useState } from 'react'
import { ArrowRight, BrainCircuit, ShieldCheck, X } from 'lucide-react'
import { ModalOverlay } from './ModalOverlay'
import { answerQuestion } from '../domain/engine'
import type { Holding } from '../types'

interface AskPanelProps {
  holdings: Holding[]
  onClose: () => void
}

export function AskPanel({ holdings, onClose }: AskPanelProps) {
  const prompts = [
    'What changed today?',
    'Which signal needs attention?',
    'Where is concentration risk?',
    'Why is CRDO ranked first?',
  ]
  const [question, setQuestion] = useState('')
  const [answer, setAnswer] = useState('')

  const ask = (text: string) => {
    setQuestion(text)
    setAnswer(answerQuestion(text, holdings))
  }

  return (
    <ModalOverlay className="ask-drawer" label="Ask Atlas" onClose={onClose}>
      <button className="icon-button drawer-close" onClick={onClose} aria-label="Close Ask Atlas">
        <X size={19} />
      </button>
      <div className="ask-heading">
        <span>
          <BrainCircuit size={21} />
        </span>
        <div>
          <p>Grounded assistant</p>
          <h2>Ask Atlas</h2>
        </div>
      </div>
      <p className="ask-intro">
        Ask about changes, signals, risk, or data provenance. Every answer is generated from the metrics visible in this demo.
      </p>
      <div className="prompt-list">
        {prompts.map((prompt) => (
          <button key={prompt} onClick={() => ask(prompt)}>
            {prompt}
            <ArrowRight size={15} />
          </button>
        ))}
      </div>
      {answer && (
        <div className="answer-card">
          <span className="eyebrow">ANSWER</span>
          <p>{answer}</p>
          <small>
            <ShieldCheck size={14} /> Derived from deterministic portfolio data
          </small>
        </div>
      )}
      <form
        className="ask-form"
        onSubmit={(event) => {
          event.preventDefault()
          if (question.trim()) ask(question)
        }}
      >
        <input
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          placeholder="Ask a question…"
        />
        <button type="submit" aria-label="Submit question">
          <ArrowRight size={17} />
        </button>
      </form>
    </ModalOverlay>
  )
}
