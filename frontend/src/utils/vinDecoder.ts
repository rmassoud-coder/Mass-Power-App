export interface VinDecodeResult {
  vin: string;
  make?: string;
  model?: string;
  year?: string;
  offline?: boolean;
  error?: string;
}

// Try to decode VIN using NHTSA API. Gracefully handles offline state.
export async function decodeVin(vin: string): Promise<VinDecodeResult> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    const response = await fetch(
      `https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVin/${encodeURIComponent(vin)}?format=json`,
      { signal: controller.signal }
    );

    clearTimeout(timeoutId);

    if (!response.ok) {
      return { vin, offline: true };
    }

    const data = await response.json();
    if (!data.Results) {
      return { vin, error: 'Could not decode VIN' };
    }

    const find = (variable: string) =>
      data.Results.find((r: any) => r.Variable === variable && r.Value)?.Value || undefined;

    return {
      vin,
      make: find('Make'),
      model: find('Model'),
      year: find('Model Year'),
    };
  } catch (e: any) {
    // Network error - offline mode
    return { vin, offline: true };
  }
}
