import { useState } from 'react'
import { apiFetch } from '../../api'

export function AdminBalancesPage() {
  const [userId, setUserId] = useState('')
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')

  async function adjust(type: 'add' | 'deduct') {
    await apiFetch('/api/balance/adjust', {
      method: 'POST',
      body: JSON.stringify({
        userId: Number(userId),
        amount: Number(amount),
        currency: 'USDC',
        type,
        note,
      }),
    })
    setNote('')
  }

  return (
    <div className="page">
      <h1 className="page-title">Admin Balances</h1>
      <div className="card login-form">
        <input
          className="field-input"
          placeholder="User ID"
          value={userId}
          onChange={(e) => setUserId(e.target.value)}
        />
        <input
          className="field-input"
          placeholder="Amount"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
        <input
          className="field-input"
          placeholder="Note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
        <div className="wallet-actions">
          <button className="wallet-action-btn wallet-action-deposit" type="button" onClick={() => adjust('add')}>
            Add
          </button>
          <button className="wallet-action-btn wallet-action-withdraw" type="button" onClick={() => adjust('deduct')}>
            Deduct
          </button>
        </div>
      </div>
    </div>
  )
}
