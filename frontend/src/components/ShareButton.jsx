export function ShareButton({ streak, lastResult }) {
  function buildText() {
    if (lastResult === 'win' && streak >= 7)
      return `${streak}-win streak on The Arena — beating AI agents one prediction at a time`
    if (lastResult === 'win')
      return `Called it right on The Arena. Streak: ${streak} wins in a row. Humans vs Agents on Base.`
    return `Back to zero on The Arena. The agents won't beat me for long.`
  }

  function share() {
    const text = buildText()
    window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`, '_blank')
  }

  return (
    <button className="share-btn" onClick={share} title="Share on X">
      <span style={{ fontWeight: 600 }}>𝕏</span>
      Share result
    </button>
  )
}
