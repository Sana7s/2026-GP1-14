import React from 'react'

export const names = {
  head_front: 'Head & neck · front', head_back: 'Head & neck · back',
  trunk_front: 'Chest & abdomen', trunk_back: 'Back', buttocks: 'Buttocks',
  arm_left_front: 'Left arm · front', arm_left_back: 'Left arm · back',
  arm_right_front: 'Right arm · front', arm_right_back: 'Right arm · back',
  leg_left_front: 'Left leg · front', leg_left_back: 'Left leg · back',
  leg_right_front: 'Right leg · front', leg_right_back: 'Right leg · back',
  perineum: 'Perineum'
}

const adultWeights = {
  head_front: 4.5, head_back: 4.5, trunk_front: 18, trunk_back: 13,
  buttocks: 5, arm_left_front: 4.5, arm_left_back: 4.5,
  arm_right_front: 4.5, arm_right_back: 4.5,
  leg_left_front: 9, leg_left_back: 9, leg_right_front: 9,
  leg_right_back: 9, perineum: 1
}

export function calculateTBSA(age, selected) {
  if (age === '' || !Number.isInteger(Number(age)) || Number(age) < 0 || Number(age) > 120 || selected.length === 0) {
    return { value: null, method: 'Select patient age and at least one affected region.' }
  }
  let weights = adultWeights
  let method = 'Adult Rule of Nines · whole-region estimate'
  if (Number(age) < 16) {
    return { value: null, method: 'Pediatric Lund–Browder: enter a clinician-verified TBSA value. Automatic pediatric calculation is not available in this prototype.' }
  }
  return { value: Math.round(selected.reduce((sum, key) => sum + weights[key], 0) * 100) / 100, method }
}

const fronts = [
  ['head_front', 'circle', { cx: 105, cy: 40, r: 27 }],
  ['trunk_front', 'path', { d: 'M73 79 L137 79 L147 188 L63 188 Z' }],
  ['arm_left_front', 'path', { d: 'M70 82 L47 89 L17 209 L34 214 L76 117 Z' }],
  ['arm_right_front', 'path', { d: 'M140 82 L163 89 L193 209 L176 214 L134 117 Z' }],
  ['leg_left_front', 'path', { d: 'M65 193 L100 193 L100 340 L78 356 L60 353 Z' }],
  ['leg_right_front', 'path', { d: 'M110 193 L145 193 L150 353 L132 356 L110 340 Z' }],
  ['perineum', 'path', { d: 'M100 193 L110 193 L105 222 Z' }],
]
const backs = [
  ['head_back', 'circle', { cx: 105, cy: 40, r: 27 }],
  ['trunk_back', 'path', { d: 'M73 79 L137 79 L144 162 L66 162 Z' }],
  ['buttocks', 'path', { d: 'M66 166 L144 166 L147 188 L63 188 Z' }],
  ['arm_left_back', 'path', { d: 'M70 82 L47 89 L17 209 L34 214 L76 117 Z' }],
  ['arm_right_back', 'path', { d: 'M140 82 L163 89 L193 209 L176 214 L134 117 Z' }],
  ['leg_left_back', 'path', { d: 'M65 193 L100 193 L100 340 L78 356 L60 353 Z' }],
  ['leg_right_back', 'path', { d: 'M110 193 L145 193 L150 353 L132 356 L110 340 Z' }],
]

function MapFigure({ title, defs, chosen, toggle }) {
  return <div className="body-map-card">
    <h4>{title}</h4>
    <svg viewBox="0 0 210 370" aria-label={`${title} interactive body map`} role="group">
      {defs.map(([key, shape, attrs]) => React.createElement(shape, {
        key, ...attrs, className: `body-zone ${chosen.includes(key) ? 'selected' : ''}`,
        role: 'button', tabIndex: 0, 'aria-label': names[key],
        'aria-pressed': chosen.includes(key),
        onClick: () => toggle(key),
        onKeyDown: event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); toggle(key) } },
      }))}
    </svg>
    <small>Click a region to select or deselect</small>
  </div>
}

export default function BodyMap({ chosen, setChosen }) {
  const toggle = key => setChosen(current => current.includes(key) ? current.filter(x => x !== key) : [...current, key])
  return <div>
    <div className="body-maps"><MapFigure title="Front view" defs={fronts} chosen={chosen} toggle={toggle}/><MapFigure title="Back view" defs={backs} chosen={chosen} toggle={toggle}/></div>
    <div className="chips" aria-live="polite">{chosen.length ? chosen.map(x => <span key={x} className="chip">{names[x]} <button type="button" aria-label={`Remove ${names[x]}`} onClick={() => toggle(x)}>×</button></span>) : <small>No regions selected yet</small>}</div>
  </div>
}
