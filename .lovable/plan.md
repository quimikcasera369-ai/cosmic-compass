

# Fix AccelerationExplorer & PredictionsExplorer

## Summary
Fix the two broken simulation graphs by ensuring field equilibration converges properly and rendering handles edge cases. Add NaN/Infinity guards throughout.

## Changes

### 1. `src/lib/kfield-physics.ts` — Add `stepToEquilibrium` helper
- New method on `RadialKField`: iterates `step()` in a loop until `max(|Kdot|) < threshold` or `iter >= maxIter`
- Add `isFinite` clamping inside the `step()` method for both `K` and `Kdot` arrays to prevent NaN propagation

### 2. `src/components/AccelerationExplorer.tsx` — Fix equilibration & rendering
- Replace fixed iteration loop with `while (!converged && iter < maxIter) { field.step(dt, density); }` using convergence check on `max(|Kdot|)`
- Guard all canvas draw values with `isFinite()` — replace non-finite with 0
- Fix log-scale rendering: skip points where acceleration ≤ 0, fall back to linear if log range is degenerate
- Replace slope-ratio transition detection with direct `g_crit` comparison on the acceleration profile

### 3. `src/components/PredictionsExplorer.tsx` — Fix velocity profiles & BTFR
- Same convergence-based equilibration loop for both z=0 and z>redshift fields
- Guard `Math.sqrt(β * r * |gradK|)` — if argument is negative or non-finite, clamp to 0
- Wire BTFR shift display to actual computed velocity ratio instead of hardcoded formula
- Add `isFinite` guards before all canvas drawing calls

### 4. Robustness pattern applied everywhere
```
if (!isFinite(value)) value = 0;
```
Applied to: field step outputs, gradient computations, velocity calculations, canvas coordinates.

