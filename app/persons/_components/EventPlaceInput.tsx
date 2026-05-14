"use client";

import { useState } from "react";
import { Label } from "@/components/ui/label";
import { COUNTRIES, DEFAULT_COUNTRY_CODE } from "@/lib/countries";
import { PlaceAutocomplete } from "./PlaceAutocomplete";

/**
 * Country dropdown + commune autocomplete combined.
 * The country selection both filters the autocomplete (countrycodes param
 * on Nominatim) and, if no suggestion is picked, supplies the country name
 * for a free-text Place. Suggestion-picked country always wins server-side.
 */
export function EventPlaceInput({
  fieldPrefix,
  defaultPlaceText = "",
  defaultCountryCode = DEFAULT_COUNTRY_CODE,
}: {
  fieldPrefix: string;
  defaultPlaceText?: string;
  defaultCountryCode?: string;
}) {
  const [countryCode, setCountryCode] = useState(defaultCountryCode);

  return (
    <div className="grid grid-cols-3 gap-3">
      <div className="space-y-1.5">
        <Label htmlFor={`${fieldPrefix}.placeCountryCode`}>Pays</Label>
        <select
          id={`${fieldPrefix}.placeCountryCode`}
          name={`${fieldPrefix}.placeCountryCode`}
          value={countryCode}
          onChange={(e) => setCountryCode(e.target.value)}
          className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs"
        >
          {COUNTRIES.map((c) => (
            <option key={c.code} value={c.code}>
              {c.name}
            </option>
          ))}
        </select>
      </div>
      <div className="col-span-2 space-y-1.5">
        <Label>Commune</Label>
        <PlaceAutocomplete
          fieldPrefix={fieldPrefix}
          defaultValue={defaultPlaceText}
          countryCode={countryCode}
        />
      </div>
    </div>
  );
}
