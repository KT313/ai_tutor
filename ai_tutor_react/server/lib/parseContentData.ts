/**
 * Extract a CONTENT_DATA JSON array from a Gemini model response.
 *
 * The model typically outputs something like:
 *   ```javascript
 *   const CONTENT_DATA = [ { ... }, ... ]
 *   ```
 *
 * We need to extract just the array part.
 */
export function parseContentData(text: string): unknown[] {
  console.log(`[parse] Attempting to extract CONTENT_DATA from ${text.length} chars of model output`);
  console.debug(`[parse] First 300 chars: ${text.slice(0, 300)}`);
  console.debug(`[parse] Last 300 chars: ...${text.slice(-300)}`);

  // Strategy 1: Find "CONTENT_DATA" followed by "=" and extract the array
  const cdMatch = text.match(/CONTENT_DATA\s*=\s*(\[[\s\S]*\])\s*;?\s*$/m);
  if (cdMatch) {
    console.log(`[parse] Strategy 1: Found CONTENT_DATA assignment (${cdMatch[1].length} chars)`);
    const parsed = tryParseArray(cdMatch[1]);
    if (parsed) {
      console.log(`[parse] Strategy 1 SUCCESS: parsed ${parsed.length} cards`);
      return parsed;
    }
    console.log(`[parse] Strategy 1: regex matched but JSON parse failed`);
  } else {
    console.log(`[parse] Strategy 1: no CONTENT_DATA assignment found`);
  }

  // Strategy 2: Find a JSON array inside a code fence
  const fenceMatch = text.match(/```(?:json|javascript|js)?\s*\n([\s\S]*?)```/);
  if (fenceMatch) {
    const inner = fenceMatch[1].trim();
    console.log(`[parse] Strategy 2: Found code fence (${inner.length} chars)`);
    console.debug(`[parse] Code fence preview: ${inner.slice(0, 200)}...`);

    // If the code fence contains "CONTENT_DATA = [...]", extract just the array
    const innerCd = inner.match(/CONTENT_DATA\s*=\s*(\[[\s\S]*\])\s*;?\s*$/m);
    if (innerCd) {
      console.log(`[parse] Strategy 2a: CONTENT_DATA inside fence (${innerCd[1].length} chars)`);
      const parsed = tryParseArray(innerCd[1]);
      if (parsed) {
        console.log(`[parse] Strategy 2a SUCCESS: parsed ${parsed.length} cards`);
        return parsed;
      }
      console.log(`[parse] Strategy 2a: regex matched but JSON parse failed`);
    }

    // Otherwise try parsing the whole fence content as an array
    const parsed = tryParseArray(inner);
    if (parsed) {
      console.log(`[parse] Strategy 2b SUCCESS: parsed fence as array, ${parsed.length} cards`);
      return parsed;
    }
    console.log(`[parse] Strategy 2b: fence content is not a valid JSON array`);
  } else {
    console.log(`[parse] Strategy 2: no code fence found`);
  }

  // Strategy 3: Find the largest JSON array in the text using bracket matching
  console.log(`[parse] Strategy 3: Scanning for largest bracket-matched array...`);
  const arr = extractLargestArray(text);
  if (arr) {
    console.log(`[parse] Strategy 3 SUCCESS: found array with ${arr.length} cards`);
    return arr;
  }
  console.log(`[parse] Strategy 3: no valid JSON array found`);

  console.error(`[parse] ALL STRATEGIES FAILED. Full model output:\n${text}`);
  throw new Error('Could not extract CONTENT_DATA from model response.');
}

function tryParseArray(str: string): unknown[] | null {
  try {
    // Clean up: remove JS comments, trailing commas
    const cleaned = str
      .replace(/\/\/[^\n]*/g, '')      // remove single-line comments
      .replace(/,\s*([}\]])/g, '$1');  // remove trailing commas
    const result = JSON.parse(cleaned);
    if (Array.isArray(result)) return result;
    console.debug(`[parse] tryParseArray: parsed OK but not an array (type: ${typeof result})`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.debug(`[parse] tryParseArray: JSON.parse failed — ${msg}`);
    console.debug(`[parse] tryParseArray: input preview (first 200 chars): ${str.slice(0, 200)}`);
  }
  return null;
}

/**
 * Use bracket matching to find the largest top-level [...] in the text.
 */
function extractLargestArray(text: string): unknown[] | null {
  let best: unknown[] | null = null;
  let bestLen = 0;

  for (let i = 0; i < text.length; i++) {
    if (text[i] !== '[') continue;

    let depth = 0;
    let inString = false;
    let escaped = false;

    for (let j = i; j < text.length; j++) {
      const ch = text[j];

      if (escaped) {
        escaped = false;
        continue;
      }
      if (ch === '\\' && inString) {
        escaped = true;
        continue;
      }
      if (ch === '"') {
        inString = !inString;
        continue;
      }
      if (inString) continue;

      if (ch === '[') depth++;
      else if (ch === ']') {
        depth--;
        if (depth === 0) {
          const slice = text.slice(i, j + 1);
          if (slice.length > bestLen) {
            const parsed = tryParseArray(slice);
            if (parsed) {
              best = parsed;
              bestLen = slice.length;
            }
          }
          break;
        }
      }
    }
  }

  return best;
}
