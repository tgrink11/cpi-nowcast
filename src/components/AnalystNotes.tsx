import type { NowcastOutput } from '../types/cpiNowcast';

interface Props {
  nowcast: NowcastOutput;
}

/**
 * Generates contextual analyst notes based on the automated model's signals.
 * Highlights key risks, divergences, and data caveats.
 */
function generateNotes(nowcast: NowcastOutput): string[] {
  const notes: string[] = [];
  const { baseEffects, commodityInputs, rateOfChange, phase } = nowcast;

  // Energy shock detection
  const brentYoY = commodityInputs.brentCrudeYoY;
  if (brentYoY != null && Math.abs(brentYoY) > 20) {
    if (brentYoY > 20) {
      notes.push(
        `Energy shock: Brent crude is up ${brentYoY.toFixed(0)}% YoY. ` +
        `Energy is ~7.5% of the CPI basket — this alone could add ~${(brentYoY * 0.075).toFixed(1)}pp to headline CPI. ` +
        `The headline re-acceleration is primarily an energy story; watch for core vs headline divergence.`
      );
    } else {
      notes.push(
        `Energy deflation: Brent crude is down ${Math.abs(brentYoY).toFixed(0)}% YoY, ` +
        `providing a significant tailwind for headline disinflation.`
      );
    }
  }

  // Base effect + commodity divergence
  if (!rateOfChange.momentumAligned) {
    notes.push(
      `Signal divergence: ${rateOfChange.baseAndCommodityAgreement}. ` +
      `When base effects and commodities conflict, the commodity signal typically dominates in the near term (1-2 months).`
    );
  }

  // Inflection point signal
  if (baseEffects.inflectionSignal !== 'none') {
    notes.push(
      `Base effect inflection: The 2-year base effect first difference has turned ${baseEffects.inflectionSignal}. ` +
      `This signal historically predicts CPI directional turns ~70% of the time.`
    );
  }

  // Phase transition context
  if (phase.phase === 3) {
    notes.push(
      `Stagflation regime (Phase 3): Growth decelerating while inflation accelerates. ` +
      `This is historically the most challenging environment for traditional 60/40 portfolios. ` +
      `Consider: commodities, gold, TIPS, cash, and defensive equities.`
    );
  } else if (phase.phase === 1) {
    notes.push(
      `Goldilocks regime (Phase 1): Growth accelerating, inflation decelerating — ideal conditions. ` +
      `Historically favors growth equities, long-duration bonds, and risk assets.`
    );
  }

  // Food price context
  const foodYoY = commodityInputs.faoFoodPriceYoY;
  if (foodYoY != null) {
    if (foodYoY > 5) {
      notes.push(
        `Food inflation pressure: FAO Food Index up ${foodYoY.toFixed(1)}% YoY. ` +
        `Food is ~13.5% of CPI — this adds upward pressure beyond energy.`
      );
    } else if (foodYoY < -3) {
      notes.push(
        `Food disinflation: FAO Food Index down ${Math.abs(foodYoY).toFixed(1)}% YoY. ` +
        `This partially offsets energy-driven headline acceleration.`
      );
    }
  }

  // Confidence caveat
  if (nowcast.confidence === 'low') {
    notes.push(
      `Low confidence: Signals are mixed or volatile. The range of outcomes is wider than usual. ` +
      `Consider both the bull and bear cases for inflation before positioning.`
    );
  }

  // If no specific notes, add a general summary
  if (notes.length === 0) {
    notes.push(
      `Signals are broadly aligned. The model estimates CPI YoY at ${nowcast.nowcastCpiYoY.toFixed(1)}% ` +
      `with ${nowcast.confidence} confidence. Base effects are ${baseEffects.baseClassification} ` +
      `and commodity signals are ${commodityInputs.signalDirection}.`
    );
  }

  return notes;
}

export function AnalystNotes({ nowcast }: Props) {
  const notes = generateNotes(nowcast);

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
      <h3 className="text-lg font-semibold text-slate-900 mb-3">
        Analyst Notes
      </h3>
      <div className="space-y-3">
        {notes.map((note, i) => (
          <div
            key={i}
            className="flex gap-3 text-sm text-slate-700 bg-slate-50 rounded-lg p-3"
          >
            <span className="text-amber-500 font-bold text-lg leading-5 shrink-0">
              {'\u25B8'}
            </span>
            <p>{note}</p>
          </div>
        ))}
      </div>
      <p className="text-xs text-slate-400 mt-3">
        Auto-generated from model signals. For deeper analysis, supplement with
        real-time geopolitical context and consensus forecasts.
      </p>
    </div>
  );
}
